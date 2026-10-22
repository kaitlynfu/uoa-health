from app.models import Career, Programme
from app.schemas import CareerResponse
from app.services.career_content import CONTENT
from conftest import TestingSessionLocal


def register(client, name):
    data = client.post('/auth/register', json={'email': name+'@example.test', 'display_name': name, 'password': 'CompletionTest123!'}).json()
    return {'Authorization': 'Bearer '+data['access_token']}


def test_every_reviewed_career_has_a_source_and_nonempty_summary():
    assert len(CONTENT['careers']) == 43
    for name in CONTENT['careers']:
        result = CareerResponse(id=1, name=name)
        assert result.description and result.official_url.startswith('https://')
        assert result.source_checked_at == '2026-10-15'
    curated = CareerResponse(id=2, name='Medicine', description='Curated description', official_url='https://example.test/curated')
    assert curated.description == 'Curated description'
    assert curated.official_url == 'https://example.test/curated'
    assert CareerResponse(id=3, name='Unknown job').description is None


def test_reference_connections_are_symmetric_and_do_not_write_database(client):
    with TestingSessionLocal() as db:
        medicine = Career(name='Medicine')
        physiotherapy = Career(name='Physiotherapy')
        programme = Programme(name='Bachelor of Medicine and Bachelor of Surgery MBChB')
        certificate = Programme(name='Certificate in Health Sciences CertHSc')
        db.add_all([medicine, physiotherapy, programme, certificate]); db.commit()
        career_id, programme_id, certificate_id, physio_id = medicine.id, programme.id, certificate.id, physiotherapy.id
    detail = client.get(f'/careers/{career_id}').json()
    assert [p['id'] for p in detail['programmes']] == [programme_id]
    assert [p['id'] for p in client.get(f'/careers/{career_id}/programmes').json()] == [programme_id]
    assert career_id in [c['id'] for c in client.get(f'/programmes/{programme_id}').json()['careers']]
    assert client.get(f'/programmes/{certificate_id}').json()['careers'] == []
    physio = client.get(f'/careers/{physio_id}').json()
    assert physio['programmes'] == [] and 'aut.ac.nz' in physio['official_url']
    with TestingSessionLocal() as db:
        assert db.get(Career, career_id).programmes == []
        assert db.get(Career, career_id).description is None


def test_report_status_is_only_visible_to_reporter(client, monkeypatch):
    first, second = register(client, 'Reporter'), register(client, 'Other')
    submitted = client.post('/social/reports', headers=first, json={'reason':'A test support issue to review.'})
    assert submitted.status_code == 201
    report_id = submitted.json()['id']
    own = client.get('/social/reports/mine', headers=first).json()
    assert own[0]['id'] == report_id and own[0]['status'] == 'open'
    assert client.get('/social/reports/mine', headers=second).json() == []
    assert client.get('/social/reports/mine').status_code == 401


def test_email_availability_is_public_but_exposes_no_configuration(client, monkeypatch):
    for key in ('SMTP_HOST','SMTP_FROM','SMTP_USER','SMTP_PASSWORD'):
        monkeypatch.delenv(key, raising=False)
    assert client.get('/auth/features').json() == {'email_delivery': False}
    monkeypatch.setenv('SMTP_HOST', 'smtp.example.test')
    monkeypatch.setenv('SMTP_FROM', 'sender@example.test')
    assert client.get('/auth/features').json() == {'email_delivery': True}
    monkeypatch.setenv('SMTP_USER','a-user')
    assert client.get('/auth/features').json() == {'email_delivery': False}
