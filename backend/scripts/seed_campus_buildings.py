"""Add City Campus buildings for building-to-building directions.

Coordinates are approximate and marked as such; confirm them against the
official University map (https://maps.auckland.ac.nz) before relying on them.
Existing building records are never modified, so this is safe to run after
seed_wayfinding and safe to run repeatedly.
"""
from app.database import SessionLocal, engine
from app.models import Base, Building, Campus
from scripts.seed_wayfinding import OFFICIAL_MAP_URL


BUILDINGS = [
    # (campus code, number, name, address, latitude, longitude)
    ("CITY", "101", "Old Arts Building (Clock Tower)", "22 Princes Street", -36.8508, 174.7689),
    ("CITY", "109", "General Library", "5 Alfred Street", -36.8514, 174.7699),
    ("CITY", "206", "Arts 1", "14A Symonds Street", -36.8515, 174.7710),
    ("CITY", "314", "Student Commons", "2 Alfred Street", -36.8520, 174.7693),
    ("CITY", "315", "Kate Edger Information Commons", "2 Alfred Street", -36.8518, 174.7697),
    ("CITY", "401", "Engineering", "20 Symonds Street", -36.8524, 174.7707),
    ("CITY", "421", "Architecture and Planning", "26 Symonds Street", -36.8531, 174.7708),
    ("CITY", "423", "Conference Centre", "22 Symonds Street", -36.8527, 174.7708),
]


def seed_campus_buildings(db):
    # The general seed overwrites campus names/addresses and reactivates them.
    # This additive seed must preserve all existing campus records as well.
    campus = db.query(Campus).filter(Campus.code == 'CITY').first()
    if campus is None:
        campus = Campus(code='CITY', name='City Campus', address='Auckland CBD',
                        active=True, official_map_url=OFFICIAL_MAP_URL)
        db.add(campus)
        db.flush()
    campuses = {'CITY': campus}
    added = 0
    for campus_code, number, name, address, latitude, longitude in BUILDINGS:
        campus = campuses[campus_code]
        exists = (
            db.query(Building)
            .filter(Building.campus_id == campus.id, Building.number == number)
            .first()
        )
        if exists:
            continue
        db.add(
            Building(
                campus_id=campus.id,
                number=number,
                name=name,
                description=(
                    "Approximate location for building-to-building directions; "
                    "confirm in the official UoA map."
                ),
                address=address,
                latitude=latitude,
                longitude=longitude,
                accessible=True,
                data_status="approximate",
                official_url=OFFICIAL_MAP_URL,
            )
        )
        added += 1
    db.flush()
    return added


def main():
    # PostgreSQL schema changes belong to reviewed Alembic migrations, not seeds.
    if engine.dialect.name == 'sqlite':
        Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        added = seed_campus_buildings(db)
        db.commit()
        print(f"Added {added} campus buildings ({db.query(Building).count()} in total).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
