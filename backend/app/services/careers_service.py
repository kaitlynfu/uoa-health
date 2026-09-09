from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.models import Career, Programme

def get_career_category(title: str):
    title = title.lower()

    if any(word in title for word in [
        "doctor",
        "medical",
        "medicine",
        "nurse",
        "pharmacist",
        "optometrist",
        "physiotherapist",
        "clinician",
        "dentist",
        "midwife"
    ]): 
        return "Clinical"

    if any(word in title for word in [
        "research",
        "researcher",
        "scientist",
        "laboratory",
        "lab"
    ]):
        return "Research"

    if any(word in title for word in [
        "mental health",
        "psychologist",
        "psychology",
        "counsellor",
        "counselor",
        "psychiatry",
        "psychiatrist",
        "behavioural",
        "behavioral"
    ]):
        return "Mental Health"

    if any(word in title for word in [
        "public health",
        "health policy",
        "health promoter",
        "community health",
        "epidemiologist"
    ]):
        return "Public Health"

    if any(word in title for word in [
        "technology",
        "tech",
        "data",
        "informatics",
        "digital health",
        "software",
        "systems",
        "analyst"
    ]):
        return "Tech"

    return "Other"

def get_all_careers(db: Session):
    careers = db.query(Career).all()

    results = []

    for career in careers:
        programme = (db.query(Programme).filter(Programme.id == career.programme_id).first())
        results.append({
            "id": career.id,
            "title": career.title,
            "category": career.category,
            "programme_id": career.programme_id,
            "programme_name": programme.name if programme else None,
        })

    return results

def search_careers(db: Session, query: str):
    rows = db.query(Career).filter(Career.title.ilike(f"%{query}"), Programme.name.ilike(f"%{query}")).all()

    results = []

    for career, programme in rows:
        results.append({
            "id": career.id,
            "title": career.title,
            "category": career.category,
            "programme_id": career.programme_id,
            "programme_name": programme.name
        })

    return results