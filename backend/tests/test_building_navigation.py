from fastapi.testclient import TestClient

from conftest import TestingSessionLocal
from test_wayfinding import seed_test_map

from app.main import app
from app.models import Building, Campus
from app.services.building_navigation import compass_direction, haversine_m
from scripts.seed_campus_buildings import seed_campus_buildings


client = TestClient(app)


def seed_navigation_map():
    seed_test_map()
    db = TestingSessionLocal()
    seed_campus_buildings(db)
    db.commit()
    db.close()


def building_ids():
    response = client.get("/navigation/buildings")
    assert response.status_code == 200
    return {item["number"]: item["id"] for item in response.json()}


def route(start, end, **params):
    ids = building_ids()
    return client.get(
        "/navigation/building-route",
        params={"from": ids[start], "to": ids[end], **params},
    )


def test_lists_buildings_across_campuses_with_maps_queries():
    seed_navigation_map()
    buildings = client.get("/navigation/buildings").json()
    numbers = {item["number"] for item in buildings}
    assert {"303", "260", "505", "101", "315", "401"} <= numbers
    glenn = next(item for item in buildings if item["number"] == "260")
    assert glenn["campus_name"] == "City Campus"
    assert glenn["maps_query"] == "Owen G Glenn Building, 12 Grafton Road, Auckland"


def test_building_search_matches_name_number_and_campus():
    seed_navigation_map()
    assert [b["number"] for b in client.get("/navigation/buildings", params={"q": "kate"}).json()] == ["315"]
    assert [b["number"] for b in client.get("/navigation/buildings", params={"q": "260"}).json()] == ["260"]
    assert {b["number"] for b in client.get("/navigation/buildings", params={"q": "grafton campus"}).json()} == {"505"}


def test_route_uses_campus_graph_when_both_buildings_are_connected():
    seed_navigation_map()
    response = route("303", "260")
    assert response.status_code == 200
    body = response.json()
    assert body["route_source"] == "campus_graph"
    assert body["same_campus"] is True
    assert body["recommended_mode"] == "walk"
    assert body["total_distance_m"] == 225
    assert body["estimated_minutes"] == 3
    assert body["steps"][-1]["instruction"] == "Arrive at Owen G Glenn Building."
    assert body["from_building"]["number"] == "303"
    assert len(body["path"]) == 2  # The central walkway node has no GPS point.


def test_route_falls_back_to_labelled_estimate_without_graph_connection():
    seed_navigation_map()
    body = route("303", "401").json()
    assert body["route_source"] == "estimate"
    straight = haversine_m(-36.8523, 174.7685, -36.8524, 174.7707)
    assert body["total_distance_m"] == round(straight * 1.3, 1)
    assert [step["instruction"].split()[0] for step in body["steps"]] == ["Leave", "Head", "Arrive"]
    assert "Head east" in body["steps"][1]["instruction"]
    assert "20 Symonds Street" in body["steps"][1]["instruction"]
    assert "estimated" in body["data_notice"]
    assert "approximate" in body["data_notice"]


def test_cross_campus_route_suggests_public_transport():
    seed_navigation_map()
    body = route("303", "505").json()
    assert body["same_campus"] is False
    assert body["recommended_mode"] == "transit"


def test_rejects_same_building_and_unknown_buildings():
    seed_navigation_map()
    ids = building_ids()
    same = client.get("/navigation/building-route", params={"from": ids["303"], "to": ids["303"]})
    assert same.status_code == 422
    assert same.json()["detail"] == "Choose two different buildings"
    missing = client.get("/navigation/building-route", params={"from": ids["303"], "to": 99999})
    assert missing.status_code == 404


def test_step_free_route_requires_accessible_buildings():
    seed_navigation_map()
    db = TestingSessionLocal()
    db.query(Building).filter(Building.number == "401").one().accessible = False
    db.commit()
    db.close()
    response = route("303", "401", accessible_only=True)
    assert response.status_code == 422
    accessible = route("303", "315", accessible_only=True)
    assert accessible.status_code == 404
    assert 'No step-free route' in accessible.json()['detail']
    mapped = route('303', '260', accessible_only=True)
    assert mapped.status_code == 200
    assert mapped.json()['route_source'] == 'campus_graph'


def test_building_seed_is_idempotent_and_keeps_existing_records():
    seed_navigation_map()
    db = TestingSessionLocal()
    assert seed_campus_buildings(db) == 0
    science = db.query(Building).filter(Building.number == "303").one()
    assert science.name == "Science Centre"
    assert science.data_status == "demo"
    db.close()


def test_building_seed_never_overwrites_or_reactivates_existing_campuses():
    seed_navigation_map()
    db = TestingSessionLocal()
    city = db.query(Campus).filter(Campus.code == 'CITY').one()
    city.name = 'Curated campus name'
    city.address = 'Curated address'
    city.active = False
    db.commit()
    assert seed_campus_buildings(db) == 0
    db.commit()
    db.refresh(city)
    assert (city.name, city.address, city.active) == ('Curated campus name', 'Curated address', False)
    db.close()


def test_compass_direction():
    assert compass_direction(-36.85, 174.76, -36.84, 174.76) == "north"
    assert compass_direction(-36.85, 174.76, -36.85, 174.77) == "east"
    assert compass_direction(-36.85, 174.76, -36.86, 174.75) == "south-west"
