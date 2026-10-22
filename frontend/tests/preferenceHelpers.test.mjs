import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preferenceTerms, togglePreference, nextMilestone } from '../services/preferenceHelpers.ts';
test('chips and free text deduplicate case-insensitively', () => {
 assert.deepEqual(preferenceTerms('Biology, biology, Hiking, '), ['Biology','Hiking']);
 assert.equal(togglePreference('biology, Hiking', 'Biology'), 'Hiking');
 assert.equal(togglePreference('Biology', 'Music'), 'Biology, Music');
});
test('next milestone uses earliest incomplete stage without mutating input', () => {
 const items=[{stage:2,completed:false,id:2},{stage:1,completed:true,id:1},{stage:1,completed:false,id:3},{stage:null,completed:false,id:4}];
 assert.equal(nextMilestone(items).id,3);
 assert.equal(items[0].id,2);
 assert.equal(nextMilestone([{stage:1,completed:true}]),undefined);
 assert.equal(nextMilestone([]),undefined);
});
