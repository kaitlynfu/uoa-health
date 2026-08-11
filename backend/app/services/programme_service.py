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

    # Break the user's search into individual words
    keywords = [
        word.lower().strip()
        for word in query.split()
        if len(word.strip()) > 2
    ]

    recommendations = []

    for programme in programmes:

        name = (programme.name or "").lower()
        description = (programme.description or "").lower()
        career_pathways = (programme.career_pathways or "").lower()

        score = 0
        matched_keywords = set()

        for keyword in keywords:

            # Programme name is the strongest signal
            if keyword in name:
                score += 4
                matched_keywords.add(keyword)

            # Career pathways are highly relevant
            if keyword in career_pathways:
                score += 3
                matched_keywords.add(keyword)

            # Description gives broader relevance
            if keyword in description:
                score += 2
                matched_keywords.add(keyword)

        # Only return programmes that actually matched something
        if score > 0:

            recommendations.append({
                "id": programme.id,
                "name": programme.name,
                "faculty": programme.faculty,
                "description": programme.description,
                "duration": programme.duration,
                "entry_requirements": programme.entry_requirements,
                "career_pathways": programme.career_pathways,
                "programme_url": programme.programme_url,
                "image_url": programme.image_url,
                "match_score": score,
                "matched_keywords": sorted(matched_keywords),
            })

    # Highest scoring programmes first
    recommendations.sort(
        key=lambda programme: programme["match_score"],
        reverse=True
    )

    return recommendations[:limit]