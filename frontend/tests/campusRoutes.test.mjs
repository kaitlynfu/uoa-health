import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCampusRoute,validateCampusPoints,campusBinding,recogniseCampus} from '../services/campusRoutes.ts';
const leg={floor:'G',start_label:'Entrance',heading_label:'Hall',transition:'elevator',frame_id:'campus-example',
    points:[{id:'start',label:'Entrance',x:0,y:0},{id:'lift',label:'Lift',x:1,y:60}]};
const route={key:'a'.repeat(24),building:'303',start:'entrance',destination:'303-104',accessible:true,include_gaps:false,revision:1,legs:[leg],survey_gaps:[]};
test('campus geometry supports building scale without changing the fixed start',()=>{
    assert.equal(validateCampusRoute(route),route);
    assert.throws(()=>validateCampusPoints([{...leg.points[0],x:1},leg.points[1]],leg.points));
    assert.throws(()=>validateCampusPoints([leg.points[0],{...leg.points[1],x:201}],leg.points));
});
test('recognition requires exact floor frame and edited geometry with a fresh pose',()=>{
    const event={alignment:[10,20,.15,0,1],timestamp:5,routes:JSON.stringify(campusBinding(route,leg))};
    assert.equal(recogniseCampus(event,route,leg,{timestamp:5,received:1000},1100).x,10);
    assert.equal(recogniseCampus(event,route,leg,{timestamp:5,received:1000},1600),null);
    for(const change of [{floor:'1'},{frame_id:'campus-wrong'},{points:[leg.points[0],{...leg.points[1],x:2}]}]){
        const bad={...event,routes:JSON.stringify({...campusBinding(route,leg),...change})};
        assert.throws(()=>recogniseCampus(bad,route,leg,{timestamp:5,received:1000},1100));
    }
});
