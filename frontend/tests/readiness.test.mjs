import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {decodeSession,sessionExpiry,sessionWriter} from '../services/sessionStorage.ts';
import {mergeMessages,messageDate} from '../services/chatPresentation.ts';
import {careerQuestions,quizPreferences,quizComplete,quizResult,toggleQuizChoice,mergeQuizPreferences,quizCareers} from '../services/careerQuiz.ts';

test('restored sessions require valid identity and future UTC expiry',()=>{
    const auth={access_token:'a-token',user:{id:1,display_name:'Alice',email:'alice@example.test'},expires_at:'2026-10-03T00:00:00'};
    const now=Date.parse('2026-10-02T00:00:00Z');
    assert.equal(sessionExpiry(auth.expires_at),Date.parse('2026-10-03T00:00:00Z'));
    assert.deepEqual(decodeSession(JSON.stringify(auth),now),auth);
    assert.equal(decodeSession(JSON.stringify(auth),now+86400000),null);
    assert.equal(decodeSession('not-json',now),null);
    assert.equal(decodeSession(JSON.stringify({...auth,user:{id:0}}),now),null);
});
test('slow secure writes cannot resurrect a session after sign-out',async()=>{
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    let stored=null;
    const save=sessionWriter({read:async()=>stored,write:async value=>{await gate;stored=value;},remove:async()=>{stored=null;}});
    const write=save({access_token:'secret'});const logout=save(null);
    release();await Promise.all([write,logout]);assert.equal(stored,null);
});
test('failed storage writes do not stop a later sign-out',async()=>{
    let removed=false;
    const save=sessionWriter({read:async()=>null,write:async()=>{throw new Error('locked');},remove:async()=>{removed=true;}});
    await assert.rejects(save({access_token:'secret'}),/locked/);await save(null);assert.equal(removed,true);
});
test('chat pages merge without duplicates or moving a new message backwards',()=>{
    const current=[{id:52,content:'existing'},{id:53,content:'new'}];
    assert.deepEqual(mergeMessages(current,[{id:51,content:'older'},{id:52,content:'existing'}]).map(m=>m.id),[51,52,53]);
    assert.equal(messageDate('invalid'),'');
    assert.equal(messageDate('2026-10-02T00:00:00'),messageDate('2026-10-02T00:00:00Z'));
});
test('quiz only maps deliberately selected interests; it does not invent a suitability score',()=>{
    assert.deepEqual(quizPreferences({}),{interests:[],career_interests:[]});
    assert.deepEqual(quizPreferences({subjects:['science'],activities:['investigate','unknown']}),{interests:['biomedical science','research'],career_interests:['research']});
});

const answersFor=area=>Object.fromEntries(careerQuestions.map(question=>[question.id,question.choices.filter(choice=>area.includes(choice.area)).map(choice=>choice.id)]));
test('quiz requires valid answers to every question and caps choices without mutating answers',()=>{
    assert.equal(quizComplete({}),false);
    const clinical=answersFor(['clinical']);
    assert.equal(quizComplete(clinical),true);
    for(const invalid of [[],['unknown'],['body','body'],['body','science','mind']])assert.equal(quizComplete({...clinical,subjects:invalid}),false);
    assert.throws(()=>quizResult({...clinical,impact:[]}),/Answer each question/);
    const one=toggleQuizChoice({},'subjects','body');
    const two=toggleQuizChoice(one,'subjects','science');
    assert.deepEqual(one,{subjects:['body']});
    assert.deepEqual(toggleQuizChoice(two,'subjects','mind'),two);
    assert.deepEqual(toggleQuizChoice(two,'subjects','body'),{subjects:['science']});
    assert.deepEqual(toggleQuizChoice(two,'not-a-question','body'),two);
});
test('quiz gives every question equal weight, keeps ties and reflects answer changes',()=>{
    for(const area of ['clinical','research','public','mental','technology']){
        const result=quizResult(answersFor([area]));
        assert.deepEqual(result.areas.map(item=>[item.id,item.score]),[[area,6]]);
        assert.equal(result.areas[0].reasons.length,6);
    }
    const mixed=answersFor(['clinical','research']);
    const tied=quizResult(mixed);
    assert.deepEqual(tied.areas.map(area=>area.score),[3,3]);
    assert.equal(tied.areas.reduce((sum,area)=>sum+area.score,0),6);
    const changed=quizResult({...mixed,subjects:['science']});
    assert.equal(changed.areas[0].id,'research');
    assert.equal(changed.areas[0].score,3.5);
});
test('quiz saving preserves existing preferences, deduplicates case and fails without truncation at profile limits',()=>{
    const existing={interests:['Biology','RESEARCH'],career_interests:['Doctor']};
    const additions={interests:['research','Chemistry'],career_interests:['doctor','research']};
    assert.deepEqual(mergeQuizPreferences(existing,additions),{interests:['Biology','RESEARCH','Chemistry'],career_interests:['Doctor','research']});
    assert.deepEqual(existing,{interests:['Biology','RESEARCH'],career_interests:['Doctor']});
    assert.throws(()=>mergeQuizPreferences({interests:Array.from({length:30},(_,i)=>`Term ${i}`),career_interests:[]},additions),/full/);
});
test('quiz suggestions contain only supplied catalogue careers in selected areas, with area diversity',()=>{
    const result=quizResult(answersFor(['clinical','research']));
    const rows=[{id:1,title:'A clinician',category:'Clinical'},{id:2,title:'B clinician',category:'Clinical'},{id:3,title:'C researcher',category:'Research'},{id:4,title:'Policy adviser',category:'Public Health'}];
    const choices=quizCareers(rows,result);
    assert.deepEqual(choices.map(career=>career.id),[1,3,2]);
    assert.deepEqual(quizCareers([],result),[]);
    assert.ok(choices.every(career=>rows.includes(career)));
});
test('patched uuid remains compatible with the Expo Xcode and tunnel v4 consumers',()=>{
    const require=createRequire(import.meta.url);
    for(const packageName of ['xcode','@expo/ngrok']){
        const consumer=createRequire(require.resolve(packageName));
        assert.match(consumer('uuid').v4(),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    }
});

test('shell quoting rejects a newline after a comment token',()=>{
    const require=createRequire(import.meta.url);
    const quote=require('shell-quote').quote;
    assert.throws(()=>quote(['echo','ok',{comment:'x'},'a\nid;#']),TypeError);
    assert.equal(quote(['echo','a b']),"echo 'a b'");
});
