from pydantic import BaseModel


class ProgrammeResponse(BaseModel):
    id: int
    name: str
    faculty: str | None
    description: str | None
    duration: str | None
    entry_requirements: str | None
    career_pathways: str | None
    programme_url: str | None
    image_url: str | None

    class Config:
        from_attributes = True


class PersonalisedRecommendationRequest(BaseModel):
    interests: list[str]
    career_goals: list[str]
    limit: int = 3


class PersonalisedRecommendationResponse(BaseModel):
    id: int
    name: str
    faculty: str | None
    description: str | None
    duration: str | None
    entry_requirements: str | None
    career_pathways: str | None
    programme_url: str | None
    image_url: str | None

    match_score: int
    matched_interests: list[str]
    matched_career_goals: list[str]
    reason: str