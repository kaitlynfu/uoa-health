from app.database import SessionLocal, engine
from app.models import (
    Base,
    Programme,
    ProgrammeMilestone,
    StudentMilestoneProgress,
)


CATALOGUE_YEAR = 2027
BHSC_OFFICIAL_URL = (
    "https://study.auckland.ac.nz/ords/r/uoa/catalogue/program"
    "?p0_catalogue_term=Summer&p0_catalogue_year=2027&p5_code=BHSc"
)
BNURS_OFFICIAL_URL = (
    "https://study.auckland.ac.nz/ords/r/uoa/catalogue/program?p5_code=BNurs"
)
BPHARM_OFFICIAL_URL = (
    "https://study.auckland.ac.nz/ords/r/uoa/catalogue/program"
    "?p0_catalogue_term=Summer&p0_catalogue_year=2027&p5_code=BPharm"
)
BOPTOM_OFFICIAL_URL = "https://study.auckland.ac.nz/ords/r/uoa/catalogue/program?p0_catalogue_term=Summer&p0_catalogue_year=2027&p5_code=BOptom"
MBCHB_OFFICIAL_URL = "https://study.auckland.ac.nz/ords/r/uoa/catalogue/program?p0_catalogue_term=Summer&p0_catalogue_year=2027&p5_code=MBChB"
CERTHSC_OFFICIAL_URL = "https://study.auckland.ac.nz/ords/r/uoa/catalogue/program?p5_code=CertHSc"
BBIOMED_OFFICIAL_URL = "https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/bachelor-of-biomedical-science.html"
BSPORTHPE_OFFICIAL_URL = "https://study.auckland.ac.nz/ords/r/uoa/catalogue/program?p5_code=BSportHPE"
BSC_OFFICIAL_URL = "https://study.auckland.ac.nz/ords/r/uoa/catalogue/program?p0_catalogue_term=Summer&p0_catalogue_year=2027&p5_code=BSc"

def milestone(
    plan_code,
    code,
    title,
    stage,
    semester,
    category="course",
    points=15,
    note=None,
):
    description = f"Semester {semester}."
    if note:
        description += f" {note}"
    return {
        "code": f"{plan_code}:{code}",
        "title": title,
        "description": description,
        "stage": stage,
        "category": category,
        "points": points,
    }


def first_year_science(plan_code, course_code, title, semester, replacement_code):
    if plan_code.endswith("CLINICAL"):
        return milestone(plan_code, course_code, title, 1, semester)
    return milestone(
        plan_code,
        replacement_code,
        "Stage I elective",
        1,
        semester,
        "elective",
        note=f"Replaces {course_code.replace('_', ' ')} for the standard pathway.",
    )


