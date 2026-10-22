"""Copy catalogue tables only from the developer's local DB into the preview.

Never reads user tables in the catalogue source. Builds a NEW preview from
the existing integration fixture; neither input is modified.
"""
import argparse
import os
import sqlite3
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path,
                        help='Explicit path to the local scraped catalogue database')
    args = parser.parse_args()
    backend = Path(__file__).resolve().parents[1]
    build_preview(backend, args.source)


def build_preview(backend: Path, source: Path):
    if os.getenv('DATABASE_URL'):
        raise SystemExit('Unset DATABASE_URL before creating the isolated preview.')
    local = backend / '.integration-local'
    if local.is_symlink() or local.resolve().parent != backend.resolve():
        raise SystemExit('Preview directory must be directly inside this backend.')
    fixture = local / 'integration.db'
    target = local / 'catalogue-preview.db'
    if not fixture.is_file():
        raise SystemExit('Create the isolated integration database first.')
    if fixture.is_symlink() or target.exists() or target.is_symlink():
        raise SystemExit('Existing preview preserved, or unsafe fixture symlink. No changes made.')
    if source.resolve() in (fixture.resolve(), target.resolve()):
        raise SystemExit('Catalogue source must be separate from the integration databases.')
    with sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True) as src:
        src.row_factory = sqlite3.Row
        programmes = [dict(r) for r in src.execute('SELECT * FROM programmes')]
        careers = [dict(r) for r in src.execute('SELECT id,name,description,official_url FROM careers')]
        links = src.execute('SELECT programme_id,career_id FROM programme_careers').fetchall()
    if len(programmes) != 9 or not careers:
        raise SystemExit('Unexpected source catalogue; no changes made.')
    # Exclusive creation refuses replacement even if another process creates it.
    # On failure the new file is retained for inspection; do not start it unless
    # the success message below is printed.
    with target.open('xb'):
        pass
    with sqlite3.connect(target.resolve().as_uri() + '?mode=rw', uri=True) as dst:
        with sqlite3.connect(fixture.resolve().as_uri() + '?mode=ro', uri=True) as original:
            original.backup(dst)
        dst.execute('PRAGMA foreign_keys=ON')
        dst.execute('BEGIN IMMEDIATE')
        mapping = {}
        for local_id, local_name in dst.execute('SELECT id,name FROM programmes').fetchall():
            matches = [p for p in programmes if p['name'] == local_name or p['name'].startswith((local_name + ' ', local_name + ','))]
            if len(matches) != 1:
                raise ValueError('Ambiguous programme mapping: ' + local_name)
            p = matches[0]
            mapping[p['id']] = local_id
            fields = ['name','faculty','description','duration','entry_requirements','career_pathways','programme_url','image_url']
            dst.execute('UPDATE programmes SET ' + ','.join(f'{f}=?' for f in fields) + ' WHERE id=?', [p[f] for f in fields] + [local_id])
        if len(mapping) != 9:
            raise ValueError('Expected nine uniquely mapped programmes')
        career_mapping = {}
        for c in careers:
            found = dst.execute('SELECT id FROM careers WHERE lower(name)=lower(?)', (c['name'],)).fetchone()
            if found:
                cid = found[0]
                dst.execute('UPDATE careers SET description=?,official_url=? WHERE id=?', (c['description'],c['official_url'],cid))
            else:
                cid = dst.execute('INSERT INTO careers(name,description,official_url) VALUES(?,?,?)', (c['name'],c['description'],c['official_url'])).lastrowid
            career_mapping[c['id']] = cid
        dst.execute('DELETE FROM programme_careers')
        dst.executemany('INSERT INTO programme_careers(programme_id,career_id) VALUES(?,?)', [(mapping[p],career_mapping[c]) for p,c in links])
        # Remove obsolete synthetic career fixtures and their synthetic saves.
        # Programme saves, accounts, messages and journey progress stay intact.
        keep = list(career_mapping.values())
        placeholders = ','.join('?' for _ in keep)
        dst.execute(f'DELETE FROM saved_careers WHERE career_id NOT IN ({placeholders})', keep)
        dst.execute(f'DELETE FROM careers WHERE id NOT IN ({placeholders})', keep)
        if dst.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Foreign-key validation failed; transaction rolled back')
        dst.commit()
        print('Catalogue imported:', len(programmes), 'programmes;', len(careers), 'careers;', len(links), 'links')
        print('New preview ready:', target)
        print('Both input databases are unchanged. Obsolete synthetic career saves are omitted from this copy.')
        print('Only catalogue data imported. Existing local test users and journeys retained.')


if __name__ == '__main__':
    main()
