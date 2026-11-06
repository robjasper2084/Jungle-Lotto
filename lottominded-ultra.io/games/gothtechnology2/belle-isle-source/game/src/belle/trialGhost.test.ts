import test from 'node:test';
import assert from 'node:assert/strict';
import {TrialRun, type TrialCourse} from './trialRules.ts';
import {createTrialGhostPose, createTrialPaceGhost, sampleTrialGhost, TrialGhostRecorder, TrialGhostStore, trialGhostFingerprint,
  TRIAL_GHOST_MAX_RECORDS, TRIAL_GHOST_MAX_SAMPLES, TRIAL_GHOST_MAX_SECONDS, TRIAL_GHOST_SAMPLE_SECONDS, TRIAL_GHOST_STORAGE_BUDGET,
  TRIAL_GHOST_STORAGE_KEY, type TrialGhostInput, type TrialGhostTrack} from './trialGhost.ts';
import type {TrialStorage} from './trialRecords.ts';

const close = (actual: number, expected: number, tolerance = 1e-7) => assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function course(id = 'ghost-test-v1', vehicle: TrialCourse['vehicle'] = 'hoverbike', distance = 100): TrialCourse {
  return {id, vehicle, name: 'Ghost test route', description: 'Fixture', distance, start: {x: 0, y: 2, z: 0, heading: 0},
    gates: [{x: 0, y: 2, z: distance, heading: 0, radius: 3, halfHeight: 2}],
    path: [{x: 0, y: 2, z: 0}, {x: 0, y: 2, z: distance}], color: '#a2e6d5', maxSpeed: 35};
}
const actor = (track: TrialCourse, z: number, heading = 0): TrialGhostInput => ({x: 0, y: 2, z, heading, vehicle: track.vehicle, onFoot: false, pitch: .1, roll: -.2});
function ride(track: TrialCourse = course(), speed = 8, delta = .37) {
  const run = new TrialRun(track), recorder = new TrialGhostRecorder(track);
  const first = actor(track, 0, track.start.heading); run.step(3, first); recorder.record(0, first);
  let frames = 0, result: TrialGhostTrack | null = null;
  while (run.status === 'running' && frames++ < 100_000) {
    const pose = actor(track, frames * delta * speed, track.start.heading);
    run.step(delta, pose);
    if (run.status === 'running') assert(recorder.record(run.elapsed, pose));
    else result = recorder.finish(run, pose);
  }
  assert.equal(run.status, 'finished'); assert(result, 'a complete, continuous TrialRun records a replay');
  return {run, recorder, track: result};
}
function memory(value: string | null = null): TrialStorage & {value: string | null; writes: number; keys: string[]} {
  return {value, writes: 0, keys: [], getItem(key) {this.keys.push(key); return this.value;},
    setItem(key, next) {this.keys.push(key); this.value = next; this.writes++;}};
}

test('actual completed rules produce a timed replay ending on the fractional finish plane', () => {
  const fixture = course(), {run, track, recorder} = ride(fixture);
  assert.equal(track.kind, 'recorded'); close(track.seconds, 12.5); assert.deepEqual(track.splits, run.splits);
  assert.equal(track.samples[0].time, 0);
  const last = track.samples.at(-1)!; close(last.z, 100); close(last.time, run.finish!);
  close(last.pitch, .1); close(last.roll, -.2);
  assert.equal(recorder.recording, false); assert.equal(recorder.finish(run, actor(fixture, 101)), null);
  assert(Object.isFrozen(track)); assert(Object.isFrozen(track.samples)); assert(Object.isFrozen(track.samples[0]));
});

test('replay interpolation uses the same race elapsed time at 30, 60 and 120 Hz', () => {
  for (const rate of [30, 60, 120]) {
    const {track} = ride(course(), 8, 1 / rate), output = createTrialGhostPose();
    close(track.seconds, 12.5);
    for (const seconds of [0, .1, 2.731, 7, 12.499]) {
      assert.equal(sampleTrialGhost(track, seconds, output), output);
      close(output.z, seconds * 8); close(output.pitch, .1); close(output.roll, -.2);
    }
    assert(track.samples.length <= Math.ceil(track.seconds / TRIAL_GHOST_SAMPLE_SECONDS) + 2);
  }
});

