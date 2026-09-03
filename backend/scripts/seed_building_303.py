"""Validate and seed the reviewed Building 303 navigation dataset.

The source JSON contains only lightweight graph data. Coordinates use each
source GLB's independent X/Z metric coordinate system; the database's existing
``x`` and ``y`` fields store those X and Z values respectively.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from app.database import SessionLocal, engine
from app.models import (
    Base,
    Building,
    BuildingFloor,
    Campus,
    WayfindingDestination,
    WayfindingEdge,
    WayfindingLocation,
)


DATA_FILE = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "data"
    / "wayfinding"
    / "building_303.json"
)


def load_dataset(path: Path = DATA_FILE) -> dict:
    dataset = json.loads(path.read_text(encoding="utf-8"))
    validate_dataset(dataset)
    return dataset


def validate_dataset(dataset: dict) -> None:
    if dataset.get("schema_version") != 1:
        raise ValueError("Unsupported Building 303 dataset schema")

    floor_keys = {floor["key"] for floor in dataset["floors"]}
    coordinate_systems = dataset["coordinate_systems"]
    if floor_keys != set(coordinate_systems):
        raise ValueError("Every floor needs exactly one coordinate system")
    node_codes = [node["code"] for node in dataset["nodes"]]
    if len(node_codes) != len(set(node_codes)):
        raise ValueError("Navigation node codes must be unique")
    nodes = {node["code"]: node for node in dataset["nodes"]}

    destination_codes = [item["code"] for item in dataset["destinations"]]
    if len(destination_codes) != len(set(destination_codes)):
        raise ValueError("Destination codes must be unique")

    for node in nodes.values():
        if node["floor"] not in floor_keys:
            raise ValueError(f"Unknown floor for node {node['code']}")
        if not all(math.isfinite(float(node[field])) for field in ("x", "z")):
            raise ValueError(f"Non-finite coordinate for node {node['code']}")
        source_bounds = coordinate_systems[node["floor"]]["bounds_m"]
        if not (
            source_bounds["x"][0] <= node["x"] <= source_bounds["x"][1]
            and source_bounds["z"][0] <= node["z"] <= source_bounds["z"][1]
        ):
            raise ValueError(f"Node {node['code']} is outside its source GLB bounds")
        if node["type"] == "stairs" and node["accessible"]:
            raise ValueError(f"Stairs node {node['code']} cannot be accessible")

    seen_edges: set[frozenset[str]] = set()
    for edge in dataset["edges"]:
        start = nodes.get(edge["from"])
        end = nodes.get(edge["to"])
        if start is None or end is None:
            raise ValueError(
                f"Unknown node in edge {edge['from']} -> {edge['to']}"
            )
        edge_key = frozenset((edge["from"], edge["to"]))
        if edge_key in seen_edges:
            raise ValueError(
                f"Duplicate bidirectional edge {edge['from']} -> {edge['to']}"
            )
        seen_edges.add(edge_key)
        if start["floor"] != end["floor"]:
            if edge["type"] not in {"stairs", "elevator"}:
                raise ValueError("Cross-floor edges must be stairs or elevator edges")
            if float(edge.get("distance_m", 0)) <= 0:
                raise ValueError("Cross-floor edges need a non-zero explicit distance")

    for destination in dataset["destinations"]:
        if destination["floor"] not in floor_keys:
            raise ValueError(f"Unknown floor for {destination['code']}")
        if not destination["doors"]:
            raise ValueError(f"Destination {destination['code']} has no door")
        for door_code in destination["doors"]:
            door = nodes.get(door_code)
            if door is None:
                raise ValueError(
                    f"Unknown door {door_code} for {destination['code']}"
                )
            if door["type"] != "door" or door["floor"] != destination["floor"]:
                raise ValueError(
                    f"Invalid door {door_code} for {destination['code']}"
                )

    for connection in dataset.get("pending_connections", []):
        if connection["from"] not in nodes or connection["to"] not in nodes:
            raise ValueError("Pending connections must reference known nodes")
        edge_key = frozenset((connection["from"], connection["to"]))
        if edge_key in seen_edges:
            raise ValueError("A pending connection must not also be an active edge")


def upsert(db, model, lookup: dict, values: dict):
    item = db.query(model).filter_by(**lookup).first()
    if item is None:
        item = model(**lookup)
        db.add(item)
    for field, value in values.items():
        setattr(item, field, value)
    db.flush()
    return item


def _edge_distance(start: dict, end: dict, edge: dict) -> float:
    if "distance_m" in edge:
        return round(float(edge["distance_m"]), 2)
    if start["floor"] != end["floor"]:
        raise ValueError("Cross-floor edge is missing distance_m")
    return round(math.hypot(end["x"] - start["x"], end["z"] - start["z"]), 2)


def seed_building_303(db, dataset: dict | None = None) -> dict:
    dataset = dataset or load_dataset()
    validate_dataset(dataset)
    building_data = dataset["building"]

    campus = upsert(
        db,
        Campus,
        {"code": building_data["campus_code"]},
        {
            "name": "City Campus",
            "description": "University of Auckland City Campus.",
            "address": "Auckland CBD",
            "official_map_url": "https://maps.auckland.ac.nz",
            "active": True,
        },
    )
    building = upsert(
        db,
        Building,
        {"campus_id": campus.id, "number": building_data["number"]},
        {
            "name": building_data["name"],
            "address": building_data["address"],
            "description": (
                "Building 303 navigation graph derived from supplied LiDAR scans; "
                "physical walkthrough verification is still required."
            ),
            "accessible": building_data["accessible"],
            "data_status": "unverified",
            "official_url": "https://maps.auckland.ac.nz",
        },
    )

    floors = {}
    for floor_data in dataset["floors"]:
        floors[floor_data["key"]] = upsert(
            db,
            BuildingFloor,
            {"building_id": building.id, "level": floor_data["level"]},
            {
                "label": floor_data["label"],
                "name": floor_data["label"],
                "sort_order": floor_data["sort_order"],
                "data_status": "unverified",
            },
        )

    locations = {}
    source_nodes = {node["code"]: node for node in dataset["nodes"]}
    for node in dataset["nodes"]:
        notes = ["Coordinates: source GLB X/Z metres."]
        if node.get("qr_checkpoint"):
            notes.append("QR checkpoint candidate; heading is not yet surveyed.")
        if node.get("review_note"):
            notes.append(node["review_note"])
        locations[node["code"]] = upsert(
            db,
            WayfindingLocation,
            {"code": node["code"]},
            {
                "campus_id": campus.id,
                "building_id": building.id,
                "floor_id": floors[node["floor"]].id,
                "name": node["name"],
                "location_type": node["type"],
                "description": " ".join(notes),
                "x": node["x"],
                "y": node["z"],
                "accessible": node["accessible"],
                "verified": node["verified"],
            },
        )

    for edge in dataset["edges"]:
        start = locations[edge["from"]]
        end = locations[edge["to"]]
        source_start = source_nodes[edge["from"]]
        source_end = source_nodes[edge["to"]]
        upsert(
            db,
            WayfindingEdge,
            {"from_location_id": start.id, "to_location_id": end.id},
            {
                "distance_m": _edge_distance(source_start, source_end, edge),
                "instruction": edge.get("instruction")
                or f"Continue to {end.name}.",
                "accessible": edge["accessible"],
                "bidirectional": True,
            },
        )

    destinations = {}
    for destination_data in dataset["destinations"]:
        destination = upsert(
            db,
            WayfindingDestination,
            {"code": destination_data["code"]},
            {
                "building_id": building.id,
                "floor_id": floors[destination_data["floor"]].id,
                "name": destination_data["name"],
                "category": destination_data["category"],
                "search_terms": destination_data["search_terms"],
                "accessible": destination_data["accessible"],
                "verified": destination_data["verified"],
            },
        )
        destination.doors = [
            locations[door_code] for door_code in destination_data["doors"]
        ]
        destinations[destination.code] = destination

    db.flush()
    return {
        "building": building,
        "floors": floors,
        "locations": locations,
        "destinations": destinations,
        "active_edge_count": len(dataset["edges"]),
        "pending_connections": dataset.get("pending_connections", []),
    }


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        result = seed_building_303(db)
        db.commit()
        print(
            f"Seeded Building 303 with {len(result['locations'])} graph nodes, "
            f"{result['active_edge_count']} active edges, and "
            f"{len(result['destinations'])} destinations."
        )
        print(
            f"Withheld {len(result['pending_connections'])} Ground-floor "
            "connections pending a physical walkthrough."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
