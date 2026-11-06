/** Classifies observed native input; it never changes or advances the game. */
// Self-contained so the same lifecycle is injected into the page and tested in
// isolation. It only owns the harness observer; it never changes game state.
export function createCountdownObserverLifecycle(owner) {
  const key = '__polishCountdownArm';
  const remove = (arm, source) => {
    arm.observer.disconnect();
    if (owner[key] !== arm) return {id: arm.id, source, status: 'superseded'};
    delete owner[key];
    if (owner[key] === arm) throw new Error('Countdown observer handle could not be removed');
    return {id: arm.id, source, status: 'complete', observerDisconnected: true, ownedHandleRemoved: true};
  };
  return {
    ready(arm, payload, notify) {
      if (!arm || payload?.id !== arm.id) return false;
      const observerCleanup = remove(arm, 'ready-callback');
      if (observerCleanup.status !== 'complete') return false;
      notify({...payload, observerCleanup});
      return true;
    },
    cancel(id) {
      const arm = owner[key];
      if (!arm) return {id, source: 'abort-cleanup', status: 'absent'};
      if (arm.id !== id) return {id, source: 'abort-cleanup', status: 'superseded'};
      return remove(arm, 'abort-cleanup');
    },
  };
}

export function hasCountdownCleanupEvidence(evidence, id) {
  return Number.isInteger(id) && id > 0 && evidence?.id === id && evidence.source === 'ready-callback' && evidence.status === 'complete' &&
    evidence.observerDisconnected === true && evidence.ownedHandleRemoved === true;
}

export function classifyCountdownInput({mobile, events, state, expectedCode, expectedTarget}) {
  const ready = state?.hudHidden === false && state.status === 'countdown' &&
    typeof state.course === 'string' && state.course.length > 0 && Number.isFinite(state.at) &&
    state.elapsed === 0 && state.speed === 0;
  const scoped = event => event?.trusted === true && event.hudHidden === false && event.course === state?.course;
  const directional = event => expectedCode ? event.type === 'keydown' && event.code === expectedCode && !event.repeat :
    !!expectedTarget && event.type === 'pointerdown' && event.pointerType === 'touch' && event.control === expectedTarget;
  const verified = ready && events.find(event => scoped(event) && directional(event) && event.status === 'countdown');
  if (verified) return {status: 'passed', event: verified,
    latencyMilliseconds: verified.at - state.at, reason: 'Trusted fresh directional input was observed during the ready countdown.'};

  // Inspect the first delivered directional event. Do not overlook a wrong target
  // or early touch and use a later event to manufacture an inconclusive result.
  const delivered = events.find(event => expectedCode ? event.type === 'keydown' && event.code === expectedCode : event.type === 'pointerdown');
  const lateTouch = ready && mobile === true && !expectedCode && scoped(delivered) && directional(delivered) &&
    delivered.status === 'running' && Number.isFinite(delivered.at) && delivered.at > state.at &&
    delivered.visibility === 'visible' && delivered.paused === 'false' &&
    Array.isArray(delivered.openDialogs) && delivered.openDialogs.length === 0;
  if (lateTouch) return {status: 'inconclusive', event: delivered,
    latencyMilliseconds: delivered.at - state.at,
    reason: 'Native touch arrived after the countdown window; countdown input buffering was not observed.'};
  return {status: 'failed', event: delivered,
    reason: 'Fresh trusted directional input was not observed in the ready countdown, and no eligible late phone touch was observed.'};
}
