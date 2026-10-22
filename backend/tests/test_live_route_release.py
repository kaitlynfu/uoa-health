"""Opt-in real loopback HTTP checks against a newly seeded disposable database."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.request

import pytest


@pytest.mark.skipif(os.getenv('TEAM43_RUN_LIVE_RELEASE_TESTS') != 'true', reason='Explicit local release check only')
def test_live_release(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env.pop('DATABASE_URL', None)
    seed = ('from pathlib import Path; from scripts import seed_integration as s; '
            f's.LOCAL_DIR=Path({str(tmp_path)!r}); s.LOCAL_DB=s.LOCAL_DIR/"integration.db"; s.main()')
    subprocess.run([sys.executable, '-c', seed], cwd=backend, env=env, check=True, capture_output=True, timeout=90)
    env['DATABASE_URL'] = 'sqlite:///' + (tmp_path/'integration.db').as_posix()
    env['TEAM43_ROUTE_EDITOR_USER_IDS'] = '1'  # Alice in this newly created fixture only.
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    server = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)],
                              cwd=backend, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        base = f'http://127.0.0.1:{port}'
        for _ in range(100):
            if server.poll() is not None: raise AssertionError('Local server exited')
            try:
                with urllib.request.urlopen(base+'/health', timeout=.5) as response:
                    if response.status == 200: break
            except OSError: time.sleep(.1)
        else: raise AssertionError('Local server did not become ready')
        env.update(EXPO_PUBLIC_API_URL=base, TEAM43_LOCAL_API_TESTS='true')
        result = subprocess.run(['node', '--experimental-strip-types', '--test',
                                 'tests/sharedRoutes.live.test.mjs', 'tests/api.integration.test.mjs'],
                                cwd=backend.parent/'frontend', env=env, capture_output=True, text=True, timeout=90)
        assert result.returncode == 0, result.stdout + result.stderr
    finally:
        server.terminate()
        server.wait(timeout=10)
