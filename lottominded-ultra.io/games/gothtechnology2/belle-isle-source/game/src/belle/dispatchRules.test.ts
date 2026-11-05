import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDispatchContracts, startDispatch, advanceDispatchTime, getDispatchTargets,
  tryDispatchHandoff, claimDispatchCompletion, cancelDispatch, restartDispatch,
  getDispatchMedal, DISPATCH_MAX_SECONDS, DISPATCH_MAX_TICK_SECONDS,
} from './dispatchRules.ts';
import type {DispatchActor, DispatchContractId, DispatchState, DispatchStop} from './dispatchRules.ts';

const hub: DispatchStop = {id: 'hub', name: 'Dispatch Hub', x: 0, y: 4, z: 0};
const stops: DispatchStop[] = [
  {id: 'near', name: 'Near Stop', x: 100, y: 4, z: 0},
  {id: 'middle', name: 'Middle Stop', x: 200, y: 5, z: 100},
  {id: 'far', name: 'Far Stop', x: 1000, y: 6, z: 500},
];
const contracts = createDispatchContracts({hub, stops, softTimeLimitsSeconds: {'cross-island-express': 10}});
const contract = (id: DispatchContractId) => contracts.find(item => item.id === id)!;
const actorAt = (stop: DispatchStop, overrides: Partial<DispatchActor> = {}): DispatchActor => ({
  x: stop.x, y: stop.y, z: stop.z, onFoot: true, speedMps: 0, ...overrides,
});
function handoff(state: DispatchState, stop: DispatchStop): DispatchState {
  const result = tryDispatchHandoff(state, actorAt(stop), {stopId: stop.id});
  assert.equal(result.reason, null);
  assert.notEqual(result.event, null);
  return result.state;
}
function complete(state: DispatchState): DispatchState {
  for (let step = 0; step < 8 && state.phase !== 'completed'; step++) state = handoff(state, getDispatchTargets(state)[0]);
  assert.equal(state.phase, 'completed');
  return state;
}

test('five contracts use only supplied map stops and have a combined 600 first-clear XP', () => {
  assert.equal(contracts.length, 5);
  assert.equal(new Set(contracts.map(item => item.id)).size, 5);
  assert.equal(contracts.reduce((sum, item) => sum + item.firstClearXp, 0), 600);
  const known = new Set([hub.id, ...stops.map(stop => stop.id)]);
  assert(contracts.every(item => [item.hub, item.pickup, ...item.dropoffs].every(stop => known.has(stop.id))));
  assert.equal(contract('first-drop').softTimeLimitSeconds, null);
  assert.equal(contract('cross-island-express').dropoffs[0].id, 'far');
  assert.equal(contract('island-round').dropoffs.length, 3);
});

test('invalid or duplicate anchors cannot produce an impossible contract', () => {
  assert.throws(() => createDispatchContracts({hub, stops: stops.slice(0, 2)}), RangeError);
  assert.throws(() => createDispatchContracts({hub, stops: [stops[0], stops[0], stops[2]]}), RangeError);
  assert.throws(() => createDispatchContracts({hub, stops: [hub, ...stops]}), RangeError);
  assert.throws(() => createDispatchContracts({hub, stops: [{...stops[0], y: NaN}, ...stops.slice(1)]}), RangeError);
  assert.throws(() => createDispatchContracts({hub, stops, softTimeLimitsSeconds: {'cross-island-express': Infinity}}), RangeError);
  assert.throws(() => startDispatch(contract('first-drop'), ''), RangeError);
  const mutable = {...stops[0]};
  const frozen = createDispatchContracts({hub, stops: [mutable, ...stops.slice(1)]});
  mutable.x = -500;
  assert.equal(frozen[0].dropoffs[0].x, 100, 'caller mutations cannot move an accepted objective');
});

