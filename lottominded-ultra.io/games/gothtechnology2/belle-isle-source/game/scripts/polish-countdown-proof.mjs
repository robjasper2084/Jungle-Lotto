/** Classifies observed native input; it never changes or advances the game. */
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
