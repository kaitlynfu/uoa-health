import test from 'node:test';
import assert from 'node:assert/strict';
import {routeRequest} from '../services/sharedRoutes.ts';
import {studentRequest} from '../services/studentApi.ts';
const enabled=process.env.TEAM43_LOCAL_API_TESTS==='true';
if(enabled) {
    const url=new URL(process.env.EXPO_PUBLIC_API_URL);
    assert.ok(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname));
}
test('real local server: authorised publish, public read, denial, conflict and recovery',{skip:!enabled},async()=>{
    const login=async email=>studentRequest('/auth/login',undefined,'POST',{email,password:'Team43-Local-Only-2026!'});
    const editor=await login('alice@example.test'), reader=await login('bob@example.test');
    const token=editor.access_token, path='home-routes/living';
    assert.equal((await routeRequest('editor-access',token)).can_edit_routes,true);
    assert.equal((await routeRequest('editor-access',reader.access_token)).can_edit_routes,false);
    const original=await routeRequest(path);
    const points=[{id:'start',label:'Start',x:0,y:0},{id:'living',label:'Living',x:1,y:1}];
    const body={expected_revision:original.revision,marker:'home-start-v1',points};
    await assert.rejects(routeRequest(path,reader.access_token,body),/authorised/);
    const saved=await routeRequest(path,token,body);
    assert.equal(saved.revision,original.revision+1);
    assert.deepEqual((await routeRequest(path)).points,points);
    await assert.rejects(routeRequest(path,token,body),/newer route/);
    const next=await routeRequest(path,token,{...body,expected_revision:saved.revision,points:[points[0],{...points[1],x:2}]});
    const history=await routeRequest(path+'/history',token);
    const restored=await routeRequest(path,token,{...body,expected_revision:next.revision,points:history[1].points});
    assert.deepEqual(restored.points,points);
});
