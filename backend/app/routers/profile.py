from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    CareerResponse,
    ProgrammeResponse,
    StudentProfileResponse,
    StudentProfileUpdate,
)
from app.services.auth_service import get_current_user
from app.services.profile_service import (
    build_profile,
    remove_saved_career,
    remove_saved_programme,
    save_career,
    save_programme,
    update_profile,
)


router = APIRouter(prefix="/profile/me", tags=["User Profile"])


@router.get("", response_model=StudentProfileResponse)
def read_my_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return build_profile(db, user)


@router.patch("", response_model=StudentProfileResponse)
def edit_my_profile(
    request: StudentProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = update_profile(db, user, request)
    db.commit()
    return profile


@router.post(
    "/saved-programmes/{programme_id}",
    response_model=ProgrammeResponse,
)
def add_saved_programme(
    programme_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = save_programme(db, user, programme_id)
    db.commit()
    return programme


@router.delete("/saved-programmes/{programme_id}", status_code=204)
def delete_saved_programme(
    programme_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    remove_saved_programme(db, user, programme_id)
    db.commit()
    return Response(status_code=204)


@router.post("/saved-careers/{career_id}", response_model=CareerResponse)
def add_saved_career(
    career_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    career = save_career(db, user, career_id)
    db.commit()
    return career


@router.delete("/saved-careers/{career_id}", status_code=204)
def delete_saved_career(
    career_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    remove_saved_career(db, user, career_id)
    db.commit()
    return Response(status_code=204)
