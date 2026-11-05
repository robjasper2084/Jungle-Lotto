/** Swoop Dispatch rules, independent of rendering. Distances are metres; time is seconds. */
export type DispatchStop = Readonly<{id: string; name: string; x: number; y: number; z: number}>;
export type DispatchContractId = 'first-drop' | 'two-stop-sweep' | 'cross-island-express' | 'pickup-and-return' | 'island-round';
export type DispatchPhase = 'pickup' | 'dropoffs' | 'return' | 'completed' | 'cancelled';
export type DispatchMedal = 'bronze' | 'silver' | 'gold';

export type DispatchContract = Readonly<{
  id: DispatchContractId;
  title: string;
  description: string;
  hub: DispatchStop;
  pickup: DispatchStop;
  dropoffs: readonly DispatchStop[];
  returnToHub: boolean;
  firstClearXp: number;
  /** Gold target, not a failure deadline. Null means an untimed tutorial. */
  softTimeLimitSeconds: number | null;
}>;

export type DispatchState = Readonly<{
  contract: DispatchContract;
  attemptId: string;
  phase: DispatchPhase;
  completedDropoffIds: readonly string[];
  elapsedSeconds: number;
  completionClaimed: boolean;
}>;

export type DispatchActor = Readonly<{
  x: number;
  /** Feet/ground contact height, not camera or head height. */
  y: number;
  z: number;
  onFoot: boolean;
  /** Signed speed is accepted; validation uses its absolute value. */
  speedMps: number;
}>;

export type DispatchHandoffLimits = Readonly<{
  radiusMetres: number;
  heightToleranceMetres: number;
  maxSpeedMps: number;
}>;

export const DEFAULT_DISPATCH_HANDOFF_LIMITS: DispatchHandoffLimits = Object.freeze({
  radiusMetres: 7,
  heightToleranceMetres: 2.5,
  maxSpeedMps: 1.5,
});
export const DISPATCH_MAX_TICK_SECONDS = 1;
export const DISPATCH_MAX_SECONDS = 86_400;

export type DispatchHandoffFailure =
  | 'inactive' | 'invalid-position' | 'on-foot-required' | 'slow-down'
  | 'wrong-stop' | 'already-delivered' | 'out-of-range' | 'wrong-height';
export type DispatchHandoffEvent = Readonly<{
  type: 'pickup' | 'dropoff' | 'return';
  stopId: string;
  completed: boolean;
  remainingDropoffs: number;
}>;
export type DispatchHandoffResult = Readonly<{
  state: DispatchState;
  event: DispatchHandoffEvent | null;
  reason: DispatchHandoffFailure | null;
}>;
export type DispatchCompletion = Readonly<{
  /** Persist this key with the shared profile when crediting XP. */
  rewardKey: string;
  attemptId: string;
  contractId: DispatchContractId;
  firstClearXp: number;
  elapsedSeconds: number;
  medal: DispatchMedal | null;
}>;

function horizontalDistance(a: DispatchStop, b: Pick<DispatchStop, 'x' | 'z'>): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function copyStop(stop: DispatchStop): DispatchStop {
  if (!stop || typeof stop.id !== 'string' || !stop.id.trim() || typeof stop.name !== 'string' || !stop.name.trim()
    || ![stop.x, stop.y, stop.z].every(Number.isFinite)) {
    throw new RangeError('Dispatch stops need an ID, a name and finite metre coordinates');
  }
  return Object.freeze({id: stop.id, name: stop.name, x: stop.x, y: stop.y, z: stop.z});
}

/**
 * Callers supply actual, accessible map anchors. No landmark names or coordinates
 * are invented here. At least three distinct non-hub destinations are required.
 * Default medal targets are generous route estimates; callers can tune each one
 * after measuring routes, or build a separate set for each ride type.
 */
