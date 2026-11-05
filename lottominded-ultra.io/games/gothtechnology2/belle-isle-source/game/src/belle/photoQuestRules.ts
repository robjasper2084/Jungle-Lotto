/** Measurements refer to the actual saved crop: (0, 0) is its top-left corner. */
export type PhotoQuestObservation = Readonly<{
  available: boolean;
  inFront: boolean;
  nearClipped?: boolean;
  bounds: Readonly<{ left: number; top: number; right: number; bottom: number }>;
  subjectSamples: number;
  visibleSamples: number;
  cameraHeight?: number;
}>;

export type PhotoQuestCriteria = Readonly<{
  minCoverage?: number;
  desiredCoverage?: readonly [number, number];
  aerialMinHeight?: number;
  minVisibleFraction?: number;
  minFrameFraction?: number;
}>;

export type PhotoQuestScore = Readonly<{
  valid: boolean;
  score: number;
  feedback: string;
  reason: 'ready' | 'unavailable' | 'behind' | 'out-of-frame' | 'cut-off' | 'too-small' | 'too-large' | 'occluded' | 'too-low';
  coverage: number;
  framing: number;
  visibility: number;
}>;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Pure, deterministic rules. A high score never overrides a failed visibility check. */
export function scorePhotoQuest(observation: PhotoQuestObservation, criteria: PhotoQuestCriteria = {}): PhotoQuestScore {
  const { left, top, right, bottom } = observation.bounds;
  const finiteBounds = [left, top, right, bottom].every(Number.isFinite);
  const area = finiteBounds ? Math.max(0, right - left) * Math.max(0, bottom - top) : 0;
  const coverage = finiteBounds ? Math.max(0, Math.min(1, right) - Math.max(0, left)) * Math.max(0, Math.min(1, bottom) - Math.max(0, top)) : 0;
  const framing = area > 0 ? clamp(coverage / area) : 0;
  const samplesValid = Number.isFinite(observation.subjectSamples) && Number.isFinite(observation.visibleSamples) && observation.subjectSamples > 0 && observation.visibleSamples >= 0 && observation.visibleSamples <= observation.subjectSamples;
  const visibility = samplesValid ? clamp(observation.visibleSamples / observation.subjectSamples) : 0;
  const finish = (reason: PhotoQuestScore['reason'], feedback: string, score = 0): PhotoQuestScore => Object.freeze({ valid: reason === 'ready', score, feedback, reason, coverage, framing, visibility });

  if (!observation.available || !finiteBounds || !Number.isFinite(area)) return finish('unavailable', 'Find a visible landmark, then raise your camera.');
  if (!observation.inFront) return finish('behind', 'Turn toward the landmark.');
  if (coverage <= 0) return finish('out-of-frame', 'Bring the landmark inside the photo frame.');
  if (observation.nearClipped || framing < (criteria.minFrameFraction ?? .9)) return finish('cut-off', 'Step back or zoom out to keep the landmark inside the frame.');
  const minimum = criteria.desiredCoverage?.[0] ?? criteria.minCoverage ?? .025;
  const maximum = criteria.desiredCoverage?.[1] ?? .82;
  if (coverage < minimum) return finish('too-small', 'Move closer or zoom in so the landmark fills more of the photo.');
  if (coverage > maximum) return finish('too-large', 'Step back or zoom out to leave some space around the landmark.');
  if (!samplesValid || visibility < (criteria.minVisibleFraction ?? .7)) return finish('occluded', 'Move to a clear view; something is blocking the landmark.');
  if (criteria.aerialMinHeight !== undefined && (!Number.isFinite(observation.cameraHeight) || observation.cameraHeight! < criteria.aerialMinHeight)) return finish('too-low', 'Gain altitude for a view from above.');

  const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
  const centered = clamp(1 - Math.hypot(centerX - .5, centerY - .5) / Math.SQRT1_2);
  const idealCoverage = Math.max(minimum, Math.min(maximum, .24));
  const scale = clamp(Math.min(coverage / idealCoverage, idealCoverage / coverage));
  const score = Math.round(35 * visibility + 25 * framing + 25 * centered + 15 * scale);
  return finish('ready', score >= 95 ? 'Excellent framing — ready to capture.' : 'Clear view — ready to capture.', score);
}
