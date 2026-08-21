from app.database import SessionLocal, engine
from app.models import (
    Base,
    Building,
    BuildingFloor,
    Campus,
    WayfindingEdge,
    WayfindingLocation,
)


OFFICIAL_MAP_URL = "https://maps.auckland.ac.nz"


def upsert(db, model, lookup, values):
    item = db.query(model).filter_by(**lookup).first()
    if item is None:
        item = model(**lookup)
        db.add(item)
    for field, value in values.items():
        setattr(item, field, value)
    db.flush()
    return item


def seed_campuses(db):
    records = [
        ("CITY", "City Campus", "Central Auckland's main teaching campus.", "Auckland CBD"),
        ("GRAFTON", "Grafton Campus", "Home to the Faculty of Medical and Health Sciences and the Liggins Institute.", "85 Park Road, Grafton, Auckland"),
        ("NEWMARKET", "Newmarket Campus", "Research facilities for Engineering, Design and Exercise Sciences.", "Newmarket, Auckland"),
        ("SOUTH", "Te Papa Ako o Tai Tonga", "The University's South Auckland campus.", "Manukau, Auckland"),
        ("TAITOKERAU", "Te Papa Ako o te Tai Tokerau", "The University's campus in Whangārei.", "Whangārei"),
        ("LEIGH", "Leigh Campus", "Marine science research facilities near the Leigh Marine Reserve.", "Leigh, Auckland"),
    ]
    return {
        code: upsert(
            db,
            Campus,
            {"code": code},
            {
                "name": name,
                "description": description,
                "address": address,
                "official_map_url": OFFICIAL_MAP_URL,
                "active": True,
            },
        )
        for code, name, description, address in records
    }


def seed_buildings(db, campuses):
    records = [
        ("CITY", "303", "Science Centre", "38 Princes Street", -36.8523, 174.7685),
        ("CITY", "201", "Building 201", "10 Symonds Street", -36.8515, 174.7697),
        ("CITY", "260", "Owen G Glenn Building", "12 Grafton Road", -36.8538, 174.7705),
        ("GRAFTON", "505", "Grafton Campus Building 505", "85 Park Road", -36.8612, 174.7693),
    ]
    buildings = {}
    for campus_code, number, name, address, latitude, longitude in records:
        building = upsert(
            db,
            Building,
            {"campus_id": campuses[campus_code].id, "number": number},
            {
                "name": name,
                "description": "Representative MVP building record; confirm live details in the official UoA map.",
                "address": address,
                "latitude": latitude,
                "longitude": longitude,
                "accessible": True,
                "data_status": "demo",
                "official_url": OFFICIAL_MAP_URL,
            },
        )
        buildings[number] = building
    return buildings


def seed_science_centre(db, campuses, buildings):
    building = buildings["303"]
    floors = {}
    for level, label, name, order in [
        (0, "Ground floor", "Ground floor", 0),
        (1, "Level 1", "Level 1", 1),
        (2, "Level 2", "Level 2", 2),
    ]:
        floors[level] = upsert(
            db,
            BuildingFloor,
            {"building_id": building.id, "level": level},
            {
                "label": label,
                "name": name,
                "sort_order": order,
                "data_status": "demo",
            },
        )

    locations = {}

    def location(code, name, kind, floor_level, x, y, accessible=True, description=None):
        item = upsert(
            db,
            WayfindingLocation,
            {"code": code},
            {
                "campus_id": campuses["CITY"].id,
                "building_id": building.id,
                "floor_id": floors[floor_level].id,
                "name": name,
                "location_type": kind,
                "description": description or "Demonstration location for the indoor-routing MVP.",
                "x": x,
                "y": y,
                "accessible": accessible,
                "verified": False,
            },
        )
        locations[code] = item
        return item

    location("303-G-ENTRANCE", "Building 303 main entrance", "entrance", 0, 0, 0)
    location("303-G-LOBBY", "Science Centre ground-floor lobby", "corridor", 0, 5, 0)
    location("303-G01", "Room 303-G01 (SLT1)", "lecture_theatre", 0, 10, 2)
    location("303-G20", "Room 303-G20", "room", 0, 11, -3)
    location("303-G-TOILET", "Ground-floor accessible toilet", "toilet", 0, 7, -4)
    location("303-G-LIFT", "Ground-floor elevator", "elevator", 0, 5, 4)
    location("303-G-STAIRS", "Ground-floor stairs", "stairs", 0, 2, 4, False)

    location("303-1-HALL", "Level 1 central corridor", "corridor", 1, 5, 0)
    location("303-101", "Room 303-101 (MLT3)", "lecture_theatre", 1, 11, -2)
    location("303-102", "Room 303-102 (MLT2)", "lecture_theatre", 1, 11, 2)
    location("303-148", "Room 303-148", "room", 1, 13, 0)
    location("303-1-TOILET", "Level 1 accessible toilet", "toilet", 1, 7, -4)
    location("303-1-LIFT", "Level 1 elevator", "elevator", 1, 5, 4)
    location("303-1-STAIRS", "Level 1 stairs", "stairs", 1, 2, 4, False)

    location("303-2-HALL", "Level 2 central corridor", "corridor", 2, 5, 0)
    location("303-201", "Room 303-201", "room", 2, 12, 0)
    location("303-2-LAB", "Level 2 teaching lab", "lab", 2, 12, 3)
    location("303-2-TOILET", "Level 2 accessible toilet", "toilet", 2, 7, -4)
    location("303-2-LIFT", "Level 2 elevator", "elevator", 2, 5, 4)
    location("303-2-STAIRS", "Level 2 stairs", "stairs", 2, 2, 4, False)
    return locations


