import test from 'node:test';
import assert from 'node:assert/strict';
import {TrialRun, trialGateCrossing, SKY_GATE_PADDING, formatTrialTime, formatTrialSplit, type TrialCourse, type TrialGate, type TrialPose} from './trialRules.ts';

const gate = (z: number, overrides: Partial<TrialGate> = {}): TrialGate => ({x: 0, y: 5, z, heading: 0, radius: 2, halfHeight: 2, ...overrides});
const pose = (z: number, overrides: Partial<TrialPose> = {}): TrialPose => ({x: 0, y: 5, z, heading: 0, vehicle: 'hoverbike', onFoot: false, ...overrides});
const course = (overrides: Partial<TrialCourse> = {}): TrialCourse => ({
  id: 'sky-test-v1', vehicle: 'hoverbike', name: 'Sky test', description: 'A straight test route.', distance: 30,
  start: {x: 0, y: 5, z: 0, heading: 0}, gates: [gate(10), gate(20), gate(30)],
  path: [{x: 0, y: 5, z: 0}, {x: 0, y: 5, z: 30}], color: '#82e4da', maxSpeed: 40, ...overrides,
});
const close = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);

test('GO starts at a frame boundary; wall time counts fully and pauses re-anchor without crossings', () => {
  const run = new TrialRun(course());
  run.step(1, pose(0));
  assert.equal(run.countdown, 2);
  run.step(120, pose(0), false);
  assert.equal(run.countdown, 2);
  run.step(2.7, pose(0));
  assert.equal(run.status, 'running');
  assert.equal(run.elapsed, 0, 'countdown overshoot cannot time movement that was frozen');
  run.step(.4, pose(5));
  close(run.elapsed, .4);
  run.step(40, pose(15), false);
  assert.equal(run.next, 0);
  close(run.elapsed, .4);
  run.step(.1, pose(16));
  assert.equal(run.next, 0, 'paused displacement must not sweep the first gate');
  close(run.elapsed, .5);
  run.suspend(pose(25));
  run.step(.1, pose(26));
  assert.equal(run.next, 0, 'a visibility-edge suspend also resets the crossing anchor');
  close(run.elapsed, .6);
});

test('gate openings require a forward swept plane crossing inside the full 3D ellipse', () => {
  const opening = gate(10);
  close(trialGateCrossing(pose(0), pose(20), opening), .5);
  assert.equal(trialGateCrossing(pose(20), pose(0), opening), null, 'backwards crossing');
  assert.equal(trialGateCrossing(pose(9.9), pose(9.9), opening), null, 'proximity without crossing');
  assert.equal(trialGateCrossing(pose(0, {y: 7.1}), pose(20, {y: 7.1}), opening), null, 'above opening');
  assert.equal(trialGateCrossing(pose(0, {y: 2.9}), pose(20, {y: 2.9}), opening), null, 'below opening');
  assert.equal(trialGateCrossing(pose(0, {x: 1.6, y: 6.6}), pose(20, {x: 1.6, y: 6.6}), opening), null, 'inside the bounding rectangle, outside the ellipse');
  close(trialGateCrossing(pose(0, {x: 1}), pose(20, {x: 1}), opening), .5);
  close(trialGateCrossing(pose(0, {x: -10}), pose(0, {x: 10}), gate(0, {heading: Math.PI / 2})), .5);
});

test('one fast segment may clear successive gates, but cannot skip or backfill route order', () => {
  const run = new TrialRun(course());
  run.step(3, pose(0));
  run.step(1, pose(35));
  assert.equal(run.status, 'finished');
  assert.equal(run.next, 3);
  [10 / 35, 20 / 35, 30 / 35].forEach((time, index) => close(run.splits[index], time));
  close(run.finish, 30 / 35);

  const missed = new TrialRun(course({gates: [gate(10, {x: 3}), gate(20)]}));
  missed.step(3, pose(0));
  missed.step(1, pose(30));
  assert.equal(missed.status, 'running');
  assert.equal(missed.next, 0, 'later gate cannot replace a missed current gate');

  const reversedOrder = new TrialRun(course({gates: [gate(20), gate(10), gate(30)]}));
  reversedOrder.step(3, pose(0));
  reversedOrder.step(1, pose(35));
  assert.equal(reversedOrder.next, 1, 'a gate crossed earlier on the segment is not backfilled');
});

test('Sky rim forgiveness is bounded and keeps swept direction, height and ellipse checks', () => {
  const opening = gate(10, {radius: 9, halfHeight: 4});
  const cross = (x: number, y: number) => trialGateCrossing(pose(0, {x, y}), pose(20, {x, y}), opening, SKY_GATE_PADDING);
  close(cross(9.5, 5), .5);
  close(cross(0, 9.5), .5);
  assert.equal(cross(9.61, 5), null, 'a wide miss remains a miss');
  assert.equal(cross(0, 9.61), null, 'vertical allowance is bounded');
  assert.equal(cross(9.4, 9.4), null, 'expanded ellipse does not become a rectangular box');
  assert.equal(trialGateCrossing(pose(20, {x: 9.5}), pose(0, {x: 9.5}), opening, SKY_GATE_PADDING), null);
  assert.equal(trialGateCrossing(pose(9.9), pose(9.9), opening, SKY_GATE_PADDING), null);
  assert.equal(trialGateCrossing(pose(0), pose(20), opening, NaN), null);
});

