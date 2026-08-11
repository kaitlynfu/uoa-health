import requests
from bs4 import BeautifulSoup

from .utils import get_text


def extract_description(soup):

    # ----------------------------
    # Method 1
    # Programme overview section
    # ----------------------------

    section_heading = soup.find(
        "h2",
        string=lambda s: s and "programme overview" in s.lower()
    )

    if section_heading:

        paragraphs = []

        # Search through elements after Programme overview
        # until the next H2 section begins
        for element in section_heading.find_all_next():

            # Stop when the next major section starts
            if element.name == "h2" and element is not section_heading:
                break

            if element.name == "p":

                text = get_text(element)

                if (
                    text
                    and len(text) > 40
                    and "breadcrumbs" not in text.lower()
                ):
                    paragraphs.append(text)

        if paragraphs:
            return "\n\n".join(paragraphs)

    # ----------------------------
    # Method 2
    # Meta description fallback
    # ----------------------------

    meta = soup.find("meta", attrs={"name": "description"})

    if meta:

        description = meta.get("content")

        if description:
            return description.strip()

    # ----------------------------
    # Method 3
    # First meaningful paragraph
    # ----------------------------

    for p in soup.find_all("p"):

        text = get_text(p)

        if text and len(text) > 120:
            return text

    return None


def extract_entry_requirements(soup):
    """
    Extracts the most relevant entry requirements from a programme page.
    """

    possible_headings = [
        "secondary school qualifications",
        "first year entry",
        "undergraduate entry",
        "category one: first year entry",
        "programme requirements",
    ]

    headings = soup.find_all(["h3", "h4"])

    target_heading = None

    for heading in headings:
        heading_text = get_text(heading)

        if not heading_text:
            continue

        heading_lower = heading_text.lower()

        if any(option in heading_lower for option in possible_headings):
            target_heading = heading
            break

    if not target_heading:
        return None

    requirements = []

    for element in target_heading.find_all_next():

        # Stop when the next entry-requirement subsection starts
        if element.name == "h3" and element is not target_heading:
            break

        if element.name in ["p", "li"]:
            text = get_text(element)

            if text and text not in requirements:
                requirements.append(text)

        # Prevent extremely large database entries
        if len("\n".join(requirements)) > 1800:
            break

    if not requirements:
        return None

    return "\n".join(requirements)


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

    description = extract_description(soup)
    
    
    # ----------------------------
    # Career Pathways
    # ----------------------------

    career_pathways = None

    # Method 1:
    # Look for an explicit "Jobs related to this programme" list
    career_heading = soup.find(
        "h3",
        string=lambda s: s and "jobs related to this programme" in s.lower()
    )

    if career_heading:

        career_list = career_heading.find_next("ul")

        if career_list:

            jobs = []

            for job in career_list.find_all("li"):

                text = get_text(job)

                if text:
                    jobs.append(text)

            if jobs:
                career_pathways = ", ".join(jobs)


    # Method 2:
    # Some programmes use a descriptive paragraph instead of a jobs list
    if not career_pathways:

        career_section = soup.find(
            "h2",
            string=lambda s: s and "where could this programme take you" in s.lower()
        )

        if career_section:

            for element in career_section.find_all_next():

                # Stop at the next major section
                if element.name == "h2" and element is not career_section:
                    break

                # Stop before further-study information
                heading_text = get_text(element)

                if (
                    element.name in ["h3", "h4"]
                    and heading_text
                    and "further study" in heading_text.lower()
                ):
                    break

                if element.name == "p":

                    text = get_text(element)

                    if text and len(text) > 40:
                        career_pathways = text
                        break


    # Method 3:
    # If there is no career description, use further-study options
    if not career_pathways:

        further_study_heading = soup.find(
            ["h3", "h4"],
            string=lambda s: s and "further study options" in s.lower()
        )

        if further_study_heading:

            further_study_list = further_study_heading.find_next("ul")

            if further_study_list:

                options = []

                for item in further_study_list.find_all("li"):

                    text = get_text(item)

                    if text:
                        options.append(text)

                if options:
                    career_pathways = ", ".join(options)
    

    # ----------------------------
    # Entry Requirements
    # ----------------------------

    entry_requirements = extract_entry_requirements(soup)


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

    print(f"\n{name}")
    print(description)
    print("-" * 80)

    if description is None:
        description = "Description coming soon."

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