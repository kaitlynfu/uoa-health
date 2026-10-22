import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeEnvironmentAlignment,routeJoinIndex,recognisedAlignment} from '../services/environmentRecognition.ts';
import {mapToWorld,worldToMap} from '../services/indoorNavigation.ts';
const route=[{id:'start',label:'Start',x:0,y:0},{id:'turn',label:'Turn',x:0,y:3},{id:'end',label:'End',x:4,y:3}];
const archive=JSON.stringify({version:1,marker:'home-start-v1',routes:{end:route}});
const event={alignment:[8,-4,.15,0,1],timestamp:10,sessionID:'session-1',routes:archive};
test('only fresh matching pose observations accept a restored origin',()=>{
    assert.ok(recognisedAlignment(event,{timestamp:10,received:1000},{end:route},'end',1200));
    for(const frame of [null,{timestamp:9,received:1000},{timestamp:10,received:500},
        {timestamp:10,received:1300},{timestamp:NaN,received:1000}])
        assert.equal(recognisedAlignment(event,frame,{end:route},'end',1200),null);
});
test('missing or incompatible snapshots cannot unlock navigation',()=>{
    for(const invalid of [{...event,sessionID:''},{...event,routes:'{'},
        {...event,routes:JSON.stringify({version:1,marker:'different-floor',routes:{end:route}})},
        {...event,routes:JSON.stringify({version:1,marker:'home-start-v1',routes:{}})}])
        assert.throws(()=>recognisedAlignment(invalid,{timestamp:10,received:1000},{end:route},'end',1200));
});
test('recognition never substitutes an archived route for the current route',()=>{
    const current=route.map(p=>p.id==='turn'?{...p,x:1}:p);
    const before=structuredClone(current);
    const result=recognisedAlignment(event,{timestamp:10,received:1000},{end:route},'end',1200);
    assert.deepEqual(Object.keys(result).sort(),['fx','fz','height','x','z']);
    assert.deepEqual(current,before);
});
test('restored origin fixes route placement independently of camera location and heading',()=>{
    for(const heading of [0,0.7,-1.2,Math.PI]) {
        const a=decodeEnvironmentAlignment([8,-4,0.15,Math.sin(heading),-Math.cos(heading)]);
        assert.ok(a);
        const expected=mapToWorld(route[2],a);
        for(const camera of [{x:0,y:0},{x:1,y:3},{x:4,y:3}]) {
            const world=mapToWorld(camera,a), back=worldToMap(world.x,world.z,a);
            assert.ok(Math.abs(back.x-camera.x)<1e-7);assert.ok(Math.abs(back.y-camera.y)<1e-7);
            assert.deepEqual(mapToWorld(route[2],a),expected);
        }
    }
});
test('invalid restored alignments cannot unlock arrows',()=>{
    for(const a of [undefined,[],[0,0,0,0,0],[0,0,0,2,0],[NaN,0,0,1,0],[0,0,Infinity,1,0]])
        assert.equal(decodeEnvironmentAlignment(a),null);
});
test('recognition can join a nearby route segment instead of redefining the start',()=>{
    assert.equal(routeJoinIndex(route,{x:0.1,y:1}),1);
    assert.equal(routeJoinIndex(route,{x:2,y:3.1}),2);
    assert.equal(routeJoinIndex(route,{x:15,y:15}),0);
    assert.equal(routeJoinIndex(route,{x:NaN,y:1}),0);
    assert.equal(routeJoinIndex([],{x:0,y:0}),0);
});
test('ambiguous nearby non-adjacent segments do not cause a route shortcut',()=>{
    const loop=[{x:0,y:0},{x:0,y:3},{x:0.3,y:3},{x:0.3,y:0}].map((p,i)=>({...p,id:String(i),label:String(i)}));
    assert.equal(routeJoinIndex(loop,{x:0.15,y:1.5}),0);
});
