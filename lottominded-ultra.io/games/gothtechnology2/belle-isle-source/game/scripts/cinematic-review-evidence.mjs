/** Finalization helpers for real cinematic browser evidence. No game-state writes. */
export function recordEvidenceError(entry, phase, error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  entry.errors.push(`${phase}: ${message}`);
  (entry.failureDetails ??= []).push({at: new Date().toISOString(), phase, message});
  if (phase.startsWith('cleanup')) entry.cleanupFailed = true;
  entry.passed = false;
}

export function observeEvidence(entry, phase, callback) {
  try { callback(); }
  catch (error) { recordEvidenceError(entry, `observer:${phase}`, error); }
}

export function finalizeCinematicCase(entry) {
  entry.passed = entry.functionalPassed === true && !entry.failure && !entry.cleanupFailed
    && Array.isArray(entry.errors) && entry.errors.length === 0
    && Array.isArray(entry.failedRequests) && entry.failedRequests.length === 0
    && (entry.requestFailureDetails?.length ?? 0) === 0
    && (entry.failureDetails?.length ?? 0) === 0;
  return entry.passed;
}

/** Try both cleanup operations even when the first fails. Never suppress a failure. */
export async function cleanupCinematicCase(entry, stopTrace, closeContext) {
  for (const [phase, operation] of [['cleanup:trace', stopTrace], ['cleanup:context', closeContext]]) {
    try { await operation(); }
    catch (error) { recordEvidenceError(entry, phase, error); }
  }
  return finalizeCinematicCase(entry);
}

/** Re-evaluate after browser.close: late observer/request errors cannot preserve a green result. */
export function finalizeCinematicReport(report, expectedCaseCount) {
  const results = report.cases.map(finalizeCinematicCase);
  report.passed = !report.failure && report.errors.length === 0
    && Number.isInteger(expectedCaseCount) && expectedCaseCount > 0
    && report.cases.length === expectedCaseCount && results.every(Boolean);
  if (!report.passed) report.liveVerified = false;
  return report.passed;
}
