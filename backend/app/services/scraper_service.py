import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.auckland.ac.nz"

START_URL = (
    "https://www.auckland.ac.nz/en/study/study-options/"
    "find-a-study-option/health-medicine-and-biomedical-sciences.html"
)


def get_text(element):
    """
    Returns cleaned text from a BeautifulSoup element.
    Returns None if the element doesn't exist.
    """
    if element:
        return element.get_text(" ", strip=True)
    return None


def is_programme_url(href: str) -> bool:
    """
    Returns True only if the URL is for a qualification/programme page.
    """

    if not href:
        return False

    if "find-a-study-option" not in href:
        return False

    slug = href.split("/")[-1]

    programme_prefixes = (
        "bachelor-of-",
        "master-of-",
        "doctor-of-",
        "certificate-",
        "graduate-diploma-",
        "postgraduate-certificate-",
        "postgraduate-diploma-",
    )

    return slug.startswith(programme_prefixes)


def get_programme_urls():
    """
    Returns all programme URLs from the Health study page.
    """

    response = requests.get(START_URL, timeout=10)

    if response.status_code != 200:
        print(f"Failed to fetch page ({response.status_code})")
        return set()

    soup = BeautifulSoup(response.text, "html.parser")

    programme_urls = set()

    for link in soup.find_all("a"):

        href = link.get("href")

        if is_programme_url(href):

            if href.startswith("/"):
                href = BASE_URL + href

            programme_urls.add(href)

    return programme_urls


def scrape_programme(url):
    """
    Scrapes one programme page.
    """

    response = requests.get(url, timeout=10)

    if response.status_code != 200:
        print(f"Failed to fetch {url}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")

    # ----------------------------
    # Programme Name
    # ----------------------------

    name = get_text(soup.find("h1"))

    # ----------------------------
    # Faculty
    # ----------------------------

    faculty = get_text(
        soup.find("p", class_="banner__faculty")
    )

    # ----------------------------
    # Quick Facts
    # ----------------------------

    duration = None

    quick_facts = soup.find_all("dl", class_="quick-facts__list")

    for fact in quick_facts:

        heading = get_text(fact.find("dt"))
        value = get_text(fact.find("dd"))

        if heading == "Duration":
            duration = value

    # ----------------------------
    # Programme Dictionary
    # ----------------------------

    programme = {
        "name": name,
        "faculty": faculty,
        "description": None,
        "duration": duration,
        "entry_requirements": None,
        "career_pathways": None,
        "programme_url": url,
        "image_url": None,
    }

    return programme