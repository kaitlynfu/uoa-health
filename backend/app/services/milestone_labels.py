"""Private milestone labels in the existing typed student-attribute store.

Reserved kinds include the immutable milestone ID, keeping programme templates,
matching interests and completion records independent. Names are capped at the
store's 100-character limit. No schema change or rewriting shared courses.
"""
from app.models import StudentAttribute


def milestone_labels(db, user_id):
    return {row.kind: row.value for row in db.query(StudentAttribute).filter(
        StudentAttribute.user_id == user_id,
        StudentAttribute.kind.startswith("milestone_", autoescape=True),
    ).all()}


def save_milestone_labels(db, user_id, milestone_id, fields):
    # The caller holds the user-row lock so simultaneous edits cannot add two
    # values for the same label. Other profile attribute kinds are untouched.
    for field, prefix in (("custom_title", "milestone_title"), ("custom_course_code", "milestone_code")):
        if field not in fields:
            continue
        kind = f"{prefix}:{milestone_id}"
        db.query(StudentAttribute).filter_by(user_id=user_id, kind=kind).delete(synchronize_session=False)
        value = fields[field]
        if value is not None:
            db.add(StudentAttribute(user_id=user_id, kind=kind, value=value, normalised_value=value.casefold()))
    db.flush()
