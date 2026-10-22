import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studentRequest, sendMessage, ApiError } from '../services/studentApi.ts';
import { adaptCareer, getCareers } from '../services/careerAdapter.ts';
import { validCatalogueYear } from '../services/catalogueYear.ts';

test('catalogue year accepts real years rather than a literal escaped digit pattern', () => {
  for (const value of ['2024','2027','2100']) assert.equal(validCatalogueYear(value),true);
  for (const value of ['2023','2101','20\\d','abc','2027x','']) assert.equal(validCatalogueYear(value),false);
});

test('authenticated messages use the social prefix and snake_case JSON', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = {url, ...options}; return Response.json({id:42});
  });
  assert.deepEqual(await sendMessage('test-token', {group_id:7, content:'hello'}), {id:42});
  assert.ok(sent.url.endsWith('/social/messages'));
  assert.equal(sent.method, 'POST');
  assert.equal(sent.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(sent.body), {group_id:7, content:'hello'});
});
test('204 responses do not attempt JSON parsing', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, {status:204}));
  assert.equal(await studentRequest('/test','token','DELETE'), undefined);
});

test('the request deadline covers a stalled response body after headers arrive', {timeout:1000}, async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(globalThis,'fetch',async (_url,{signal})=>({ok:true,status:200,json:()=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(new Error('Body aborted')),{once:true});
  })}));
  const request=studentRequest('/slow-body');
  await Promise.resolve();
  t.mock.timers.tick(15000);
  await assert.rejects(request,/too long to respond/);
});
test('structured API errors retain status and safe validation messages', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({detail:'Membership required'}, {status:403}));
  await assert.rejects(studentRequest('/test'), e => e instanceof ApiError && e.status === 403 && e.message === 'Membership required');
  mock.mock.mockImplementation(async () => Response.json({detail:[{input:'do not echo'}]}, {status:422}));
  await assert.rejects(studentRequest('/test'), /Please check the entered values/);
});
test('career adapter preserves canonical identity and every linked programme', () => {
  const programmes = [{id:1,name:'A'}, {id:2,name:'B'}];
  const result = adaptCareer({id:3,name:'Public health researcher',description:null,official_url:null}, programmes);
  assert.equal(result.id, 3); assert.equal(result.title, 'Public health researcher');
  assert.deepEqual(result.programmes, programmes); assert.equal(result.category,'Public Health');
});
test('career search encodes query without inventing programme relationships', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(new URL(url).searchParams.get('q'), 'research & health');
    return Response.json([{id:1,name:'Researcher',description:null,official_url:null}]);
  });
  assert.deepEqual((await getCareers(' research & health '))[0].programmes, []);
});
