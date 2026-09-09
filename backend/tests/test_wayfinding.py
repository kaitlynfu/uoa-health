from conftest import TestingSessionLocal

from app.models import (
    Building,
    BuildingFloor,
    WayfindingDestination,
    WayfindingLocation,
)

from scripts.seed_wayfinding import (
    connect,
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


def seed_multi_door_destination(with_doors=True):
    db = TestingSessionLocal()
    building = db.query(Building).filter(Building.number == "303").one()
    floor = (
        db.query(BuildingFloor)
        .filter(
            BuildingFloor.building_id == building.id,
            BuildingFloor.level == 1,
        )
        .one()
    )
    hall = (
        db.query(WayfindingLocation)
        .filter(WayfindingLocation.code == "303-1-HALL")
        .one()
    )
    destination = WayfindingDestination(
        building=building,
        floor=floor,
        code="303-153/1" if with_doors else "303-155/1",
        name="Population Health tutorial room" if with_doors else "Room 303-155/1",
        category="room",
        search_terms="population health tutorial|tutorial room|153/1",
        accessible=True,
        verified=False,
    )
    if with_doors:
        door_a = WayfindingLocation(
            campus_id=building.campus_id,
            building=building,
            floor=floor,
            code="303-153-1-DOOR-A",
            name="303-153/1 west door",
            location_type="door",
            x=4.0,
            y=1.0,
            accessible=True,
            verified=False,
        )
        door_b = WayfindingLocation(
            campus_id=building.campus_id,
            building=building,
            floor=floor,
            code="303-153-1-DOOR-B",
            name="303-153/1 east door",
            location_type="door",
            x=6.0,
            y=1.0,
            accessible=True,
            verified=False,
        )
        destination.doors.extend([door_a, door_b])
        db.add(destination)
        db.flush()
        connect(db, hall, door_a, 9, "Continue to the west door of 303-153/1.")
        connect(db, hall, door_b, 2, "Continue to the east door of 303-153/1.")
    else:
        db.add(destination)
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


def test_destination_search_and_nearest_door_routing(client):
    seed_test_map()
    seed_multi_door_destination()

    search = client.get(
        "/navigation/destinations",
        params={"building": "303", "q": "population health"},
    )
    assert search.status_code == 200
    assert [item["code"] for item in search.json()] == ["303-153/1"]
    assert [door["code"] for door in search.json()[0]["doors"]] == [
        "303-153-1-DOOR-A",
        "303-153-1-DOOR-B",
    ]

    standard = client.get(
        "/navigation/route",
        params={
            "start": "303_G_ENTRANCE",
            "destination": "303-153/1",
        },
    )
    accessible = client.get(
        "/navigation/route",
        params={
            "start": "303-G-ENTRANCE",
            "destination": "303-153/1",
            "accessible_only": True,
        },
    )

    assert standard.status_code == 200
    assert accessible.status_code == 200
    assert standard.json()["destination"]["code"] == "303-153/1"
    assert standard.json()["arrival_door"]["code"] == "303-153-1-DOOR-B"
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


def test_destination_without_door_nodes_returns_clear_error(client):
    seed_test_map()
    seed_multi_door_destination(with_doors=False)

    response = client.get(
        "/navigation/route",
        params={
            "start": "303-G-ENTRANCE",
            "destination": "303-155/1",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Destination has no configured door nodes"


def test_missing_wayfinding_records_return_clear_errors(client):
    seed_test_map()

    assert client.get("/campuses/99999").status_code == 404
    assert client.get("/buildings/99999").status_code == 404
    response = client.post(
        "/wayfinding/routes",
        json={"start_location_id": 99998, "end_location_id": 99999},
    )
    assert response.status_code == 404
