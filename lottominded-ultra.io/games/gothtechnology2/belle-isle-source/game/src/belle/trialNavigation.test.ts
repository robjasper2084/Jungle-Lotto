import test from 'node:test';
import assert from 'node:assert/strict';
import {trialDeviation} from './trialNavigation.ts';
import type {TrialCourse} from './trialRules.ts';

const route = (vehicle: TrialCourse['vehicle']): TrialCourse => ({
  id: 'navigation-test', name: 'Test route', description: '', vehicle, distance: 200, color: '#fff', maxSpeed: 35,
  start: {x: 0, y: 30, z: 0, heading: 0},
  gates: [{x: 0, y: 30, z: 100, heading: 0, radius: 9, halfHeight: 4}],
  path: [{x: 0, y: 30, z: 0}, {x: 0, y: 30, z: 100}, {x: 100, y: 34, z: 100}],
});

test('route guidance follows bends and uses height only for flight', () => {
  assert.equal(trialDeviation(route('onewheel'), {x: 50, y: 32, z: 100}).offCourse, false);
  assert.equal(trialDeviation(route('onewheel'), {x: 8, y: 100, z: 50}).offCourse, true);
  assert.equal(trialDeviation(route('onewheel'), {x: 2, y: 100, z: 50}).offCourse, false);
  assert.equal(trialDeviation(route('hoverbike'), {x: 0, y: 40, z: 50}).offCourse, true);
  assert.equal(trialDeviation(route('hoverbike'), {x: 50, y: 32, z: 100}).offCourse, false);
  assert.equal(trialDeviation(route('hoverbike'), {x: 23, y: 30, z: 50}).offCourse, true);
});

test('off-course warning has hysteresis and does not chatter at the boundary', () => {
  const course = route('onewheel');
  let off = false;
  for (const x of [7.1, 6.9, 7.05, 6, 5.1]) {
    off = trialDeviation(course, {x, y: 30, z: 50}, off).offCourse;
    assert.equal(off, true);
  }
  off = trialDeviation(course, {x: 4.9, y: 30, z: 50}, off).offCourse;
  assert.equal(off, false);
  assert.equal(trialDeviation(course, {x: 6.9, y: 30, z: 50}, off).offCourse, false);
});
