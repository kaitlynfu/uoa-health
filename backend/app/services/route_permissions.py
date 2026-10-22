"""Operator-managed route-editor access; never trust a client-supplied role.

Grants use immutable account IDs, not emails that could be registered later.
Missing or malformed configuration denies access to everyone.
"""
import os

from fastapi import Depends, HTTPException

from app.models import User
from app.services.auth_service import get_current_user


def can_edit_routes(user: User) -> bool:
    raw = os.environ.get("TEAM43_ROUTE_EDITOR_USER_IDS", "").strip()
    if not raw:
        return False
    parts = [part.strip() for part in raw.split(",")]
    if any(not part.isascii() or not part.isdecimal() or int(part) < 1 for part in parts):
        return False
    return user.id in {int(part) for part in parts}


def require_route_editor(user: User = Depends(get_current_user)) -> User:
    if not can_edit_routes(user):
        raise HTTPException(status_code=403, detail="Route editor access required")
    return user
