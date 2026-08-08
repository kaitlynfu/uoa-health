import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.auckland.ac.nz"

START_URL = (
    "https://www.auckland.ac.nz/en/study/study-options/"
    "find-a-study-option/health-medicine-and-biomedical-sciences.html"
)



def is_programme_url(href: str) -> bool:
    """
    Returns True only for first-entry undergraduate programmes.
    """

    if not href:
        return False

    if "find-a-study-option" not in href:
        return False

    slug = href.split("/")[-1].lower()

    # Only bachelor's degrees and certificates
    if not slug.startswith(("bachelor-of-", "certificate-")):
        return False

    # Exclude honours qualifications
    if "honours" in slug:
        return False

    return not slug.endswith("hons.html")


def get_programme_urls():
    """
    Returns a set of programme URLs from the Health page.
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
