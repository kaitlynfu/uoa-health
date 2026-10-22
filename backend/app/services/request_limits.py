"""Atomic, cross-worker fixed-window abuse limits on both supported databases."""
import hashlib
import time
from datetime import UTC, datetime
from fastapi import HTTPException
from sqlalchemy import case, delete
from app.models import RequestLimit, utc_now


def throttle(db, scope, identity, maximum, seconds=900):
    if db.bind.dialect.name == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    key = hashlib.sha256(f'{scope}:{identity}'.encode()).hexdigest()
    window = int(time.time()) // seconds
    expires_at = datetime.fromtimestamp((window + 1) * seconds, UTC).replace(tzinfo=None)
    db.execute(delete(RequestLimit).where(RequestLimit.expires_at < utc_now()))
    statement = insert(RequestLimit).values(key=key, window=window, count=1, expires_at=expires_at)
    statement = statement.on_conflict_do_update(index_elements=['key'], set_={
        'window': window, 'expires_at':expires_at,
        'count': case((RequestLimit.window == window, RequestLimit.count + 1), else_=1)})
    count = db.scalar(statement.returning(RequestLimit.count))
    db.commit()  # Failed requests also consume their attempt; never rolls back a limit.
    if count > maximum:
        raise HTTPException(429, 'Too many attempts. Please try again later.', headers={'Retry-After': str(seconds)})
