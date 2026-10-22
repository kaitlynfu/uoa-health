import test from 'node:test';
import assert from 'node:assert/strict';
import { alignmentFromMarker, observeMarker } from '../services/markerAlignment.ts';
import { mapToWorld, worldToMap } from '../services/indoorNavigation.ts';
import { readFileSync } from 'node:fs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const observation=(t=1,yaw=0)=>({name:'home-start-v1',timestamp:t,
    transform:[Math.cos(yaw),0,-Math.sin(yaw),0, 0,1,0,0, Math.sin(yaw),0,Math.cos(yaw),0, 4,0.2,-7,1]});

test('floor marker fixes origin, floor height and heading independently of the viewer',()=>{
    for(const yaw of [0,0.8,-1.2,Math.PI]) {
        const a=alignmentFromMarker(observation(1,yaw));
        assert.ok(a);close(a.x,4);close(a.z,-7);close(a.height,0.35);
        const target=mapToWorld({x:2,y:3},a);
        close(target.x,4-2*Math.cos(yaw)-3*Math.sin(yaw));
        close(target.z,-7+2*Math.sin(yaw)-3*Math.cos(yaw));
        // Different user positions do not alter target world coordinates.
        for(const camera of [{x:0,y:-0.5},{x:0.4,y:0.2},{x:-0.3,y:0.6}]) {
            const world=mapToWorld(camera,a), p=worldToMap(world.x,world.z,a);
            close(p.x,camera.x);close(p.y,camera.y);
            assert.deepEqual(mapToWorld({x:2,y:3},alignmentFromMarker(observation(1,yaw))),target);
        }
    }
});
test('unknown, malformed, scaled, reflected, upright and upside-down markers cannot align',()=>{
    assert.equal(alignmentFromMarker({...observation(),name:'other-room'}),null);
    assert.equal(alignmentFromMarker({...observation(),timestamp:NaN}),null);
    assert.equal(alignmentFromMarker({...observation(),transform:[]}),null);
    for(const [slot,value] of [[5,0],[5,-1],[0,-1],[0,2],[12,NaN],[15,0]]) {
        const o=observation();o.transform[slot]=value;
        assert.equal(alignmentFromMarker(o),null);
    }
});
test('a single marker hit cannot align; stable fresh repeated observations can',()=>{
    let candidate=null,result;
    for(let i=0;i<10;i++) {
        result=observeMarker(candidate,observation(1+i*0.11));candidate=result.candidate;
        if(i<8) assert.equal(result.alignment,null);
    }
    assert.ok(result.alignment);
});
test('lost observation, clock reset, wrong ID, translation or rotation reset stability',()=>{
    const first=observeMarker(null,observation()).candidate;
    for(const o of [observation(2),observation(0.5),observation(1.1,0.2)]) {
        const result=observeMarker(first,o);
        assert.equal(result.alignment,null);assert.equal(result.candidate.samples,1);
    }
    const moved=observation(1.1);moved.transform[12]+=0.06;
    assert.equal(observeMarker(first,moved).candidate.samples,1);
    assert.equal(observeMarker(first,{...observation(),name:'unknown'}).candidate,null);
});
test('printed reference contains exactly the same PNG bytes as the native resource',()=>{
    const png=readFileSync(new URL('../modules/wayfinder-ar/ios/Resources/home-start-v1.png',import.meta.url));
    const html=readFileSync(new URL('../../docs/home-start-marker.html',import.meta.url),'utf8');
    assert.ok(html.includes(`data:image/png;base64,${png.toString('base64')}`));
    assert.ok(html.includes('width:200mm;height:200mm'));
    assert.equal(png.readUInt32BE(16),800);assert.equal(png.readUInt32BE(20),800);
});
