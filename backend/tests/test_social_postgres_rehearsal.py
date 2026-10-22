import pytest
from sqlalchemy import create_engine, text

from scripts.rehearse_social_postgres import checked_url, check_preserved, row_digest, snapshot


@pytest.mark.parametrize('url', [
    'postgresql+psycopg://ubuntu@/team43?host=/var/run/postgresql',
    'postgresql+psycopg://ubuntu@/team43_rehearsal?host=/var/run/postgresql',
    'sqlite://',
    'postgresql+psycopg://ubuntu@server/team43_social_rehearsal',
    'postgresql+psycopg://postgres@/team43_social_rehearsal?host=/var/run/postgresql',
    'postgresql+psycopg://ubuntu:secret@/team43_social_rehearsal?host=/var/run/postgresql',
    'postgresql+psycopg://ubuntu@/team43_social_rehearsal?host=/elsewhere',
    'postgresql+psycopg://ubuntu@/team43_social_rehearsal?host=/var/run/postgresql&options=x',
])
def test_refuses_production_and_unexpected_connection_before_access(url):
    with pytest.raises(ValueError):
        checked_url(url)


def test_allows_only_fixed_isolated_copy():
    assert checked_url('postgresql+psycopg://ubuntu@/team43_social_rehearsal?host=/var/run/postgresql').database == 'team43_social_rehearsal'


def test_snapshot_compares_every_original_column_and_ignores_added_columns():
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE groups (id INTEGER PRIMARY KEY, name TEXT)'))
        connection.execute(text("INSERT INTO groups VALUES (1, 'Original')"))
        before = snapshot(connection)
        connection.execute(text("ALTER TABLE groups ADD COLUMN description TEXT DEFAULT ''"))
        columns = {name: row['columns'] for name, row in before.items()}
        check_preserved(before, snapshot(connection, columns))
        connection.execute(text("UPDATE groups SET name = 'Changed'"))
        with pytest.raises(ValueError, match='groups'):
            check_preserved(before, snapshot(connection, columns))
    engine.dispose()


def test_digest_is_order_independent_but_not_count_or_content_independent():
    assert row_digest([(1, 'A'), (2, 'B')]) == row_digest([(2, 'B'), (1, 'A')])
    assert row_digest([(1, 'A')]) != row_digest([(1, 'B')])
    assert row_digest([(1, 'A')]) != row_digest([(1, 'A'), (1, 'A')])
