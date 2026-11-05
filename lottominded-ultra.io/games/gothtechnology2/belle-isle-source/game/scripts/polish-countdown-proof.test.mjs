import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCountdownInput} from './polish-countdown-proof.mjs';

const state = {at: 100, hudHidden: false, status: 'countdown', course: 'cup-v1', elapsed: 0, speed: 0};
const touch = {at: 110, trusted: true, hudHidden: false, status: 'countdown', course: 'cup-v1',
  type: 'pointerdown', pointerType: 'touch', control: 'touch-zone', visibility: 'visible', paused: 'false', openDialogs: []};
const classify = (event = touch, options = {}) => classifyCountdownInput({mobile: true, state,
  expectedTarget: 'touch-zone', events: event ? [event] : [], ...options});

test('only native countdown evidence passes the strict timing check', () => {
  assert.equal(classify().status, 'passed');
  const key = {...touch, type: 'keydown', code: 'KeyW', repeat: false};
  assert.equal(classify(key, {mobile: false, expectedCode: 'KeyW'}).status, 'passed');
  assert.equal(classify({...key, repeat: true}, {mobile: false, expectedCode: 'KeyW'}).status, 'failed');
});

test('a correctly targeted late phone touch is inconclusive, never passed', () => {
  const late = {...touch, at: 17117.5, status: 'running'};
  const result = classify(late);
  assert.equal(result.status, 'inconclusive');
  assert.equal(result.event, late);
  assert.equal(result.latencyMilliseconds, 17017.5);
  assert.match(result.reason, /not observed/);
  assert.equal(classify(late, {mobile: false}).status, 'failed');
  assert.equal(classify({...late, type: 'keydown', code: 'KeyW', repeat: false}, {expectedCode: 'KeyW'}).status, 'failed');
});

test('invalid delivery evidence cannot be downgraded to inconclusive', async t => {
  const late = {...touch, at: 17117.5, status: 'running'};
  const cases = {
    'wrong target': {control: 'trial-restart'}, untrusted: {trusted: false}, hidden: {hudHidden: true},
    'wrong course': {course: 'sky-v1'}, preparing: {status: 'preparing'}, 'before countdown': {at: 99},
    'same timestamp': {at: 100}, 'missing timestamp': {at: undefined}, 'nonfinite timestamp': {at: Infinity},
    'wrong pointer type': {pointerType: 'mouse'}, 'pointer move only': {type: 'pointermove'},
    'background page': {visibility: 'hidden'}, 'open modal': {openDialogs: ['settings']}, paused: {paused: 'true'},
    'unknown visibility': {visibility: undefined}, 'unknown dialog state': {openDialogs: undefined},
  };
  for (const [name, change] of Object.entries(cases)) await t.test(name, () => assert.equal(classify({...late, ...change}).status, 'failed'));
  assert.equal(classify(null).status, 'failed');
  assert.equal(classify(late, {state: {...state, status: 'running'}}).status, 'failed');
  assert.equal(classify(late, {events: [{...late, control: 'wrong-zone'}, late]}).status, 'failed');
});
