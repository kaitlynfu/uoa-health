from fastapi import APIRouter

from app.database import SessionLocal
from app.schemas import CareerResponse
from app.services.careers_service import (
    get_all_careers,
    search_careers,
)

router = APIRouter(
    prefix="/careers",
    tags=["Careers"]
)

@router.get("", response_model=list[CareerResponse])
def read_careers():
    db = SessionLocal()

    try:
        return get_all_careers(db)

    finally:
        db.close()

@router.get("/search", response_model=list[CareerResponse])
def search_career_list(q: str):
    db = SessionLocal()

    try:
        return search_careers(db, q)

    finally:
        db.close()