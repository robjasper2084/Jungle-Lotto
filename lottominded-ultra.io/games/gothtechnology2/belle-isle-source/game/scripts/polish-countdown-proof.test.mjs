import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {classifyCountdownInput, createCountdownObserverLifecycle, hasCountdownCleanupEvidence} from './polish-countdown-proof.mjs';

test('readiness notifies only after its own observer is disconnected and its handle is deleted', () => {
  const order = [], owner = new Proxy({}, {deleteProperty(target, key) { order.push('delete'); return Reflect.deleteProperty(target, key); }});
  const arm = {id: 4, observer: {disconnect() { order.push('disconnect'); }}};
  owner.__polishCountdownArm = arm;
  const lifecycle = createCountdownObserverLifecycle(owner);
  let notified;
  assert.equal(lifecycle.ready(arm, {id: 4, state: {status: 'countdown'}}, payload => {
    order.push('notify'); notified = payload;
    assert.equal(owner.__polishCountdownArm, undefined);
    assert.equal(hasCountdownCleanupEvidence(payload.observerCleanup, 4), true);
  }), true);
  assert.deepEqual(order, ['disconnect', 'delete', 'notify']);
  assert.equal(notified.state.status, 'countdown');
  assert.equal(lifecycle.ready(arm, {id: 4}, () => assert.fail('duplicate readiness must not notify')), false);
});

test('stale readiness disconnects only its own observer and cannot delete a replacement generation', () => {
  for (const replacementId of [4, 5]) {
    let oldDisconnects = 0, replacementDisconnects = 0;
    const stale = {id: 4, observer: {disconnect() { oldDisconnects++; }}};
    const replacement = {id: replacementId, observer: {disconnect() { replacementDisconnects++; }}};
    const owner = {__polishCountdownArm: replacement}, lifecycle = createCountdownObserverLifecycle(owner);
    assert.equal(lifecycle.ready(stale, {id: 4}, () => assert.fail('stale readiness must not notify')), false);
    assert.equal(oldDisconnects, 1); assert.equal(replacementDisconnects, 0); assert.equal(owner.__polishCountdownArm, replacement);
  }
});

test('no-readiness cleanup removes only the matching arm and never manufactures readiness proof', () => {
  let disconnected = 0;
  const arm = {id: 8, observer: {disconnect() { disconnected++; }}};
  const owner = {__polishCountdownArm: arm}, lifecycle = createCountdownObserverLifecycle(owner);
  assert.equal(lifecycle.cancel(7).status, 'superseded');
  assert.equal(disconnected, 0); assert.equal(owner.__polishCountdownArm, arm);
  const cleanup = lifecycle.cancel(8);
  assert.equal(disconnected, 1); assert.equal(owner.__polishCountdownArm, undefined);
  assert.equal(cleanup.status, 'complete'); assert.equal(hasCountdownCleanupEvidence(cleanup, 8), false);
  assert.equal(lifecycle.cancel(8).status, 'absent');
});

test('cleanup errors remain fatal and cannot send a successful readiness notification', () => {
  const arm = {id: 2, observer: {disconnect() { throw new Error('disconnect failed'); }}};
  const owner = {__polishCountdownArm: arm}, lifecycle = createCountdownObserverLifecycle(owner);
  assert.throws(() => lifecycle.ready(arm, {id: 2}, () => assert.fail('failed cleanup must not notify')), /disconnect failed/);
  assert.equal(owner.__polishCountdownArm, arm);
  assert.throws(() => lifecycle.cancel(2), /disconnect failed/);
  assert.equal(lifecycle.ready(arm, {id: 3}, () => assert.fail('wrong identity must not notify')), false);
});

test('only complete matching readiness evidence permits skipping the fallback cleanup', () => {
  const evidence = {id: 4, source: 'ready-callback', status: 'complete', observerDisconnected: true, ownedHandleRemoved: true};
  assert.equal(hasCountdownCleanupEvidence(evidence, 4), true);
  for (const change of [{id: 3}, {source: 'abort-cleanup'}, {status: 'absent'}, {observerDisconnected: false}, {ownedHandleRemoved: false}]) {
    assert.equal(hasCountdownCleanupEvidence({...evidence, ...change}, 4), false);
  }
  assert.equal(hasCountdownCleanupEvidence(undefined, 4), false);
  assert.equal(hasCountdownCleanupEvidence(undefined, undefined), false);
});

test('the injected lifecycle is self-contained when serialized outside its module', () => {
  const owner = {}, arm = {id: 1, observer: {disconnect() {}}}; owner.__polishCountdownArm = arm;
  const lifecycle = runInNewContext('(' + createCountdownObserverLifecycle.toString() + ')(owner)', {owner});
  let evidence;
  lifecycle.ready(arm, {id: 1}, payload => { evidence = payload.observerCleanup; });
  assert.equal(hasCountdownCleanupEvidence(evidence, 1), true); assert.equal(owner.__polishCountdownArm, undefined);
});

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
