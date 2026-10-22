import hashlib
import sqlite3
from pathlib import Path

import pytest

from scripts.import_local_catalogue import build_preview


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_db(path, real=False):
    with sqlite3.connect(path) as db:
        db.executescript('''
        CREATE TABLE programmes(id INTEGER PRIMARY KEY, name TEXT, faculty TEXT,
          description TEXT, duration TEXT, entry_requirements TEXT,
          career_pathways TEXT, programme_url TEXT, image_url TEXT);
        CREATE TABLE careers(id INTEGER PRIMARY KEY, name TEXT, description TEXT, official_url TEXT);
        CREATE TABLE programme_careers(programme_id INTEGER REFERENCES programmes(id), career_id INTEGER REFERENCES careers(id));
        CREATE TABLE saved_careers(user_id INTEGER, career_id INTEGER REFERENCES careers(id));
        CREATE TABLE users(id INTEGER, name TEXT);
        CREATE TABLE journeys(user_id INTEGER, programme_id INTEGER, completed INTEGER);
        ''')
        for i in range(1, 10):
            db.execute('INSERT INTO programmes VALUES(?,?,?,?,?,?,?,?,?)',
                       (i, f'Programme {i}', 'Faculty', 'Real description' if real else 'Synthetic',
                        '3 years', '', '', '', ''))
        db.execute('INSERT INTO careers VALUES(1,?,?,NULL)', ('Real career' if real else 'Fake career', 'Description'))
        db.execute('INSERT INTO programme_careers VALUES(1,1)')
        db.execute('INSERT INTO saved_careers VALUES(1,1)')
        db.execute("INSERT INTO users VALUES(1,'Alice')")
        db.execute('INSERT INTO journeys VALUES(1,1,3)')


def test_preview_preserves_inputs_and_test_progress(tmp_path, monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)
    backend = tmp_path / 'mac-test-folder' / 'backend'
    local = backend / '.integration-local'
    local.mkdir(parents=True)
    fixture = local / 'integration.db'
    source = tmp_path / 'scraped.db'
    make_db(fixture)
    make_db(source, real=True)
    before = (digest(fixture), digest(source))
    build_preview(backend, source)
    assert before == (digest(fixture), digest(source))
    target = local / 'catalogue-preview.db'
    with sqlite3.connect(target) as db:
        assert db.execute('SELECT description FROM programmes WHERE id=1').fetchone()[0] == 'Real description'
        assert db.execute('SELECT name FROM careers').fetchall() == [('Real career',)]
        assert db.execute('SELECT * FROM journeys').fetchall() == [(1, 1, 3)]
        assert db.execute('SELECT name FROM users').fetchall() == [('Alice',)]
        assert db.execute('SELECT * FROM saved_careers').fetchall() == []
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    saved = digest(target)
    with pytest.raises(SystemExit, match='Existing preview preserved'):
        build_preview(backend, source)
    assert digest(target) == saved


def test_preview_refuses_environment_database(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///do-not-touch.db')
    with pytest.raises(SystemExit, match='Unset DATABASE_URL'):
        build_preview(tmp_path, Path('unused.db'))