export function createDispatchContracts(options: {
  hub: DispatchStop;
  stops: readonly DispatchStop[];
  softTimeLimitsSeconds?: Partial<Record<DispatchContractId, number>>;
}): readonly DispatchContract[] {
  const hub = copyStop(options.hub);
  const stops = options.stops.map(copyStop);
  if (stops.length < 3 || new Set(stops.map(stop => stop.id)).size !== stops.length
    || stops.some(stop => stop.id === hub.id)) {
    throw new RangeError('Dispatch needs at least three unique destinations distinct from its hub');
  }
  stops.sort((a, b) => horizontalDistance(hub, a) - horizontalDistance(hub, b) || a.id.localeCompare(b.id));
  const near = stops[0], middle = stops[Math.floor(stops.length / 2)], far = stops[stops.length - 1];

  function make(
    id: DispatchContractId, title: string, description: string, pickup: DispatchStop,
    dropoffs: readonly DispatchStop[], returnToHub: boolean, firstClearXp: number,
  ): DispatchContract {
    const route = [hub, pickup, ...dropoffs, ...(returnToHub ? [hub] : [])];
    const metres = route.reduce((sum, stop, i) => sum + (i ? horizontalDistance(route[i - 1], stop) : 0), 0);
    // Allow detours and walking handoffs; these are targets, never failure timers.
    const estimated = Math.max(90, Math.ceil(metres / 6 * 1.6 + 20 * (1 + dropoffs.length + Number(returnToHub))));
    const target = id === 'first-drop' ? null : options.softTimeLimitsSeconds?.[id] ?? estimated;
    if (target !== null && (!Number.isFinite(target) || target <= 0 || target > DISPATCH_MAX_SECONDS)) {
      throw new RangeError('Dispatch medal targets must be positive, finite seconds within the clock limit');
    }
    return Object.freeze({id, title, description, hub, pickup, dropoffs: Object.freeze([...dropoffs]), returnToHub, firstClearXp, softTimeLimitSeconds: target});
  }

  return Object.freeze([
    make('first-drop', 'First Drop', 'Collect one parcel at the dispatch hub and deliver it. Take your time.', hub, [near], false, 80),
    make('two-stop-sweep', 'Two-Stop Sweep', 'Collect two parcels and choose the order of your deliveries.', hub, stops.slice(0, 2), false, 100),
    make('cross-island-express', 'Cross-Island Express', 'Deliver a parcel across the island. Beat the target for a better medal; late deliveries still count.', hub, [far], false, 120),
    make('pickup-and-return', 'Pickup & Return', 'Retrieve a parcel from the pickup stop and bring it back to the hub.', middle, [], true, 140),
    make('island-round', 'Island Round', 'Deliver three parcels in any order, then return to the hub to finish your shift.', hub, [near, middle, far], true, 160),
  ]);
}

/** Start a fresh attempt. IDs come from the host so saved reward keys remain stable. */
export function startDispatch(contract: DispatchContract, attemptId: string): DispatchState {
  if (typeof attemptId !== 'string' || !attemptId.trim() || attemptId.length > 128) {
    throw new RangeError('Dispatch needs a nonempty attempt ID of at most 128 characters');
  }
  const hub = copyStop(contract.hub), pickup = copyStop(contract.pickup), dropoffs = contract.dropoffs.map(copyStop);
  if ((!dropoffs.length && !contract.returnToHub)
    || new Set(dropoffs.map(stop => stop.id)).size !== dropoffs.length
    || dropoffs.some(stop => stop.id === pickup.id)
    || (!dropoffs.length && pickup.id === hub.id)
    || !Number.isFinite(contract.firstClearXp) || contract.firstClearXp < 0
    || (contract.softTimeLimitSeconds !== null && (!Number.isFinite(contract.softTimeLimitSeconds)
      || contract.softTimeLimitSeconds <= 0 || contract.softTimeLimitSeconds > DISPATCH_MAX_SECONDS))) {
    throw new RangeError('Dispatch contract needs a valid route, XP value and optional soft time target');
  }
  return {
    contract: Object.freeze({...contract, hub, pickup, dropoffs: Object.freeze(dropoffs)}),
    attemptId,
    phase: 'pickup',
    completedDropoffIds: [],
    elapsedSeconds: 0,
    completionClaimed: false,
  };
}

function active(state: DispatchState): boolean {
  return state.phase !== 'completed' && state.phase !== 'cancelled';
}

