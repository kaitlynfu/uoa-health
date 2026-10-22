from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Career,
    Programme,
    SavedCareer,
    SavedProgramme,
    StudentAttribute,
    StudentCourse,
    StudentPersonalisation,
    StudentProfile,
    User,
)


ATTRIBUTE_FIELDS = {
    "interests": "interest",
    "hobbies": "hobby",
    "career_interests": "career_interest",
}


def build_profile(db: Session, user: User):
    profile = user.profile
    personalisation = user.personalisation
    attributes = {field: [] for field in ATTRIBUTE_FIELDS}
    kind_to_field = {kind: field for field, kind in ATTRIBUTE_FIELDS.items()}
    for item in sorted(user.attributes, key=lambda value: value.value.casefold()):
        field = kind_to_field.get(item.kind)
        if field:
            attributes[field].append(item.value)

    return {
        "user": user,
        "programme": profile.programme if profile else None,
        "current_stage": profile.current_stage if profile else None,
        "catalogue_year": profile.catalogue_year if profile else None,
        "bio": personalisation.bio if personalisation else None,
        **attributes,
        "courses": sorted(user.courses, key=lambda item: item.course_code),
        "study_preferences": {
            "study_mode": personalisation.study_mode if personalisation else None,
            "study_style": personalisation.study_style if personalisation else None,
            "preferred_group_size": (
                personalisation.preferred_group_size if personalisation else None
            ),
            "availability": personalisation.availability if personalisation else None,
        },
        "matching_enabled": (
            personalisation.matching_enabled if personalisation else False
        ),
        "saved_programmes": sorted(
            (item.programme for item in user.saved_programmes),
            key=lambda item: item.name,
        ),
        "saved_careers": sorted(
            (item.career for item in user.saved_careers),
            key=lambda item: item.name,
        ),
    }


def update_profile(db: Session, user: User, request):
    fields = request.model_fields_set
    if user.profile is None:
        user.profile = StudentProfile()
    if user.personalisation is None:
        user.personalisation = StudentPersonalisation()
    db.flush()

    if "display_name" in fields:
        if not request.display_name:
            raise HTTPException(status_code=422, detail="Display name cannot be blank")
        user.display_name = request.display_name

    if "programme_id" in fields:
        programme = None
        if request.programme_id is not None:
            programme = db.get(Programme, request.programme_id)
            if programme is None:
                raise HTTPException(status_code=404, detail="Programme not found")
        changed = user.profile.programme_id != request.programme_id
        user.profile.programme = programme
        if changed and user.journey_preference is not None:
            db.delete(user.journey_preference)

    if "current_stage" in fields:
        user.profile.current_stage = request.current_stage
    if "catalogue_year" in fields:
        user.profile.catalogue_year = request.catalogue_year
    if "bio" in fields:
        user.personalisation.bio = request.bio
    if "matching_enabled" in fields:
        user.personalisation.matching_enabled = request.matching_enabled

    if "study_preferences" in fields and request.study_preferences is not None:
        preferences = request.study_preferences
        for field in preferences.model_fields_set:
            setattr(user.personalisation, field, getattr(preferences, field))

    for field, kind in ATTRIBUTE_FIELDS.items():
        if field in fields:
            _replace_attributes(db, user, kind, getattr(request, field) or [])

    if "courses" in fields:
        _replace_courses(db, user, request.courses or [])

    db.flush()
    return build_profile(db, user)


def _replace_attributes(db: Session, user: User, kind: str, values: list[str]):
    db.query(StudentAttribute).filter(
        StudentAttribute.user_id == user.id,
        StudentAttribute.kind == kind,
    ).delete(synchronize_session=False)
    for value in values:
        db.add(
            StudentAttribute(
                user_id=user.id,
                kind=kind,
                value=value,
                normalised_value=value.casefold(),
            )
        )
    db.flush()
    db.expire(user, ["attributes"])


def _replace_courses(db: Session, user: User, courses):
    db.query(StudentCourse).filter(StudentCourse.user_id == user.id).delete(
        synchronize_session=False
    )
    for course in courses:
        db.add(
            StudentCourse(
                user_id=user.id,
                course_code=course.course_code,
                course_name=course.course_name,
                semester=course.semester,
                academic_year=course.academic_year,
            )
        )
    db.flush()
    db.expire(user, ["courses"])


def save_programme(db: Session, user: User, programme_id: int):
    programme = db.get(Programme, programme_id)
    if programme is None:
        raise HTTPException(status_code=404, detail="Programme not found")
    saved = (
        db.query(SavedProgramme)
        .filter(
            SavedProgramme.user_id == user.id,
            SavedProgramme.programme_id == programme_id,
        )
        .first()
    )
    if saved is None:
        db.add(SavedProgramme(user_id=user.id, programme_id=programme_id))
        db.flush()
        db.expire(user, ["saved_programmes"])
    return programme


def remove_saved_programme(db: Session, user: User, programme_id: int):
    removed = (
        db.query(SavedProgramme)
        .filter(
            SavedProgramme.user_id == user.id,
            SavedProgramme.programme_id == programme_id,
        )
        .delete(synchronize_session=False)
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Saved programme not found")


def save_career(db: Session, user: User, career_id: int):
    career = db.get(Career, career_id)
    if career is None:
        raise HTTPException(status_code=404, detail="Career not found")
    saved = (
        db.query(SavedCareer)
        .filter(
            SavedCareer.user_id == user.id,
            SavedCareer.career_id == career_id,
        )
        .first()
    )
    if saved is None:
        db.add(SavedCareer(user_id=user.id, career_id=career_id))
        db.flush()
        db.expire(user, ["saved_careers"])
    return career


def remove_saved_career(db: Session, user: User, career_id: int):
    removed = (
        db.query(SavedCareer)
        .filter(
            SavedCareer.user_id == user.id,
            SavedCareer.career_id == career_id,
        )
        .delete(synchronize_session=False)
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Saved career not found")
