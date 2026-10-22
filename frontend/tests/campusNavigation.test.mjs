import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDistance, formatDuration, mapsDirectionsUrl} from '../services/campusNavigation.ts';

const destination = 'Owen G Glenn Building, 12 Grafton Road, Auckland';

test('iPhone opens Apple Maps walking directions from the current location', () => {
    const url = new URL(mapsDirectionsUrl({platform: 'ios', origin: null, destination, mode: 'walk'}));
    assert.equal(url.host, 'maps.apple.com');
    assert.equal(url.searchParams.get('daddr'), destination);
    assert.equal(url.searchParams.get('dirflg'), 'w');
    assert.equal(url.searchParams.has('saddr'), false);
});

test('Android and web open Google Maps with the chosen start and travel mode', () => {
    const origin = 'Science Centre, 38 Princes Street, Auckland';
    for (const platform of ['android', 'web']) {
        const url = new URL(mapsDirectionsUrl({platform, origin, destination, mode: 'transit'}));
        assert.equal(url.host, 'www.google.com');
        assert.equal(url.pathname, '/maps/dir/');
        assert.equal(url.searchParams.get('api'), '1');
        assert.equal(url.searchParams.get('origin'), origin);
        assert.equal(url.searchParams.get('destination'), destination);
        assert.equal(url.searchParams.get('travelmode'), 'transit');
    }
    const drive = new URL(mapsDirectionsUrl({platform: 'ios', origin, destination, mode: 'drive'}));
    assert.equal(drive.searchParams.get('dirflg'), 'd');
    assert.equal(drive.searchParams.get('saddr'), origin);
});

test('distances and durations read naturally', () => {
    assert.equal(formatDistance(3), '10 m');
    assert.equal(formatDistance(224.6), '220 m');
    assert.equal(formatDistance(1285), '1.3 km');
    assert.equal(formatDuration(0), '1 min');
    assert.equal(formatDuration(17), '17 min');
    assert.equal(formatDuration(60), '1 hr');
    assert.equal(formatDuration(75), '1 hr 15 min');
});
