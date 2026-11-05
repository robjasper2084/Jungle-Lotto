import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyActivityProfile, completeActivity, activityXp, readActivityProfile} from './activityProgress.ts';

test('first clears and medal upgrades award XP exactly once, including after a reload', () => {
  let result = completeActivity(emptyActivityProfile(), {id: 'dispatch:first', baseXp: 80, score: 60, seconds: 90, ride: 'onewheel'});
  assert.equal(result.earnedXp, 80);
  result = completeActivity(readActivityProfile(JSON.stringify(result.profile)), {id: 'dispatch:first', baseXp: 80, score: 60, seconds: 95, ride: 'onewheel'});
  assert.equal(result.earnedXp, 0);
  result = completeActivity(result.profile, {id: 'dispatch:first', baseXp: 80, score: 95, seconds: 65, ride: 'hoverbike'});
  assert.equal(result.earnedXp, 20);
  result = completeActivity(result.profile, {id: 'dispatch:first', baseXp: 80, score: 100, seconds: 60, ride: 'hoverbike'});
  assert.equal(result.earnedXp, 0);
  assert.equal(activityXp(result.profile), 100);
  assert.deepEqual(result.profile.records['dispatch:first'].bestSecondsByRide, {onewheel: 90, hoverbike: 60});
});

test('invalid storage and locked cosmetics recover without losing valid records', () => {
  assert.deepEqual(readActivityProfile('invalid'), emptyActivityProfile());
  assert.deepEqual(readActivityProfile('{"version":2,"records":{}}'), emptyActivityProfile());
  const profile = completeActivity(emptyActivityProfile(), {id: 'photo:first', baseXp: 50, score: 80}).profile;
  profile.frame = 'gold';
  const restored = readActivityProfile(JSON.stringify(profile));
  assert.equal(restored.frame, 'classic');
  assert.equal(activityXp(restored), 60);
});

test('malformed identifiers and inherited properties cannot become progress records', () => {
  assert.throws(() => completeActivity(emptyActivityProfile(), {id: '__proto__', baseXp: 50, score: 100}));
  assert.throws(() => completeActivity(emptyActivityProfile(), {id: 'valid', baseXp: 50, score: NaN}));
  assert.deepEqual(readActivityProfile('{"version":1,"records":{"__proto__":{"baseXp":99,"medal":"gold","bestScore":99}}}'), emptyActivityProfile());
});
