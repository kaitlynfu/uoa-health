"""Reviewed reference content supplements missing scraped fields without DB writes.

Existing IDs, curated DB text and stored relationships are preserved. Additional
connections describe study areas, not automatic registration or admission.
"""
import json
from pathlib import Path

from app.models import Career, Programme

CONTENT = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'career_content.json').read_text(encoding='utf-8'))


def career_content(name):
    entry = CONTENT['careers'].get(name)
    if not entry:
        return None
    source, description = entry
    return {'description': description, 'official_url': CONTENT['sources'][source],
            'source_checked_at': CONTENT['checked_at']}


def connected_programmes(db, career):
    existing = list(career.programmes)
    names = CONTENT['additional_connections'].get(career.name, [])
    extra = db.query(Programme).filter(Programme.name.in_(names)).all() if names else []
    combined = {p.id: p for p in [*existing, *extra]}
    return sorted(combined.values(), key=lambda p: p.name)


def connected_careers(db, programme):
    names = [name for name, programmes in CONTENT['additional_connections'].items() if programme.name in programmes]
    extra = db.query(Career).filter(Career.name.in_(names)).all() if names else []
    combined = {c.id: c for c in [*programme.careers, *extra]}
    return sorted(combined.values(), key=lambda c: c.name)
