import requests
from bs4 import BeautifulSoup

from .utils import get_text


def scrape_programme(url):
    """
    Scrapes a single programme page and returns a dictionary.
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
    # Description
    # ----------------------------

    description = None

    section_heading = soup.find(
        "h2",
        string=lambda s: s and "Programme overview" in s
    )

    if section_heading:

        section_container = section_heading.find_parent("div")

        if section_container:

            text_div = section_container.find_next_sibling(
                "div",
                class_="text"
            )

            if text_div:

                paragraphs = []

                for child in text_div.children:

                    # Stop when we reach Programme Highlights
                    if getattr(child, "name", None) == "h4":
                        break

                    if getattr(child, "name", None) == "p":

                        text = get_text(child)

                        if text:
                            paragraphs.append(text)

                description = "\n\n".join(paragraphs)
                

    # ----------------------------
    # Career Pathways
    # ----------------------------

    career_pathways = None

    career_heading = soup.find(
        "h3",
        string=lambda s: s and "Jobs related to this programme" in s
    )

    if career_heading:

        career_list = career_heading.find_next("ul")

        if career_list:

            jobs = []

            for job in career_list.find_all("li"):

                text = get_text(job)

                if text:
                    jobs.append(text)

            career_pathways = ", ".join(jobs)
    

    # ----------------------------
    # Entry Requirements
    # ----------------------------

    entry_requirements = None

    entry_heading = soup.find(
        "h2",
        string=lambda s: s and "entry requirements" in s.lower()
    )

    if entry_heading:

        section = soup.find("div", id="undergraduate-qualifications")

        if section:

            requirements = []

            ordered_list = section.find("ol")

            if ordered_list:

                for item in ordered_list.find_all("li"):

                    text = get_text(item)

                    if text:
                        requirements.append(text)

            entry_requirements = "\n".join(requirements)


    # ----------------------------
    # Quick Facts
    # ----------------------------

    quick_facts = {}

    for fact in soup.find_all("dl", class_="quick-facts__list"):

        heading = get_text(fact.find("dt"))
        value = get_text(fact.find("dd"))

        if heading and value:
            quick_facts[heading] = value

    duration = quick_facts.get("Duration")
    programme_type = quick_facts.get("Programme type")
    points = quick_facts.get("Points")
    available_locations = quick_facts.get("Available locations")
    next_start_date = quick_facts.get("Next start date")

    # ----------------------------
    # Programme Dictionary
    # ----------------------------

    print("Entry Requirements:")
    print(entry_requirements)
    print("-" * 80)

    programme = {
        "name": name,
        "faculty": faculty,
        "description": description,
        "duration": duration,
        "entry_requirements": entry_requirements,
        "career_pathways": career_pathways,
        "programme_url": url,
        "image_url": None,
    }

    return programme