def seed_outdoor_locations(db, campuses, buildings):
    records = [
        ("CITY-CENTRAL", "City Campus central walkway", "CITY", None, 0, 0),
        ("CITY-303", "Building 303 — Science Centre", "CITY", "303", 50, 20),
        ("CITY-201", "Building 201 entrance", "CITY", "201", 15, 15),
        ("CITY-260", "Building 260 — Owen G Glenn Building", "CITY", "260", 25, -30),
        ("GRAFTON-505", "Building 505 entrance", "GRAFTON", "505", 0, 0),
    ]
    locations = {}
    for code, name, campus_code, building_number, x, y in records:
        building = buildings.get(building_number)
        locations[code] = upsert(
            db,
            WayfindingLocation,
            {"code": code},
            {
                "campus_id": campuses[campus_code].id,
                "building_id": building.id if building else None,
                "floor_id": None,
                "name": name,
                "location_type": "building" if building else "landmark",
                "description": "Demonstration outdoor routing point.",
                "x": x,
                "y": y,
                "latitude": building.latitude if building else None,
                "longitude": building.longitude if building else None,
                "accessible": True,
                "verified": False,
            },
        )
    return locations


def connect(db, start, end, distance, instruction, accessible=True):
    return upsert(
        db,
        WayfindingEdge,
        {"from_location_id": start.id, "to_location_id": end.id},
        {
            "distance_m": distance,
            "instruction": instruction,
            "accessible": accessible,
            "bidirectional": True,
        },
    )


def seed_edges(db, outdoor, indoor):
    connect(db, outdoor["CITY-CENTRAL"], outdoor["CITY-303"], 85, "Follow the central walkway towards Building 303.")
    connect(db, outdoor["CITY-CENTRAL"], outdoor["CITY-201"], 60, "Follow the central walkway towards Building 201.")
    connect(db, outdoor["CITY-CENTRAL"], outdoor["CITY-260"], 140, "Continue towards Grafton Road and Building 260.")
    connect(db, outdoor["CITY-CENTRAL"], outdoor["GRAFTON-505"], 1200, "Follow the outdoor route towards Grafton Campus and Building 505.")
    connect(db, outdoor["CITY-303"], indoor["303-G-ENTRANCE"], 8, "Enter Building 303 through the main entrance.")
    connect(db, indoor["303-G-ENTRANCE"], indoor["303-G-LOBBY"], 6, "Continue into the ground-floor lobby.")
    for code, distance in [("303-G01", 8), ("303-G20", 9), ("303-G-TOILET", 7), ("303-G-LIFT", 5), ("303-G-STAIRS", 4)]:
        connect(db, indoor["303-G-LOBBY"], indoor[code], distance, f"Continue to {indoor[code].name}.", code != "303-G-STAIRS")
    for level in (1, 2):
        hall = indoor[f"303-{level}-HALL"]
        lift = indoor[f"303-{level}-LIFT"]
        stairs = indoor[f"303-{level}-STAIRS"]
        connect(db, lift, hall, 5, f"Exit the elevator and enter the Level {level} corridor.")
        connect(db, stairs, hall, 4, f"Exit the stairs and enter the Level {level} corridor.", False)
    for code, distance in [("303-101", 8), ("303-102", 8), ("303-148", 10), ("303-1-TOILET", 7)]:
        connect(db, indoor["303-1-HALL"], indoor[code], distance, f"Continue to {indoor[code].name}.")
    for code, distance in [("303-201", 9), ("303-2-LAB", 11), ("303-2-TOILET", 7)]:
        connect(db, indoor["303-2-HALL"], indoor[code], distance, f"Continue to {indoor[code].name}.")
    connect(db, indoor["303-G-LIFT"], indoor["303-1-LIFT"], 5, "Take the elevator to Level 1.")
    connect(db, indoor["303-1-LIFT"], indoor["303-2-LIFT"], 5, "Take the elevator to Level 2.")
    connect(db, indoor["303-G-STAIRS"], indoor["303-1-STAIRS"], 4, "Take the stairs to Level 1.", False)
    connect(db, indoor["303-1-STAIRS"], indoor["303-2-STAIRS"], 4, "Take the stairs to Level 2.", False)


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        campuses = seed_campuses(db)
        buildings = seed_buildings(db, campuses)
        indoor = seed_science_centre(db, campuses, buildings)
        outdoor = seed_outdoor_locations(db, campuses, buildings)
        seed_edges(db, outdoor, indoor)
        db.commit()
        print(
            f"Seeded {db.query(Campus).count()} campuses, "
            f"{db.query(Building).count()} buildings, "
            f"{db.query(WayfindingLocation).count()} locations and "
            f"{db.query(WayfindingEdge).count()} route connections."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
