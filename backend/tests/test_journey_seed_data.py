from app.journey_plans import JOURNEY_PLAN_OPTIONS
from scripts.seed_journey import (
    BHSC_MILESTONES,
    BIOMEDICAL_MILESTONES,
    BSC_MILESTONES,
    CERTHSC_MILESTONES,
    MEDICINE_MILESTONES,
    NURSING_MILESTONES,
    OPTOMETRY_MILESTONES,
    PHARMACY_MILESTONES,
    SPORTHPE_MILESTONES,
)


EXPECTED_PLAN_POINTS = {
    "COMH_CLINICAL": 360,
    "COMH_STANDARD": 360,
    "HSDA_CLINICAL": 360,
    "HSDA_STANDARD": 360,
    "BNURS_STANDARD": 360,
    "BPHARM_STANDARD": 480,
    "BOPTOM_STANDARD": 600,
    "MBCHB_STANDARD": 720,
    "CERTHSC_STANDARD": 120,
    "BBIOMED_STANDARD": 360,
    "BSPORTHPE_GENERAL": 360,
    "BSC_CMB": 360,
    "BSC_EXERCISE": 360,
    "BSC_MEDCHEM": 360,
    "BSC_NUTRITION": 360,
    "BSC_PHARMACOLOGY": 360,
    "BSC_PHYSIOLOGY": 360,
}


def test_every_seeded_journey_plan_is_registered_and_has_the_right_total():
    all_milestones = (
        BHSC_MILESTONES
        + NURSING_MILESTONES
        + PHARMACY_MILESTONES
        + OPTOMETRY_MILESTONES
        + MEDICINE_MILESTONES
        + CERTHSC_MILESTONES
        + BIOMEDICAL_MILESTONES
        + SPORTHPE_MILESTONES
        + BSC_MILESTONES
    )
    plans = {}
    for item in all_milestones:
        plan_code = item["code"].split(":", 1)[0]
        plans.setdefault(plan_code, []).append(item)

    assert set(plans) == set(EXPECTED_PLAN_POINTS)
    assert set(plans) == set(JOURNEY_PLAN_OPTIONS)
    assert {
        code: sum(item["points"] for item in milestones)
        for code, milestones in plans.items()
    } == EXPECTED_PLAN_POINTS


def test_seeded_milestone_codes_are_unique():
    groups = [
        BHSC_MILESTONES,
        NURSING_MILESTONES,
        PHARMACY_MILESTONES,
        OPTOMETRY_MILESTONES,
        MEDICINE_MILESTONES,
        CERTHSC_MILESTONES,
        BIOMEDICAL_MILESTONES,
        SPORTHPE_MILESTONES,
        BSC_MILESTONES,
    ]
    codes = [item["code"] for group in groups for item in group]

    assert len(codes) == len(set(codes))


def test_all_nine_new_first_year_clinical_routes_are_labelled():
    clinical_codes = {
        code
        for code, plan in JOURNEY_PLAN_OPTIONS.items()
        if plan["clinical_pathway"]
    }

    assert clinical_codes == {
        "COMH_CLINICAL",
        "HSDA_CLINICAL",
        "BBIOMED_STANDARD",
        "BSC_CMB",
        "BSC_EXERCISE",
        "BSC_MEDCHEM",
        "BSC_NUTRITION",
        "BSC_PHARMACOLOGY",
        "BSC_PHYSIOLOGY",
    }
    assert all(
        "clinical-entry pathway" in JOURNEY_PLAN_OPTIONS[code]["name"].casefold()
        or "clinical-selection pathway" in JOURNEY_PLAN_OPTIONS[code]["name"].casefold()
        for code in clinical_codes
    )
