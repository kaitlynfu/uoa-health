import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {positiveId,messageTarget} from '../services/socialNavigation.ts';
import {studentRequest,sendMessage} from '../services/studentApi.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>readFileSync(path.join(root,file),'utf8');
const nav=read('navigation/AppNavigator.tsx');
const registered=[...nav.matchAll(/<Stack.Screen\s+name=["']([^"']+)["']/g)].map(m=>m[1]);
function files(dir){return readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);}
test('teammate routes are registered exactly once',()=>{
    assert.equal(new Set(registered).size,registered.length);
    for(const route of ['Settings','ChangePassword','NotificationSettings','Privacy','AboutApp','HelpSupport','EditInterests','EditCareerInterests','StudyGroups','AllGroups','AllCourses','CreateGroup','GroupDetails','UserGroup','Friends','Messages','Chat','Notifications','Quiz'])
        assert.ok(registered.includes(route),route);
});
test('literal screen and sidebar destinations all resolve to registered routes',()=>{
    for(const file of [...files('screens'),...files('components')].filter(f=>f.endsWith('.tsx'))) {
        for(const m of read(file).matchAll(/\b(?:navigation|nav)\.(?:navigate|replace)\(['"]([^'"]+)['"]/g))
            assert.ok(registered.includes(m[1]),`${file}: missing ${m[1]}`);
    }
});
test('profile opens dedicated editors and settings, not aliases to EditProfile',()=>{
    const profile=read('screens/ProfileScreen.tsx');
    for(const route of ['EditInterests','EditCareerInterests','Settings'])assert.ok(profile.includes(`navigate('${route}')`));
});
test('social IDs cannot become arbitrary URL fragments',()=>{
    assert.equal(positiveId('42'),42);
    for(const value of ['',0,-1,'1/../2','1.5','1e3',NaN,Infinity,'9007199254740992',undefined])assert.throws(()=>positiveId(value));
});
test('chat uses exactly one target and validates content',()=>{
    assert.deepEqual(messageTarget(7,true,' hello '),{group_id:7,content:'hello'});
    assert.deepEqual(messageTarget(9,false,'hello'),{recipient_id:9,content:'hello'});
    for(const content of ['', '   ','a'.repeat(2001)])assert.throws(()=>messageTarget(1,true,content));
});
test('connected messages retain existing authenticated backend contract',async t=>{
    let sent;
    t.mock.method(globalThis,'fetch',async(url,options)=>{sent={url,...options};return Response.json({id:1});});
    await sendMessage('local-test-token',messageTarget(2,false,'hello'));
    assert.ok(sent.url.endsWith('/social/messages'));
    assert.equal(sent.headers.Authorization,'Bearer local-test-token');
    assert.deepEqual(JSON.parse(sent.body),{recipient_id:2,content:'hello'});
});
test('individual preference changes do not overwrite other fields',async t=>{
    let body;
    t.mock.method(globalThis,'fetch',async(url,options)=>{body=JSON.parse(options.body);assert.ok(url.endsWith('/profile/me'));assert.equal(options.method,'PATCH');return Response.json({});});
    await studentRequest('/profile/me','local-test-token','PATCH',{interests:['Hiking']});
    assert.deepEqual(body,{interests:['Hiking']});
    assert.ok(read('hooks/usePreferenceEditor.ts').includes("'PATCH',{[field]:terms}"));
});
test('new social screens do not ship teammate sample conversations or fake status',()=>{
    for(const file of files('screens/study-groups'))assert.doesNotMatch(read(file),/Olivia Smith|Sophie Williams|Active now|mutualFriends|const chats\s*=/);
});

test('sidebar data-driven destinations resolve and expose social screens',()=>{
    const sidebar=read('components/SideBar.tsx');
    const destinations=[...sidebar.matchAll(/route:\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
    assert.ok(destinations.length>0);
    for(const route of destinations)assert.ok(registered.includes(route),route);
    for(const route of ['StudyGroups','Friends','Messages'])assert.ok(destinations.includes(route),route);
});

test('compass, utility tabs, drawer and campus entry points remain connected',()=>{
    for (const route of ['Home','FindRoute','Wayfinder','IndoorWayfinder']) assert.ok(registered.includes(route));
    assert.match(read('screens/HomeScreen.tsx'), /<Compass size=/);
    const sidebar=read('components/SideBar.tsx');
    for (const route of ['Wayfinder','Friends','Recommendations','Settings','Profile','Progression','Saves','UserGroup'])
        assert.ok(sidebar.includes(`route: "${route}"`), route);
    assert.doesNotMatch(sidebar,/route: "Dashboard"/);
    const shortcuts=read('services/homeNavigation.ts');
    for(const route of ['Saves','Recommendations','Programmes']) assert.ok(registered.includes(route));
    assert.match(shortcuts,/route: 'Saves'/);
    const tabs=read('components/NavBar.tsx');
    for(const match of tabs.matchAll(/route:'([^']+)'/g)) assert.ok(registered.includes(match[1]),match[1]);
    assert.match(read('screens/IndoorWayfinderScreen.tsx'), /<CampusWayfinderScreen/);
});

test('one Wayfinder entry separates indoor AR from outdoor Maps without mounting AR early', () => {
    const hub = read('screens/WayfinderScreen.tsx');
    assert.match(hub, /navigate\('IndoorWayfinder'\)/);
    assert.match(hub, /navigate\('FindRoute'\)/);
    assert.match(hub, /Choose indoor navigation/);
    assert.match(hub, /Choose outdoor navigation/);
    assert.match(hub, /iPhone AR pilot/);
    assert.match(hub, /do not switch automatically/);
    assert.doesNotMatch(hub, /<CampusWayfinderScreen|requestCameraPermissions|<HomeArView/);
    assert.match(read('screens/IndoorWayfinderScreen.tsx'), /<CampusWayfinderScreen\/>/);
    assert.match(read('screens/FindRouteScreen.tsx'), /Outdoor wayfinder/);
    assert.doesNotMatch(read('components/SideBar.tsx'), /route: "FindRoute"/);
    assert.match(read('screens/CampusWayfinderScreen.tsx'), /usePreventRemove\(editing\|\|busy/);
});
