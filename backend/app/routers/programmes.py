from fastapi import APIRouter, HTTPException

from app.database import SessionLocal
from app.schemas import (
    ProgrammeResponse,
    PersonalisedRecommendationRequest,
    PersonalisedRecommendationResponse,
)
from app.services.programme_service import (
    get_all_programmes,
    get_programme_by_id,
    search_programmes,
    get_programme_stats,
    recommend_programmes,
    recommend_personalised_programmes,
)

router = APIRouter(
    prefix="/programmes",
    tags=["Programmes"]
)


@router.get("", response_model=list[ProgrammeResponse])
def read_programmes():

    db = SessionLocal()

    try:
        return get_all_programmes(db)

    finally:
        db.close()
        

@router.get("/search", response_model=list[ProgrammeResponse])
def search_programme_list(q: str):

    db = SessionLocal()

    try:
        return search_programmes(db, q)

    finally:
        db.close()


@router.get("/stats")
def read_programme_stats():

    db = SessionLocal()

    try:
        return get_programme_stats(db)

    finally:
        db.close()


@router.get("/recommend")
def recommend_programme_list(q: str, limit: int = 5):

    db = SessionLocal()

    try:
        return recommend_programmes(db, q, limit)

    finally:
        db.close()


@router.post(
    "/recommend/personalised",
    response_model=list[PersonalisedRecommendationResponse]
)
def recommend_personalised(
    request: PersonalisedRecommendationRequest
):
    db = SessionLocal()

    try:
        return recommend_personalised_programmes(
            db=db,
            interests=request.interests,
            career_goals=request.career_goals,
            limit=request.limit,
        )

    finally:
        db.close()

       
@router.get("/{programme_id}", response_model=ProgrammeResponse)
def read_programme(programme_id: int):

    db = SessionLocal()

    try:
        programme = get_programme_by_id(db, programme_id)

        if programme is None:
            raise HTTPException(
                status_code=404,
                detail="Programme not found"
            )

        return programme

    finally:
        db.close()