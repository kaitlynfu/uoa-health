from conftest import TestingSessionLocal

from scripts.seed_wayfinding import (
    seed_buildings,
    seed_campuses,
    seed_edges,
    seed_outdoor_locations,
    seed_science_centre,
)


def seed_test_map():
    db = TestingSessionLocal()
    campuses = seed_campuses(db)
    buildings = seed_buildings(db, campuses)
    indoor = seed_science_centre(db, campuses, buildings)
    outdoor = seed_outdoor_locations(db, campuses, buildings)
    seed_edges(db, outdoor, indoor)
    db.commit()
    db.close()


def test_browse_search_and_filter_wayfinding_data(client):
    seed_test_map()

    demo = client.get("/demo/wayfinding")
    assert demo.status_code == 200
    assert "Campus & Indoor Wayfinding" in demo.text

    campuses = client.get("/campuses")
    assert campuses.status_code == 200
    assert len(campuses.json()) == 6
    city = next(item for item in campuses.json() if item["code"] == "CITY")

    buildings = client.get(
        f"/campuses/{city['id']}/buildings",
        params={"q": "303"},
    )
    assert buildings.status_code == 200
    assert [item["number"] for item in buildings.json()] == ["303"]
    building = buildings.json()[0]

    floors = client.get(f"/buildings/{building['id']}/floors")
    assert [item["label"] for item in floors.json()] == [
        "Ground floor",
        "Level 1",
        "Level 2",
    ]

    rooms = client.get(
        f"/buildings/{building['id']}/locations",
        params={"location_type": "room", "q": "201"},
    )
    assert rooms.status_code == 200
    assert [item["code"] for item in rooms.json()] == ["303-201"]

    search = client.get("/wayfinding/search", params={"q": "MLT2"})
    assert search.status_code == 200
    assert search.json()[0]["code"] == "303-102"
    assert search.json()[0]["floor_label"] == "Level 1"


def test_route_calculation_and_accessible_alternative(client):
    seed_test_map()
    start = client.get("/wayfinding/search", params={"q": "central walkway"}).json()[0]
    destination = client.get("/wayfinding/search", params={"q": "303-201"}).json()[0]

    standard = client.post(
        "/wayfinding/routes",
        json={
            "start_location_id": start["id"],
            "end_location_id": destination["id"],
            "accessible_only": False,
        },
    )
    accessible = client.post(
        "/wayfinding/routes",
        json={
            "start_location_id": start["id"],
            "end_location_id": destination["id"],
            "accessible_only": True,
        },
    )

    assert standard.status_code == 200
    assert accessible.status_code == 200
    assert standard.json()["destination"]["code"] == "303-201"
    assert any(
        location["location_type"] == "stairs"
        for location in standard.json()["locations"]
    )
    assert all(
        location["location_type"] != "stairs"
        for location in accessible.json()["locations"]
    )
    assert any(
        location["location_type"] == "elevator"
        for location in accessible.json()["locations"]
    )
    assert "demonstration indoor geometry" in accessible.json()["data_notice"]


def test_missing_wayfinding_records_return_clear_errors(client):
    seed_test_map()

    assert client.get("/campuses/99999").status_code == 404
    assert client.get("/buildings/99999").status_code == 404
    response = client.post(
        "/wayfinding/routes",
        json={"start_location_id": 99998, "end_location_id": 99999},
    )
    assert response.status_code == 404
