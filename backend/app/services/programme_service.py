from sqlalchemy.orm import Session

from app.models import Programme


def get_all_programmes(db: Session):
    return db.query(Programme).all()


def get_programme_by_id(db, programme_id: int):
    return (
        db.query(Programme)
        .filter(Programme.id == programme_id)
        .first()
    )
    
    
def search_programmes(db, query: str):
    return (
        db.query(Programme)
        .filter(Programme.name.ilike(f"%{query}%"))
        .all()
    )
    
    
def get_programme_stats(db):

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