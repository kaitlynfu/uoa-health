import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Programme, ProgrammeMilestone
from app.services.career_service import sync_all_programme_careers


TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    db = TestingSessionLocal()
    db.add_all(
        [
            Programme(
                name="Bachelor of Health Sciences",
                faculty="Faculty of Medical and Health Sciences",
                description="Study population health and community wellbeing.",
                duration="3 years",
                entry_requirements="University Entrance",
                career_pathways="Public health analyst, health policy adviser",
                programme_url="https://example.test/health-sciences",
            ),
            Programme(
                name="Bachelor of Nursing",
                faculty="Faculty of Medical and Health Sciences",
                description="Learn clinical care and patient safety.",
                duration="3 years",
                entry_requirements="University Entrance",
                career_pathways="Registered nurse, clinical researcher",
                programme_url="https://example.test/nursing",
            ),
            Programme(
                name="Bachelor of Pharmacy",
                faculty="Faculty of Medical and Health Sciences",
                description="Study pharmaceutical science and clinical practice.",
                duration="4 years",
                career_pathways="Pharmacist, medicines safety adviser",
                programme_url="https://example.test/pharmacy",
            ),
            Programme(
                name="Bachelor of Biomedical Science",
                faculty="Faculty of Science",
                description="Explore biology, medicine, and laboratory science.",
                duration="3 years",
                career_pathways="Biomedical researcher, laboratory scientist",
                programme_url="https://example.test/biomedical-science",
            ),
        ]
    )
    db.flush()
    health_programme = (
        db.query(Programme)
        .filter(Programme.name == "Bachelor of Health Sciences")
        .first()
    )
    for plan_code in (
        "COMH_CLINICAL",
        "COMH_STANDARD",
        "HSDA_CLINICAL",
        "HSDA_STANDARD",
    ):
        db.add_all(
            [
                ProgrammeMilestone(
                    programme=health_programme,
                    catalogue_year=2027,
                    code=f"{plan_code}:TEST_CORE",
                    title="Complete core courses",
                    category="core",
                    points=180,
                    required=True,
                    sort_order=1,
                ),
                ProgrammeMilestone(
                    programme=health_programme,
                    catalogue_year=2027,
                    code=f"{plan_code}:TEST_ELECTIVES",
                    title="Complete elective courses",
                    category="electives",
                    points=180,
                    required=True,
                    sort_order=2,
                ),
            ]
        )
    nursing_programme = (
        db.query(Programme)
        .filter(Programme.name == "Bachelor of Nursing")
        .first()
    )
    db.add_all(
        [
            ProgrammeMilestone(
                programme=nursing_programme,
                catalogue_year=2027,
                code="BNURS_STANDARD:TEST_PART_I",
                title="Complete Part I",
                category="part",
                points=120,
                required=True,
                sort_order=1,
            ),
            ProgrammeMilestone(
                programme=nursing_programme,
                catalogue_year=2027,
                code="BNURS_STANDARD:TEST_PART_II_III",
                title="Complete Parts II and III",
                category="part",
                points=240,
                required=True,
                sort_order=2,
            ),
        ]
    )
    pharmacy_programme = (
        db.query(Programme)
        .filter(Programme.name == "Bachelor of Pharmacy")
        .first()
    )
    db.add_all(
        [
            ProgrammeMilestone(
                programme=pharmacy_programme,
                catalogue_year=2027,
                code="BPHARM_STANDARD:TEST_PART_I",
                title="Complete Part I",
                category="part",
                points=120,
                required=True,
                sort_order=1,
            ),
            ProgrammeMilestone(
                programme=pharmacy_programme,
                catalogue_year=2027,
                code="BPHARM_STANDARD:TEST_PART_II_IV",
                title="Complete Parts II to IV",
                category="part",
                points=360,
                required=True,
                sort_order=2,
            ),
        ]
    )
    sync_all_programme_careers(db)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
