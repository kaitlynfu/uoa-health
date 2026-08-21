def test_home_and_health(client):
    home = client.get("/")
    health = client.get("/health")

    assert home.status_code == 200
    assert home.json()["docs"] == "/docs"
    assert health.status_code == 200
    assert health.json() == {
        "status": "healthy",
        "database": "connected",
        "programmes": 4,
    }


def test_integrated_demo_is_available(client):
    response = client.get("/demo/app")

    assert response.status_code == 200
    assert "Student Compass" in response.text
    assert "data-view=\"wayfinder\"" in response.text


def test_list_programmes_is_alphabetical(client):
    response = client.get("/programmes")

    assert response.status_code == 200
    names = [programme["name"] for programme in response.json()]
    assert names == sorted(names)


def test_programme_filters_and_pagination(client):
    faculty = client.get(
        "/programmes",
        params={"faculty": "Faculty of Science"},
    )
    duration = client.get(
        "/programmes",
        params={"duration": "3 years", "offset": 1, "limit": 1},
    )
    career = client.get(
        "/programmes",
        params={"career": "registered nurse"},
    )

    assert [item["name"] for item in faculty.json()] == [
        "Bachelor of Biomedical Science"
    ]
    assert len(duration.json()) == 1
    assert [item["name"] for item in career.json()] == [
        "Bachelor of Nursing"
    ]


def test_programme_options(client):
    response = client.get("/programmes/options")

    assert response.status_code == 200
    assert response.json()["faculties"] == [
        "Faculty of Medical and Health Sciences",
        "Faculty of Science",
    ]
    assert response.json()["durations"] == ["3 years", "4 years"]
    assert "Registered nurse" in response.json()["careers"]


def test_get_programme_and_missing_programme(client):
    programmes = client.get("/programmes").json()
    programme_id = programmes[0]["id"]

    found = client.get(f"/programmes/{programme_id}")
    missing = client.get("/programmes/99999")

    assert found.status_code == 200
    assert found.json()["id"] == programme_id
    assert "careers" in found.json()
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Programme not found"}


def test_browse_search_and_open_careers(client):
    careers = client.get("/careers", params={"q": "researcher"})

    assert careers.status_code == 200
    assert len(careers.json()) == 2

    career_id = careers.json()[0]["id"]
    detail = client.get(f"/careers/{career_id}")
    programmes = client.get(f"/careers/{career_id}/programmes")

    assert detail.status_code == 200
    assert detail.json()["programmes"]
    assert programmes.status_code == 200
    assert programmes.json()
    assert client.get("/careers/99999").status_code == 404


def test_searches_multiple_fields_and_escapes_wildcards(client):
    description_match = client.get("/programmes/search", params={"q": "patient"})
    career_match = client.get("/programmes/search", params={"q": "analyst"})
    wildcard = client.get("/programmes/search", params={"q": "%"})

    assert description_match.status_code == 200
    assert [item["name"] for item in description_match.json()] == [
        "Bachelor of Nursing"
    ]
    assert [item["name"] for item in career_match.json()] == [
        "Bachelor of Health Sciences"
    ]
    assert wildcard.json() == []


def test_programme_stats(client):
    response = client.get("/programmes/stats")

    assert response.status_code == 200
    assert response.json() == {
        "total_programmes": 4,
        "programmes_with_descriptions": 4,
        "programmes_with_career_pathways": 4,
        "programmes_with_entry_requirements": 2,
    }


def test_recommendations_are_ranked_and_validated(client):
    response = client.get(
        "/programmes/recommend",
        params={"q": "health researcher", "limit": 2},
    )
    invalid_limit = client.get(
        "/programmes/recommend",
        params={"q": "health", "limit": 0},
    )

    assert response.status_code == 200
    recommendations = response.json()
    assert len(recommendations) == 2
    assert recommendations[0]["name"] == "Bachelor of Health Sciences"
    assert recommendations[0]["match_score"] >= recommendations[1]["match_score"]
    assert "health" in recommendations[0]["matched_keywords"]
    assert invalid_limit.status_code == 422


def test_personalised_recommendations_clean_input(client):
    response = client.post(
        "/programmes/recommend/personalised",
        json={
            "interests": [" clinical care ", "Clinical Care"],
            "career_goals": ["researcher"],
            "limit": 2,
        },
    )
    empty_request = client.post(
        "/programmes/recommend/personalised",
        json={"interests": [], "career_goals": []},
    )

    assert response.status_code == 200
    recommendations = response.json()
    assert recommendations[0]["name"] == "Bachelor of Nursing"
    assert recommendations[0]["matched_interests"] == ["clinical care"]
    assert empty_request.status_code == 422


def test_query_validation(client):
    assert client.get("/programmes/search", params={"q": ""}).status_code == 422
    assert client.get("/programmes/0").status_code == 422
