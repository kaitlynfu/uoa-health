import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingArRoute} from '../services/buildingArRoute.ts';
const start={id:1,code:'303-G-ENTRANCE-A',name:'Start',floor_id:1,building_id:303,x:-54.35,y:-20.57};
const door={...start,id:2,code:'303-G-DOOR',name:'Door',x:-44.35};
const route={start,arrival_door:door,destination:{building_number:'303'},locations:[start,door]};
const placement={markerId:'303-entrance-a-v1',checkpointCode:start.code,floorId:1,x:start.x,z:start.y,
    forwardX:1,forwardZ:0,physicalWidthM:.2,verified:true};
test('metric graph transforms into marker frame without scaling or mirroring',()=>{
    const points=buildingArRoute(route,placement);
    assert.deepEqual(points.map(p=>[p.x,p.y]),[[0,0],[0,10]]);
    const rotated=buildingArRoute(route,{...placement,forwardX:0,forwardZ:1});
    assert.deepEqual(rotated.map(p=>[p.x,p.y]),[[0,0],[10,0]]);
});
test('unverified, wrong checkpoint and wrong floor markers cannot start AR',()=>{
    for(const change of [{verified:false},{markerId:'home-start-v1'},{floorId:2},{checkpointCode:'303-OTHER'},
        {x:0},{forwardX:2},{physicalWidthM:0}]) assert.throws(()=>buildingArRoute(route,{...placement,...change}));
});
test('cross-floor and malformed routes cannot become floor arrows',()=>{
    for(const changed of [{...door,floor_id:2},{...door,building_id:4},{...door,x:null},{...door,y:NaN},{...door,code:start.code}])
        assert.throws(()=>buildingArRoute({...route,locations:[start,changed]},placement));
    assert.throws(()=>buildingArRoute({...route,locations:[door,start]},placement));
});
