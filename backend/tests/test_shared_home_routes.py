import pytest


def account(client, email):
    response = client.post('/auth/register', json={"email": email, "password": "Local-Test-Password-2026", "display_name": "Editor test"})
    result = response.json()
    return result['user']['id'], {"Authorization": "Bearer " + result['access_token']}


def payload(revision=0):
    return {"expected_revision": revision, "marker": "home-start-v1", "points": [
        {"id": "start", "label": "Start", "x": 0, "y": 0},
        {"id": "arrow", "label": "Turn", "x": 0, "y": 1},
        {"id": "living", "label": "Living", "x": 1, "y": 1},
    ]}


def test_publish_read_history_and_conflict(client, monkeypatch):
    uid, headers = account(client, 'editor@example.test')
    monkeypatch.setenv('TEAM43_ROUTE_EDITOR_USER_IDS', str(uid))
    path = '/navigation/home-routes/living'
    assert client.get(path).json()['revision'] == 0
    assert client.post(path, headers=headers, json=payload()).json()['revision'] == 1
    assert client.get(path).json()['points'] == payload()['points']
    assert client.post(path, headers=headers, json=payload()).status_code == 409
    next_route = payload(1)
    next_route['points'].pop(1)  # deleting an intermediate arrow is publishable
    assert client.post(path, headers=headers, json=next_route).json()['revision'] == 2
    history = client.get(path+'/history', headers=headers).json()
    assert [r['revision'] for r in history] == [2, 1]
    # Recovery appends the old geometry; it does not erase history.
    assert client.post(path, headers=headers, json=payload(2)).json()['revision'] == 3
    assert client.get('/navigation/home-routes/office').json()['revision'] == 0


def test_no_anonymous_or_ordinary_user_writes(client, monkeypatch):
    monkeypatch.delenv('TEAM43_ROUTE_EDITOR_USER_IDS', raising=False)
    _, headers = account(client, 'ordinary@example.test')
    path = '/navigation/home-routes/living'
    assert client.post(path, json=payload()).status_code == 401
    assert client.post(path, headers=headers, json=payload()).status_code == 403
    assert client.get(path+'/history', headers=headers).status_code == 403
    assert client.get(path).json()['points'] is None


@pytest.mark.parametrize('change', ['marker', 'start', 'destination', 'duplicate', 'close', 'bounds'])
def test_invalid_geometry_is_rejected(client, monkeypatch, change):
    uid, headers = account(client, 'editor@example.test')
    monkeypatch.setenv('TEAM43_ROUTE_EDITOR_USER_IDS', str(uid))
    data = payload()
    if change == 'marker': data['marker'] = 'building303'
    if change == 'start': data['points'][0]['x'] = 1
    if change == 'destination': data['points'][-1]['id'] = 'office'
    if change == 'duplicate': data['points'][1]['id'] = 'start'
    if change == 'close': data['points'][1]['y'] = .01
    if change == 'bounds': data['points'][1]['x'] = 31
    assert client.post('/navigation/home-routes/living', headers=headers, json=data).status_code == 422
    assert client.get('/navigation/home-routes/living').json()['revision'] == 0


def test_campus_namespace_is_not_accepted(client, monkeypatch):
    uid, headers = account(client, 'editor@example.test')
    monkeypatch.setenv('TEAM43_ROUTE_EDITOR_USER_IDS', str(uid))
    assert client.post('/navigation/home-routes/303', headers=headers, json=payload()).status_code == 404
