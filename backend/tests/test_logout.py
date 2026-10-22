def test_logout_returns_valid_empty_response_and_revokes_sessions(client):
    credentials = {"email": "logout@example.test", "password": "Local-Test-Password-2026"}
    first = client.post('/auth/register', json={**credentials, "display_name": "Logout test"}).json()
    second = client.post('/auth/login', json=credentials).json()
    headers = {"Authorization": "Bearer " + first['access_token']}
    response = client.post('/auth/logout', headers=headers)
    assert response.status_code == 204
    assert response.content == b''
    for session in (first, second):
        assert client.get('/auth/me', headers={"Authorization": "Bearer " + session['access_token']}).status_code == 401