test('heading interpolation takes the short path across the minus-pi/plus-pi seam', () => {
  const base = ride().track;
  const track: TrialGhostTrack = {...base, seconds: 2, samples: [
    {time: 0, x: 0, y: 2, z: 0, heading: Math.PI - .08, pitch: 0, roll: -.2},
    {time: 2, x: 0, y: 2, z: 10, heading: -Math.PI + .08, pitch: .2, roll: .2},
  ]};
  const middle = sampleTrialGhost(track, 1)!;
  close(Math.abs(middle.heading), Math.PI); close(middle.z, 5); close(middle.pitch, .1); close(middle.roll, 0);
  for (const time of [-1, NaN, Infinity, 2.01]) assert.equal(sampleTrialGhost(track, time), null);
  assert.equal(sampleTrialGhost(null, 1), null);
});

test('paused time never grows a recording and restart requires a fresh recorder', () => {
  const fixture = course(), recorder = new TrialGhostRecorder(fixture), pose = actor(fixture, 8);
  recorder.record(0, actor(fixture, 0)); assert(recorder.record(1, pose));
  for (let frame = 0; frame < 120; frame++) assert(recorder.record(1, pose));
  assert.equal(recorder.record(.5, pose), false); assert.equal(recorder.recording, false);
  const fresh = new TrialGhostRecorder(fixture); assert(fresh.record(0, actor(fixture, 0))); assert(fresh.recording);
  const track = ride(fixture).track;
  assert.deepEqual(sampleTrialGhost(track, 1), sampleTrialGhost(track, 1), 'pause is the same trajectory sample, not a wall-clock advance');
});

test('incomplete, invalid, wrong-vehicle and discontinuous attempts cannot become a saved ghost', () => {
  const fixture = course();
  for (const reason of ['countdown', 'running', 'invalid'] as const) {
    const run = new TrialRun(fixture); run.status = reason;
    assert.equal(new TrialGhostRecorder(fixture).finish(run, actor(fixture, 0)), null);
  }
  for (const invalid of [
    {...actor(fixture, 8), x: NaN}, {...actor(fixture, 8), pitch: Infinity}, {...actor(fixture, 8), roll: NaN},
    {...actor(fixture, 8), onFoot: true}, {...actor(fixture, 8), vehicle: 'onewheel' as const}, actor(fixture, 500),
  ]) {
    const recorder = new TrialGhostRecorder(fixture);
    assert.equal(recorder.record(1, invalid), false); assert.equal(recorder.recording, false);
  }
  const recorder = new TrialGhostRecorder(fixture); assert.equal(recorder.record(TRIAL_GHOST_MAX_SECONDS + 1, actor(fixture, 8)), false);
});

test('finish must come from all ordered gate splits on this exact layout', () => {
  const fixture = course(), {run} = ride(fixture);
  const invalidRuns = [
    {...run, next: 0}, {...run, splits: []}, {...run, splits: [1]}, {...run, course: course('different-course-v1')},
    {...run, finish: NaN}, {...run, splits: [NaN]},
  ];
  for (const bad of invalidRuns) {
    const recorder = new TrialGhostRecorder(fixture); recorder.record(12, actor(fixture, 96));
    assert.equal(recorder.finish(bad, actor(fixture, 104)), null);
  }
  const wrongPlane = new TrialGhostRecorder(fixture); wrongPlane.record(12, actor(fixture, 96));
  assert.equal(wrongPlane.finish(run, actor(fixture, 97)), null, 'a fabricated finish that never crosses the last gate is rejected');
});

