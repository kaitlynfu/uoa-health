from bs4 import BeautifulSoup

from app.services.career_service import extract_career_names
from app.services.scraper.programme_scraper import extract_image_url


def test_extracts_list_style_careers():
    assert extract_career_names(
        "Health analyst, Policy adviser, Community health lead"
    ) == ["Health analyst", "Policy adviser", "Community health lead"]


def test_ignores_narrative_career_text():
    narrative = (
        "Because science supports many industries and communities across New "
        "Zealand, graduates can explore a very wide range of opportunities, "
        "government, teaching and research."
    )

    assert extract_career_names(narrative) == []


def test_ignores_study_pathways_that_are_not_careers():
    pathways = (
        "This certificate provides an entry pathway into the Bachelor of "
        "Nursing, Bachelor of Health Sciences, or Pharmacy."
    )

    assert extract_career_names(pathways) == []


def test_removes_explanatory_note_from_career_name():
    careers = (
        "Sports coach, Primary or secondary teacher — you will be required "
        "to add a teaching qualification, Event manager"
    )

    assert extract_career_names(careers) == [
        "Sports coach",
        "Primary or secondary teacher",
        "Event manager",
    ]


def test_extracts_and_resolves_social_image():
    soup = BeautifulSoup(
        '<meta property="og:image" content="/images/programme.jpg">',
        "html.parser",
    )

    assert extract_image_url(soup, "https://example.test/programme") == (
        "https://example.test/images/programme.jpg"
    )


def test_extracts_banner_image_when_social_image_is_missing():
    soup = BeautifulSoup(
        '<img class="banner__img" src="/images/banner.jpg">',
        "html.parser",
    )

    assert extract_image_url(soup, "https://example.test/programme") == (
        "https://example.test/images/banner.jpg"
    )
