JOURNEY_PLAN_OPTIONS = {
    "COMH_CLINICAL": {
        "code": "COMH_CLINICAL",
        "name": "Community Health — clinical-selection pathway",
        "major": "Community Health",
        "clinical_pathway": True,
        "description": (
            "Includes BIOSCI 107, CHEM 190, MEDSCI 142 and POPLHLTH 111 "
            "in first year. Students may apply competitively for Medicine, Pharmacy, "
            "Optometry or Medical Imaging; entry is not guaranteed."
        ),
    },
    "COMH_STANDARD": {
        "code": "COMH_STANDARD",
        "name": "Community Health — standard pathway",
        "major": "Community Health",
        "clinical_pathway": False,
        "description": (
            "Uses Stage I electives in place of BIOSCI 107, CHEM 190 and "
            "MEDSCI 142 for students not applying to a clinical programme."
        ),
    },
    "HSDA_CLINICAL": {
        "code": "HSDA_CLINICAL",
        "name": "Health Systems & Data Analytics — clinical-selection pathway",
        "major": "Health Systems & Data Analytics",
        "clinical_pathway": True,
        "description": (
            "Includes BIOSCI 107, CHEM 190, MEDSCI 142 and POPLHLTH 111 "
            "in first year. Students may apply competitively for Medicine, Pharmacy, "
            "Optometry or Medical Imaging; entry is not guaranteed."
        ),
    },
    "HSDA_STANDARD": {
        "code": "HSDA_STANDARD",
        "name": "Health Systems & Data Analytics — standard pathway",
        "major": "Health Systems & Data Analytics",
        "clinical_pathway": False,
        "description": (
            "Uses Stage I electives in place of BIOSCI 107, CHEM 190 and "
            "MEDSCI 142 for students not applying to a clinical programme."
        ),
    },
    "BNURS_STANDARD": {
        "code": "BNURS_STANDARD",
        "name": "Bachelor of Nursing — standard 2027 plan",
        "major": "Bachelor of Nursing",
        "clinical_pathway": False,
        "description": (
            "The fixed three-part Nursing structure, including foundation "
            "science, nursing practice, and clinical learning requirements."
        ),
    },
    "BPHARM_STANDARD": {
        "code": "BPHARM_STANDARD",
        "name": "Bachelor of Pharmacy — standard 2027 plan",
        "major": "Bachelor of Pharmacy",
        "clinical_pathway": False,
        "description": (
            "The four-part Pharmacy structure, including the Part I entry "
            "courses, pharmaceutical practice, placements, and research inquiry."
        ),
    },
    "BOPTOM_STANDARD": {
        "code": "BOPTOM_STANDARD",
        "name": "Bachelor of Optometry — standard 2027 plan",
        "major": "Bachelor of Optometry",
        "clinical_pathway": False,
        "description": "The five-part, 600-point Optometry programme, including clinical practice and the research project.",
    },
    "MBCHB_STANDARD": {
        "code": "MBCHB_STANDARD",
        "name": "Medicine and Surgery — standard 2027 plan",
        "major": "Medicine and Surgery",
        "clinical_pathway": False,
        "description": "The six-part, 720-point MBChB structure. Part I is the required pre-clinical year.",
    },
    "CERTHSC_STANDARD": {
        "code": "CERTHSC_STANDARD",
        "name": "Certificate in Health Sciences — standard plan",
        "major": "Certificate in Health Sciences",
        "clinical_pathway": False,
        "description": "The one-year, 120-point foundation programme for Māori and Pacific students.",
    },
    "BBIOMED_STANDARD": {
        "code": "BBIOMED_STANDARD",
        "name": "Biomedical Science — clinical-entry pathway",
        "major": "Biomedical Science",
        "clinical_pathway": True,
        "description": (
            "The new three-year Biomedical Science degree with the required first-year "
            "clinical courses. This makes a student eligible to apply competitively for "
            "Medicine, Pharmacy, Optometry or Medical Imaging after first year; entry is not guaranteed."
        ),
    },
    "BSPORTHPE_GENERAL": {
        "code": "BSPORTHPE_GENERAL",
        "name": "Sport, Health and Physical Education — general plan",
        "major": "Sport, Health and Physical Education",
        "clinical_pathway": False,
        "description": "The general 360-point plan. Specialised pathway choices can be added later without changing student progress.",
    },
    "BSC_CMB": {
        "code": "BSC_CMB", "name": "BSc — Cell and Molecular Bioscience — clinical-entry pathway", "major": "Cell and Molecular Bioscience", "clinical_pathway": True,
        "description": "Includes the required first-year clinical courses. Students may apply competitively for Medicine, Pharmacy, Optometry or Medical Imaging; entry is not guaranteed.",
    },
    "BSC_EXERCISE": {
        "code": "BSC_EXERCISE", "name": "BSc — Exercise Sciences — clinical-entry pathway", "major": "Exercise Sciences", "clinical_pathway": True,
        "description": "Includes the required first-year clinical courses. Students may apply competitively for Medicine, Pharmacy, Optometry or Medical Imaging; entry is not guaranteed.",
    },
    "BSC_MEDCHEM": {
        "code": "BSC_MEDCHEM", "name": "BSc — Medicinal Chemistry — clinical-entry pathway", "major": "Medicinal Chemistry", "clinical_pathway": True,
        "description": "Includes the required first-year clinical courses. Students may apply competitively for Medicine, Pharmacy, Optometry or Medical Imaging; entry is not guaranteed.",
    },
    "BSC_NUTRITION": {
        "code": "BSC_NUTRITION", "name": "BSc — Nutrition — clinical-entry pathway", "major": "Nutrition", "clinical_pathway": True,
        "description": "Includes the required first-year clinical courses. Students may apply competitively for Medicine, Pharmacy, Optometry or Medical Imaging; entry is not guaranteed.",
    },
    "BSC_PHARMACOLOGY": {
        "code": "BSC_PHARMACOLOGY", "name": "BSc — Pharmacology — clinical-entry pathway", "major": "Pharmacology", "clinical_pathway": True,
        "description": "Includes the required first-year clinical courses. Students may apply competitively for Medicine, Pharmacy, Optometry or Medical Imaging; entry is not guaranteed.",
    },
    "BSC_PHYSIOLOGY": {
        "code": "BSC_PHYSIOLOGY", "name": "BSc — Physiology — clinical-entry pathway", "major": "Physiology", "clinical_pathway": True,
        "description": "Includes the required first-year clinical courses. Students may apply competitively for Medicine, Pharmacy, Optometry or Medical Imaging; entry is not guaranteed.",
    },
}


def get_plan_option(plan_code: str):
    return JOURNEY_PLAN_OPTIONS.get(plan_code.strip().upper())
