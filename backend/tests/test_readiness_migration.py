"""Preserve populated 0004 rows; deployment guard remains intentionally unchanged."""
import importlib.util
from pathlib import Path
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text
from app.database import Base
from app import models

NEW={'blocked_users','safety_reports','account_email_tokens','verified_emails',
     'notification_preferences','request_limits','deleted_accounts','profile_photos'}


def test_additive_upgrade_preserves_accounts_messages_and_route_bytes():
    path=Path(__file__).resolve().parents[1]/'migrations/versions/0005_account_safety.py'
    spec=importlib.util.spec_from_file_location('readiness_revision',path)
    revision=importlib.util.module_from_spec(spec);spec.loader.exec_module(revision)
    engine=create_engine('sqlite://')
    Base.metadata.create_all(engine,tables=[table for table in Base.metadata.sorted_tables if table.name not in NEW])
    with engine.begin() as db:
        db.execute(text('DROP INDEX ix_messages_direct_page'));db.execute(text('DROP INDEX ix_messages_group_page'))
        db.execute(text("INSERT INTO users (id,email,password_hash,display_name,created_at) VALUES (1,'keep@example.test','hash-must-not-change','Existing','2026-10-02')"))
        db.execute(text("INSERT INTO groups (id,name,created_at) VALUES (1,'Existing group','2026-10-02')"))
        db.execute(text("INSERT INTO messages (id,sender_id,recipient_id,content,created_at) VALUES (1,1,1,'Existing private message','2026-10-02')"))
        db.execute(text("INSERT INTO published_campus_routes (id,route_key,revision,metadata_json,package,editor_id,created_at) VALUES (1,'route',1,'{}',:package,1,'2026-10-02')"),{'package':b'Original recording bytes'})
        original={name:db.execute(text(f'SELECT * FROM "{name}"')).all() for name in inspect(db).get_table_names()}
        revision.op=Operations(MigrationContext.configure(db));revision.upgrade()
        for name,rows in original.items():assert db.execute(text(f'SELECT * FROM "{name}"')).all()==rows
        assert NEW.issubset(inspect(db).get_table_names())
        assert {index['name'] for index in inspect(db).get_indexes('messages')}=={'ix_messages_group_page','ix_messages_direct_page'}
        revision.downgrade()
        for name,rows in original.items():assert db.execute(text(f'SELECT * FROM "{name}"')).all()==rows
        revision.upgrade()
    engine.dispose()


def test_rehearsal_refuses_live_remote_or_wrong_user_before_connecting():
    import sys
    scripts=Path(__file__).resolve().parents[1]/'scripts'
    sys.path.insert(0,str(scripts))
    try:
        from rehearse_readiness_postgres import checked_url
        import pytest
        allowed='postgresql+psycopg://ubuntu@/team43_readiness_rehearsal?host=/var/run/postgresql'
        assert checked_url(allowed).database=='team43_readiness_rehearsal'
        for value in (allowed.replace('team43_readiness_rehearsal','team43'),
                      allowed.replace('ubuntu@','postgres@'),
                      'postgresql+psycopg://ubuntu@localhost/team43_readiness_rehearsal'):
            with pytest.raises(ValueError):checked_url(value)
    finally:sys.path.remove(str(scripts))
