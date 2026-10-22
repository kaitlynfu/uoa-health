import test from 'node:test';
import assert from 'node:assert/strict';
import {routeJoinIndex,canReuseAlignment,manualTestAlignment,roomSaveStatus} from '../services/routeSession.ts';
import {mapToWorld} from '../services/indoorNavigation.ts';
const route=[{id:'start',label:'Start',x:0,y:0},{id:'turn',label:'Turn',x:0,y:4},{id:'end',label:'End',x:4,y:4}];
test('room save label explains the blocking state even when the surroundings are mapped',()=>{
    const ready={saving:false,aligned:true,world:false,busy:false,routeError:false,ready:true,mapped:true};
    assert.equal(roomSaveStatus(ready),'Save room recording');
    for(const [change,expected] of [
        [{aligned:false},'Cannot save: align at HOME START first'],
        [{aligned:false,world:true},'Cannot save: waiting for room recognition'],
        [{saving:true},'Saving room…'],
        [{busy:true},'Cannot save: route operation in progress'],
        [{routeError:true},'Cannot save: saved route data needs attention'],
        [{ready:false},'Cannot save: waiting for reliable tracking'],
        [{mapped:false},'Recording: look around the surroundings slowly'],
    ]) assert.equal(roomSaveStatus({...ready,...change}),expected);
});
test('manual developer alignment uses measured camera height, not an invented floor',()=>{
    const pose=[1,0,0,0,0,1,0,0,0,0,1,0,5,2,8,1];
    const a=manualTestAlignment(pose,1.5);
    assert.equal(a.height,.65);assert.equal(a.x,5);assert.equal(a.z,8);
    for(const height of [0,NaN,3]) assert.equal(manualTestAlignment(pose,height),null);
    assert.equal(manualTestAlignment([],1.5),null);
});
test('destination changes join nearby segments without moving fixed arrows',()=>{
    const before=structuredClone(route);
    const alignment={x:10,z:20,height:.15,fx:0,fz:1};
    const fixed=mapToWorld(route[1],alignment);
    assert.equal(routeJoinIndex(route,{x:.1,y:2}),1);
    assert.equal(routeJoinIndex(route,{x:2,y:4.1}),2);
    assert.deepEqual(mapToWorld(route[1],alignment),fixed);
    assert.deepEqual(route,before);
});
test('being elsewhere does not create a shortcut through a wall',()=>{
    assert.equal(routeJoinIndex(route,{x:2,y:2}),0);
    assert.equal(routeJoinIndex([],{x:0,y:0}),0);
});
test('reuse requires a live, aligned, fresh session',()=>{
    assert.equal(canReuseAlignment(true,true,'normal',1000,1500),true);
    for(const args of [[false,true,'normal',1000,1500],[true,false,'normal',1000,1500],
        [true,true,'limited',1000,1500],[true,true,'normal',1000,1700],
        [true,true,'normal',undefined,1500],[true,true,'normal',2000,1500]])
        assert.equal(canReuseAlignment(...args),false);
});
