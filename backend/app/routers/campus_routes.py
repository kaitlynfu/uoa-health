"""Atomic route + iOS environment publication, with immutable revision downloads."""
import base64
import hashlib
import json
import math
import plistlib
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, defer
from app.database import get_db
from app.models import PublishedCampusRoute, User
from app.services.auth_service import get_current_user
from app.services.route_permissions import require_route_editor
from app.services.campus_routes import DATA, STARTS, template

router = APIRouter(prefix="/navigation/campus", tags=["Campus route editor"])
MAX_BODY = 50_000_000

class Point(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    id: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=120)
    x: float = Field(ge=-200, le=200)
    y: float = Field(ge=-200, le=200)

class Leg(BaseModel):
    model_config = ConfigDict(extra="forbid")
    floor: str = Field(pattern="^(G|1)$")
    frame_id: str = Field(pattern="^campus-[a-zA-Z0-9-]{1,100}$")
    points: list[Point] = Field(min_length=1, max_length=100)
    environment: str = Field(min_length=1, max_length=16_000_000)
    @model_validator(mode="after")
    def geometry(self):
        if len({p.id for p in self.points}) != len(self.points):
            raise ValueError("Duplicate waypoint identity")
        if any(math.hypot(a.x-b.x, a.y-b.y)<.1 for a,b in zip(self.points,self.points[1:])):
            raise ValueError("Waypoints must be at least 10 cm apart")
        return self

class Publish(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)
    start: str
    destination: str
    accessible: bool
    include_gaps: bool = False
    surveyed: bool
    legs: list[Leg] = Field(min_length=1, max_length=3)

def latest(db, key):
    return db.query(PublishedCampusRoute).filter_by(route_key=key).order_by(PublishedCampusRoute.revision.desc()).first()

def metadata(row):
    return dict(json.loads(row.metadata_json), revision=row.revision)

@router.get("/catalog")
def catalog(response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    # One latest entry per route variant. Payloads are fetched only on selection.
    rows = db.query(PublishedCampusRoute).options(defer(PublishedCampusRoute.package)).order_by(PublishedCampusRoute.revision.desc()).all()
    unique = {}
    for row in rows:
        unique.setdefault(row.route_key, metadata(row))
    return dict(starts=[dict(code=n["code"],name=n["name"],floor=n["floor"]) for n in STARTS.values()],
                destinations=[dict(code=d["code"],name=d["name"]) for d in DATA["destinations"]],
                published=list(unique.values()))

@router.get("/template")
def survey_template(start: str, destination: str, accessible: bool = False, include_gaps: bool = False,
                    user: User = Depends(require_route_editor), db: Session = Depends(get_db)):
    result = template(start, destination, accessible, include_gaps)
    row = latest(db, result["key"])
    return dict(result, revision=row.revision if row else 0)

@router.get("/routes/{key}/{revision}")
def download(key: str, revision: int, response: Response, user: User = Depends(get_current_user),
             db: Session = Depends(get_db)):
    row = db.query(PublishedCampusRoute).filter_by(route_key=key, revision=revision).first()
    if not row:
        raise HTTPException(404, "Published campus route not found")
    response.headers["Cache-Control"] = "no-store"
    return json.loads(row.package)

@router.post("/publish")
async def publish(request: Request, user: User = Depends(require_route_editor), db: Session = Depends(get_db)):
    # Bound streamed request size before JSON/base64 parsing, even without Content-Length.
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BODY:
            raise HTTPException(413, "Recording too large. Survey a smaller route.")
        chunks.append(chunk)
    try:
        body = Publish.model_validate_json(b"".join(chunks))
    except ValidationError:
        raise HTTPException(422, "Invalid campus route package")
    if not body.surveyed:
        raise HTTPException(422, "Walk and verify every leg and floor connection before publishing")
    seed = template(body.start, body.destination, body.accessible, body.include_gaps)
    if len(seed["legs"]) != len(body.legs) or len({l.frame_id for l in body.legs}) != len(body.legs):
        raise HTTPException(422, "Each floor leg needs its own coordinate frame and recording")
    release_legs = []
    for actual, expected in zip(body.legs, seed["legs"]):
        if (actual.floor != expected["floor"] or actual.points[0].id != expected["points"][0]["id"]
            or actual.points[0].x != 0 or actual.points[0].y != 0
            or actual.points[-1].id != expected["points"][-1]["id"]
            or len(actual.points)<min(2,len(expected["points"]))):
            raise HTTPException(422, "Keep floor, start and destination identities")
        points = [p.model_dump() for p in actual.points]
        binding = dict(version=1, building="303", route_key=seed["key"], floor=actual.floor,
                       frame_id=actual.frame_id, points=points)
        try:
            raw = base64.b64decode(actual.environment, validate=True)
            if len(raw)>12_000_000:
                raise ValueError()
            archive = plistlib.loads(raw)
            if archive["version"] != 1 or json.loads(archive["routes"]) != binding:
                raise ValueError()
            # The backend cannot relocalize ARKit maps. Validate the envelope here;
            # iOS securely decodes ARWorldMap and requires its origin before use.
            world = archive["worldMap"]
            if not isinstance(world, bytes) or not world.startswith(b"bplist00"):
                raise ValueError()
        except (ValueError, KeyError, TypeError, plistlib.InvalidFileException, OverflowError):
            raise HTTPException(422, "Environment must match the exact edited floor geometry")
        release_legs.append(dict(expected, points=points, frame_id=actual.frame_id,
                                 environment=actual.environment, sha256=hashlib.sha256(raw).hexdigest()))
    current = latest(db, seed["key"])
    revision = current.revision if current else 0
    if revision != body.expected_revision:
        raise HTTPException(409, "Another editor published. Reload; your phone draft is unchanged.")
    release = dict(seed, legs=release_legs, revision=revision+1, platform="ios-arkit-v1")
    summary = {k: release[k] for k in ("key","building","start","destination","accessible","include_gaps","platform")}
    row = PublishedCampusRoute(route_key=seed["key"], revision=revision+1, editor_id=user.id,
                               metadata_json=json.dumps(summary), package=json.dumps(release).encode())
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Another editor published first. Reload before publishing.")
    return dict(summary, revision=revision+1)
