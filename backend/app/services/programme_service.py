import re

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Career, Programme


def get_all_programmes(
    db: Session,
    faculty: str | None = None,
    duration: str | None = None,
    career: str | None = None,
    offset: int = 0,
    limit: int = 100,
):
    query = db.query(Programme)

    if faculty:
        query = query.filter(Programme.faculty == faculty)

    if duration:
        query = query.filter(Programme.duration == duration)

    if career:
        query = (
            query.join(Programme.careers)
            .filter(Career.name.ilike(f"%{career.strip()}%"))
            .distinct()
        )

    return (
        query
        .order_by(Programme.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_programme_by_id(db: Session, programme_id: int):
    return (
        db.query(Programme)
        .filter(Programme.id == programme_id)
        .first()
    )
    
    
def search_programmes(db: Session, query: str):
    query = query.strip()

    if not query:
        return []

    escaped_query = (
        query.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    pattern = f"%{escaped_query}%"

    return (
        db.query(Programme)
        .filter(
            or_(
                Programme.name.ilike(pattern, escape="\\"),
                Programme.faculty.ilike(pattern, escape="\\"),
                Programme.description.ilike(pattern, escape="\\"),
                Programme.career_pathways.ilike(pattern, escape="\\"),
            )
        )
        .order_by(Programme.name.asc())
        .all()
    )
    
    
def get_programme_stats(db: Session):

    total_programmes = db.query(Programme).count()

    programmes_with_descriptions = (
        db.query(Programme)
        .filter(
            Programme.description.isnot(None),
            Programme.description != ""
        )
        .count()
    )

    programmes_with_career_pathways = (
        db.query(Programme)
        .filter(
            Programme.career_pathways.isnot(None),
            Programme.career_pathways != ""
        )
        .count()
    )

    programmes_with_entry_requirements = (
        db.query(Programme)
        .filter(
            Programme.entry_requirements.isnot(None),
            Programme.entry_requirements != ""
        )
        .count()
    )

    return {
        "total_programmes": total_programmes,
        "programmes_with_descriptions": programmes_with_descriptions,
        "programmes_with_career_pathways": programmes_with_career_pathways,
        "programmes_with_entry_requirements": programmes_with_entry_requirements,
    }
    
    
def _keywords(text: str) -> list[str]:
    """Return unique, searchable words while preserving their input order."""
    words = re.findall(r"[a-z0-9]+", text.casefold())
    return list(dict.fromkeys(word for word in words if len(word) >= 2))


def _programme_fields(programme: Programme) -> dict[str, str]:
    return {
        "name": (programme.name or "").casefold(),
        "description": (programme.description or "").casefold(),
        "career_pathways": (programme.career_pathways or "").casefold(),
    }


def get_programme_options(db: Session):
    faculties = [
        value
        for (value,) in (
            db.query(Programme.faculty)
            .filter(Programme.faculty.isnot(None), Programme.faculty != "")
            .distinct()
            .order_by(Programme.faculty.asc())
            .all()
        )
    ]
    durations = [
        value
        for (value,) in (
            db.query(Programme.duration)
            .filter(Programme.duration.isnot(None), Programme.duration != "")
            .distinct()
            .order_by(Programme.duration.asc())
            .all()
        )
    ]
    careers = [
        name
        for (name,) in db.query(Career.name).order_by(Career.name.asc()).all()
    ]

    return {
        "faculties": faculties,
        "durations": durations,
        "careers": careers,
    }


def _programme_dict(programme: Programme) -> dict:
    return {
        "id": programme.id,
        "name": programme.name,
        "faculty": programme.faculty,
        "description": programme.description,
        "duration": programme.duration,
        "entry_requirements": programme.entry_requirements,
        "career_pathways": programme.career_pathways,
        "programme_url": programme.programme_url,
        "image_url": programme.image_url,
    }


def recommend_programmes(db: Session, query: str, limit: int = 5):
    """
    Rank programmes based on how closely they match a student's
    interests or career goals.

    Scoring:
    - Programme name: 4 points
    - Career pathways: 3 points
    - Description: 2 points
    """

    programmes = db.query(Programme).all()
    keywords = _keywords(query)

    recommendations = []

    for programme in programmes:

        fields = _programme_fields(programme)

        score = 0
        matched_keywords = set()

        for keyword in keywords:

            # Programme name is the strongest signal
            if keyword in fields["name"]:
                score += 4
                matched_keywords.add(keyword)

            # Career pathways are highly relevant
            if keyword in fields["career_pathways"]:
                score += 3
                matched_keywords.add(keyword)

            # Description gives broader relevance
            if keyword in fields["description"]:
                score += 2
                matched_keywords.add(keyword)

        # Only return programmes that actually matched something
        if score > 0:

            recommendations.append({
                **_programme_dict(programme),
                "match_score": score,
                "matched_keywords": sorted(matched_keywords),
            })

    # Highest scoring programmes first
    recommendations.sort(
        key=lambda item: (-item["match_score"], item["name"].casefold())
    )

    return recommendations[:limit]


def recommend_personalised_programmes(
    db: Session,
    interests: list[str],
    career_goals: list[str],
    limit: int = 3
):
    """
    Recommend programmes based on a student's interests and career goals.

    Scoring:
    Interests:
    - Programme name: 4 points
    - Career pathways: 3 points
    - Description: 2 points

    Career goals:
    - Programme name: 4 points
    - Career pathways: 5 points
    - Description: 2 points
    """

    programmes = db.query(Programme).all()

    cleaned_interests = [
        interest.strip()
        for interest in interests
        if interest.strip()
    ]
    cleaned_career_goals = [
        goal.strip()
        for goal in career_goals
        if goal.strip()
    ]

    recommendations = []

    for programme in programmes:

        fields = _programme_fields(programme)

        score = 0
        matched_interests = []
        matched_career_goals = []

        # ----------------------------
        # Score interests
        # ----------------------------

        for interest in cleaned_interests:

            matched = False

            for keyword in _keywords(interest):
                if keyword in fields["name"]:
                    score += 4
                    matched = True

                if keyword in fields["career_pathways"]:
                    score += 3
                    matched = True

                if keyword in fields["description"]:
                    score += 2
                    matched = True

            if matched:
                matched_interests.append(interest)

        # ----------------------------
        # Score career goals
        # ----------------------------

        for goal in cleaned_career_goals:

            matched = False

            for keyword in _keywords(goal):
                if keyword in fields["name"]:
                    score += 4
                    matched = True

                if keyword in fields["career_pathways"]:
                    score += 5
                    matched = True

                if keyword in fields["description"]:
                    score += 2
                    matched = True

            if matched:
                matched_career_goals.append(goal)

        # Ignore programmes with no relevance
        if score == 0:
            continue

        # ----------------------------
        # Generate explanation
        # ----------------------------

        reason_parts = []

        if matched_interests:
            reason_parts.append(
                "Matches your interests in "
                + ", ".join(matched_interests)
            )

        if matched_career_goals:
            reason_parts.append(
                "aligns with your career goals in "
                + ", ".join(matched_career_goals)
            )

        reason = " and ".join(reason_parts) + "."

        recommendations.append({
            **_programme_dict(programme),
            "match_score": score,
            "matched_interests": matched_interests,
            "matched_career_goals": matched_career_goals,
            "reason": reason,
        })

    # Highest score first
    recommendations.sort(
        key=lambda item: (-item["match_score"], item["name"].casefold())
    )

    return recommendations[:limit]
