def test_password_change_rotates_sessions_and_requires_current_password(client):
    from datetime import timedelta
    from app.models import AccountEmailToken, utc_now
    from app.security import hash_access_token
    from conftest import TestingSessionLocal
    body = {'email': 'change@example.test', 'password': 'old-password-123', 'display_name': 'Student'}
    auth = client.post('/auth/register', json=body).json()
    headers = {'Authorization': 'Bearer ' + auth['access_token']}
    second = client.post('/auth/login', json=body).json()['access_token']
    old_code = 'old-recovery-code-before-password-change'
    with TestingSessionLocal() as db:
        db.add(AccountEmailToken(token_hash=hash_access_token(old_code),user_id=auth['user']['id'],
            purpose='reset',expires_at=utc_now()+timedelta(minutes=30)))
        db.commit()
    assert client.post('/auth/password', headers=headers,
        json={'current_password': 'wrong-password', 'new_password': 'new-password-123'}).status_code == 400
    assert client.post('/auth/password', headers=headers,
        json={'current_password': body['password'], 'new_password': 'short'}).status_code == 422
    response = client.post('/auth/password', headers=headers,
        json={'current_password': body['password'], 'new_password': 'new-password-123'})
    assert response.status_code == 200
    assert client.get('/auth/me', headers=headers).status_code == 401
    assert client.get('/auth/me', headers={'Authorization': 'Bearer ' + second}).status_code == 401
    assert client.get('/auth/me', headers={'Authorization': 'Bearer ' + response.json()['access_token']}).status_code == 200
    assert client.post('/auth/login', json=body).status_code == 401
    assert client.post('/auth/login', json={**body, 'password': 'new-password-123'}).status_code == 200
    assert client.post('/auth/password/reset',json={'code':old_code,'new_password':'attacker-password'}).status_code == 400


def test_email_failure_does_not_log_secrets(monkeypatch, caplog):
    import pytest
    from fastapi import HTTPException
    from app.services.account_email import send_account_email
    monkeypatch.setenv('SMTP_HOST','mail.example.test')
    monkeypatch.setenv('SMTP_FROM','invalid\nheader')
    monkeypatch.setenv('SMTP_PASSWORD','private-mail-password')
    with pytest.raises(HTTPException) as error:
        send_account_email('private-student@example.test','reset','private-reset-code')
    assert error.value.status_code == 503
    assert 'Account email delivery failed' in caplog.text
    assert all(secret not in caplog.text for secret in ('private-mail-password','private-student','private-reset-code'))
