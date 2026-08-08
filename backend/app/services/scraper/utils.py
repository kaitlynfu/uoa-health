def get_text(element):
    """Return cleaned text from a BeautifulSoup element."""
    if element:
        return element.get_text(" ", strip=True)
    return None