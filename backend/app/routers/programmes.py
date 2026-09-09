from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    PersonalisedRecommendationRequest,
    PersonalisedRecommendationResponse,
    ProgrammeRecommendationResponse,
    ProgrammeDetailResponse,
    ProgrammeOptionsResponse,
    ProgrammeResponse,
    ProgrammeStatsResponse,
)
from app.services.programme_service import (
    get_all_programmes,
    get_programme_by_id,
    get_programme_options,
    search_programmes,
    get_programme_stats,
    recommend_programmes,
    recommend_personalised_programmes,
)

router = APIRouter(
    prefix="/programmes",
    tags=["Programmes"],
)


@router.get("", response_model=list[ProgrammeResponse])
def read_programmes(
    faculty: str | None = Query(default=None, max_length=255),
    duration: str | None = Query(default=None, max_length=100),
    career: str | None = Query(default=None, max_length=100),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return get_all_programmes(
        db,
        faculty=faculty,
        duration=duration,
        career=career,
        offset=offset,
        limit=limit,
    )
        

@router.get("/search", response_model=list[ProgrammeResponse])
def search_programme_list(
    q: str = Query(min_length=1, max_length=100),
    db: Session = Depends(get_db),
):
    return search_programmes(db, q)


@router.get("/stats", response_model=ProgrammeStatsResponse)
def read_programme_stats(db: Session = Depends(get_db)):
    return get_programme_stats(db)


@router.get("/options", response_model=ProgrammeOptionsResponse)
def read_programme_options(db: Session = Depends(get_db)):
    return get_programme_options(db)


@router.get(
    "/recommend",
    response_model=list[ProgrammeRecommendationResponse],
)
def recommend_programme_list(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    return recommend_programmes(db, q, limit)


@router.post(
    "/recommend/personalised",
    response_model=list[PersonalisedRecommendationResponse]
)
def recommend_personalised(
    request: PersonalisedRecommendationRequest,
    db: Session = Depends(get_db),
):
    return recommend_personalised_programmes(
        db=db,
        interests=request.interests,
        career_goals=request.career_goals,
        limit=request.limit,
    )

       
@router.get("/{programme_id}", response_model=ProgrammeDetailResponse)
def read_programme(
    programme_id: int = Path(ge=1),
    db: Session = Depends(get_db),
):
    programme = get_programme_by_id(db, programme_id)

    if programme is None:
        raise HTTPException(status_code=404, detail="Programme not found")

    return programme