/** Advance active play only. Supply paused=true for menus, hidden tabs and game pauses. */
export function advanceDispatchTime(state: DispatchState, deltaSeconds: number, paused = false): DispatchState {
  if (!active(state) || paused || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state;
  const elapsedSeconds = Math.min(DISPATCH_MAX_SECONDS, state.elapsedSeconds + Math.min(deltaSeconds, DISPATCH_MAX_TICK_SECONDS));
  return elapsedSeconds === state.elapsedSeconds ? state : {...state, elapsedSeconds};
}

/** Eligible stops, including all unserved destinations in an any-order contract. */
export function getDispatchTargets(state: DispatchState): readonly DispatchStop[] {
  if (state.phase === 'pickup') return [state.contract.pickup];
  if (state.phase === 'dropoffs') return state.contract.dropoffs.filter(stop => !state.completedDropoffIds.includes(stop.id));
  if (state.phase === 'return') return [state.contract.hub];
  return [];
}

function handoffLimits(overrides: Partial<DispatchHandoffLimits> = {}): DispatchHandoffLimits {
  const limits = {...DEFAULT_DISPATCH_HANDOFF_LIMITS, ...overrides};
  if (!Object.values(limits).every(value => Number.isFinite(value) && value >= 0) || limits.radiusMetres === 0) {
    throw new RangeError('Dispatch handoff limits must be finite and nonnegative, with a positive radius');
  }
  return limits;
}

/**
 * A handoff is an explicit input action, never a per-frame proximity trigger.
 * If stopId is omitted, the closest currently eligible stop is considered.
 * Invalid actions return the original state without progress or side effects.
 */
export function tryDispatchHandoff(
  state: DispatchState,
  actor: DispatchActor,
  options: {stopId?: string; limits?: Partial<DispatchHandoffLimits>} = {},
): DispatchHandoffResult {
  const blocked = (reason: DispatchHandoffFailure): DispatchHandoffResult => ({state, event: null, reason});
  if (!active(state)) return blocked('inactive');
  if (![actor.x, actor.y, actor.z, actor.speedMps].every(Number.isFinite)) return blocked('invalid-position');
  if (actor.onFoot !== true) return blocked('on-foot-required');
  const limits = handoffLimits(options.limits);
  if (Math.abs(actor.speedMps) > limits.maxSpeedMps) return blocked('slow-down');
  const targets = getDispatchTargets(state);
  const stop = options.stopId === undefined
    ? [...targets].sort((a, b) => horizontalDistance(a, actor) - horizontalDistance(b, actor))[0]
    : targets.find(target => target.id === options.stopId);
  if (!stop) {
    return blocked(options.stopId !== undefined && state.completedDropoffIds.includes(options.stopId) ? 'already-delivered' : 'wrong-stop');
  }
  if (horizontalDistance(stop, actor) > limits.radiusMetres) return blocked('out-of-range');
  if (Math.abs(stop.y - actor.y) > limits.heightToleranceMetres) return blocked('wrong-height');

  let phase: DispatchPhase;
  let completedDropoffIds = state.completedDropoffIds;
  let type: DispatchHandoffEvent['type'];
  if (state.phase === 'pickup') {
    type = 'pickup';
    phase = state.contract.dropoffs.length ? 'dropoffs' : 'return';
  } else if (state.phase === 'dropoffs') {
    type = 'dropoff';
    completedDropoffIds = [...completedDropoffIds, stop.id];
    phase = completedDropoffIds.length < state.contract.dropoffs.length ? 'dropoffs'
      : state.contract.returnToHub ? 'return' : 'completed';
  } else {
    type = 'return';
    phase = 'completed';
  }
  const next: DispatchState = {...state, phase, completedDropoffIds};
  return {
    state: next,
    event: {type, stopId: stop.id, completed: phase === 'completed', remainingDropoffs: state.contract.dropoffs.length - completedDropoffIds.length},
    reason: null,
  };
}

/** Untimed tutorial and unfinished attempts have no medal; every timed finish earns one. */
export function getDispatchMedal(state: DispatchState): DispatchMedal | null {
  const target = state.contract.softTimeLimitSeconds;
  if (state.phase !== 'completed' || target === null) return null;
  if (state.elapsedSeconds <= target) return 'gold';
  return state.elapsedSeconds <= target * 1.5 ? 'silver' : 'bronze';
}

/**
 * Replace the caller's state with the returned state and persist rewardKey with
 * the shared profile. This core emits one claim per attempt; the profile owns
 * first-clear/medal-upgrade XP and deduplication of saved or replayed claims.
 */
export function claimDispatchCompletion(state: DispatchState): {state: DispatchState; completion: DispatchCompletion | null} {
  if (state.phase !== 'completed' || state.completionClaimed) return {state, completion: null};
  return {
    state: {...state, completionClaimed: true},
    completion: {
      rewardKey: `dispatch:${state.attemptId}`,
      attemptId: state.attemptId,
      contractId: state.contract.id,
      firstClearXp: state.contract.firstClearXp,
      elapsedSeconds: state.elapsedSeconds,
      medal: getDispatchMedal(state),
    },
  };
}

export function cancelDispatch(state: DispatchState): DispatchState {
  return active(state) ? {...state, phase: 'cancelled'} : state;
}

/** Restart clears only this attempt. Previously earned XP belongs to the shared profile. */
export function restartDispatch(state: DispatchState, newAttemptId: string): DispatchState {
  if (newAttemptId === state.attemptId) throw new RangeError('A dispatch restart needs a fresh attempt ID');
  return startDispatch(state.contract, newAttemptId);
}
