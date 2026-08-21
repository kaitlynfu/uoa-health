from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    JourneyResponse,
    JourneyPlanResponse,
    MilestoneResponse,
    SelectProgrammeRequest,
    UpdateMilestoneRequest,
)
from app.services.auth_service import get_current_user
from app.services.journey_service import (
    build_journey,
    get_programme_milestones,
    get_programme_plans,
    select_programme,
    update_milestone,
)


router = APIRouter(prefix="/journey", tags=["Student Journey"])


@router.get(
    "/programmes/{programme_id}/plans",
    response_model=list[JourneyPlanResponse],
)
def read_programme_plans(
    programme_id: int = Path(ge=1),
    catalogue_year: int = Query(ge=2024, le=2100),
    db: Session = Depends(get_db),
):
    return get_programme_plans(db, programme_id, catalogue_year)


@router.get(
    "/programmes/{programme_id}/milestones",
    response_model=list[MilestoneResponse],
)
def read_programme_milestones(
    programme_id: int = Path(ge=1),
    catalogue_year: int = Query(ge=2024, le=2100),
    plan_code: str = Query(min_length=3, max_length=50),
    db: Session = Depends(get_db),
):
    return get_programme_milestones(
        db,
        programme_id,
        catalogue_year,
        plan_code,
    )


@router.put("/me/programme", response_model=JourneyResponse)
def choose_programme(
    request: SelectProgrammeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return select_programme(
        db,
        user,
        request.programme_id,
        request.current_stage,
        request.catalogue_year,
        request.plan_code,
    )


@router.get("/me", response_model=JourneyResponse)
def read_my_journey(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return build_journey(db, user)


@router.patch("/me/milestones/{milestone_id}", response_model=JourneyResponse)
def set_milestone_progress(
    request: UpdateMilestoneRequest,
    milestone_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_milestone(db, user, milestone_id, request.completed)
