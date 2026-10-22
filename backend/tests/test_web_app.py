from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.web_app import mount_web_app


def test_same_origin_web_app_and_assets_leave_api_routes_intact(tmp_path):
    root = tmp_path / 'public'
    (root / '_expo' / 'static').mkdir(parents=True)
    (root / 'assets').mkdir()
    (root / 'index.html').write_text('<html><script src="/_expo/static/index.js"></script></html>')
    (root / '_expo' / 'static' / 'index.js').write_text('window.appReady=true;')
    (root / 'assets' / 'icon.png').write_bytes(b'icon')
    (root / 'build-info.json').write_text('{"commit":"tested"}')
    (tmp_path / 'private.txt').write_text('private')
    app = FastAPI()
    @app.get('/health')
    def health():
        return {'status': 'healthy'}
    assert mount_web_app(app, root)
    with TestClient(app) as client:
        page = client.get('/app/')
        assert page.status_code == 200 and '<html>' in page.text
        assert page.headers['cache-control'] == 'no-cache'
        assert client.get('/app/build-info.json').headers['cache-control'] == 'no-cache'
        assert client.get('/_expo/static/index.js').status_code == 200
        assert client.get('/assets/icon.png').status_code == 200
        assert client.get('/health').json() == {'status': 'healthy'}
        assert client.get('/unknown-api').status_code == 404
        assert client.get('/app/%2e%2e/private.txt').status_code == 404


def test_backend_only_checkout_does_not_expose_a_missing_export(tmp_path):
    app = FastAPI()
    assert not mount_web_app(app, tmp_path)
    with TestClient(app) as client:
        assert client.get('/app/').status_code == 404
