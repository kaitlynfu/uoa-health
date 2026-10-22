"""Building-to-building directions across the campus map.

Routes follow the configured outdoor campus graph when both buildings are
connected to it. Otherwise the route falls back to a clearly labelled
straight-line estimate, and the app hands live turn-by-turn guidance to the
phone's maps app.
"""
from __future__ import annotations

import math

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import Building, Campus, WayfindingLocation
from app.services.wayfinding_service import (
    _estimated_minutes,
    _route_steps,
    _shortest_path,
    escape_like,
)


# Straight lines under-count real walking paths around buildings and streets.
WALKING_DETOUR_FACTOR = 1.3
# Beyond this, walking is still shown but public transport is suggested.
TRANSIT_SUGGESTION_M = 1500
COMPASS_POINTS = [
    "north", "north-east", "east", "south-east",
    "south", "south-west", "west", "north-west",
]


def _building_summary(building: Building):
    campus = building.campus
    query_parts = [building.name]
    if building.address:
        query_parts.append(building.address)
    query_parts.append("Auckland")
    return {
        "id": building.id,
        "number": building.number,
        "name": building.name,
        "campus_id": building.campus_id,
        "campus_name": campus.name,
        "address": building.address,
        "latitude": building.latitude,
        "longitude": building.longitude,
        "accessible": building.accessible,
        "data_status": building.data_status,
        "maps_query": ", ".join(query_parts),
    }


def list_navigation_buildings(db: Session, query: str | None):
    statement = (
        db.query(Building)
        .join(Campus)
        .options(joinedload(Building.campus))
        .filter(Campus.active.is_(True))
    )
    if query:
        pattern = f"%{escape_like(query.strip())}%"
        statement = statement.filter(
            or_(
                Building.name.ilike(pattern, escape="\\"),
                Building.number.ilike(pattern, escape="\\"),
                Building.address.ilike(pattern, escape="\\"),
                Campus.name.ilike(pattern, escape="\\"),
            )
        )
    buildings = statement.order_by(Campus.name, Building.number).all()
    return [_building_summary(building) for building in buildings]


def calculate_building_route(
    db: Session,
    from_building_id: int,
    to_building_id: int,
    accessible_only: bool,
):
    if from_building_id == to_building_id:
        raise HTTPException(status_code=422, detail="Choose two different buildings")
    origin = _get_building(db, from_building_id)
    destination = _get_building(db, to_building_id)
    if accessible_only and (not origin.accessible or not destination.accessible):
        raise HTTPException(
            status_code=422,
            detail="Both buildings must be marked accessible for a step-free route",
        )

    graph_route = _campus_graph_route(db, origin, destination, accessible_only)
    if graph_route is not None:
        distance, steps, path = graph_route
        source = "campus_graph"
    else:
        distance, steps, path = _estimated_route(origin, destination)
        source = "estimate"

    same_campus = origin.campus_id == destination.campus_id
    return {
        "from_building": _building_summary(origin),
        "to_building": _building_summary(destination),
        "same_campus": same_campus,
        "route_source": source,
        "accessible_only": accessible_only,
        "total_distance_m": distance,
        "estimated_minutes": _estimated_minutes(distance),
        "recommended_mode": (
            "transit"
            if not same_campus or distance > TRANSIT_SUGGESTION_M
            else "walk"
        ),
        "steps": steps,
        "path": path,
        "data_notice": _data_notice(source, accessible_only, origin, destination),
    }


def _get_building(db: Session, building_id: int) -> Building:
    building = (
        db.query(Building)
        .options(joinedload(Building.campus))
        .filter(Building.id == building_id)
        .first()
    )
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    return building


def _outdoor_node(db: Session, building: Building):
    return (
        db.query(WayfindingLocation)
        .filter(
            WayfindingLocation.building_id == building.id,
            WayfindingLocation.floor_id.is_(None),
        )
        .order_by(WayfindingLocation.id)
        .first()
    )


def _campus_graph_route(db, origin, destination, accessible_only):
    start = _outdoor_node(db, origin)
    end = _outdoor_node(db, destination)
    if start is None or end is None:
        if accessible_only:
            raise HTTPException(status_code=404,
                                detail="No step-free route found between these buildings")
        return None
    try:
        _, path, path_edges, distance = _shortest_path(
            db, start, {end.id}, accessible_only
        )
    except HTTPException as error:
        # Accessible-only requests must not silently fall back to an
        # unverified straight line; other gaps in the graph can.
        if accessible_only:
            raise HTTPException(
                status_code=404,
                detail="No step-free route found between these buildings",
            ) from error
        return None
    steps = [
        {"instruction": step["instruction"], "distance_m": step["distance_m"]}
        for step in _route_steps(path, path_edges)
    ]
    steps.append({"instruction": f"Arrive at {destination.name}.", "distance_m": 0})
    coordinates = [
        {"latitude": item.latitude, "longitude": item.longitude}
        for item in path
        if item.latitude is not None and item.longitude is not None
    ]
    return distance, steps, coordinates


def _estimated_route(origin: Building, destination: Building):
    if None in (
        origin.latitude, origin.longitude, destination.latitude, destination.longitude
    ):
        raise HTTPException(
            status_code=422,
            detail="One of these buildings has no map location yet",
        )
    straight = haversine_m(
        origin.latitude, origin.longitude, destination.latitude, destination.longitude
    )
    distance = round(straight * WALKING_DETOUR_FACTOR, 1)
    heading = compass_direction(
        origin.latitude, origin.longitude, destination.latitude, destination.longitude
    )
    target = destination.name
    if destination.address:
        target = f"{destination.name} ({destination.address})"
    steps = [
        {"instruction": f"Leave {origin.name} by the nearest exit.", "distance_m": 0},
        {
            "instruction": f"Head {heading} for about {_rounded(distance)} m towards {target}.",
            "distance_m": distance,
        },
        {"instruction": f"Arrive at {destination.name}.", "distance_m": 0},
    ]
    path = [
        {"latitude": origin.latitude, "longitude": origin.longitude},
        {"latitude": destination.latitude, "longitude": destination.longitude},
    ]
    return distance, steps, path


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def compass_direction(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_lambda = math.radians(lon2 - lon1)
    x = math.sin(d_lambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lambda)
    bearing = (math.degrees(math.atan2(x, y)) + 360) % 360
    return COMPASS_POINTS[round(bearing / 45) % 8]


def _rounded(distance: float) -> int:
    step = 10 if distance < 500 else 50
    return max(step, int(round(distance / step) * step))


def _data_notice(source, accessible_only, origin, destination):
    notes = []
    if source == "estimate":
        notes.append(
            "Distance and time are estimated from building locations, not a "
            "mapped footpath. Use Start directions for live turn-by-turn guidance."
        )
    if origin.data_status != "verified" or destination.data_status != "verified":
        notes.append(
            "Building locations are approximate; check the official University "
            "map if anything looks wrong."
        )
    if accessible_only and source == "estimate":
        notes.append("Step-free access along this route has not been verified.")
    return " ".join(notes) or "Route uses the configured campus map."
