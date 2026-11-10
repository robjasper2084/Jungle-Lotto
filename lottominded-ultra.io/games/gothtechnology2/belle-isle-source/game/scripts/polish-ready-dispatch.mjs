/** Test-driver sequencing only. Never changes game state, countdown clocks or input proof.
 * The caller retains its existing action deadline, trusted native input transport,
 * classifier and observer cleanup. Refresh is read-only current-control geometry.
 */
export async function dispatchAfterReadyCountdown({triggered, ready, refresh, press, current = () => true}) {
  const assertCurrent = () => {
    if (!current()) throw new Error('Countdown input generation is no longer current');
  };
  assertCurrent();
  // Observe both promises immediately so trigger failures cannot hang behind ready.
  const [, observed] = await Promise.all([triggered, ready]);
  assertCurrent();
  if (!observed?.state || observed.state.status !== 'countdown' || observed.state.hudHidden !== false) {
    throw new Error('Fresh input requires an observed visible countdown');
  }
  if (press) {
    if (refresh) await refresh();
    assertCurrent();
    await press();
  }
  return observed;
}
