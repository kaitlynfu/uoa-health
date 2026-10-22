"""Copy a stopped application's SQLite snapshot into an empty migrated PostgreSQL DB.

Usage: python -m scripts.migrate_sqlite_to_postgres --source /path/snapshot.db
The target is DATABASE_URL. No source rows or credentials are printed.
"""
import argparse
from contextlib import closing
from pathlib import Path
import sqlite3

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, func, inspect, select, text

from app import models
from app.database import BACKEND_DIR, Base, engine


def copy_rows(source, target):
    """Caller owns a target transaction; errors roll back every inserted row."""
    tables = Base.metadata.sorted_tables
    source_inspector = inspect(source)
    source_tables = set(source_inspector.get_table_names()) - {"alembic_version"}
    if source_tables != set(Base.metadata.tables):
        extra = sorted(source_tables - set(Base.metadata.tables))
        missing = sorted(set(Base.metadata.tables) - source_tables)
        raise ValueError(
            f"Source tables differ from the model: extra={extra}, missing={missing}. "
            "Use matching application code; do not discard source tables."
        )
    for table in tables:
        actual = {column["name"] for column in source_inspector.get_columns(table.name)}
        if actual != set(table.columns.keys()):
            raise ValueError(f"Source columns differ for {table.name}.")
        if target.scalar(select(func.count()).select_from(table)):
            raise ValueError(f"Target table {table.name} is not empty; no rows copied.")

    counts = {}
    for table in tables:
        query = select(table).order_by(*table.primary_key.columns)
        # SQLAlchemy applies DateTime and Boolean conversion using model types.
        rows = source.execute(query).mappings().all()
        for offset in range(0, len(rows), 500):
            target.execute(table.insert(), [dict(row) for row in rows[offset:offset + 500]])
        copied = target.execute(query).mappings().all()
        if copied != rows:
            raise ValueError(f"Verification failed for {table.name}; import rolled back.")
        counts[table.name] = len(rows)
    return counts


def reset_sequences(connection):
    for table in Base.metadata.sorted_tables:
        if "id" not in table.c or not table.c.id.primary_key:
            continue
        sequence = connection.scalar(
            text("SELECT pg_get_serial_sequence(:table, 'id')"), {"table": table.name}
        )
        if sequence:
            maximum = connection.scalar(select(func.max(table.c.id)))
            connection.execute(
                text("SELECT setval(CAST(:sequence AS regclass), :value, :used)"),
                {"sequence": sequence, "value": maximum or 1, "used": maximum is not None},
            )


def migrate(source_path, destination=engine):
    if destination.dialect.name != "postgresql":
        raise ValueError("DATABASE_URL must select PostgreSQL.")
    source_path = Path(source_path).resolve(strict=True)
    uri = source_path.as_uri() + "?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as check:
        if check.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise ValueError("SQLite snapshot failed integrity checking.")
        if check.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError("SQLite snapshot has broken references; repair a copy first.")
    source_engine = create_engine(
        "sqlite://", creator=lambda: sqlite3.connect(uri, uri=True)
    )
    try:
        with source_engine.connect() as source, destination.begin() as target:
            config = Config(str(BACKEND_DIR / "alembic.ini"))
            expected = ScriptDirectory.from_config(config).get_current_head()
            if MigrationContext.configure(target).get_current_revision() != expected:
                raise ValueError("Target schema is not current; run alembic upgrade head first.")
            # Block other writers for the entire empty-check/copy/verify operation.
            names = ", ".join(target.dialect.identifier_preparer.quote(t.name)
                              for t in Base.metadata.sorted_tables)
            target.execute(text("SET LOCAL lock_timeout = '10s'"))
            target.execute(text(f"LOCK TABLE {names} IN ACCESS EXCLUSIVE MODE"))
            counts = copy_rows(source, target)
            reset_sequences(target)
        return counts
    finally:
        source_engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    args = parser.parse_args()
    try:
        counts = migrate(args.source)
    except Exception as error:
        # Driver errors can contain parameters and private user data.
        message = str(error) if isinstance(error, ValueError) else type(error).__name__
        parser.exit(1, f"Migration failed: {message}\n")
    for table, count in counts.items():
        print(f"{table}: {count} rows verified")
    print("Import committed. Source SQLite snapshot was not changed.")


if __name__ == "__main__":
    main()
