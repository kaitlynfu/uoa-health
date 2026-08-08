from pydantic import BaseModel # pydantic is a data validation and settings management library that uses Python type annotations. It is used to define data models and validate data in FastAPI applications.


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