test('delivery cannot happen before pickup and a tutorial completes only after its handoff', () => {
  const initial = startDispatch(contract('first-drop'), 'tutorial');
  const destination = initial.contract.dropoffs[0];
  const premature = tryDispatchHandoff(initial, actorAt(destination), {stopId: destination.id});
  assert.equal(premature.reason, 'wrong-stop');
  assert.equal(premature.state, initial);
  assert.equal(claimDispatchCompletion(initial).completion, null);
  const collected = handoff(initial, hub);
  assert.equal(initial.phase, 'pickup', 'transitions preserve the previous state');
  assert.equal(collected.phase, 'dropoffs');
  const done = tryDispatchHandoff(collected, actorAt(destination));
  assert.equal(done.state.phase, 'completed');
  assert.equal(done.event?.completed, true);
  assert.equal(getDispatchMedal(done.state), null);
  assert.deepEqual(getDispatchTargets(done.state), []);
});

test('multi-stop deliveries allow either order and refuse repeated or unrelated stops', () => {
  let state = handoff(startDispatch(contract('two-stop-sweep'), 'sweep'), hub);
  const [first, second] = state.contract.dropoffs;
  state = handoff(state, second);
  assert.deepEqual(state.completedDropoffIds, [second.id]);
  assert.deepEqual(getDispatchTargets(state).map(stop => stop.id), [first.id]);
  const duplicate = tryDispatchHandoff(state, actorAt(second), {stopId: second.id});
  assert.equal(duplicate.reason, 'already-delivered');
  assert.equal(duplicate.state, state);
  assert.equal(tryDispatchHandoff(state, actorAt(hub), {stopId: hub.id}).reason, 'wrong-stop');
  state = handoff(state, first);
  assert.equal(state.phase, 'completed');
  assert.equal(state.completedDropoffIds.length, 2);
});

test('handoffs require walking, low absolute speed, horizontal proximity and matching height', () => {
  const state = startDispatch(contract('first-drop'), 'validation');
  for (const [overrides, reason] of [
    [{onFoot: false}, 'on-foot-required'],
    [{speedMps: 1.51}, 'slow-down'],
    [{speedMps: -2}, 'slow-down'],
    [{x: hub.x + 7.01}, 'out-of-range'],
    [{y: hub.y + 2.51}, 'wrong-height'],
    [{y: hub.y - 2.51}, 'wrong-height'],
    [{x: NaN}, 'invalid-position'],
    [{speedMps: Infinity}, 'invalid-position'],
  ] as const) {
    const result = tryDispatchHandoff(state, actorAt(hub, overrides));
    assert.equal(result.reason, reason);
    assert.equal(result.state, state);
    assert.equal(result.event, null);
  }
  assert.equal(tryDispatchHandoff(state, actorAt(hub, {x: 7, y: 6.5, speedMps: -1.5})).reason, null);
  assert.equal(tryDispatchHandoff(state, actorAt(hub, {x: 2}), {limits: {radiusMetres: 1}}).reason, 'out-of-range');
  assert.throws(() => tryDispatchHandoff(state, actorAt(hub), {limits: {radiusMetres: NaN}}), RangeError);
});

test('pickup-and-return and island-round require an explicit return to the hub', () => {
  let returning = startDispatch(contract('pickup-and-return'), 'return');
  assert.notEqual(getDispatchTargets(returning)[0].id, hub.id);
  returning = handoff(returning, returning.contract.pickup);
  assert.equal(returning.phase, 'return');
  assert.equal(claimDispatchCompletion(returning).completion, null);
  returning = handoff(returning, hub);
  assert.equal(returning.phase, 'completed');

  let round = handoff(startDispatch(contract('island-round'), 'round'), hub);
  for (const stop of [...round.contract.dropoffs].reverse()) round = handoff(round, stop);
  assert.equal(round.phase, 'return');
  assert.equal(round.completedDropoffIds.length, 3);
  assert.equal(claimDispatchCompletion(round).completion, null);
  assert.equal(handoff(round, hub).phase, 'completed');
});