def community_health_plan(plan_code):
    return [
        first_year_science(plan_code, "BIOSCI107", "BIOSCI 107: Biology for Biomedical Science: Cellular Processes", 1, "S1_ELECTIVE_A"),
        first_year_science(plan_code, "CHEM190", "CHEM 190: Chemistry for Medical and Life Sciences", 1, "S1_ELECTIVE_B"),
        milestone(plan_code, "POPLHLTH111", "POPLHLTH 111: Population Health", 1, 1),
        milestone(plan_code, "S1_ELECTIVE_C", "Stage I elective", 1, 1, "elective"),
        milestone(plan_code, "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
        milestone(plan_code, "POPLHLTH113", "POPLHLTH 113: Introduction to Community Health", 1, 2),
        first_year_science(plan_code, "MEDSCI142", "MEDSCI 142: Biology for Biomedical Science: Organ Systems", 2, "S1_ELECTIVE_D"),
        milestone(plan_code, "WTRMHS100", "WTRMHS 100: Foundations for Effective Health Practice", 1, 2),
        milestone(plan_code, "S1_ELECTIVE_E", "Stage I elective", 1, 2, "elective"),
        milestone(plan_code, "POPLHLTH219", "POPLHLTH 219: Health Promotion and Community Development", 2, 1),
        milestone(plan_code, "POPLHLTH220", "POPLHLTH 220: Evidence and Community Health", 2, 1),
        milestone(plan_code, "POPLHLTH299", "POPLHLTH 299: Exploring Population Health Challenges", 2, 1),
        milestone(plan_code, "S2_ELECTIVE_A", "Stage I or above elective", 2, 1, "elective"),
        milestone(plan_code, "MAORIHTH201", "MAORIHTH 201: Introduction to Māori Health", 2, 2),
        milestone(plan_code, "S2_ELECTIVE_B", "Stage I or above elective", 2, 2, "elective"),
        milestone(plan_code, "S2_ELECTIVE_C", "Stage I or above elective", 2, 2, "elective"),
        milestone(plan_code, "GENED", "Approved General Education course", 2, 2, "general_education"),
        milestone(plan_code, "S3_GROUP_A", "Community Health Stage III Group A course", 3, 1, "major_choice", note="Choose POPLHLTH 321, 323, or 324."),
        milestone(plan_code, "S3_ELECTIVE_A", "Stage II or above elective", 3, 1, "elective"),
        milestone(plan_code, "S3_ELECTIVE_B", "Stage II or above elective", 3, 1, "elective"),
        milestone(plan_code, "CAPSTONE", "Approved Population Health capstone", 3, 1, "core_course", note="Choose POPLHLTH 398 or POPLHLTH 399."),
        milestone(plan_code, "POPLHLTH322", "POPLHLTH 322: Practice in Health Promotion", 3, 2),
        milestone(plan_code, "S3_GROUP_B", "Community Health Stage III Group B course", 3, 2, "major_choice", note="Choose MAORIHTH 301, POPLHLTH 312, or POPLHLTH 313."),
        milestone(plan_code, "S3_ELECTIVE_C", "Stage II or above elective", 3, 2, "elective"),
        milestone(plan_code, "S3_ELECTIVE_D", "Stage III elective", 3, 2, "elective"),
    ]


def health_data_plan(plan_code):
    group_a_note = "Choose two courses across these two slots from POPLHLTH 318, 319, 320, or 321."
    return [
        first_year_science(plan_code, "BIOSCI107", "BIOSCI 107: Biology for Biomedical Science: Cellular Processes", 1, "S1_ELECTIVE_A"),
        first_year_science(plan_code, "CHEM190", "CHEM 190: Chemistry for Medical and Life Sciences", 1, "S1_ELECTIVE_B"),
        milestone(plan_code, "POPLHLTH111", "POPLHLTH 111: Population Health", 1, 1),
        milestone(plan_code, "POPLHLTH112", "POPLHLTH 112: Introduction to Health Systems and Data Analytics", 1, 1),
        milestone(plan_code, "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
        first_year_science(plan_code, "MEDSCI142", "MEDSCI 142: Biology for Biomedical Science: Organ Systems", 2, "S1_ELECTIVE_C"),
        milestone(plan_code, "WTRMHS100", "WTRMHS 100: Foundations for Effective Health Practice", 1, 2),
        milestone(plan_code, "S1_ELECTIVE_D", "Stage I elective", 1, 2, "elective"),
        milestone(plan_code, "S1_ELECTIVE_E", "Stage I elective", 1, 2, "elective"),
        milestone(plan_code, "POPLHLTH218", "POPLHLTH 218: Understanding Health Systems", 2, 1),
        milestone(plan_code, "POPLHLTH299", "POPLHLTH 299: Exploring Population Health Challenges", 2, 1),
        milestone(plan_code, "S2_ELECTIVE_A", "Stage I or above elective", 2, 1, "elective"),
        milestone(plan_code, "S2_ELECTIVE_B", "Stage I or above elective", 2, 1, "elective"),
        milestone(plan_code, "MAORIHTH201", "MAORIHTH 201: Introduction to Māori Health", 2, 2),
        milestone(plan_code, "POPLHLTH217", "POPLHLTH 217: Health Data Science", 2, 2),
        milestone(plan_code, "S2_ELECTIVE_C", "Stage I or above elective", 2, 2, "elective"),
        milestone(plan_code, "GENED", "Approved General Education course", 2, 2, "general_education"),
        milestone(plan_code, "S3_GROUP_A_ONE", "Health Systems & Data Analytics Group A course (1 of 2)", 3, 1, "major_choice", note=group_a_note),
        milestone(plan_code, "S3_GROUP_A_TWO", "Health Systems & Data Analytics Group A course (2 of 2)", 3, 1, "major_choice", note=group_a_note),
        milestone(plan_code, "CAPSTONE", "Approved Population Health capstone", 3, 1, "core_course", note="Choose POPLHLTH 398 or POPLHLTH 399."),
        milestone(plan_code, "S3_ELECTIVE_A", "Stage II or above elective", 3, 1, "elective"),
        milestone(plan_code, "S3_ELECTIVE_B", "Stage II or above elective", 3, 2, "elective"),
        milestone(plan_code, "S3_ELECTIVE_C", "Stage II or above elective", 3, 2, "elective"),
        milestone(plan_code, "S3_ELECTIVE_D", "Stage II or above elective", 3, 2, "elective"),
        milestone(plan_code, "S3_ELECTIVE_E", "Stage III elective", 3, 2, "elective"),
    ]


# The catalogue publishes clinical and non-clinical variants for both BHSc majors.
# Each variant is independently prefixed so API queries cannot mix their courses.
BHSC_MILESTONES = (
    community_health_plan("COMH_CLINICAL")
    + community_health_plan("COMH_STANDARD")
    + health_data_plan("HSDA_CLINICAL")
    + health_data_plan("HSDA_STANDARD")
)


NURSING_MILESTONES = [
    milestone("BNURS_STANDARD", "BIOSCI107", "BIOSCI 107: Biology for Biomedical Science: Cellular Processes", 1, 1),
    milestone("BNURS_STANDARD", "NURSING104", "NURSING 104: Applied Science for Nurses", 1, 1),
    milestone("BNURS_STANDARD", "POPLHLTH111", "POPLHLTH 111: Population Health", 1, 1),
    milestone("BNURS_STANDARD", "WTRMHS100", "WTRMHS 100: Foundations for Effective Health Practice in Aotearoa", 1, 1),
    milestone("BNURS_STANDARD", "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
    milestone("BNURS_STANDARD", "HLTHPSYC122", "HLTHPSYC 122: Behaviour, Health and Development", 1, 2),
    milestone("BNURS_STANDARD", "MEDSCI142", "MEDSCI 142: Biology for Biomedical Science: Organ Systems", 1, 2),
    milestone("BNURS_STANDARD", "NURSING105", "NURSING 105: Nursing in Practice", 1, 2, points=30),
    milestone("BNURS_STANDARD", "NURSING199", "NURSING 199: English Language Competency", 1, 2, "competency", 0, note="Must be passed before enrolment in NURSING 201."),
    milestone("BNURS_STANDARD", "NURSING201", "NURSING 201: Nursing Clients with a Pathophysiological Problem", 2, 1, "clinical_course", 60),
    milestone("BNURS_STANDARD", "NURSING202", "NURSING 202: Mental Health, Addiction, (Dis)Ability and Enablement", 2, 2, "clinical_course", 60),
    milestone("BNURS_STANDARD", "NURSING301", "NURSING 301: Community Health and Wellbeing", 3, 1, "clinical_course", 60),
    milestone("BNURS_STANDARD", "NURSING302", "NURSING 302: Professional Nursing Practice", 3, 2, "clinical_course", 60),
]


PHARMACY_MILESTONES = [
    milestone("BPHARM_STANDARD", "BIOSCI107", "BIOSCI 107: Biology for Biomedical Science: Cellular Processes", 1, 1),
    milestone("BPHARM_STANDARD", "CHEM190", "CHEM 190: Chemistry for Medical and Life Sciences", 1, 1),
    milestone("BPHARM_STANDARD", "POPLHLTH111", "POPLHLTH 111: Population Health", 1, 1),
    milestone("BPHARM_STANDARD", "S1_ELECTIVE_A", "Part I elective course", 1, 1, "elective"),
    milestone("BPHARM_STANDARD", "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
    milestone("BPHARM_STANDARD", "MEDSCI142", "MEDSCI 142: Biology for Biomedical Science: Organ Systems", 1, 2),
    milestone("BPHARM_STANDARD", "WTR_COURSE", "Required Waipapa Taumata Rau course", 1, 2, "required_choice", note="Complete WTRMHS 100 or WTRSCI 100, as required for your Part I programme."),
    milestone("BPHARM_STANDARD", "S1_ELECTIVE_B", "Part I elective course", 1, 2, "elective"),
    milestone("BPHARM_STANDARD", "S1_ELECTIVE_C", "Part I elective course", 1, 2, "elective"),
    milestone("BPHARM_STANDARD", "PHARMACY211", "PHARMACY 211: Applied Science for Pharmacy", 2, 1, "pharmacy_course", 30),
    milestone("BPHARM_STANDARD", "PHARMACY212", "PHARMACY 212: Pharmaceutical Science and Practice", 2, 1, "pharmacy_course", 30),
    milestone("BPHARM_STANDARD", "PHARMACY199", "PHARMACY 199: English Language Competency", 2, 1, "competency", 0, note="Must be passed before enrolment in PHARMACY 213."),
    milestone("BPHARM_STANDARD", "PHARMACY213", "PHARMACY 213: Pharmacy 1", 2, 2, "clinical_course", 60),
    milestone("BPHARM_STANDARD", "PHARMACY311", "PHARMACY 311: Pharmacy 2", 3, 1, "clinical_course", 60),
    milestone("BPHARM_STANDARD", "PHARMACY312", "PHARMACY 312: Pharmacy 3", 3, 2, "clinical_course", 60),
    milestone("BPHARM_STANDARD", "PHARMACY413A", "PHARMACY 413A: Research Inquiry in Pharmacy", 4, 1, "research", 15),
    milestone("BPHARM_STANDARD", "PHARMACY701", "PHARMACY 701: Medicine Optimisation 1", 4, 1, "clinical_course", 45),
    milestone("BPHARM_STANDARD", "PHARMACY413B", "PHARMACY 413B: Research Inquiry in Pharmacy", 4, 2, "research", 15),
    milestone("BPHARM_STANDARD", "PHARMACY702", "PHARMACY 702: Medicine Optimisation 2", 4, 2, "clinical_course", 45),
]


OPTOMETRY_MILESTONES = [
    milestone("BOPTOM_STANDARD", "BIOSCI107", "BIOSCI 107: Biology for Biomedical Science: Cellular Processes", 1, 1),
    milestone("BOPTOM_STANDARD", "CHEM190", "CHEM 190: Chemistry for Medical and Life Sciences", 1, 1),
    milestone("BOPTOM_STANDARD", "POPLHLTH111", "POPLHLTH 111: Population Health", 1, 1),
    milestone("BOPTOM_STANDARD", "PART1_ELECTIVE_A", "Part I degree course", 1, 1, "elective"),
    milestone("BOPTOM_STANDARD", "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
    milestone("BOPTOM_STANDARD", "MEDSCI142", "MEDSCI 142: Biology for Biomedical Science: Organ Systems", 1, 2),
    milestone("BOPTOM_STANDARD", "WTR_COURSE", "Required Waipapa Taumata Rau course", 1, 2, "required_choice", note="Complete WTRMHS 100 or WTRSCI 100."),
    milestone("BOPTOM_STANDARD", "PART1_ELECTIVE_B", "Part I degree course", 1, 2, "elective"),
    milestone("BOPTOM_STANDARD", "PART1_ELECTIVE_C", "Part I degree course", 1, 2, "elective"),
    milestone("BOPTOM_STANDARD", "OPTOM216AB", "OPTOM 216A/B: Introduction to Optometry", 2, "full year", "optometry_course", 30),
    milestone("BOPTOM_STANDARD", "OPTOM263AB", "OPTOM 263A/B: Essential Optics", 2, "full year", "optometry_course", 30),
    milestone("BOPTOM_STANDARD", "OPTOM272AB", "OPTOM 272A/B: Visual Science 1", 2, "full year", "optometry_course", 30),
    milestone("BOPTOM_STANDARD", "MEDSCI203", "MEDSCI 203: Mechanisms of Disease", 2, 1),
    milestone("BOPTOM_STANDARD", "GENED", "Approved General Education course", 2, 2, "general_education"),
    milestone("BOPTOM_STANDARD", "OPTOM316AB", "OPTOM 316A/B: Optometry", 3, "full year", "clinical_course", 60),
    milestone("BOPTOM_STANDARD", "OPTOM345AB", "OPTOM 345A/B: Principles of Ocular Pharmacology", 3, "full year", "optometry_course", 15),
    milestone("BOPTOM_STANDARD", "OPTOM353AB", "OPTOM 353A/B: Ocular Pathology", 3, "full year", "optometry_course", 15),
    milestone("BOPTOM_STANDARD", "OPTOM375AB", "OPTOM 375A/B: Visual Science 2", 3, "full year", "optometry_course", 15),
    milestone("BOPTOM_STANDARD", "MEDSCI202", "MEDSCI 202: Microbiology and Immunology", 3, 1),
    milestone("BOPTOM_STANDARD", "OPTOM416AB", "OPTOM 416A/B: Clinical Optometry", 4, "full year", "clinical_course", 30),
    milestone("BOPTOM_STANDARD", "OPTOM430AB", "OPTOM 430A/B: Contact Lens Practice", 4, "full year", "clinical_course", 15),
    milestone("BOPTOM_STANDARD", "OPTOM442AB", "OPTOM 442A/B: Optometry for Special Populations", 4, "full year", "clinical_course", 15),
    milestone("BOPTOM_STANDARD", "OPTOM450AB", "OPTOM 450A/B: Diseases of the Eye and Visual System", 4, "full year", "clinical_course", 30),
    milestone("BOPTOM_STANDARD", "OPTOM783AB", "OPTOM 783A/B: Research Project in Vision Science", 4, "full year", "research", 30),
    milestone("BOPTOM_STANDARD", "OPTOM510AB", "OPTOM 510A/B: Advanced Clinical Optometry 1", 5, "full year", "clinical_course", 30),
    milestone("BOPTOM_STANDARD", "OPTOM520AB", "OPTOM 520A/B: Advanced Clinical Optometry 2", 5, "full year", "clinical_course", 30),
    milestone("BOPTOM_STANDARD", "OPTOM561AB", "OPTOM 561A/B: Optometry in Practice", 5, "full year", "clinical_course", 60),
]


MEDICINE_MILESTONES = [
    milestone("MBCHB_STANDARD", "BIOSCI107", "BIOSCI 107: Biology for Biomedical Science: Cellular Processes", 1, 1),
    milestone("MBCHB_STANDARD", "CHEM190", "CHEM 190: Chemistry for Medical and Life Sciences", 1, 1),
    milestone("MBCHB_STANDARD", "POPLHLTH111", "POPLHLTH 111: Population Health", 1, 1),
    milestone("MBCHB_STANDARD", "PART1_ELECTIVE_A", "Part I degree course", 1, 1, "elective"),
    milestone("MBCHB_STANDARD", "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
    milestone("MBCHB_STANDARD", "MEDSCI142", "MEDSCI 142: Biology for Biomedical Science: Organ Systems", 1, 2),
    milestone("MBCHB_STANDARD", "WTR_COURSE", "Required Waipapa Taumata Rau course", 1, 2, "required_choice", note="Complete WTRMHS 100 or WTRSCI 100."),
    milestone("MBCHB_STANDARD", "PART1_ELECTIVE_B", "Part I degree course", 1, 2, "elective"),
    milestone("MBCHB_STANDARD", "PART1_ELECTIVE_C", "Part I degree course", 1, 2, "elective"),
    milestone("MBCHB_STANDARD", "MBCHB221A", "MBCHB 221A: Medicine Part II", 2, 1, "medical_course", 60),
    milestone("MBCHB_STANDARD", "MBCHB221B", "MBCHB 221B: Medicine Part II", 2, 2, "medical_course", 60),
    milestone("MBCHB_STANDARD", "MBCHB311AB", "MBCHB 311A/B: Medical Humanities", 3, "full year", "medical_course", 15),
    milestone("MBCHB_STANDARD", "MBCHB321AB", "MBCHB 321A/B: Medicine Part III", 3, "full year", "medical_course", 105),
    milestone("MBCHB_STANDARD", "MBCHB401A", "MBCHB 401A: Medicine Part IV", 4, 1, "clinical_course", 60),
    milestone("MBCHB_STANDARD", "MBCHB401B", "MBCHB 401B: Medicine Part IV", 4, 2, "clinical_course", 60),
    milestone("MBCHB_STANDARD", "MBCHB501A", "MBCHB 501A: Medicine Part V", 5, 1, "clinical_course", 60),
    milestone("MBCHB_STANDARD", "MBCHB501B", "MBCHB 501B: Medicine Part V", 5, 2, "clinical_course", 60),
    milestone("MBCHB_STANDARD", "MBCHB551A", "MBCHB 551A: Medicine Part VI", 6, 1, "clinical_course", 60),
    milestone("MBCHB_STANDARD", "MBCHB551B", "MBCHB 551B: Medicine Part VI", 6, 2, "clinical_course", 60),
]


CERTHSC_MILESTONES = [
    milestone("CERTHSC_STANDARD", "MAORIHTH21H", "MAORIHTH 21H: Introduction to Biology", 1, 1, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH23H", "MAORIHTH 23H: Chemistry 1", 1, 1, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH25H", "MAORIHTH 25H: Population Health 1", 1, 1, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH27H", "MAORIHTH 27H: Academic and Professional Development 1", 1, 1, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH29H", "MAORIHTH 29H: Introduction to Mathematics", 1, 1, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH22H", "MAORIHTH 22H: Introduction to Anatomy and Physiology", 1, 2, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH24H", "MAORIHTH 24H: Chemistry 2", 1, 2, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH26H", "MAORIHTH 26H: Population Health 2", 1, 2, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH28H", "MAORIHTH 28H: Academic and Professional Development 2", 1, 2, points=12),
    milestone("CERTHSC_STANDARD", "MAORIHTH30H", "MAORIHTH 30H: Introduction to Health Psychology", 1, 2, points=12),
    milestone("CERTHSC_STANDARD", "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
]


BIOMEDICAL_MILESTONES = [
    milestone("BBIOMED_STANDARD", "BIOMED101", "BIOMED 101: Biomedical Beginnings", 1, 1),
    milestone("BBIOMED_STANDARD", "BIOSCI107", "BIOSCI 107: Biology for Biomedical Science: Cellular Processes", 1, 1),
    milestone("BBIOMED_STANDARD", "CHEM190", "CHEM 190: Chemistry for Medical and Life Sciences", 1, 1),
    milestone("BBIOMED_STANDARD", "POPLHLTH111", "POPLHLTH 111: Population Health", 1, 1, note="Students not applying to a clinical programme may replace this with another Stage I elective."),
    milestone("BBIOMED_STANDARD", "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
    milestone("BBIOMED_STANDARD", "MEDSCI142", "MEDSCI 142: Biology for Biomedical Science: Organ Systems", 1, 2),
    milestone("BBIOMED_STANDARD", "WTRMHS100", "WTRMHS 100: Foundations for Effective Health Practice in Aotearoa", 1, 2),
    milestone("BBIOMED_STANDARD", "S1_ELECTIVE_A", "Stage I elective", 1, 2, "elective"),
    milestone("BBIOMED_STANDARD", "S1_ELECTIVE_B", "Stage I elective", 1, 2, "elective"),
] + [
    milestone("BBIOMED_STANDARD", f"S2_REQUIREMENT_{letter}", f"Approved Stage II Biomedical Science requirement {letter}", 2, 1 if index < 4 else 2, "major_choice", note="Select from the official advanced-course schedule with prerequisite advice.")
    for index, letter in enumerate("ABCDEFGH")
] + [
    milestone("BBIOMED_STANDARD", "S3_ADVANCED_A", "Approved Stage III Biomedical Science course (1 of 5)", 3, 1, "major_choice"),
    milestone("BBIOMED_STANDARD", "S3_ADVANCED_B", "Approved Stage III Biomedical Science course (2 of 5)", 3, 1, "major_choice"),
    milestone("BBIOMED_STANDARD", "S3_ADVANCED_C", "Approved Stage III Biomedical Science course (3 of 5)", 3, 1, "major_choice"),
    milestone("BBIOMED_STANDARD", "S3_ADVANCED_D", "Approved Stage III Biomedical Science course (4 of 5)", 3, 2, "major_choice"),
    milestone("BBIOMED_STANDARD", "S3_ADVANCED_E", "Approved Stage III Biomedical Science course (5 of 5)", 3, 2, "major_choice"),
    milestone("BBIOMED_STANDARD", "BIOMED_CAPSTONE", "Approved Biomedical Science capstone", 3, 2, "capstone"),
    milestone("BBIOMED_STANDARD", "S3_ELECTIVE_A", "Approved degree elective", 3, 2, "elective"),
    milestone("BBIOMED_STANDARD", "S3_ELECTIVE_B", "Approved degree elective", 3, 2, "elective"),
]


SPORTHPE_MILESTONES = [
    milestone("BSPORTHPE_GENERAL", code, title, stage, "to be planned", category)
    for code, title, stage, category in [
        ("SPORT101", "SPORT 101: Introduction to Sport and Exercise in Aotearoa New Zealand", 1, "core_course"),
        ("SPORTHPE101", "SPORTHPE 101: Introduction to Sport, Health and Physical Education", 1, "core_course"),
        ("SPORTHPE102", "SPORTHPE 102: Foundations of Human Movement", 1, "core_course"),
        ("SPORTHPE103", "SPORTHPE 103: Health and Physical Education", 1, "core_course"),
        ("SPORTHPE104", "SPORTHPE 104: Sport, Culture and Society", 1, "core_course"),
        ("GROUP1_A", "Group 1 elective (1 of 2)", 1, "pathway_choice"),
        ("GROUP1_B", "Group 1 elective (2 of 2)", 1, "pathway_choice"),
        ("GROUP2_A", "Group 2 elective (1 of 7)", 1, "pathway_choice"),
        ("EDUCSW201", "EDUCSW 201: Learning in Practice", 2, "core_course"),
        ("HEALTHED201", "HEALTHED 201: Promoting Health and Wellbeing", 2, "core_course"),
        ("SPORT202", "SPORT 202: Sport and Recreation Management", 2, "core_course"),
        ("SPORTHPE201", "SPORTHPE 201: Advanced Human Movement", 2, "core_course"),
        ("SPORTHPE202", "SPORTHPE 202: Pedagogy and Learning", 2, "core_course"),
        ("SPORTHPE203", "SPORTHPE 203: Sport, Health and Society", 2, "core_course"),
        ("GROUP2_B", "Group 2 elective (2 of 7)", 2, "pathway_choice"),
        ("GROUP2_C", "Group 2 elective (3 of 7)", 2, "pathway_choice"),
        ("EDUCSW302", "EDUCSW 302: Service Learning", 3, "core_course"),
        ("EDUCSW303", "EDUCSW 303: Research and Professional Practice", 3, "core_course"),
        ("GROUP2_D", "Group 2 elective (4 of 7)", 3, "pathway_choice"),
        ("GROUP2_E", "Group 2 elective (5 of 7)", 3, "pathway_choice"),
        ("GROUP2_F", "Group 2 elective (6 of 7)", 3, "pathway_choice"),
        ("GROUP2_G", "Group 2 elective (7 of 7)", 3, "pathway_choice"),
        ("GENED_A", "Approved General Education course (1 of 2)", 3, "general_education"),
        ("GENED_B", "Approved General Education course (2 of 2)", 3, "general_education"),
    ]
] + [
    milestone("BSPORTHPE_GENERAL", "EDUCSW199", "EDUCSW 199: English Language Competency", 1, "as required", "competency", 0),
    milestone("BSPORTHPE_GENERAL", "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
]


def bsc_health_plan(plan_code, major, stage_two, stage_three, capstone):
    milestones = [
        milestone(plan_code, "BIOSCI107", "BIOSCI 107: Biology for Biomedical Science: Cellular Processes", 1, 1),
        milestone(plan_code, "CHEM190", "CHEM 190: Chemistry for Medical and Life Sciences", 1, 1),
        milestone(plan_code, "POPLHLTH111", "POPLHLTH 111: Population Health", 1, 1),
        milestone(plan_code, "MAJOR_STAGE1", f"{major} Stage I course or approved choice", 1, 1, "major_choice"),
        milestone(plan_code, "MEDSCI142", "MEDSCI 142: Biology for Biomedical Science: Organ Systems", 1, 2),
        milestone(plan_code, "WTRSCI100", "WTRSCI 100: Contemporary Science in Aotearoa New Zealand", 1, 2),
        milestone(plan_code, "NUMERACY", "Approved BSc numeracy course", 1, 2, "numeracy"),
        milestone(plan_code, "S1_SCIENCE", "Bachelor of Science course", 1, 2, "elective"),
        milestone(plan_code, "ACADINT", "ACADINT A01: Academic Integrity Course", 1, 1, "university_requirement", 0),
    ]
    for index, title in enumerate(stage_two):
        milestones.append(milestone(plan_code, f"MAJOR_S2_{index + 1}", title, 2, 1 if index < 2 else 2, "major_choice"))
    for index in range(5):
        milestones.append(milestone(plan_code, f"S2_SCIENCE_{index + 1}", "Bachelor of Science course", 2, 1 if index < 2 else 2, "elective"))
    for index, title in enumerate(stage_three):
        milestones.append(milestone(plan_code, f"MAJOR_S3_{index + 1}", title, 3, 1 if index < 2 else 2, "major_choice"))
    milestones.extend([
        milestone(plan_code, "CAPSTONE", capstone, 3, 2, "capstone"),
        milestone(plan_code, "S3_SCIENCE_A", "Stage II or III Science course", 3, 1, "elective"),
        milestone(plan_code, "S3_SCIENCE_B", "Stage II or III Science course", 3, 1, "elective"),
        milestone(plan_code, "GENED_A", "Approved General Education course (1 of 2)", 3, 2, "general_education"),
        milestone(plan_code, "GENED_B", "Approved General Education course (2 of 2)", 3, 2, "general_education"),
    ])
    return milestones


BSC_MILESTONES = (
    bsc_health_plan("BSC_CMB", "Cell and Molecular Bioscience", ["Cell and Molecular Bioscience Stage II choice (1 of 3)", "Cell and Molecular Bioscience Stage II choice (2 of 3)", "Cell and Molecular Bioscience Stage II choice (3 of 3)"], ["Cell and Molecular Bioscience Stage III choice (1 of 3)", "Cell and Molecular Bioscience Stage III choice (2 of 3)", "Cell and Molecular Bioscience Stage III choice (3 of 3)"], "Approved Cell and Molecular Bioscience capstone")
    + bsc_health_plan("BSC_EXERCISE", "Exercise Sciences", ["Exercise Sciences Stage II choice (1 of 3)", "Exercise Sciences Stage II choice (2 of 3)", "Exercise Sciences Stage II choice (3 of 3)"], ["Exercise Sciences Stage III choice (1 of 3)", "Exercise Sciences Stage III choice (2 of 3)", "Exercise Sciences Stage III choice (3 of 3)"], "EXERSCI 399: Capstone in Exercise Sciences")
    + bsc_health_plan("BSC_MEDCHEM", "Medicinal Chemistry", ["Medicinal Chemistry Stage II choice (1 of 3)", "Medicinal Chemistry Stage II choice (2 of 3)", "Medicinal Chemistry Stage II choice (3 of 3)"], ["Medicinal Chemistry Stage III choice (1 of 3)", "Medicinal Chemistry Stage III choice (2 of 3)", "Medicinal Chemistry Stage III choice (3 of 3)"], "Approved Medicinal Chemistry capstone")
    + bsc_health_plan("BSC_NUTRITION", "Nutrition", ["Nutrition Stage II choice (1 of 3)", "Nutrition Stage II choice (2 of 3)", "Nutrition Stage II choice (3 of 3)"], ["Nutrition Stage III choice (1 of 3)", "Nutrition Stage III choice (2 of 3)", "Nutrition Stage III choice (3 of 3)"], "Approved Nutrition capstone")
    + bsc_health_plan("BSC_PHARMACOLOGY", "Pharmacology", ["MEDSCI 204: Pharmacology and Toxicology", "Pharmacology Stage II choice (1 of 2)", "Pharmacology Stage II choice (2 of 2)"], ["MEDSCI 318: Pharmacology course", "MEDSCI 319: Pharmacology course", "MEDSCI 320: Pharmacology course"], "PHARMCOL 399: Capstone in Pharmacology")
    + bsc_health_plan("BSC_PHYSIOLOGY", "Physiology", ["MEDSCI 205: The Physiology of Human Organ Systems", "MEDSCI 206: Principles of Neuroscience", "Physiology Stage II elective"], ["Physiology Stage III elective (1 of 3)", "Physiology Stage III elective (2 of 3)", "Physiology Stage III elective (3 of 3)"], "PHYSIOL 399: Capstone in Physiology")
)


def seed_programme(db, programme_name, milestones, official_url):
    programme = (
        db.query(Programme)
        .filter(Programme.name.ilike(f"{programme_name}%"))
        .first()
    )
    if programme is None:
        raise RuntimeError(f"{programme_name} programme not found")

    for sort_order, data in enumerate(milestones, start=1):
        item = (
            db.query(ProgrammeMilestone)
            .filter(
                ProgrammeMilestone.programme_id == programme.id,
                ProgrammeMilestone.catalogue_year == CATALOGUE_YEAR,
                ProgrammeMilestone.code == data["code"],
            )
            .first()
        )
        if item is None:
            item = ProgrammeMilestone(
                programme=programme,
                catalogue_year=CATALOGUE_YEAR,
                code=data["code"],
            )
            db.add(item)

        for field, value in data.items():
            setattr(item, field, value)
        item.sort_order = sort_order
        item.required = True
        item.official_url = official_url

    managed_codes = [item["code"] for item in milestones]
    obsolete_ids = [
        milestone_id
        for (milestone_id,) in (
            db.query(ProgrammeMilestone.id)
            .filter(
                ProgrammeMilestone.programme_id == programme.id,
                ProgrammeMilestone.catalogue_year == CATALOGUE_YEAR,
                ~ProgrammeMilestone.code.in_(managed_codes),
            )
            .all()
        )
    ]
    if obsolete_ids:
        db.query(StudentMilestoneProgress).filter(
            StudentMilestoneProgress.milestone_id.in_(obsolete_ids)
        ).delete(synchronize_session=False)
        db.query(ProgrammeMilestone).filter(
            ProgrammeMilestone.id.in_(obsolete_ids)
        ).delete(synchronize_session=False)

    return len(milestones)


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        total = seed_programme(
            db,
            "Bachelor of Health Sciences",
            BHSC_MILESTONES,
            BHSC_OFFICIAL_URL,
        )
        total += seed_programme(
            db,
            "Bachelor of Nursing",
            NURSING_MILESTONES,
            BNURS_OFFICIAL_URL,
        )
        total += seed_programme(
            db,
            "Bachelor of Pharmacy",
            PHARMACY_MILESTONES,
            BPHARM_OFFICIAL_URL,
        )
        total += seed_programme(db, "Bachelor of Optometry", OPTOMETRY_MILESTONES, BOPTOM_OFFICIAL_URL)
        total += seed_programme(db, "Bachelor of Medicine", MEDICINE_MILESTONES, MBCHB_OFFICIAL_URL)
        total += seed_programme(db, "Certificate in Health Sciences", CERTHSC_MILESTONES, CERTHSC_OFFICIAL_URL)
        total += seed_programme(db, "Bachelor of Biomedical Science", BIOMEDICAL_MILESTONES, BBIOMED_OFFICIAL_URL)
        total += seed_programme(db, "Bachelor of Sport", SPORTHPE_MILESTONES, BSPORTHPE_OFFICIAL_URL)
        total += seed_programme(db, "Bachelor of Science", BSC_MILESTONES, BSC_OFFICIAL_URL)
        db.commit()
        all_milestones = (
            BHSC_MILESTONES + NURSING_MILESTONES + PHARMACY_MILESTONES
            + OPTOMETRY_MILESTONES + MEDICINE_MILESTONES + CERTHSC_MILESTONES
            + BIOMEDICAL_MILESTONES + SPORTHPE_MILESTONES + BSC_MILESTONES
        )
        plan_count = len({item["code"].split(":", 1)[0] for item in all_milestones})
        print(
            f"Seeded {total} journey milestones for {CATALOGUE_YEAR} "
            f"across {plan_count} plans."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
