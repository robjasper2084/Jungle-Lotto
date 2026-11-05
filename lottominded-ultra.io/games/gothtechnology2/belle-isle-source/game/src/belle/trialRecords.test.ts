import test from 'node:test';
import assert from 'node:assert/strict';
import {TrialRecords, type TrialStorage} from './trialRecords.ts';
import type {TrialCourse} from './trialRules.ts';

const course = (id = 'sky-bridge-v1', vehicle: TrialCourse['vehicle'] = 'hoverbike'): TrialCourse => ({
  id, vehicle, name: 'Test course', description: 'A test route.', distance: 30,
  start: {x: 0, y: 5, z: 0, heading: 0}, gates: [{x: 0, y: 5, z: 30, heading: 0, radius: 2, halfHeight: 2}],
  path: [], color: '#82e4da', maxSpeed: 40,
});
function memory(value: string | null = null): TrialStorage & {value: string | null} {
  return {value, getItem() { return this.value; }, setItem(_key, next) { this.value = next; }};
}

test('course, version and vehicle personal bests remain separate through slower replays and reload', () => {
  const storage = memory(), records = new TrialRecords(storage);
  const bridge = course(), sunset = course('sky-sunset-v1'), cup = course('island-cup-v1', 'onewheel');
  assert.deepEqual(records.save(bridge, 60, [60]), {improved: true, saved: true, best: 60});
  records.save(sunset, 80, [80]);
  records.save(cup, 45, [45]);
  records.save(course(bridge.id, 'onewheel'), 90, [90]);
  assert.deepEqual(records.save(bridge, 70, [70]), {improved: false, saved: true, best: 60});
  assert.deepEqual(records.save(bridge, 55, [55]), {improved: true, saved: true, best: 55});
  const restored = new TrialRecords(storage);
  assert.equal(restored.best(bridge), 55);
  assert.equal(restored.best(sunset), 80);
  assert.equal(restored.best(cup), 45);
  assert.equal(restored.best(course(bridge.id, 'onewheel')), 90);
  assert.equal(restored.best(course('sky-bridge-v2')), null);
});

test('malformed saves recover safely and valid independent records survive mixed bad entries', () => {
  for (const value of ['invalid JSON', '{"version":2,"records":[]}', '{"version":1,"records":{}}']) {
    const records = new TrialRecords(memory(value));
    assert.equal(records.best(course()), null);
    assert.equal(records.save(course(), 50, [50]).saved, true);
  }
  const records = new TrialRecords(memory(JSON.stringify({version: 1, records: [
    {courseId: 'sky-bridge-v1', vehicle: 'hoverbike', seconds: 40, splits: [40]},
    {courseId: 'sky-sunset-v1', vehicle: 'hoverbike', seconds: 60, splits: [30, 10]},
    {courseId: 'island-cup-v1', vehicle: 'onewheel', seconds: -1, splits: []},
    {courseId: 'sky-bridge-v1', vehicle: 'hoverbike', seconds: 90, splits: [90]},
    {courseId: '__proto__', vehicle: 'onewheel', seconds: 1, splits: []},
    {courseId: 'bogus-v1', vehicle: 'car', seconds: 10, splits: []},
  ]})));
  assert.equal(records.best(course()), 40, 'slower duplicate cannot replace a best');
  assert.equal(records.best(course('sky-sunset-v1')), 60, 'damaged optional splits do not erase a valid time');
  assert.equal(records.best(course('island-cup-v1', 'onewheel')), null);
  assert.equal(records.best(course('__proto__', 'onewheel')), null);
});

test('unavailable reads and quota failures keep session bests without claiming persistence', () => {
  for (const storage of [null, {getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }}]) {
    const records = new TrialRecords(storage);
    assert.equal(records.available, false);
    assert.deepEqual(records.save(course(), 60, [60]), {improved: true, saved: false, best: 60});
    assert.equal(records.best(course()), 60);
  }
  const storage = memory();
  let writable = false;
  const blocked: TrialStorage = {getItem: key => storage.getItem(key), setItem(key, value) {
    if (!writable) throw new Error('Quota exceeded');
    storage.setItem(key, value);
  }};
  const records = new TrialRecords(blocked);
  assert.deepEqual(records.save(course(), 50, [50]), {improved: true, saved: false, best: 50});
  assert.equal(records.available, false);
  assert.equal(storage.value, null);
  writable = true;
  assert.deepEqual(records.save(course(), 55, [55]), {improved: false, saved: true, best: 50});
  assert.equal(records.available, true);
  assert.equal(new TrialRecords(storage).best(course()), 50, 'a later save retries the better session result');
});

test('invalid times and incomplete split sequences cannot replace a saved finish', () => {
  const records = new TrialRecords(memory()), track = course();
  records.save(track, 60, [60]);
  for (const seconds of [0, -1, NaN, Infinity]) {
    assert.deepEqual(records.save(track, seconds), {improved: false, saved: false, best: 60});
  }
  assert.equal(records.save(track, 50, [20]).saved, false, 'final split must match finish');
  assert.equal(records.save(track, 50, [20, 50]).saved, false, 'provided splits must cover exactly the course gates');
  assert.equal(records.save(track, 50, [NaN]).saved, false);
  assert.equal(records.best(track), 60);
});
