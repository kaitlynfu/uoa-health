def register(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "student@example.com",
            "password": "a-secure-test-password",
            "display_name": "Test Student",
        },
    )
    assert response.status_code == 201
    return response.json()


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_journey_demo_is_served(client):
    response = client.get("/demo/journey")

    assert response.status_code == 200
    assert "Student Journey Backend Demo" in response.text


def test_register_login_and_current_user(client):
    auth = register(client)
    headers = auth_headers(auth["access_token"])

    assert client.get("/auth/me").status_code == 401
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "student@example.com"

    duplicate = client.post(
        "/auth/register",
        json={
            "email": "student@example.com",
            "password": "another-secure-password",
            "display_name": "Duplicate",
        },
    )
    assert duplicate.status_code == 409

    bad_login = client.post(
        "/auth/login",
        json={"email": "student@example.com", "password": "wrong-password"},
    )
    assert bad_login.status_code == 401

    login = client.post(
        "/auth/login",
        json={
            "email": "STUDENT@example.com",
            "password": "a-secure-test-password",
        },
    )
    assert login.status_code == 200


def test_journey_selection_and_progress(client):
    auth = register(client)
    headers = auth_headers(auth["access_token"])
    programmes = client.get("/programmes").json()
    health_id = next(
        item["id"]
        for item in programmes
        if item["name"] == "Bachelor of Health Sciences"
    )

    public_template = client.get(
        f"/journey/programmes/{health_id}/milestones",
        params={"catalogue_year": 2027, "plan_code": "COMH_CLINICAL"},
    )
    assert public_template.status_code == 200
    assert len(public_template.json()) == 2

    plans = client.get(
        f"/journey/programmes/{health_id}/plans",
        params={"catalogue_year": 2027},
    )
    assert plans.status_code == 200
    assert {item["code"] for item in plans.json()} == {
        "COMH_CLINICAL",
        "COMH_STANDARD",
        "HSDA_CLINICAL",
        "HSDA_STANDARD",
    }

    selected = client.put(
        "/journey/me/programme",
        headers=headers,
        json={
            "programme_id": health_id,
            "current_stage": 1,
            "catalogue_year": 2027,
            "plan_code": "COMH_CLINICAL",
        },
    )
    assert selected.status_code == 200
    assert selected.json()["progress_percent"] == 0
    assert selected.json()["total_points"] == 360
    assert selected.json()["plan_name"] == (
        "Community Health — clinical-selection pathway"
    )

    milestone_id = selected.json()["milestones"][0]["id"]
    updated = client.patch(
        f"/journey/me/milestones/{milestone_id}",
        headers=headers,
        json={"completed": True},
    )
    assert updated.status_code == 200
    assert updated.json()["progress_percent"] == 50
    assert updated.json()["completed_points"] == 180

    journey = client.get("/journey/me", headers=headers)
    assert journey.status_code == 200
    assert journey.json()["completed_count"] == 1

    wrong_plan_milestone = client.get(
        f"/journey/programmes/{health_id}/milestones",
        params={"catalogue_year": 2027, "plan_code": "HSDA_STANDARD"},
    ).json()[0]["id"]
    rejected = client.patch(
        f"/journey/me/milestones/{wrong_plan_milestone}",
        headers=headers,
        json={"completed": True},
    )
    assert rejected.status_code == 409


def test_journey_requires_authentication_and_a_template(client):
    assert client.get("/journey/me").status_code == 401

    auth = register(client)
    headers = auth_headers(auth["access_token"])
    science_id = next(
        item["id"]
        for item in client.get("/programmes").json()
        if item["name"] == "Bachelor of Biomedical Science"
    )
    missing = client.put(
        "/journey/me/programme",
        headers=headers,
        json={
            "programme_id": science_id,
            "current_stage": 1,
            "catalogue_year": 2027,
            "plan_code": "COMH_CLINICAL",
        },
    )
    assert missing.status_code == 404


def test_nursing_journey_is_available_and_separate(client):
    auth = register(client)
    headers = auth_headers(auth["access_token"])
    nursing_id = next(
        item["id"]
        for item in client.get("/programmes").json()
        if item["name"] == "Bachelor of Nursing"
    )

    plans = client.get(
        f"/journey/programmes/{nursing_id}/plans",
        params={"catalogue_year": 2027},
    )
    assert plans.status_code == 200
    assert [item["code"] for item in plans.json()] == ["BNURS_STANDARD"]

    selected = client.put(
        "/journey/me/programme",
        headers=headers,
        json={
            "programme_id": nursing_id,
            "current_stage": 1,
            "catalogue_year": 2027,
            "plan_code": "BNURS_STANDARD",
        },
    )
    assert selected.status_code == 200
    assert selected.json()["programme"]["name"] == "Bachelor of Nursing"
    assert selected.json()["plan_code"] == "BNURS_STANDARD"
    assert selected.json()["total_points"] == 360


def test_pharmacy_journey_has_four_part_total(client):
    auth = register(client)
    headers = auth_headers(auth["access_token"])
    pharmacy_id = next(
        item["id"]
        for item in client.get("/programmes").json()
        if item["name"] == "Bachelor of Pharmacy"
    )

    plans = client.get(
        f"/journey/programmes/{pharmacy_id}/plans",
        params={"catalogue_year": 2027},
    )
    assert plans.status_code == 200
    assert [item["code"] for item in plans.json()] == ["BPHARM_STANDARD"]

    selected = client.put(
        "/journey/me/programme",
        headers=headers,
        json={
            "programme_id": pharmacy_id,
            "current_stage": 1,
            "catalogue_year": 2027,
            "plan_code": "BPHARM_STANDARD",
        },
    )
    assert selected.status_code == 200
    assert selected.json()["programme"]["name"] == "Bachelor of Pharmacy"
    assert selected.json()["total_points"] == 480
