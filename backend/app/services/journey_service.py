from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Programme,
    ProgrammeMilestone,
    StudentJourneyPreference,
    StudentMilestoneProgress,
    User,
)
from app.journey_plans import JOURNEY_PLAN_OPTIONS, get_plan_option


def get_programme_milestones(
    db: Session,
    programme_id: int,
    catalogue_year: int,
    plan_code: str,
):
    prefix = f"{plan_code.strip().upper()}:%"
    return (
        db.query(ProgrammeMilestone)
        .filter(
            ProgrammeMilestone.programme_id == programme_id,
            ProgrammeMilestone.catalogue_year == catalogue_year,
            ProgrammeMilestone.code.like(prefix),
        )
        .order_by(ProgrammeMilestone.sort_order.asc())
        .all()
    )


def get_programme_plans(db: Session, programme_id: int, catalogue_year: int):
    available_codes = {
        code.split(":", 1)[0]
        for (code,) in (
            db.query(ProgrammeMilestone.code)
            .filter(
                ProgrammeMilestone.programme_id == programme_id,
                ProgrammeMilestone.catalogue_year == catalogue_year,
            )
            .all()
        )
        if ":" in code
    }
    return [
        option
        for code, option in JOURNEY_PLAN_OPTIONS.items()
        if code in available_codes
    ]


def select_programme(
    db: Session,
    user: User,
    programme_id: int,
    current_stage: int,
    catalogue_year: int,
    plan_code: str,
):
    programme = db.query(Programme).filter(Programme.id == programme_id).first()
    if programme is None:
        raise HTTPException(status_code=404, detail="Programme not found")

    plan = get_plan_option(plan_code)
    if plan is None:
        raise HTTPException(status_code=404, detail="Journey plan not found")

    milestones = get_programme_milestones(
        db,
        programme_id,
        catalogue_year,
        plan["code"],
    )
    if not milestones:
        raise HTTPException(
            status_code=404,
            detail="No journey template exists for this programme, year, and plan",
        )

    user.profile.programme = programme
    user.profile.current_stage = current_stage
    user.profile.catalogue_year = catalogue_year
    if user.journey_preference is None:
        user.journey_preference = StudentJourneyPreference(plan_code=plan["code"])
    else:
        user.journey_preference.plan_code = plan["code"]
    db.commit()
    return build_journey(db, user)


def build_journey(db: Session, user: User):
    profile = user.profile
    if profile.programme_id is None or profile.catalogue_year is None:
        raise HTTPException(status_code=404, detail="No programme journey selected")
    if user.journey_preference is None:
        raise HTTPException(status_code=404, detail="No journey plan selected")

    plan = get_plan_option(user.journey_preference.plan_code)
    if plan is None:
        raise HTTPException(status_code=404, detail="Journey plan not found")

    milestones = get_programme_milestones(
        db,
        profile.programme_id,
        profile.catalogue_year,
        plan["code"],
    )
    progress_by_milestone = {
        progress.milestone_id: progress
        for progress in (
            db.query(StudentMilestoneProgress)
            .join(StudentMilestoneProgress.milestone)
            .filter(
                StudentMilestoneProgress.user_id == user.id,
                ProgrammeMilestone.programme_id == profile.programme_id,
                ProgrammeMilestone.catalogue_year == profile.catalogue_year,
                ProgrammeMilestone.code.like(f"{plan['code']}:%"),
            )
            .all()
        )
    }

    milestone_results = []
    completed_count = 0
    completed_points = 0
    total_points = sum(item.points for item in milestones if item.required)

    for milestone in milestones:
        progress = progress_by_milestone.get(milestone.id)
        completed = bool(progress and progress.completed)
        if completed and milestone.required:
            completed_count += 1
            completed_points += milestone.points

        milestone_results.append({
            "id": milestone.id,
            "code": milestone.code,
            "title": milestone.title,
            "description": milestone.description,
            "stage": milestone.stage,
            "category": milestone.category,
            "points": milestone.points,
            "required": milestone.required,
            "sort_order": milestone.sort_order,
            "official_url": milestone.official_url,
            "completed": completed,
            "completed_at": progress.completed_at if progress else None,
        })

    required_count = sum(1 for item in milestones if item.required)
    percent = round(completed_count / required_count * 100) if required_count else 0

    return {
        "programme": profile.programme,
        "plan_code": plan["code"],
        "plan_name": plan["name"],
        "current_stage": profile.current_stage,
        "catalogue_year": profile.catalogue_year,
        "completed_count": completed_count,
        "total_count": required_count,
        "progress_percent": percent,
        "completed_points": completed_points,
        "total_points": total_points,
        "milestones": milestone_results,
    }


def update_milestone(
    db: Session,
    user: User,
    milestone_id: int,
    completed: bool,
):
    profile = user.profile
    if user.journey_preference is None:
        raise HTTPException(status_code=404, detail="No journey plan selected")
    milestone = (
        db.query(ProgrammeMilestone)
        .filter(ProgrammeMilestone.id == milestone_id)
        .first()
    )
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if (
        profile.programme_id != milestone.programme_id
        or profile.catalogue_year != milestone.catalogue_year
        or not milestone.code.startswith(f"{user.journey_preference.plan_code}:")
    ):
        raise HTTPException(status_code=409, detail="Milestone is not in your journey")

    progress = (
        db.query(StudentMilestoneProgress)
        .filter(
            StudentMilestoneProgress.user_id == user.id,
            StudentMilestoneProgress.milestone_id == milestone_id,
        )
        .first()
    )
    if progress is None:
        progress = StudentMilestoneProgress(user=user, milestone=milestone)
        db.add(progress)

    progress.completed = completed
    progress.completed_at = (
        datetime.now(UTC).replace(tzinfo=None)
        if completed
        else None
    )
    db.commit()
    return build_journey(db, user)
