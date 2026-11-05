/** Solo trial rules. Positions are metres and all clock values are seconds. */
export type TrialVehicle = 'hoverbike' | 'onewheel';
export type TrialPoint = {x: number; y: number; z: number};
export type TrialPose = TrialPoint & {heading: number; vehicle: TrialVehicle; onFoot: boolean};
export type TrialGate = TrialPoint & {heading: number; radius: number; halfHeight: number};
export type TrialCourse = {
  id: string;
  vehicle: TrialVehicle;
  name: string;
  description: string;
  distance: number;
  start: TrialPoint & {heading: number};
  gates: TrialGate[];
  path: TrialPoint[];
  color: string;
  maxSpeed: number;
};
export type TrialStatus = 'countdown' | 'running' | 'finished' | 'invalid';

const pointIsFinite = (point: TrialPoint) => [point.x, point.y, point.z].every(Number.isFinite);
const copyPoint = (point: TrialPoint): TrialPoint => ({x: point.x, y: point.y, z: point.z});

/** A small physical allowance outside the drawn Sky ring, in metres. */
export const SKY_GATE_PADDING = .6;

/**
 * Fraction of the segment that crosses the gate's forward plane inside its
 * lateral/vertical ellipse. Being near a gate, crossing backwards, or flying
 * above/below its opening does not count. Endpoints may both be outside it.
 */
export function trialGateCrossing(from: TrialPoint, to: TrialPoint, gate: TrialGate, padding = 0): number | null {
  if (!pointIsFinite(from) || !pointIsFinite(to) || !pointIsFinite(gate)
    || ![gate.heading, gate.radius, gate.halfHeight].every(Number.isFinite)
    || gate.radius <= 0 || gate.halfHeight <= 0 || !Number.isFinite(padding) || padding < 0) return null;
  const nx = Math.sin(gate.heading), nz = Math.cos(gate.heading);
  const before = (from.x - gate.x) * nx + (from.z - gate.z) * nz;
  const after = (to.x - gate.x) * nx + (to.z - gate.z) * nz;
  if (before >= 0 || after < 0) return null;
  const fraction = -before / (after - before);
  const x = from.x + (to.x - from.x) * fraction - gate.x;
  const y = from.y + (to.y - from.y) * fraction - gate.y;
  const z = from.z + (to.z - from.z) * fraction - gate.z;
  const lateral = x * nz - z * nx;
  return (lateral / (gate.radius + padding)) ** 2 + (y / (gate.halfHeight + padding)) ** 2 <= 1 + 1e-9 ? fraction : null;
}

export class TrialRun {
  readonly course: TrialCourse;
  status: TrialStatus = 'countdown';
  countdown = 3;
  elapsed = 0;
  next = 0;
  splits: number[] = [];
  finish: number | null = null;
  reason = '';
  private previous: TrialPoint | null = null;

  constructor(course: TrialCourse) {
    if (!course.gates.length || !pointIsFinite(course.start) || !Number.isFinite(course.start.heading)
      || !Number.isFinite(course.maxSpeed) || course.maxSpeed <= 0
      || !['hoverbike', 'onewheel'].includes(course.vehicle)
      || course.gates.some(gate => !pointIsFinite(gate)
        || ![gate.heading, gate.radius, gate.halfHeight].every(Number.isFinite)
        || gate.radius <= 0 || gate.halfHeight <= 0)) {
      throw new RangeError('A trial needs a valid start, forward gates and a positive speed limit');
    }
    this.course = course;
    this.restart();
  }

  /** The caller resets the actual vehicle before restarting the rules. */
  restart(pose?: TrialPose): void {
    this.status = 'countdown';
    this.countdown = 3;
    this.elapsed = 0;
    this.next = 0;
    this.splits = [];
    this.finish = null;
    this.reason = '';
    this.previous = copyPoint(pose && pointIsFinite(pose) ? pose : this.course.start);
  }

  /** Re-anchor on pause/visibility edges; paused movement never sweeps a gate. */
  suspend(pose: TrialPose): void {
    this.previous = pointIsFinite(pose) ? copyPoint(pose) : null;
  }

  private invalidate(reason: string): void {
    this.status = 'invalid';
    this.reason = reason;
  }

  /**
   * Supply actual active wall time after the physics update, never its capped
   * simulation delta. Freeze movement during countdown. GO takes effect at the
   * end of that frame, so countdown overshoot cannot charge an unmoving rider.
   */
  step(seconds: number, pose: TrialPose, running = true): void {
    if (this.status === 'finished' || this.status === 'invalid') return;
    if (!running) { this.suspend(pose); return; }
    if (!pointIsFinite(pose) || !Number.isFinite(pose.heading)) {
      this.invalidate('Position unavailable. Restart this run.'); return;
    }
    if (pose.vehicle !== this.course.vehicle || pose.onFoot !== false) {
      this.invalidate('Stay on the course vehicle. Restart this run.'); return;
    }
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(this.elapsed + seconds)) {
      this.invalidate('Timing was interrupted. Restart this run.'); return;
    }
    if (this.status === 'countdown') {
      this.suspend(pose);
      this.countdown = Math.max(0, this.countdown - seconds);
      if (this.countdown < 1e-9) { this.countdown = 0; this.status = 'running'; }
      return;
    }
    const from = this.previous;
    this.previous = copyPoint(pose);
    if (from) {
      // RideCore may carry one fixed physics step across render boundaries.
      const tolerance = this.course.maxSpeed / 60 + .05;
      const distance = Math.hypot(pose.x - from.x, pose.y - from.y, pose.z - from.z);
      if (distance > this.course.maxSpeed * seconds + tolerance) {
        this.invalidate('Travel or recovery interrupted the course. Restart this run.'); return;
      }
    }
    if (seconds === 0) return;
    const before = this.elapsed;
    this.elapsed += seconds;
    if (!from) return;
    let lastFraction = -1;
    while (this.next < this.course.gates.length) {
      const fraction = trialGateCrossing(from, pose, this.course.gates[this.next], this.course.vehicle === 'hoverbike' ? SKY_GATE_PADDING : 0);
      // A later gate crossed earlier on the segment cannot be awarded out of order.
      if (fraction === null || fraction + 1e-9 < lastFraction) break;
      lastFraction = fraction;
      const split = before + seconds * fraction;
      this.splits.push(split);
      this.next++;
      if (this.next === this.course.gates.length) {
        this.finish = split;
        this.elapsed = split;
        this.status = 'finished';
        break;
      }
    }
  }
}

/** Round once in centiseconds so 59.999 seconds displays as 1:00.00. */
export function formatTrialTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const hundredths = Math.round(seconds * 100);
  if (!Number.isSafeInteger(hundredths)) return '—';
  return `${Math.floor(hundredths / 6000)}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
}

export function formatTrialSplit(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return '—';
  const rounded = Math.round(Math.abs(delta) * 100);
  return `${rounded === 0 ? '±' : delta < 0 ? '−' : '+'}${formatTrialTime(Math.abs(delta))}`;
}
