// Explicit opt-in; never run writes against the deployed API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studentRequest as request, sendMessage } from '../services/studentApi.ts';
import { getCareers, getCareerDetails } from '../services/careerAdapter.ts';
import { getProgrammes, getProgramme, getNavigationDestinations, getNavigationRoute } from '../services/api.ts';

const enabled = process.env.TEAM43_LOCAL_API_TESTS === 'true';
if (enabled) {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL);
  assert.ok(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname), 'Only explicit loopback test APIs are allowed');
}
test('running frontend/API integration: accounts, saves, journey, messages and indoor routing', {skip:!enabled}, async () => {
  const suffix = crypto.randomUUID();
  const register = name => request('/auth/register', undefined, 'POST', {
    email:`${name}-${suffix}@example.test`, password:'Integration-Test-Only-2026!', display_name:name,
  });
  const a = await register('TestAlice'), b = await register('TestBob'), outsider = await register('Outsider');
  const ta = a.access_token, tb = b.access_token;
  const programmes = await getProgrammes(); assert.equal(programmes.length,9);
  const programme = programmes.find(p => p.name.startsWith('Bachelor of Health Sciences'));
  assert.ok(programme);
  assert.equal((await getProgramme(programme.id)).id,programme.id);
  const careers = await getCareers(); assert.ok(careers.length > 0);
  const career = await getCareerDetails(careers[0].id); assert.ok(career.programmes.length > 0);
  await request('/profile/me',ta,'PATCH',{interests:['biology'],career_interests:['research']});
  await request(`/profile/me/saved-programmes/${programme.id}`,ta,'POST');
  await request(`/profile/me/saved-careers/${career.id}`,ta,'POST');
  const profile = await request('/profile/me',ta);
  assert.deepEqual(profile.interests,['biology']); assert.equal(profile.saved_programmes[0].id,programme.id);
  assert.equal(profile.saved_careers[0].id,career.id);
  assert.deepEqual((await request('/profile/me',tb)).saved_careers,[]);
  const plans = await request(`/journey/programmes/${programme.id}/plans?catalogue_year=2027`);
  assert.ok(plans.length > 0);
  let journey = await request('/journey/me/programme',ta,'PUT',{programme_id:programme.id,plan_code:plans[0].code,catalogue_year:2027,current_stage:1});
  assert.ok(journey.milestones.length > 0);
  const milestone = journey.milestones[0];
  journey = await request(`/journey/me/milestones/${milestone.id}`,ta,'PATCH',{completed:true});
  assert.equal(journey.milestones.find(m=>m.id===milestone.id).completed,true);
  assert.equal((await request('/journey/me',ta)).completed_count,1);
  const group = await request('/social/groups',ta,'POST',{name:'Integration fixture group'});
  await assert.rejects(request(`/social/messages/group/${group.id}`,tb), e=>e.status===403);
  await assert.rejects(sendMessage(tb,{group_id:group.id,content:'blocked'}), e=>e.status===403);
  await request(`/social/groups/${group.id}/join`,tb,'POST');
  await sendMessage(ta,{group_id:group.id,content:'group fixture'});
  assert.equal((await request(`/social/messages/group/${group.id}`,tb))[0].content,'group fixture');
  await sendMessage(ta,{recipient_id:b.user.id,content:'private fixture'});
  assert.equal((await request(`/social/messages/direct/${a.user.id}`,tb))[0].content,'private fixture');
  assert.deepEqual(await request(`/social/messages/direct/${a.user.id}`,outsider.access_token),[]);
  await request(`/social/groups/${group.id}/leave`,tb,'DELETE');
  await assert.rejects(request(`/social/messages/group/${group.id}`,tb),e=>e.status===403);
  const destinations = await getNavigationDestinations(); assert.equal(destinations.length,7);
  for (const start of ['303-G-ENTRANCE-B','303-G-ENTRANCE-C','303-G-ENTRANCE-D']) {
    for (const destination of destinations) {
      const route = await getNavigationRoute(start,destination.code);
      assert.equal(route.destination.code,destination.code); assert.ok(route.steps.length > 0);
    }
  }
  const accessible = await getNavigationRoute('303-G-ENTRANCE-C','303-103',true);
  assert.ok(accessible.locations.some(l=>l.location_type==='elevator'));
  assert.ok(accessible.locations.every(l=>l.location_type!=='stairs'));
  await assert.rejects(getNavigationRoute('303-G-ENTRANCE-A','303-103'), /No route found/);
  for (const token of [ta,tb,outsider.access_token]) await request('/auth/logout',token,'POST');
  await assert.rejects(request('/profile/me',ta),e=>e.status===401);
});
