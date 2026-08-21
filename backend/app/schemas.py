from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProgrammeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    faculty: str | None = None
    description: str | None = None
    duration: str | None = None
    entry_requirements: str | None = None
    career_pathways: str | None = None
    programme_url: str | None = None
    image_url: str | None = None


class CareerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    official_url: str | None = None


class ProgrammeDetailResponse(ProgrammeResponse):
    careers: list[CareerResponse] = Field(default_factory=list)


class CareerDetailResponse(CareerResponse):
    programmes: list[ProgrammeResponse] = Field(default_factory=list)


class ProgrammeOptionsResponse(BaseModel):
    faculties: list[str]
    durations: list[str]
    careers: list[str]


class HealthResponse(BaseModel):
    status: str
    database: str
    programmes: int


class ProgrammeStatsResponse(BaseModel):
    total_programmes: int
    programmes_with_descriptions: int
    programmes_with_career_pathways: int
    programmes_with_entry_requirements: int


class ProgrammeRecommendationResponse(ProgrammeResponse):
    match_score: int
    matched_keywords: list[str]


class PersonalisedRecommendationRequest(BaseModel):
    interests: list[str] = Field(default_factory=list)
    career_goals: list[str] = Field(default_factory=list)
    limit: int = Field(default=3, ge=1, le=20)

    @field_validator("interests", "career_goals")
    @classmethod
    def clean_terms(cls, values: list[str]) -> list[str]:
        cleaned = []
        seen = set()

        for value in values:
            term = value.strip()
            key = term.casefold()

            if term and key not in seen:
                cleaned.append(term)
                seen.add(key)

        return cleaned

    @model_validator(mode="after")
    def require_a_preference(self):
        if not self.interests and not self.career_goals:
            raise ValueError("Provide at least one interest or career goal")
        return self


class PersonalisedRecommendationResponse(ProgrammeResponse):
    match_score: int
    matched_interests: list[str]
    matched_career_goals: list[str]
    reason: str


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = value.strip().casefold()
        if "@" not in email or email.startswith("@") or email.endswith("@"):
            raise ValueError("Enter a valid email address")
        return email

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Display name cannot be blank")
        return cleaned


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserResponse


class StudentCourseInput(BaseModel):
    course_code: str = Field(min_length=2, max_length=30)
    course_name: str | None = Field(default=None, max_length=255)
    semester: str | None = Field(default=None, max_length=30)
    academic_year: int | None = Field(default=None, ge=2020, le=2100)

    @field_validator("course_code")
    @classmethod
    def clean_course_code(cls, value: str) -> str:
        cleaned = " ".join(value.strip().upper().split())
        if not cleaned:
            raise ValueError("Course code cannot be blank")
        return cleaned

    @field_validator("course_name", "semester")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class StudentCourseResponse(StudentCourseInput):
    model_config = ConfigDict(from_attributes=True)

    id: int


