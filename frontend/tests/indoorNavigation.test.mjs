import test from 'node:test';
import assert from 'node:assert/strict';
import { alignAtStart, arrivalDwell, mapToWorld, worldToMap, shortestPath, routeLength,
    progressAt, relativeBearing, turnAt } from '../services/indoorNavigation.ts';
import { homeGraph, homeDestinations } from '../data/homeDemo.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test('calibration maps arbitrary camera yaw and origin to map X/right and Y/forward', () => {
    for (const yaw of [0, Math.PI / 2, -0.9, Math.PI]) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const m = [c,0,-s,0, 0,1,0,0, s,0,c,0, 12,1.7,-8,1];
        const a = alignAtStart(m);
        assert.ok(a);
        for (const p of [{x:0,y:0}, {x:2,y:5}, {x:-3,y:-1}]) {
            const world = mapToWorld(p, a);
            const back = worldToMap(world.x, world.z, a);
            close(back.x, p.x); close(back.y, p.y);
            close(world.y, 0.8);
        }
        const forward = mapToWorld({x:0,y:2}, a);
        close(forward.x, 12 - 2*s); close(forward.z, -8 - 2*c);
    }
});
test('calibration rejects invalid or downward-pointing camera poses', () => {
    assert.equal(alignAtStart([]), null);
    assert.equal(alignAtStart(Array(16).fill(NaN)), null);
    assert.equal(alignAtStart([1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,1,0,1]), null);
});
test('remaining distance follows route bends and responds to movement in both directions', () => {
    const route = [{x:0,y:0}, {x:0,y:4}, {x:3,y:4}];
    close(progressAt(route, 1, {x:0,y:0}).remaining, 7);
    close(progressAt(route, 1, {x:0,y:3}).remaining, 4);
    close(progressAt(route, 1, {x:0,y:2}).remaining, 5);
    close(progressAt(route, 2, {x:2,y:4}).remaining, 1);
    close(progressAt(route, 1, {x:1.5,y:2}).offRoute, 1.5);
    close(progressAt(route, 3, {x:3,y:4}).remaining, 0);
});
test('shortest path uses distances and never jumps disconnected rooms', () => {
    const graph = {nodes:[{id:'a',x:0,y:0},{id:'b',x:0,y:10},{id:'c',x:1,y:0},{id:'d',x:2,y:0},{id:'isolated',x:3,y:0}],
        edges:[['a','b'],['b','d'],['a','c'],['c','d']]};
    assert.deepEqual(shortestPath(graph,'a','d').map(n=>n.id),['a','c','d']);
    assert.deepEqual(shortestPath(graph,'a','isolated'),[]);
    assert.deepEqual(shortestPath(graph,'unknown','d'),[]);
});
test('all home destinations exit Bedroom 1 and closet route goes through its door', () => {
    for (const destination of homeDestinations) {
        const route = shortestPath(homeGraph, 'start', destination.id);
        assert.equal(route[0].id, 'start');
        assert.equal(route.at(-1).id, destination.id);
        assert.ok(route.some(n => n.id === 'bedroom-exit'));
        assert.ok(routeLength(route) > 3);
        for (let i=1;i<route.length;i++) assert.ok(homeGraph.edges.some(([a,b]) =>
            (a===route[i-1].id && b===route[i].id) || (b===route[i-1].id && a===route[i].id)));
    }
    const closet = shortestPath(homeGraph,'start','closet').map(n=>n.id);
    assert.ok(closet.indexOf('right-door') < closet.indexOf('closet-door'));
    assert.ok(closet.includes('closet-door'));
});
test('left/right prompts agree with a downward-facing map orientation', () => {
    close(relativeBearing({x:0,y:0},{x:1,y:0},{x:0,y:1}), Math.PI/2);
    assert.equal(turnAt([{x:0,y:0},{x:0,y:1},{x:-1,y:1}],1),'Then turn left');
    assert.equal(turnAt([{x:0,y:0},{x:0,y:1},{x:1,y:1}],1),'Then turn right');
});

test('arrival requires sustained proximity and resets when tracking or proximity is lost', () => {
    const begin = arrivalDwell(null, 1, 0.4, true);
    assert.deepEqual(begin, {nearSince:1, reached:false});
    assert.equal(arrivalDwell(begin.nearSince, 1.2, 0.4, true).reached, false);
    assert.equal(arrivalDwell(begin.nearSince, 1.4, 0.3, true).reached, true);
    assert.deepEqual(arrivalDwell(begin.nearSince, 1.4, 0.7, true), {nearSince:null, reached:false});
    assert.deepEqual(arrivalDwell(begin.nearSince, 1.4, 0.3, false), {nearSince:null, reached:false});
    assert.equal(arrivalDwell(1, 0.5, 0.3, true).reached, false);
    assert.equal(arrivalDwell(1, 2, NaN, true).reached, false);
});
