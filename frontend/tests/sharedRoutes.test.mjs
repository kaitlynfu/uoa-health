import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedSharedRoute, routeRequest} from '../services/sharedRoutes.ts';
const points=[{id:'start',label:'Start',x:0,y:0},{id:'living',label:'Living',x:1,y:1}];
const value={destination:'living',marker:'home-start-v1',revision:1,points};

test('shared geometry is validated against the selected destination and marker',()=>{
    assert.deepEqual(checkedSharedRoute(value,'living',points),points);
    for(const invalid of [{...value,marker:'303'},{...value,destination:'office'},
        {...value,revision:-1},{...value,revision:0},{...value,points:null},
        {...value,points:[{...points[0],x:2},points[1]]}])
        assert.throws(()=>checkedSharedRoute(invalid,'living',points));
    assert.equal(checkedSharedRoute({...value,revision:0,points:null},'living',points),points);
});
test('public reads omit credentials; publication sends explicit revision and token',async(t)=>{
    const requests=[];
    t.mock.method(globalThis,'fetch',async(url,options)=>{
        requests.push({url,options});return {ok:true,json:async()=>value};
    });
    await routeRequest('home-routes/living');
    await routeRequest('home-routes/living','private-token',{expected_revision:0,points});
    assert.equal(requests[0].options.headers.Authorization,undefined);
    assert.equal(requests[0].options.method,'GET');
    assert.equal(requests[1].options.headers.Authorization,'Bearer private-token');
    assert.equal(JSON.parse(requests[1].options.body).expected_revision,0);
    assert.ok(requests[0].options.signal instanceof AbortSignal);
});
test('conflicts and denied access are not reported as successful saves',async(t)=>{
    t.mock.method(globalThis,'fetch',async()=>({ok:false,status:409}));
    await assert.rejects(routeRequest('home-routes/living','token',{}),/newer route/);
    globalThis.fetch=async()=>({ok:false,status:403});
    await assert.rejects(routeRequest('home-routes/living','token',{}),/authorised/);
});
