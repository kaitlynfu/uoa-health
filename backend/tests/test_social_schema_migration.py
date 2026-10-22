"""Exercise the additive revision with populated old tables, without production access."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text, inspect


def test_upgrade_preserves_existing_group_and_message_and_can_reapply():
    path = Path(__file__).resolve().parents[1] / 'migrations/versions/0004_social_inbox_groups.py'
    spec = importlib.util.spec_from_file_location('social_revision', path)
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    engine = create_engine('sqlite://')
    with engine.begin() as db:
        db.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        db.execute(text('CREATE TABLE groups (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL)'))
        db.execute(text('CREATE TABLE messages (id INTEGER PRIMARY KEY, content VARCHAR(2000))'))
        db.execute(text('CREATE TABLE published_campus_routes (id INTEGER PRIMARY KEY, package BLOB)'))
        db.execute(text('INSERT INTO published_campus_routes VALUES (1, :package)'), {'package': b'Preserve campus recording'})
        db.execute(text("INSERT INTO groups VALUES (1, 'Existing', '2026-09-22')"))
        db.execute(text("INSERT INTO messages VALUES (1, 'Keep message')"))
        revision.op = Operations(MigrationContext.configure(db))
        revision.upgrade()
        assert db.execute(text('SELECT name, course, preferred_days FROM groups')).one() == ('Existing', '', '[]')
        assert db.scalar(text('SELECT content FROM messages')) == 'Keep message'
        assert db.scalar(text('SELECT package FROM published_campus_routes')) == b'Preserve campus recording'
        assert 'saved_groups' in inspect(db).get_table_names()
        revision.downgrade()
        assert db.scalar(text('SELECT name FROM groups')) == 'Existing'
        revision.upgrade()
    engine.dispose()


def test_social_revision_follows_the_unchanged_deployed_campus_revision():
    import hashlib
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    backend = Path(__file__).resolve().parents[1]
    graph = ScriptDirectory.from_config(Config(str(backend / 'alembic.ini')))
    assert graph.get_heads() == ['0005']
    assert graph.get_revision('0005').down_revision == '0004'
    assert graph.get_revision('0004').down_revision == '0003'
    campus = backend / 'migrations/versions/0003_published_campus_routes.py'
    assert hashlib.sha256(campus.read_text().encode()).hexdigest() == '0b1106ddf4e1f910546b6acc7f404b49209f9f7c89e97e1460b54f0958021318'