class StudyPreferencesUpdate(BaseModel):
    study_mode: str | None = Field(default=None, max_length=30)
    study_style: str | None = Field(default=None, max_length=50)
    preferred_group_size: int | None = Field(default=None, ge=1, le=20)
    availability: str | None = Field(default=None, max_length=500)

    @field_validator("study_mode")
    @classmethod
    def validate_study_mode(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if cleaned not in {"in_person", "online", "hybrid"}:
            raise ValueError("Study mode must be in_person, online, or hybrid")
        return cleaned

    @field_validator("study_style", "availability")
    @classmethod
    def clean_preference_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class StudyPreferencesResponse(StudyPreferencesUpdate):
    pass


class StudentProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    programme_id: int | None = Field(default=None, ge=1)
    current_stage: int | None = Field(default=None, ge=1, le=10)
    catalogue_year: int | None = Field(default=None, ge=2024, le=2100)
    bio: str | None = Field(default=None, max_length=1000)
    interests: list[str] | None = None
    hobbies: list[str] | None = None
    career_interests: list[str] | None = None
    courses: list[StudentCourseInput] | None = None
    study_preferences: StudyPreferencesUpdate | None = None
    matching_enabled: bool | None = None

    @field_validator("display_name", "bio")
    @classmethod
    def clean_profile_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned and value is not None:
            return None
        return cleaned

    @field_validator("interests", "hobbies", "career_interests")
    @classmethod
    def clean_profile_terms(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        cleaned = []
        seen = set()
        for value in values:
            term = value.strip()
            key = term.casefold()
            if term and key not in seen:
                if len(term) > 100:
                    raise ValueError("Profile terms must be 100 characters or fewer")
                cleaned.append(term)
                seen.add(key)
        if len(cleaned) > 30:
            raise ValueError("Use no more than 30 terms in each category")
        return cleaned

    @field_validator("courses")
    @classmethod
    def unique_courses(
        cls,
        courses: list[StudentCourseInput] | None,
    ) -> list[StudentCourseInput] | None:
        if courses is None:
            return None
        codes = [course.course_code for course in courses]
        if len(codes) != len(set(codes)):
            raise ValueError("Course codes must be unique")
        if len(courses) > 30:
            raise ValueError("Use no more than 30 courses")
        return courses


class StudentProfileResponse(BaseModel):
    user: UserResponse
    programme: ProgrammeResponse | None = None
    current_stage: int | None = None
    catalogue_year: int | None = None
    bio: str | None = None
    interests: list[str]
    hobbies: list[str]
    career_interests: list[str]
    courses: list[StudentCourseResponse]
    study_preferences: StudyPreferencesResponse
    matching_enabled: bool
    saved_programmes: list[ProgrammeResponse]
    saved_careers: list[CareerResponse]


class SelectProgrammeRequest(BaseModel):
    programme_id: int = Field(ge=1)
    current_stage: int = Field(default=1, ge=1, le=10)
    catalogue_year: int = Field(ge=2024, le=2100)
    plan_code: str = Field(min_length=3, max_length=50)

    @field_validator("plan_code")
    @classmethod
    def clean_plan_code(cls, value: str) -> str:
        return value.strip().upper()


class JourneyPlanResponse(BaseModel):
    code: str
    name: str
    major: str
    clinical_pathway: bool
    description: str


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    description: str | None = None
    stage: int | None = None
    category: str
    points: int
    required: bool
    sort_order: int
    official_url: str | None = None


class MilestoneProgressResponse(MilestoneResponse):
    completed: bool
    completed_at: datetime | None = None


class UpdateMilestoneRequest(BaseModel):
    completed: bool


class JourneyResponse(BaseModel):
    programme: ProgrammeResponse
    plan_code: str
    plan_name: str
    current_stage: int
    catalogue_year: int
    completed_count: int
    total_count: int
    progress_percent: int
    completed_points: int
    total_points: int
    milestones: list[MilestoneProgressResponse]


class CampusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    official_map_url: str | None = None
    active: bool


class BuildingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campus_id: int
    number: str
    name: str
    description: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    image_url: str | None = None
    accessible: bool
    data_status: str
    official_url: str | None = None


class FloorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    building_id: int
    level: int
    label: str
    name: str | None = None
    sort_order: int
    floorplan_url: str | None = None
    data_status: str


class LocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campus_id: int
    building_id: int | None = None
    floor_id: int | None = None
    code: str
    name: str
    location_type: str
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    x: float | None = None
    y: float | None = None
    accessible: bool
    verified: bool


class WayfindingSearchResult(LocationResponse):
    campus_name: str
    building_number: str | None = None
    building_name: str | None = None
    floor_label: str | None = None


class RouteRequest(BaseModel):
    start_location_id: int = Field(ge=1)
    end_location_id: int = Field(ge=1)
    accessible_only: bool = False


class RouteStepResponse(BaseModel):
    from_location: LocationResponse
    to_location: LocationResponse
    instruction: str
    distance_m: float


class RouteResponse(BaseModel):
    start: LocationResponse
    destination: LocationResponse
    accessible_only: bool
    total_distance_m: float
    estimated_minutes: int
    locations: list[LocationResponse]
    steps: list[RouteStepResponse]
    data_notice: str
