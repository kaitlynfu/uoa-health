import pytest
from sqlalchemy import create_engine, inspect
from app.models import Base
from scripts.create_campus_publications import migrate

def test_additive_legacy_migration_dry_run_retry_and_preservation():
    engine=create_engine("sqlite://")
    Base.metadata.create_all(engine,tables=[t for t in Base.metadata.sorted_tables if t.name!="published_campus_routes"])
    with engine.begin() as db:
        before=set(inspect(db).get_table_names())
        assert "Would create" in migrate(db)
        assert set(inspect(db).get_table_names()) == before
        assert "Created" in migrate(db,True)
        assert "Already present" in migrate(db,True)
        assert set(inspect(db).get_table_names()) == before | {"published_campus_routes"}
    engine.dispose()

def test_refuses_incompatible_or_alembic_managed_database():
    engine=create_engine("sqlite://")
    with engine.begin() as db:
        with pytest.raises(RuntimeError): migrate(db,True)
        db.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        db.exec_driver_sql("CREATE TABLE published_campus_routes (id INTEGER PRIMARY KEY)")
        with pytest.raises(RuntimeError): migrate(db,True)
        db.exec_driver_sql("CREATE TABLE alembic_version (version_num VARCHAR)")
        with pytest.raises(RuntimeError,match="Alembic"): migrate(db,True)
    engine.dispose()
