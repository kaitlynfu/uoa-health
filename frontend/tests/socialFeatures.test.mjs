import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInbox,getSavedGroups,setGroupSaved,createSocialGroup,markConversationRead} from '../services/socialFeatures.ts';

test('social requests use auth, paging, exact payloads and idempotent bookmarks',async t=>{
    const calls=[];
    t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return new Response(null,{status:204});});
    await getInbox('token',50);await getSavedGroups('token',100);
    await setGroupSaved('token',4,true);await setGroupSaved('token',4,false);
    const draft={name:'Study',course:'BIOSCI 107',description:'Together',location:'Library',group_type:'Exam Prep',study_format:'Hybrid',preferred_days:['Mon']};
    await createSocialGroup('token',draft);await markConversationRead('token','group',4,12);
    assert.ok(calls[0].url.endsWith('/social/messages/inbox?limit=50&offset=50'));
    assert.ok(calls[1].url.endsWith('/social/groups/saved?limit=50&offset=100'));
    assert.equal(calls[2].options.method,'PUT');assert.equal(calls[3].options.method,'DELETE');
    assert.deepEqual(JSON.parse(calls[4].options.body),draft);
    assert.ok(calls[5].url.endsWith('/social/messages/group/4/read'));
    assert.deepEqual(JSON.parse(calls[5].options.body),{through_message_id:12});
    for(const call of calls)assert.equal(call.options.headers.Authorization,'Bearer token');
});
test('failed inbox request stays an error, not an empty conversation list',async t=>{
    t.mock.method(globalThis,'fetch',async()=>Response.json({detail:'Unavailable'},{status:503}));
    await assert.rejects(getInbox('token'),/Unavailable/);
});
