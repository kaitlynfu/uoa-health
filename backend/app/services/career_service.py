import re

from sqlalchemy.orm import Session

from app.models import Career, Programme


def extract_career_names(career_pathways: str | None) -> list[str]:
    """Extract list-style career data without treating prose as a job title."""
    if not career_pathways:
        return []

    normalised = career_pathways.replace("\ufffd", "-")
    narrative_starts = ("because ", "those ", "students ", "this ", "graduates ")
    pathway_phrases = (
        "entry pathway",
        "pathway into",
        "further study",
    )

    normalised_lower = normalised.casefold()
    if (
        normalised_lower.startswith(narrative_starts)
        or any(phrase in normalised_lower for phrase in pathway_phrases)
    ):
        return []

    candidates = [
        re.split(
            r"\s+[—–-]\s+(?=you\b)",
            item.strip(" ."),
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0]
        for item in re.split(r"[,;\n]+", normalised)
        if item.strip(" .")
    ]

    if not candidates or len(candidates[0]) > 100:
        return []

    short_candidates = [item for item in candidates if len(item) <= 100]
    return list(dict.fromkeys(short_candidates))


def sync_programme_careers(db: Session, programme: Programme) -> int:
    names = extract_career_names(programme.career_pathways)
    careers = []

    for name in names:
        career = (
            db.query(Career)
            .filter(Career.name.ilike(name))
            .first()
        )

        if career is None:
            career = Career(name=name)
            db.add(career)

        careers.append(career)

    programme.careers = careers
    return len(careers)


def sync_all_programme_careers(db: Session) -> tuple[int, int]:
    programmes = db.query(Programme).all()
    linked_careers = 0

    for programme in programmes:
        linked_careers += sync_programme_careers(db, programme)

    db.flush()
    db.query(Career).filter(~Career.programmes.any()).delete(
        synchronize_session=False
    )

    return len(programmes), linked_careers


def get_careers(
    db: Session,
    query: str | None = None,
    offset: int = 0,
    limit: int = 100,
):
    career_query = db.query(Career)

    if query and query.strip():
        career_query = career_query.filter(
            Career.name.ilike(f"%{query.strip()}%")
        )

    return (
        career_query
        .order_by(Career.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_career_by_id(db: Session, career_id: int):
    return db.query(Career).filter(Career.id == career_id).first()
