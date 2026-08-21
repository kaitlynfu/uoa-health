def register(client, email="profile@example.com", name="Profile Student"):
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "a-secure-test-password",
            "display_name": name,
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_profile_requires_authentication(client):
    demo = client.get("/demo/profile")
    assert demo.status_code == 200
    assert "Account & Personalisation" in demo.text
    assert client.get("/profile/me").status_code == 401
    assert client.patch("/profile/me", json={"bio": "Hello"}).status_code == 401


def test_update_structured_profile_and_clean_duplicates(client):
    headers = register(client)
    programme = client.get("/programmes").json()[0]

    response = client.patch(
        "/profile/me",
        headers=headers,
        json={
            "display_name": "Avi",
            "programme_id": programme["id"],
            "current_stage": 1,
            "catalogue_year": 2027,
            "bio": "First-year health student",
            "interests": ["Public health", " public health ", "Technology"],
            "hobbies": ["Football", "Music"],
            "career_interests": ["Medicine"],
            "courses": [
                {
                    "course_code": "biosci 107",
                    "course_name": "Biology for Biomedical Science",
                    "semester": "Semester 1",
                    "academic_year": 2027,
                },
                {"course_code": "CHEM 190", "academic_year": 2027},
            ],
            "study_preferences": {
                "study_mode": "hybrid",
                "study_style": "Structured group sessions",
                "preferred_group_size": 4,
                "availability": "Weekday afternoons",
            },
            "matching_enabled": True,
        },
    )

    assert response.status_code == 200
    profile = response.json()
    assert profile["user"]["display_name"] == "Avi"
    assert profile["programme"]["id"] == programme["id"]
    assert profile["interests"] == ["Public health", "Technology"]
    assert [item["course_code"] for item in profile["courses"]] == [
        "BIOSCI 107",
        "CHEM 190",
    ]
    assert profile["study_preferences"]["preferred_group_size"] == 4
    assert profile["matching_enabled"] is True

    persisted = client.get("/profile/me", headers=headers)
    assert persisted.status_code == 200
    assert persisted.json()["bio"] == "First-year health student"


def test_save_programmes_and_careers_is_idempotent_and_private(client):
    first_headers = register(client, "first@example.com", "First")
    second_headers = register(client, "second@example.com", "Second")
    programme = client.get("/programmes").json()[0]
    career = client.get("/careers").json()[0]

    first_save = client.post(
        f"/profile/me/saved-programmes/{programme['id']}",
        headers=first_headers,
    )
    duplicate_save = client.post(
        f"/profile/me/saved-programmes/{programme['id']}",
        headers=first_headers,
    )
    career_save = client.post(
        f"/profile/me/saved-careers/{career['id']}",
        headers=first_headers,
    )

    assert first_save.status_code == 200
    assert duplicate_save.status_code == 200
    assert career_save.status_code == 200
    first_profile = client.get("/profile/me", headers=first_headers).json()
    assert len(first_profile["saved_programmes"]) == 1
    assert len(first_profile["saved_careers"]) == 1

    second_profile = client.get("/profile/me", headers=second_headers).json()
    assert second_profile["saved_programmes"] == []
    assert second_profile["saved_careers"] == []

    removed = client.delete(
        f"/profile/me/saved-programmes/{programme['id']}",
        headers=first_headers,
    )
    assert removed.status_code == 204
    assert client.get("/profile/me", headers=first_headers).json()[
        "saved_programmes"
    ] == []


def test_profile_validation_and_missing_favourites(client):
    headers = register(client)

    invalid_mode = client.patch(
        "/profile/me",
        headers=headers,
        json={"study_preferences": {"study_mode": "sometimes"}},
    )
    duplicate_courses = client.patch(
        "/profile/me",
        headers=headers,
        json={
            "courses": [
                {"course_code": "BIOSCI 107"},
                {"course_code": "biosci 107"},
            ]
        },
    )

    assert invalid_mode.status_code == 422
    assert duplicate_courses.status_code == 422
    assert client.post(
        "/profile/me/saved-programmes/99999", headers=headers
    ).status_code == 404
    assert client.delete(
        "/profile/me/saved-careers/99999", headers=headers
    ).status_code == 404
