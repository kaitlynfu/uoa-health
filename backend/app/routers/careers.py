from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import CareerDetailResponse, CareerResponse, ProgrammeResponse
from app.services.career_service import get_career_by_id, get_careers


router = APIRouter(prefix="/careers", tags=["Careers"])


@router.get("", response_model=list[CareerResponse])
def read_careers(
    q: str | None = Query(default=None, min_length=1, max_length=100),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return get_careers(db, query=q, offset=offset, limit=limit)


@router.get("/{career_id}", response_model=CareerDetailResponse)
def read_career(
    career_id: int = Path(ge=1),
    db: Session = Depends(get_db),
):
    career = get_career_by_id(db, career_id)

    if career is None:
        raise HTTPException(status_code=404, detail="Career not found")

    return career


@router.get(
    "/{career_id}/programmes",
    response_model=list[ProgrammeResponse],
)
def read_career_programmes(
    career_id: int = Path(ge=1),
    db: Session = Depends(get_db),
):
    career = get_career_by_id(db, career_id)

    if career is None:
        raise HTTPException(status_code=404, detail="Career not found")

    return career.programmes
