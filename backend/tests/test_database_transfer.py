import pytest
from sqlalchemy import create_engine, select

from app.database import Base
from app.models import (
    User, StudentProfile, PublishedHomeRoute, Friendship, FriendshipStatus,
    Group, GroupMember, GroupRole, Message,
)
from scripts.migrate_sqlite_to_postgres import copy_rows, migrate


ROUTE_POINTS = '[{"id":"start","x":0,"y":0},{"id":"office","x":2,"y":3}]'


def seed_transfer_source(source, include_chat=True):
    source.execute(User.__table__.insert(), [
        {"id": 42, "email": "transfer@example.test", "password_hash": "existing-hash",
         "display_name": "Transfer Student"},
        {"id": 43, "email": "friend@example.test", "password_hash": "friend-hash",
         "display_name": "Friend"},
    ])
    source.execute(StudentProfile.__table__.insert().values(id=5, user_id=42))
    source.execute(PublishedHomeRoute.__table__.insert().values(
        id=9, destination="office", revision=3, editor_id=42, points_json=ROUTE_POINTS,
    ))
    if not include_chat:
        return
    source.execute(Friendship.__table__.insert().values(
        id=7, user_id=42, friend_id=43, status=FriendshipStatus.ACCEPTED,
    ))
    source.execute(Group.__table__.insert().values(id=6, name="Study group"))
    source.execute(GroupMember.__table__.insert().values(
        id=8, group_id=6, user_id=42, role=GroupRole.ADMIN,
    ))
    source.execute(Message.__table__.insert().values(
        id=11, sender_id=42, recipient_id=43, content="Preserve direct message",
    ))
    source.execute(Message.__table__.insert().values(
        id=12, sender_id=42, group_id=6, content="Preserve group message",
    ))


def verify_transferred_features(target, include_chat=True):
    assert target.scalar(select(PublishedHomeRoute.points_json)) == ROUTE_POINTS
    assert target.scalar(select(PublishedHomeRoute.editor_id)) == 42
    assert target.scalar(select(PublishedHomeRoute.revision)) == 3
    if not include_chat:
        assert target.execute(select(Message.id)).all() == []
        return
    assert target.scalar(select(Friendship.status)) == FriendshipStatus.ACCEPTED
    assert target.scalar(select(GroupMember.role)) == GroupRole.ADMIN
    assert target.scalar(select(GroupMember.group_id)) == 6
    assert target.scalar(select(Message.content).where(Message.id == 11)) == "Preserve direct message"
    assert target.scalar(select(Message.group_id).where(Message.id == 12)) == 6


@pytest.mark.parametrize("include_chat", [False, True])
def test_transfer_preserves_identity_and_relationships_and_refuses_duplicates(include_chat):
    source_engine = create_engine("sqlite://")
    target_engine = create_engine("sqlite://")
    try:
        for engine in (source_engine, target_engine):
            Base.metadata.create_all(engine)
        with source_engine.begin() as source:
            seed_transfer_source(source, include_chat)
        with source_engine.connect() as source, target_engine.begin() as target:
            counts = copy_rows(source, target)
            assert counts["users"] == 2
            assert counts["published_home_routes"] == 1
            assert counts["messages"] == (2 if include_chat else 0)
            assert target.scalar(select(User.password_hash).where(User.id == 42)) == "existing-hash"
            assert target.scalar(select(StudentProfile.user_id)) == 42
            verify_transferred_features(target, include_chat)
            with pytest.raises(ValueError, match="not empty"):
                copy_rows(source, target)
    finally:
        source_engine.dispose()
        target_engine.dispose()


def test_transfer_refuses_sqlite_destination():
    target = create_engine("sqlite://")
    try:
        with pytest.raises(ValueError, match="must select PostgreSQL"):
            migrate("absent.db", target)
    finally:
        target.dispose()


def test_postgres_transfer_and_next_generated_id(request):
    from conftest import test_engine
    if test_engine.dialect.name != "postgresql":
        pytest.skip("Run in PostgreSQL CI or with TEST_DATABASE_URL.")
    tmp_path = request.getfixturevalue("tmp_path")
    # The fixture creates schema and seeds rows; this disposable DB was migrated in CI.
    with test_engine.begin() as target:
        for table in reversed(Base.metadata.sorted_tables):
            target.execute(table.delete())
    source_path = tmp_path / "source.db"
    source_engine = create_engine(f"sqlite:///{source_path.as_posix()}")
    try:
        Base.metadata.create_all(source_engine)
        with source_engine.begin() as source:
            seed_transfer_source(source)
    finally:
        source_engine.dispose()
    counts = migrate(source_path, test_engine)
    assert counts["users"] == 2
    assert counts["published_home_routes"] == 1
    assert counts["messages"] == 2
    with test_engine.begin() as target:
        verify_transferred_features(target)
        assert target.scalar(select(User.password_hash).where(User.id == 42)) == "existing-hash"
        result = target.execute(User.__table__.insert().values(
            email="new@example.test", password_hash="new-hash", display_name="New",
        ))
        assert result.inserted_primary_key[0] > 43
        route = target.execute(PublishedHomeRoute.__table__.insert().values(
            destination="office", revision=4, editor_id=42, points_json=ROUTE_POINTS,
        ))
        assert route.inserted_primary_key[0] > 9
    with pytest.raises(ValueError, match="not empty"):
        migrate(source_path, test_engine)
