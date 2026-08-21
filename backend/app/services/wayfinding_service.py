from __future__ import annotations

import heapq
import math

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Building,
    BuildingFloor,
    Campus,
    WayfindingEdge,
    WayfindingLocation,
)


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_campuses(db: Session, query: str | None, include_inactive: bool):
    statement = db.query(Campus)
    if not include_inactive:
        statement = statement.filter(Campus.active.is_(True))
    if query:
        pattern = f"%{escape_like(query.strip())}%"
        statement = statement.filter(
            or_(
                Campus.name.ilike(pattern, escape="\\"),
                Campus.code.ilike(pattern, escape="\\"),
                Campus.address.ilike(pattern, escape="\\"),
            )
        )
    return statement.order_by(Campus.name).all()


def get_campus(db: Session, campus_id: int):
    campus = db.get(Campus, campus_id)
    if campus is None:
        raise HTTPException(status_code=404, detail="Campus not found")
    return campus


def list_buildings(db: Session, campus_id: int, query: str | None):
    get_campus(db, campus_id)
    statement = db.query(Building).filter(Building.campus_id == campus_id)
    if query:
        pattern = f"%{escape_like(query.strip())}%"
        statement = statement.filter(
            or_(
                Building.name.ilike(pattern, escape="\\"),
                Building.number.ilike(pattern, escape="\\"),
                Building.description.ilike(pattern, escape="\\"),
            )
        )
    return statement.order_by(Building.number).all()


def get_building(db: Session, building_id: int):
    building = db.get(Building, building_id)
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    return building


def list_floors(db: Session, building_id: int):
    get_building(db, building_id)
    return (
        db.query(BuildingFloor)
        .filter(BuildingFloor.building_id == building_id)
        .order_by(BuildingFloor.sort_order)
        .all()
    )


def list_locations(
    db: Session,
    building_id: int,
    floor_id: int | None,
    location_type: str | None,
    query: str | None,
    accessible_only: bool,
):
    get_building(db, building_id)
    statement = db.query(WayfindingLocation).filter(
        WayfindingLocation.building_id == building_id
    )
    if floor_id is not None:
        floor = db.get(BuildingFloor, floor_id)
        if floor is None or floor.building_id != building_id:
            raise HTTPException(status_code=404, detail="Floor not found in this building")
        statement = statement.filter(WayfindingLocation.floor_id == floor_id)
    if location_type:
        statement = statement.filter(
            WayfindingLocation.location_type == location_type.strip().lower()
        )
    if accessible_only:
        statement = statement.filter(WayfindingLocation.accessible.is_(True))
    if query:
        pattern = f"%{escape_like(query.strip())}%"
        statement = statement.filter(
            or_(
                WayfindingLocation.name.ilike(pattern, escape="\\"),
                WayfindingLocation.code.ilike(pattern, escape="\\"),
                WayfindingLocation.description.ilike(pattern, escape="\\"),
            )
        )
    return statement.order_by(WayfindingLocation.name).all()


def search_locations(
    db: Session,
    query: str,
    campus_id: int | None,
    location_type: str | None,
    accessible_only: bool,
    limit: int,
):
    pattern = f"%{escape_like(query.strip())}%"
    statement = (
        db.query(WayfindingLocation)
        .options(
            joinedload(WayfindingLocation.campus),
            joinedload(WayfindingLocation.building),
            joinedload(WayfindingLocation.floor),
        )
        .outerjoin(Building, WayfindingLocation.building_id == Building.id)
        .filter(
            or_(
                WayfindingLocation.name.ilike(pattern, escape="\\"),
                WayfindingLocation.code.ilike(pattern, escape="\\"),
                Building.name.ilike(pattern, escape="\\"),
                Building.number.ilike(pattern, escape="\\"),
            )
        )
    )
    if campus_id is not None:
        get_campus(db, campus_id)
        statement = statement.filter(WayfindingLocation.campus_id == campus_id)
    if location_type:
        statement = statement.filter(
            WayfindingLocation.location_type == location_type.strip().lower()
        )
    if accessible_only:
        statement = statement.filter(WayfindingLocation.accessible.is_(True))

    locations = statement.order_by(WayfindingLocation.name).limit(limit).all()
    return [
        {
            "id": location.id,
            "campus_id": location.campus_id,
            "building_id": location.building_id,
            "floor_id": location.floor_id,
            "code": location.code,
            "name": location.name,
            "location_type": location.location_type,
            "description": location.description,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "x": location.x,
            "y": location.y,
            "accessible": location.accessible,
            "verified": location.verified,
            "campus_name": location.campus.name,
            "building_number": location.building.number if location.building else None,
            "building_name": location.building.name if location.building else None,
            "floor_label": location.floor.label if location.floor else None,
        }
        for location in locations
    ]


