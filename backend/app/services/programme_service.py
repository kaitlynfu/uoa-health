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

    # Clean the input
    cleaned_interests = [
        interest.lower().strip()
        for interest in interests
        if interest.strip()
    ]

    cleaned_career_goals = [
        goal.lower().strip()
        for goal in career_goals
        if goal.strip()
    ]

    recommendations = []

    for programme in programmes:

        name = (programme.name or "").lower()
        description = (programme.description or "").lower()
        career_pathways = (programme.career_pathways or "").lower()

        score = 0
        matched_interests = []
        matched_career_goals = []

        # ----------------------------
        # Score interests
        # ----------------------------

        for interest in cleaned_interests:

            matched = False

            if interest in name:
                score += 4
                matched = True

            if interest in career_pathways:
                score += 3
                matched = True

            if interest in description:
                score += 2
                matched = True

            if matched:
                matched_interests.append(interest)

        # ----------------------------
        # Score career goals
        # ----------------------------

        for goal in cleaned_career_goals:

            matched = False

            if goal in name:
                score += 4
                matched = True

            if goal in career_pathways:
                score += 5
                matched = True

            if goal in description:
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
            "matched_interests": matched_interests,
            "matched_career_goals": matched_career_goals,
            "reason": reason,
        })

    # Highest score first
    recommendations.sort(
        key=lambda programme: programme["match_score"],
        reverse=True
    )

    return recommendations[:limit]