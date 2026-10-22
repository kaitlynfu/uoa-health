import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWayfindingQr} from '../types/wayfinding.ts';

test('checkpoint QR formats preserve the backend start code', () => {
  for (const value of ['303-G-ENTRANCE-C','303_G_ENTRANCE_C','wayfinder://location/303-G-ENTRANCE-C','wayfinder://location/303%2DG%2DENTRANCE%2DC']) {
    const checkpoint = parseWayfindingQr(value);
    assert.equal(checkpoint.kind,'location'); assert.equal(checkpoint.code,'303-G-ENTRANCE-C');
  }
});
test('test checkpoint stays separate from real Building 303 routes', () => {
  assert.equal(parseWayfindingQr('TEST_START').kind,'test');
});
test('QR parser rejects malformed payloads and arbitrary web links', () => {
  for (const value of ['', 'https://example.test','wayfinder://location/%ZZ','<script>alert(1)</script>','303-G-ENTRANCE-C?admin=true']) assert.equal(parseWayfindingQr(value),null);
});