test('long whole-island runs retain their start and finish while sample memory remains bounded', () => {
  const fixture = course('slow-island-v1', 'onewheel', 7000), {track} = ride(fixture, 1, .2);
  close(track.seconds, 7000, 1e-6);
  assert(track.samples.length <= TRIAL_GHOST_MAX_SAMPLES); assert(track.samples.length > 1000);
  close(track.samples[0].z, 0); close(track.samples.at(-1)!.z, 7000);
  for (const time of [1, 1599, 2500.12, 5900, 6999.95]) close(sampleTrialGhost(track, time)!.z, time, 1e-5);
});

test('stored replay keeps sub-millisecond finish timing and optional chassis reactions', () => {
  const fixture = course('fractional-v1', 'hoverbike', 99.99998), {track} = ride(fixture, 10, .2);
  const storage = memory(), store = new TrialGhostStore(storage);
  assert.deepEqual(store.save(track), {improved: true, saved: true, seconds: track.seconds});
  const restored = new TrialGhostStore(storage).best(fixture)!; assert(restored);
  close(restored.seconds, track.seconds); close(restored.samples.at(-1)!.time, track.seconds);
  close(sampleTrialGhost(restored, 4.123)!.z, 41.23, .01);
  close(sampleTrialGhost(restored, 4.123)!.pitch, .1); close(sampleTrialGhost(restored, 4.123)!.roll, -.2);
  assert(storage.keys.every(key => key === TRIAL_GHOST_STORAGE_KEY), 'ghost persistence never touches official time or account records');
});

test('only faster recorded runs replace a ghost and guides can never masquerade as a recording', () => {
  const fixture = course(), storage = memory(), store = new TrialGhostStore(storage);
  const first = ride(fixture, 8).track, slower = ride(fixture, 5).track, faster = ride(fixture, 10).track;
  assert.equal(store.save(first).improved, true); assert.equal(store.save(slower).improved, false);
  close(store.best(fixture)!.seconds, 12.5); assert.equal(store.save(faster).improved, true); close(store.best(fixture)!.seconds, 10);
  const pace = createTrialPaceGhost(fixture, 15)!; assert(pace); assert.equal(store.save(pace).saved, false);
  close(new TrialGhostStore(storage).best(fixture)!.seconds, 10);
});

test('course ID, vehicle, version and geometry isolate replay data; cosmetic edits preserve it', () => {
  const fixture = course(), store = new TrialGhostStore(memory()); store.save(ride(fixture).track);
  for (const changed of [course('ghost-test-v2'), course(fixture.id, 'onewheel'),
    {...fixture, path: [{x: 1, y: 2, z: 0}, ...fixture.path.slice(1)]},
    {...fixture, gates: fixture.gates.map(gate => ({...gate, radius: gate.radius + 1}))},
    {...fixture, start: {...fixture.start, heading: .1}},
  ]) assert.equal(store.best(changed), null);
  assert(store.best({...fixture, name: 'New title', color: '#000000', targetSeconds: 20} as TrialCourse));
  assert.equal(trialGhostFingerprint(fixture), trialGhostFingerprint({...fixture, name: 'New title'}));
});

test('broken storage and quota failures preserve visit-only ghosts without claiming they persisted', () => {
  const fixture = course(), track = ride(fixture).track;
  for (const storage of [null, {getItem() {throw new Error('blocked');}, setItem() {throw new Error('blocked');}}]) {
    const store = new TrialGhostStore(storage); assert.equal(store.available, false);
    assert.equal(store.save(track).saved, false); assert(store.best(fixture));
  }
  const storage = memory(); let writable = false;
  const store = new TrialGhostStore({getItem: key => storage.getItem(key), setItem(key, value) {
    if (!writable) throw new Error('quota'); storage.setItem(key, value);
  }});
  assert.equal(store.save(track).saved, false); assert.equal(store.available, false);
  writable = true; assert.equal(store.save(ride(fixture, 5).track).saved, true); assert.equal(store.available, true);
  close(new TrialGhostStore(storage).best(fixture)!.seconds, track.seconds, 1e-7);
});

