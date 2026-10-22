"""Home-marker routes only; campus routing remains on its existing API."""
import json
import math

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PublishedHomeRoute, User
from app.services.route_permissions import require_route_editor

router = APIRouter(prefix="/navigation/home-routes", tags=["Route editing"])
DESTINATIONS = {"living", "bedroom2", "office", "passage", "right-room", "closet"}


class Point(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    id: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=120)
    x: float = Field(ge=-30, le=30)
    y: float = Field(ge=-30, le=30)


class PublishRoute(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)
    marker: str = Field(pattern="^home-start-v1$")
    points: list[Point] = Field(min_length=2, max_length=100)

    @model_validator(mode="after")
    def validate_geometry(self):
        first = self.points[0]
        if first.id != "start" or first.x != 0 or first.y != 0:
            raise ValueError("Keep the fixed marker start")
        if len({p.id for p in self.points}) != len(self.points):
            raise ValueError("Waypoint IDs must be unique")
        if any(math.hypot(a.x-b.x, a.y-b.y) < .1 for a, b in zip(self.points, self.points[1:])):
            raise ValueError("Waypoints must be at least 10 cm apart")
        return self


def latest(db, destination):
    if destination not in DESTINATIONS:
        raise HTTPException(404, "Unknown home destination")
    return db.query(PublishedHomeRoute).filter_by(destination=destination).order_by(PublishedHomeRoute.revision.desc()).first()


def serialize(row, destination):
    return {"destination": destination, "marker": "home-start-v1",
            "revision": row.revision if row else 0,
            "points": json.loads(row.points_json) if row else None}


@router.get("/{destination}")
def read_route(destination: str, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return serialize(latest(db, destination), destination)


@router.get("/{destination}/history")
def history(destination: str, user: User = Depends(require_route_editor), db: Session = Depends(get_db)):
    latest(db, destination)
    rows = db.query(PublishedHomeRoute).filter_by(destination=destination).order_by(PublishedHomeRoute.revision.desc()).limit(50).all()
    return [serialize(row, destination) for row in rows]


@router.post("/{destination}")
def publish(destination: str, body: PublishRoute, user: User = Depends(require_route_editor), db: Session = Depends(get_db)):
    current = latest(db, destination)
    revision = current.revision if current else 0
    if revision != body.expected_revision:
        raise HTTPException(409, "Route changed. Reload the latest route before publishing; your draft is unchanged.")
    if body.points[-1].id != destination:
        raise HTTPException(422, "Keep the destination identity")
    row = PublishedHomeRoute(destination=destination, revision=revision+1, editor_id=user.id,
                             points_json=json.dumps([p.model_dump() for p in body.points]))
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Another editor published first. Reload before publishing.")
    return serialize(row, destination)
