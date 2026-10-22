import test from 'node:test';
import assert from 'node:assert/strict';
import {moveWaypoint,insertWaypoint,deleteWaypoint,nudgePoint,validateRoute,decodeRoutes,encodeRoutes} from '../services/routeEditor.ts';
import {shortestPath,progressAt,routeLength,mapToWorld,worldToMap} from '../services/indoorNavigation.ts';
import {homeGraph,homeDestinations} from '../data/homeDemo.ts';
const generated=Object.fromEntries(homeDestinations.map(d=>[d.id,shortestPath(homeGraph,'start',d.id)]));
const base=generated.living;
test('every generated home route satisfies editor persistence validation',()=>{
    for(const route of Object.values(generated)) assert.equal(validateRoute(route,route),route);
});
test('moving an arrow changes route geometry without mutating the generated route',()=>{
    const before=JSON.stringify(base), moved=moveWaypoint(base,1,{x:-0.2,y:1.4});
    assert.equal(JSON.stringify(base),before);assert.notEqual(moved,base);
    assert.equal(moved[1].x,-0.2);assert.equal(moved[1].y,1.4);
    assert.notEqual(routeLength(moved),routeLength(base));
    assert.equal(progressAt(moved,1,{x:-0.2,y:1.4}).next,0);
});
test('insertion preserves ordering and destination, including insertion with final selected',()=>{
    const route=insertWaypoint(base,1,{x:0,y:1.8},'custom1');
    assert.equal(route[2].id,'custom1');assert.equal(route.at(-1).id,'living');
    assert.equal(route.length,base.length+1);validateRoute(route,base);
    const finalInsert=insertWaypoint(base,base.length-1,{x:2,y:3},'custom2');
    assert.equal(finalInsert.at(-2).id,'custom2');assert.equal(finalInsert.at(-1).id,'living');
});
test('fixed start and final identity cannot be removed',()=>{
    assert.equal(moveWaypoint(base,0,{x:2,y:2}),base);
    assert.equal(deleteWaypoint(base,0),base);assert.equal(deleteWaypoint(base,base.length-1),base);
    assert.equal(deleteWaypoint(base,2).length,base.length-1);
});
test('camera-relative nudges preserve physical left/right in image-down coordinates',()=>{
    assert.deepEqual(nudgePoint({x:0,y:0},{x:0,y:1},0.1,0),{x:-0.1,y:0});
    assert.deepEqual(nudgePoint({x:0,y:0},{x:1,y:0},0.1,0),{x:0,y:0.1});
    assert.deepEqual(nudgePoint({x:0,y:0},{x:0,y:2},0,0.1),{x:0,y:0.1});
    assert.deepEqual(nudgePoint({x:2,y:3},{x:0,y:0},0,0.1),{x:2,y:3});
});
test('saved edits round trip per destination without affecting other generated routes',()=>{
    const edited=moveWaypoint(base,1,{x:0.1,y:1.3});
    const raw=encodeRoutes({living:edited},generated), decoded=decodeRoutes(raw,generated);
    assert.deepEqual(decoded.living,edited);assert.equal(decoded.office,undefined);
    assert.deepEqual(decodeRoutes(null,generated),{});
    // Undo/cancel can return to the immutable previous route, not a mutated graph.
    assert.deepEqual(generated.living,base);
});
test('saved map coordinates are restored under a different AR session origin',()=>{
    const edited=moveWaypoint(base,1,{x:-0.2,y:1.3});
    const restored=decodeRoutes(encodeRoutes({living:edited},generated),generated).living;
    const a={x:20,z:-5,height:0.15,fx:1,fz:0};
    const world=mapToWorld(restored[1],a), map=worldToMap(world.x,world.z,a);
    assert.ok(Math.abs(map.x+0.2)<1e-8);assert.ok(Math.abs(map.y-1.3)<1e-8);
});
test('invalid storage versions, markers, destinations and malformed JSON fail closed',()=>{
    for(const raw of ['{',JSON.stringify({version:2,marker:'home-start-v1',routes:{}}),
        JSON.stringify({version:1,marker:'moved-marker',routes:{}}),
        JSON.stringify({version:1,marker:'home-start-v1',routes:{unknown:base}})])
        assert.throws(()=>decodeRoutes(raw,generated));
});
test('save rejects duplicate IDs, invalid coordinates, changed origins and zero-length segments',()=>{
    for(const edited of [
        base.map((n,i)=>i===1?{...n,x:NaN}:n),
        base.map((n,i)=>i===1?{...n,x:31}:n),
        base.map((n,i)=>i===1?{...n,id:base[0].id}:n),
        base.map((n,i)=>i===0?{...n,x:1}:n),
        base.map((n,i)=>i===1?{...n,x:0,y:0}:n),
        base.map((n,i)=>i===base.length-1?{...n,id:'other-room'}:n),
    ]) assert.throws(()=>validateRoute(edited,base));
});
test('unsafe edit inputs are no-ops and saved waypoint count is bounded',()=>{
    assert.equal(moveWaypoint(base,1,{x:Infinity,y:1}),base);
    assert.equal(insertWaypoint(base,1,{x:1,y:1},base[0].id),base);
    assert.throws(()=>validateRoute([],base));
    assert.throws(()=>validateRoute(Array(101).fill(base[0]),base));
});
