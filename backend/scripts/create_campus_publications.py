"""Explicit additive migration. Dry run by default; never run on deployment startup.

Before --apply: verify target DATABASE_URL, stop writers, take a verified backup,
and rehearse on a restored database. No seeds, updates or drops.
"""
import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import inspect
from app.database import engine
from app.models import PublishedCampusRoute


def migrate(connection, apply=False):
    inspector = inspect(connection)
    if connection.dialect.name != "sqlite" or "alembic_version" in inspector.get_table_names():
        raise RuntimeError("Use the reviewed Alembic 0003 migration for this database")
    if "users" not in inspector.get_table_names():
        raise RuntimeError("Expected existing application database with users")
    name = PublishedCampusRoute.__tablename__
    if name in inspector.get_table_names():
        expected = {c.name: (str(c.type.compile(dialect=connection.dialect)).upper(), c.nullable, c.primary_key)
                    for c in PublishedCampusRoute.__table__.columns}
        actual = {c["name"]: (str(c["type"]).upper(), c["nullable"], bool(c["primary_key"]))
                  for c in inspector.get_columns(name)}
        uniques = {tuple(c["column_names"]) for c in inspector.get_unique_constraints(name)}
        indexes = {tuple(c["column_names"]) for c in inspector.get_indexes(name)}
        foreign_keys = inspector.get_foreign_keys(name)
        if (actual != expected or ("route_key", "revision") not in uniques or ("route_key",) not in indexes
            or not any(fk["constrained_columns"] == ["editor_id"] and fk["referred_table"] == "users"
                       and fk["referred_columns"] == ["id"] for fk in foreign_keys)):
            raise RuntimeError("Unexpected campus table schema; manual review required")
        return "Already present; no changes"
    if not apply:
        return "Would create published_campus_routes and route_key index; no existing rows change"
    PublishedCampusRoute.__table__.create(connection, checkfirst=False)
    return "Created published_campus_routes"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with engine.begin() as connection:
        print(migrate(connection, args.apply))
