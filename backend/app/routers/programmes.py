from fastapi import APIRouter

from app.database import SessionLocal
from app.schemas import ProgrammeResponse
from app.services.programme_service import get_all_programmes

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