test('the active clock pauses, ignores invalid deltas, bounds frame spikes and saturates safely', () => {
  const initial = startDispatch(contract('cross-island-express'), 'clock');
  assert.equal(advanceDispatchTime(initial, 1, true), initial);
  for (const dt of [NaN, Infinity, -1, 0]) assert.equal(advanceDispatchTime(initial, dt), initial);
  let state = advanceDispatchTime(initial, 0.25);
  assert.equal(state.elapsedSeconds, 0.25);
  state = advanceDispatchTime(state, 600);
  assert.equal(state.elapsedSeconds, 0.25 + DISPATCH_MAX_TICK_SECONDS);
  const capped = advanceDispatchTime({...state, elapsedSeconds: DISPATCH_MAX_SECONDS - 0.1}, 1);
  assert.equal(capped.elapsedSeconds, DISPATCH_MAX_SECONDS);
  assert.equal(capped.phase, 'pickup', 'clock bounds must not create a failure state');
  assert.equal(advanceDispatchTime(capped, 1), capped);
  const done = complete(state);
  assert.equal(advanceDispatchTime(done, 1), done);
});

test('Express awards soft medals and still completes after its target', () => {
  for (const [seconds, medal] of [[10, 'gold'], [15, 'silver'], [16, 'bronze'], [600, 'bronze']] as const) {
    let state = startDispatch(contract('cross-island-express'), `express-${seconds}`);
    for (let i = 0; i < seconds; i++) state = advanceDispatchTime(state, 1);
    assert.equal(state.phase, 'pickup');
    state = complete(state);
    assert.equal(getDispatchMedal(state), medal);
    assert.equal(claimDispatchCompletion(state).completion?.elapsedSeconds, seconds);
  }
});

test('completion claim is emitted once and carries a stable profile deduplication key', () => {
  const done = complete(startDispatch(contract('first-drop'), 'unique-attempt'));
  const first = claimDispatchCompletion(done);
  assert.equal(first.completion?.rewardKey, 'dispatch:unique-attempt');
  assert.equal(first.completion?.firstClearXp, 80);
  assert.equal(first.state.completionClaimed, true);
  assert.equal(claimDispatchCompletion(first.state).completion, null);
  const repeatedHandoff = tryDispatchHandoff(first.state, actorAt(done.contract.dropoffs[0]));
  assert.equal(repeatedHandoff.reason, 'inactive');
  assert.equal(repeatedHandoff.state, first.state);
  const restored = JSON.parse(JSON.stringify(first.state)) as DispatchState;
  assert.equal(claimDispatchCompletion(restored).completion, null, 'saving and reloading a claimed attempt cannot reclaim it');
});

test('cancelling stops progress and restarting clears the attempt without reusing its reward key', () => {
  let state = handoff(startDispatch(contract('island-round'), 'old-attempt'), hub);
  state = advanceDispatchTime(handoff(state, state.contract.dropoffs[1]), 0.5);
  const cancelled = cancelDispatch(state);
  assert.equal(cancelled.phase, 'cancelled');
  assert.equal(cancelDispatch(cancelled), cancelled);
  assert.equal(advanceDispatchTime(cancelled, 1), cancelled);
  assert.equal(tryDispatchHandoff(cancelled, actorAt(hub)).reason, 'inactive');
  assert.equal(claimDispatchCompletion(cancelled).completion, null);
  assert.deepEqual(getDispatchTargets(cancelled), []);
  assert.throws(() => restartDispatch(cancelled, 'old-attempt'), RangeError);
  const fresh = restartDispatch(cancelled, 'new-attempt');
  assert.equal(fresh.phase, 'pickup');
  assert.equal(fresh.elapsedSeconds, 0);
  assert.deepEqual(fresh.completedDropoffIds, []);
  assert.equal(fresh.completionClaimed, false);
  const done = complete(fresh);
  assert.equal(cancelDispatch(done), done, 'closing a finished activity must preserve its claim');
  assert.equal(claimDispatchCompletion(done).completion?.rewardKey, 'dispatch:new-attempt');
});