test('malformed archives, impossible positions and altered finish samples are ignored safely', () => {
  const fixture = course(), storage = memory(); new TrialGhostStore(storage).save(ride(fixture).track);
  for (const text of ['not json', '{"version":2,"records":[]}', '{"version":1,"records":{}}', ' '.repeat(TRIAL_GHOST_STORAGE_BUDGET + 1)]) {
    const store = new TrialGhostStore(memory(text)); assert.equal(store.best(fixture), null); assert(store.save(ride(fixture).track).saved);
  }
  for (const damage of [
    (raw: any) => {raw.samples[1][0] = 0;},
    (raw: any) => {raw.samples[1][1] = 1e20;},
    (raw: any) => {raw.samples.at(-1)[3] -= 2;},
    (raw: any) => {raw.splits[0] = raw.seconds + 1;},
    (raw: any) => {raw.kind = 'pace';},
    (raw: any) => {raw.samples[1][1] = 1000;},
    (raw: any) => {raw.samples[0][1] = 5;},
  ]) {
    const parsed = JSON.parse(storage.value!); damage(parsed.records[0]);
    assert.equal(new TrialGhostStore(memory(JSON.stringify(parsed))).best(fixture), null);
  }
});

test('archive eviction respects both the record count and browser-storage budget', () => {
  const storage = memory(), store = new TrialGhostStore(storage), template = course('template-v1', 'hoverbike', 7000);
  const recorded = ride(template, 1, .2).track;
  let latest = template;
  for (let index = 0; index < TRIAL_GHOST_MAX_RECORDS + 2; index++) {
    latest = {...template, id: `long-${index}-v1`};
    const track = {...recorded, courseId: latest.id, fingerprint: trialGhostFingerprint(latest)};
    assert.equal(store.save(track).saved, true);
    assert(storage.value!.length <= TRIAL_GHOST_STORAGE_BUDGET);
    assert(JSON.parse(storage.value!).records.length <= TRIAL_GHOST_MAX_RECORDS);
  }
  assert(new TrialGhostStore(storage).best(latest));
  assert.equal(store.best({...template, id: 'long-0-v1'}), null);
});

test('pace guide follows the authored route and target while staying a distinct generated kind', () => {
  const fixture = {...course(), targetSeconds: 20} as TrialCourse, track = createTrialPaceGhost(fixture)!;
  assert(track); assert.equal(track.kind, 'pace'); close(track.seconds, 20); assert.deepEqual(track.splits, []);
  close(sampleTrialGhost(track, 10)!.z, 50); close(sampleTrialGhost(track, 20)!.z, 100);
  const square: TrialCourse = {...fixture, start: {x: 0, y: 2, z: 0, heading: 0}, path: [
    {x: 0, y: 2, z: 0}, {x: 0, y: 2, z: 50}, {x: 50, y: 12, z: 50}, {x: 50, y: 12, z: 0}, {x: 0, y: 2, z: 0},
  ]};
  const loop = createTrialPaceGhost(square, 40)!; assert(loop);
  assert.deepEqual(loop.samples.map(({x, y, z}) => ({x, y, z})), square.path);
  close(loop.samples.at(-1)!.time, 40); close(sampleTrialGhost(loop, 40)!.x, 0); close(sampleTrialGhost(loop, 40)!.z, 0);
  assert(loop.samples.every(sample => Math.abs(sample.pitch) <= .35 && Math.abs(sample.roll) <= .35));
});

test('guide construction rejects invalid routes and impossible targets instead of showing misleading motion', () => {
  for (const bad of [{...course(), path: []}, {...course(), path: [{x: 0, y: 2, z: 0}, {x: NaN, y: 2, z: 20}]},
    {...course(), path: [{x: 0, y: 2, z: 0}, {x: 0, y: 2, z: 0}]}, {...course(), maxSpeed: 0}]) {
    assert.equal(createTrialPaceGhost(bad), null);
  }
  for (const seconds of [0, -1, NaN, Infinity, .1]) assert.equal(createTrialPaceGhost(course(), seconds), null);
});