test('only aerial runs receive the rim allowance and later gates cannot replace a miss', () => {
  for (const vehicle of ['hoverbike', 'onewheel'] as const) {
    const start = pose(0, {x: 2.5, vehicle});
    const run = new TrialRun(course({vehicle, start, gates: [gate(10)]}));
    run.step(3, start); run.step(1, pose(20, {x: 2.5, vehicle}));
    assert.equal(run.status, vehicle === 'hoverbike' ? 'finished' : 'running');
  }
  const start = pose(0, {x: 2.7});
  const run = new TrialRun(course({start, gates: [gate(10), gate(20, {x: 2.7})]}));
  run.step(3, start); run.step(1, pose(30, {x: 2.7}));
  assert.equal(run.next, 0); assert.equal(run.finish, null);
});

test('interpolated splits and finish agree at 30 and 120 Hz, then remain frozen', () => {
  function drive(hz: number) {
    const track = course({gates: [gate(5), gate(10), gate(19.7)], start: {x: 0, y: 5, z: -4, heading: 0}});
    const run = new TrialRun(track);
    run.step(3, pose(-4));
    for (let frame = 1; run.status === 'running' && frame <= hz * 8; frame++) {
      run.step(1 / hz, pose(-4 + 7 * frame / hz));
    }
    assert.equal(run.status, 'finished');
    close(run.finish, 23.7 / 7);
    const before = [...run.splits];
    run.step(100, pose(1000));
    run.suspend(pose(-100));
    run.step(2, pose(20));
    assert.deepEqual(run.splits, before, 'completion is emitted only once');
    close(run.elapsed, run.finish!);
    return run;
  }
  const slow = drive(30), fast = drive(120);
  slow.splits.forEach((time, index) => close(fast.splits[index], time));
});

test('wrong vehicle, dismount, invalid samples and travel jumps cannot produce a finish', () => {
  const cases: {seconds: number; at: TrialPose}[] = [
    {seconds: 1, at: pose(30, {vehicle: 'onewheel'})},
    {seconds: 1, at: pose(30, {onFoot: true})},
    {seconds: 1, at: pose(30, {y: NaN})},
    {seconds: 1, at: pose(30, {heading: Infinity})},
    {seconds: .1, at: pose(35)},
    {seconds: NaN, at: pose(0)},
  ];
  for (const sample of cases) {
    const run = new TrialRun(course());
    run.step(3, pose(0));
    run.step(sample.seconds, sample.at);
    assert.equal(run.status, 'invalid');
    assert.ok(run.reason.length > 0);
    assert.equal(run.finish, null);
    assert.deepEqual(run.splits, []);
    run.step(3, pose(30));
    assert.equal(run.status, 'invalid', 'only an explicit restart may restore eligibility');
  }
});

test('restart during countdown, after a split or after invalidation clears the entire attempt', () => {
  const run = new TrialRun(course());
  run.step(2, pose(0));
  run.restart(pose(0));
  assert.equal(run.countdown, 3);
  run.step(3, pose(0));
  run.step(.5, pose(12));
  assert.equal(run.next, 1);
  assert.equal(run.splits.length, 1);
  run.restart(pose(0));
  assert.equal(run.status, 'countdown');
  assert.equal(run.countdown, 3);
  assert.equal(run.elapsed, 0);
  assert.equal(run.next, 0);
  assert.deepEqual(run.splits, []);
  assert.equal(run.finish, null);
  assert.equal(run.reason, '');
  run.step(3, pose(0));
  run.step(.1, pose(35));
  assert.equal(run.status, 'invalid');
  run.restart();
  assert.equal(run.reason, '');
  run.step(3, pose(0));
  run.step(1, pose(35));
  assert.equal(run.status, 'finished');
  close(run.splits[0], 10 / 35);
  close(run.finish, 30 / 35);
});

test('time formatting carries centisecond rounding and makes split direction explicit', () => {
  assert.equal(formatTrialTime(59.999), '1:00.00');
  assert.equal(formatTrialTime(0), '0:00.00');
  assert.equal(formatTrialTime(65.123), '1:05.12');
  for (const value of [null, NaN, Infinity, -1]) assert.equal(formatTrialTime(value), '—');
  assert.equal(formatTrialSplit(-.056), '−0:00.06');
  assert.equal(formatTrialSplit(1.2), '+0:01.20');
  assert.equal(formatTrialSplit(-.001), '±0:00.00');
});
