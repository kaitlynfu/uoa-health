def get_text(element):

    if not element:
        return None

    text = element.get_text(" ", strip=True)

    # Clean common formatting artifacts
    text = text.replace("##", "")
    text = text.replace("#", "")
    text = text.replace("*", "")

    # Collapse repeated whitespace
    text = " ".join(text.split())

    return text