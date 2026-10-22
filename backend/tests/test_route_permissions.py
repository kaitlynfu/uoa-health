import pytest
from fastapi import HTTPException

from app.models import User
from app.services.route_permissions import can_edit_routes, require_route_editor


@pytest.mark.parametrize("value", ["", "0", "-1", "1,", "all", "1,broken", "١", "1.0"])
def test_invalid_configuration_denies_everyone(monkeypatch, value):
    monkeypatch.setenv("TEAM43_ROUTE_EDITOR_USER_IDS", value)
    assert not can_edit_routes(User(id=1))


def test_grants_are_account_specific_and_revocable(monkeypatch):
    monkeypatch.setenv("TEAM43_ROUTE_EDITOR_USER_IDS", "1, 3")
    user = User(id=1, email="test@example.test")
    assert require_route_editor(user) is user
    assert not can_edit_routes(User(id=2, email="test@example.test"))
    monkeypatch.delenv("TEAM43_ROUTE_EDITOR_USER_IDS")
    with pytest.raises(HTTPException) as error:
        require_route_editor(user)
    assert error.value.status_code == 403


def test_endpoint_requires_login_and_defaults_to_no_access(client, monkeypatch):
    monkeypatch.delenv("TEAM43_ROUTE_EDITOR_USER_IDS", raising=False)
    assert client.get("/navigation/editor-access").status_code == 401
    response = client.post("/auth/register", json={
        "email": "route-access@example.test", "password": "Local-Test-Password-2026",
        "display_name": "Route access test", "can_edit_routes": True,
    })
    token = response.json()["access_token"]
    access = client.get("/navigation/editor-access", headers={"Authorization": "Bearer " + token})
    assert access.status_code == 200
    assert access.json() == {"can_edit_routes": False, "publishing_available": True}
