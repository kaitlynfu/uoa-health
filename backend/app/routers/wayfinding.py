from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    BuildingResponse,
    CampusResponse,
    FloorResponse,
    LocationResponse,
    RouteRequest,
    RouteResponse,
    WayfindingSearchResult,
)
from app.services.wayfinding_service import (
    calculate_route,
    get_building,
    get_campus,
    list_buildings,
    list_campuses,
    list_floors,
    list_locations,
    search_locations,
)


router = APIRouter(tags=["Campus Wayfinding"])


@router.get("/campuses", response_model=list[CampusResponse])
def read_campuses(
    q: str | None = Query(default=None, min_length=1, max_length=100),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    return list_campuses(db, q, include_inactive)


@router.get("/campuses/{campus_id}", response_model=CampusResponse)
def read_campus(
    campus_id: int = Path(ge=1),
    db: Session = Depends(get_db),
):
    return get_campus(db, campus_id)


@router.get(
    "/campuses/{campus_id}/buildings",
    response_model=list[BuildingResponse],
)
def read_campus_buildings(
    campus_id: int = Path(ge=1),
    q: str | None = Query(default=None, min_length=1, max_length=100),
    db: Session = Depends(get_db),
):
    return list_buildings(db, campus_id, q)


@router.get("/buildings/{building_id}", response_model=BuildingResponse)
def read_building(
    building_id: int = Path(ge=1),
    db: Session = Depends(get_db),
):
    return get_building(db, building_id)


@router.get(
    "/buildings/{building_id}/floors",
    response_model=list[FloorResponse],
)
def read_building_floors(
    building_id: int = Path(ge=1),
    db: Session = Depends(get_db),
):
    return list_floors(db, building_id)


@router.get(
    "/buildings/{building_id}/locations",
    response_model=list[LocationResponse],
)
def read_building_locations(
    building_id: int = Path(ge=1),
    floor_id: int | None = Query(default=None, ge=1),
    location_type: str | None = Query(default=None, min_length=2, max_length=50),
    q: str | None = Query(default=None, min_length=1, max_length=100),
    accessible_only: bool = False,
    db: Session = Depends(get_db),
):
    return list_locations(
        db,
        building_id,
        floor_id,
        location_type,
        q,
        accessible_only,
    )


@router.get(
    "/wayfinding/search",
    response_model=list[WayfindingSearchResult],
)
def search_wayfinding_locations(
    q: str = Query(min_length=1, max_length=100),
    campus_id: int | None = Query(default=None, ge=1),
    location_type: str | None = Query(default=None, min_length=2, max_length=50),
    accessible_only: bool = False,
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return search_locations(
        db,
        q,
        campus_id,
        location_type,
        accessible_only,
        limit,
    )


@router.post("/wayfinding/routes", response_model=RouteResponse)
def create_wayfinding_route(
    request: RouteRequest,
    db: Session = Depends(get_db),
):
    return calculate_route(
        db,
        request.start_location_id,
        request.end_location_id,
        request.accessible_only,
    )
