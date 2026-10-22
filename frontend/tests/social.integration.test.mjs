// Opt-in: isolated local backend only. Never uses the deployed app or real accounts.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';

test('two accounts: discover friends and groups, join, bookmark, inbox and message reads', {skip:!process.env.SOCIAL_TEST_BACKEND,timeout:30000},async()=>{
    const folder=await mkdtemp(path.join(tmpdir(),'team43-social-test-'));
    const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
    const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
    const base=`http://127.0.0.1:${port}`;
    const child=spawn(process.env.SOCIAL_TEST_PYTHON||'python',['-m','uvicorn','app.main:app','--host','127.0.0.1','--port',String(port)],{
        cwd:process.env.SOCIAL_TEST_BACKEND,windowsHide:true,stdio:'ignore',
        env:{...process.env,DATABASE_URL:`sqlite:///${path.join(folder,'test.db').replaceAll('\\','/')}`},
    });
    let launchError;child.on('error',error=>{launchError=error;});
    try {
        let ready=false;
        for(let i=0;i<100;i++){
            if(launchError)throw launchError;
            if(child.exitCode!==null)throw new Error('Local test backend exited');
            try{if((await fetch(base+'/openapi.json')).ok){ready=true;break;}}catch{}
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        assert.ok(ready,'Local backend started');
        process.env.EXPO_PUBLIC_API_URL=base;
        const {studentRequest}=await import('../services/studentApi.ts');
        const api=await import('../services/socialFeatures.ts');
        const register=name=>studentRequest('/auth/register',undefined,'POST',{email:`${name}@example.test`,display_name:name,password:'isolated-test-password'});
        const alice=await register('alice'),bob=await register('bob');
        const a=alice.access_token,b=bob.access_token;
        const found=await api.socialPage(a,'/social/users?q=bob');
        assert.deepEqual(found.map(u=>[u.id,u.display_name,u.connection]),[[bob.user.id,'bob','none']]);
        assert.ok(!('email' in found[0]));
        await studentRequest('/social/friends/request',a,'POST',{friend_id:bob.user.id});
        assert.equal((await api.socialPage(b,'/social/friends/requests?direction=incoming'))[0].user.id,alice.user.id);
        assert.equal((await api.socialPage(a,'/social/friends/requests?direction=outgoing'))[0].user.id,bob.user.id);
        await studentRequest(`/social/friends/${alice.user.id}/accept`,b,'POST');
        assert.equal((await api.socialPage(b,'/social/friends'))[0].user.display_name,'alice');
        assert.equal((await api.socialPage(a,'/social/users?q=bob'))[0].connection,'friend');
        const group=await api.createSocialGroup(a,{name:'Test group',course:'BIOSCI 107',description:'Persist all fields',location:'Library',group_type:'Exam Prep',study_format:'Hybrid',preferred_days:['Mon','Fri']});
        const stored=await api.getGroupDetails(b,group.id);
        assert.equal(stored.description,'Persist all fields');assert.deepEqual(stored.preferred_days,['Mon','Fri']);
        assert.equal(stored.member_count,1);assert.equal(stored.joined,false);
        assert.equal((await api.socialPage(b,'/social/groups?q=Test&course=BIOSCI&study_format=Hybrid'))[0].id,group.id);
        assert.deepEqual(await api.getJoinedGroups(b),[]);
        await assert.rejects(api.socialPage(b,`/social/groups/${group.id}/members`),e=>e.status===403);
        await api.setGroupSaved(b,group.id,true);await api.setGroupSaved(b,group.id,true);
        assert.equal((await api.getSavedGroups(b)).length,1);assert.deepEqual(await api.getSavedGroups(a),[]);
        await assert.rejects(studentRequest(`/social/messages/group/${group.id}`,b),e=>e.status===403);
        await studentRequest(`/social/groups/${group.id}/join`,b,'POST');
        assert.equal((await api.getJoinedGroups(b))[0].id,group.id);
        const joined=await api.getGroupDetails(b,group.id);
        assert.equal(joined.joined,true);assert.equal(joined.saved,true);assert.equal(joined.member_count,2);
        assert.deepEqual((await api.socialPage(b,`/social/groups/${group.id}/members`)).map(m=>m.user.display_name),['alice','bob']);
        const groupMessage=await studentRequest('/social/messages',a,'POST',{group_id:group.id,content:'Group hello'});
        const direct=await studentRequest('/social/messages',a,'POST',{recipient_id:bob.user.id,content:'Direct hello'});
        const inbox=await api.getInbox(b);assert.equal(inbox.length,2);assert.ok(inbox.every(c=>c.unread_count===1));
        assert.equal(inbox[0].name,'alice');assert.equal(inbox[0].last_message.content,'Direct hello');
        await api.markConversationRead(b,'direct',alice.user.id,direct.id);
        await api.markConversationRead(b,'group',group.id,groupMessage.id);
        assert.ok((await api.getInbox(b)).every(c=>c.unread_count===0));
        await api.setGroupSaved(b,group.id,false);assert.deepEqual(await api.getSavedGroups(b),[]);
        await studentRequest(`/social/groups/${group.id}/leave`,b,'DELETE');
        assert.deepEqual(await api.getJoinedGroups(b),[]);
        assert.equal((await api.getInbox(b)).length,1);
        await studentRequest(`/social/friends/${alice.user.id}`,b,'DELETE');
        assert.deepEqual(await api.socialPage(a,'/social/friends'),[]);
    }finally{
        if(child.exitCode===null&&!launchError){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill();await ended;}
        // Only remove this test's freshly-created temporary directory.
        if(path.dirname(folder)===tmpdir()&&path.basename(folder).startsWith('team43-social-test-'))await rm(folder,{recursive:true,force:true});
    }
});