def calculate_route(
    db: Session,
    start_location_id: int,
    end_location_id: int,
    accessible_only: bool,
):
    start = db.get(WayfindingLocation, start_location_id)
    destination = db.get(WayfindingLocation, end_location_id)
    if start is None or destination is None:
        raise HTTPException(status_code=404, detail="Start or destination not found")
    if accessible_only and (not start.accessible or not destination.accessible):
        raise HTTPException(
            status_code=422,
            detail="Start and destination must both be accessible",
        )
    if start.id == destination.id:
        return {
            "start": start,
            "destination": destination,
            "accessible_only": accessible_only,
            "total_distance_m": 0,
            "estimated_minutes": 0,
            "locations": [start],
            "steps": [],
            "data_notice": _data_notice([start]),
        }

    locations = {item.id: item for item in db.query(WayfindingLocation).all()}
    edges = db.query(WayfindingEdge).all()
    adjacency: dict[int, list[tuple[int, WayfindingEdge]]] = {}
    for edge in edges:
        if accessible_only and not edge.accessible:
            continue
        if accessible_only and (
            not locations[edge.from_location_id].accessible
            or not locations[edge.to_location_id].accessible
        ):
            continue
        adjacency.setdefault(edge.from_location_id, []).append(
            (edge.to_location_id, edge)
        )
        if edge.bidirectional:
            adjacency.setdefault(edge.to_location_id, []).append(
                (edge.from_location_id, edge)
            )

    distances = {start.id: 0.0}
    previous: dict[int, tuple[int, WayfindingEdge]] = {}
    queue = [(0.0, start.id)]
    while queue:
        distance, location_id = heapq.heappop(queue)
        if distance != distances.get(location_id):
            continue
        if location_id == destination.id:
            break
        for neighbour_id, edge in adjacency.get(location_id, []):
            candidate = distance + edge.distance_m
            if candidate < distances.get(neighbour_id, math.inf):
                distances[neighbour_id] = candidate
                previous[neighbour_id] = (location_id, edge)
                heapq.heappush(queue, (candidate, neighbour_id))

    if destination.id not in distances:
        detail = "No accessible route found" if accessible_only else "No route found"
        raise HTTPException(status_code=404, detail=detail)

    path_ids = [destination.id]
    path_edges = []
    while path_ids[-1] != start.id:
        prior_id, edge = previous[path_ids[-1]]
        path_edges.append(edge)
        path_ids.append(prior_id)
    path_ids.reverse()
    path_edges.reverse()
    path = [locations[location_id] for location_id in path_ids]

    steps = []
    for index, edge in enumerate(path_edges):
        from_location = path[index]
        to_location = path[index + 1]
        forward = edge.from_location_id == from_location.id
        instruction = edge.instruction if forward else None
        if not instruction:
            instruction = _fallback_instruction(from_location, to_location)
        steps.append(
            {
                "from_location": from_location,
                "to_location": to_location,
                "instruction": instruction,
                "distance_m": edge.distance_m,
            }
        )

    total_distance = round(distances[destination.id], 1)
    return {
        "start": start,
        "destination": destination,
        "accessible_only": accessible_only,
        "total_distance_m": total_distance,
        "estimated_minutes": max(1, math.ceil(total_distance / 75)),
        "locations": path,
        "steps": steps,
        "data_notice": _data_notice(path),
    }


def _fallback_instruction(from_location, to_location):
    if from_location.floor_id != to_location.floor_id and to_location.floor:
        return f"Continue to {to_location.floor.label} via {to_location.name}."
    return f"Continue to {to_location.name}."


def _data_notice(path):
    if any(not location.verified for location in path):
        return (
            "This route uses demonstration indoor geometry and must not be treated "
            "as an official accessibility or emergency route."
        )
    return "Route locations have been verified against the configured source data."
