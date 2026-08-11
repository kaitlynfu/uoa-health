from fastapi import APIRouter

from fastapi import APIRouter, HTTPException

from app.database import SessionLocal
from app.schemas import ProgrammeResponse
from app.services.programme_service import (
    get_all_programmes,
    get_programme_by_id,
    search_programmes,
    get_programme_stats,
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