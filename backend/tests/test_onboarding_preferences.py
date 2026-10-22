def test_registered_preferences_feed_recommendations(client):
    auth = client.post('/auth/register', json={
        'email': 'onboarding@example.test', 'password': 'Local-test-password-2026!',
        'display_name': 'New student',
    })
    assert auth.status_code == 201
    headers = {'Authorization': 'Bearer ' + auth.json()['access_token']}
    saved = client.patch('/profile/me', headers=headers, json={
        'interests': ['population health'], 'career_interests': ['health policy'],
    })
    assert saved.status_code == 200
    profile = client.get('/profile/me', headers=headers).json()
    result = client.post('/programmes/recommend/personalised', json={
        'interests': profile['interests'], 'career_goals': profile['career_interests'], 'limit': 9,
    })
    assert result.status_code == 200
    assert any(p['name'] == 'Bachelor of Health Sciences' for p in result.json())


def test_guest_can_request_suggestions_without_account(client):
    result = client.post('/programmes/recommend/personalised', json={
        'interests': ['clinical care'], 'career_goals': ['nurse'], 'limit': 9,
    })
    assert result.status_code == 200
    assert any(p['name'] == 'Bachelor of Nursing' for p in result.json())
    assert client.get('/profile/me').status_code == 401
