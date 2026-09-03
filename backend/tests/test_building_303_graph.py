from conftest import TestingSessionLocal

from scripts.seed_building_303 import load_dataset, seed_building_303


DESTINATIONS = [
    "303-103",
    "303-104",
    "303-148/1",
    "303-153/1",
    "303-153/2",
    "303-155/1",
    "303-155/2",
]


def seed_review_graph():
    db = TestingSessionLocal()
    result = seed_building_303(db)
    db.commit()
    db.close()
    return result


def test_building_303_dataset_is_structurally_valid():
    dataset = load_dataset()

    assert dataset["dataset_status"] == "glb_projection_matched_unverified"
    assert [item["code"] for item in dataset["destinations"]] == DESTINATIONS
    destination = next(
        item for item in dataset["destinations"] if item["code"] == "303-153/1"
    )
    assert len(destination["doors"]) == 2
    assert len(dataset["pending_connections"]) == 2


def test_building_303_seed_is_idempotent_and_searchable(client):
    first = seed_review_graph()
    second = seed_review_graph()

    assert len(first["locations"]) == len(second["locations"])
    assert len(first["destinations"]) == len(second["destinations"]) == 7

    response = client.get(
        "/navigation/destinations",
        params={"building": "303", "q": "chem lab"},
    )
    assert response.status_code == 200
    assert [item["code"] for item in response.json()] == ["303-103", "303-104"]


def test_confirmed_ground_clusters_route_to_every_destination(client):
    seed_review_graph()

    for start in ("303-G-ENTRANCE-B", "303-G-ENTRANCE-C", "303-G-ENTRANCE-D"):
        for destination in DESTINATIONS:
            response = client.get(
                "/navigation/route",
                params={"start": start, "destination": destination},
            )
            assert response.status_code == 200, (start, destination, response.json())
            body = response.json()
            assert body["start"]["code"] == start
            assert body["destination"]["code"] == destination
            assert body["total_distance_m"] > 0
            assert any(
                item["location_type"] in {"stairs", "elevator"}
                for item in body["locations"]
            )


def test_accessible_routes_from_east_ground_cluster_use_elevator(client):
    seed_review_graph()

    for start in ("303-G-ENTRANCE-C", "303-G-ENTRANCE-D"):
        for destination in DESTINATIONS:
            response = client.get(
                "/navigation/route",
                params={
                    "start": start,
                    "destination": destination,
                    "accessible_only": True,
                },
            )
            assert response.status_code == 200, (start, destination, response.json())
            locations = response.json()["locations"]
            assert any(item["location_type"] == "elevator" for item in locations)
            assert all(item["location_type"] != "stairs" for item in locations)


def test_unscanned_ground_connections_are_not_silently_routable(client):
    seed_review_graph()

    for start in ("303-G-ENTRANCE-A", "303-G-ENTRANCE-2A"):
        response = client.get(
            "/navigation/route",
            params={"start": start, "destination": "303-103"},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "No route found"

    accessible_from_b = client.get(
        "/navigation/route",
        params={
            "start": "303-G-ENTRANCE-B",
            "destination": "303-103",
            "accessible_only": True,
        },
    )
    assert accessible_from_b.status_code == 404
    assert accessible_from_b.json()["detail"] == "No accessible route found"

    legacy_entrance_a_qr = client.get(
        "/navigation/route",
        params={"start": "303-G-ENTRANCE", "destination": "303-103"},
    )
    assert legacy_entrance_a_qr.status_code == 404
    assert legacy_entrance_a_qr.json()["detail"] == "No route found"


def test_multi_door_destination_selects_the_closest_reachable_door(client):
    seed_review_graph()

    from_north = client.get(
        "/navigation/route",
        params={
            "start": "303-G-ENTRANCE-B",
            "destination": "303-153/1",
        },
    )
    from_south = client.get(
        "/navigation/route",
        params={
            "start": "303-G-ENTRANCE-C",
            "destination": "303-153/1",
        },
    )

    assert from_north.status_code == 200
    assert from_south.status_code == 200
    assert from_north.json()["arrival_door"]["code"] == "303-1-153-1-DOOR-A"
    assert from_south.json()["arrival_door"]["code"] == "303-1-153-1-DOOR-B"
