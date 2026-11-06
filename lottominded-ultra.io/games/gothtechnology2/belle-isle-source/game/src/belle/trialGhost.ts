import {trialGateCrossing, SKY_GATE_PADDING, type TrialCourse, type TrialPoint, type TrialPose, type TrialRun, type TrialVehicle} from './trialRules.ts';
import type {TrialStorage} from './trialRecords.ts';

export const TRIAL_GHOST_STORAGE_KEY = 'belle-isle-ghosts-v1';
export const TRIAL_GHOST_SAMPLE_SECONDS = .2;
export const TRIAL_GHOST_MAX_SAMPLES = 6001;
export const TRIAL_GHOST_MAX_SECONDS = 7200;
export const TRIAL_GHOST_MAX_RECORDS = 8;
/** UTF-16 localStorage uses about twice this character budget, before browser overhead. */
export const TRIAL_GHOST_STORAGE_BUDGET = 1_500_000;

export type TrialGhostInput = TrialPose & {pitch?: number; roll?: number};
export type TrialGhostPose = TrialPoint & {heading: number; pitch: number; roll: number};
export type TrialGhostSample = Readonly<TrialGhostPose & {time: number}>;
export type TrialGhostTrack = Readonly<{
  kind: 'recorded' | 'pace';
  courseId: string;
  vehicle: TrialVehicle;
  fingerprint: string;
  seconds: number;
  splits: readonly number[];
  samples: readonly TrialGhostSample[];
}>;
export type TrialGhostSaveResult = {improved: boolean; saved: boolean; seconds: number | null};

const TAU = Math.PI * 2;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const separation = (a: TrialPoint, b: TrialPoint) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const finitePoint = (point: TrialPoint) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
  && Math.abs(point.x) <= 100_000 && Math.abs(point.y) <= 100_000 && Math.abs(point.z) <= 100_000;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9][a-z0-9:_-]{0,95}$/.test(id)
  && !['constructor', 'prototype', '__proto__'].includes(id);
const finiteTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= TRIAL_GHOST_MAX_SECONDS;
const validVehicle = (value: unknown): value is TrialVehicle => value === 'onewheel' || value === 'hoverbike';
const keyOf = (track: Pick<TrialGhostTrack, 'courseId' | 'vehicle' | 'fingerprint'>) => `${track.vehicle}:${track.courseId}:${track.fingerprint}`;

export function createTrialGhostPose(): TrialGhostPose {
  return {x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0};
}

function poseOf(pose: TrialGhostInput): TrialGhostPose | null {
  if (!finitePoint(pose) || !Number.isFinite(pose.heading)
    || (pose.pitch !== undefined && !Number.isFinite(pose.pitch)) || (pose.roll !== undefined && !Number.isFinite(pose.roll))) return null;
  return {x: pose.x, y: pose.y, z: pose.z, heading: wrap(pose.heading),
    pitch: clamp(pose.pitch ?? 0, -1.4, 1.4), roll: clamp(pose.roll ?? 0, -1.4, 1.4)};
}

function copyPose(pose: TrialGhostPose, target: TrialGhostPose): TrialGhostPose {
  target.x = pose.x; target.y = pose.y; target.z = pose.z;
  target.heading = pose.heading; target.pitch = pose.pitch; target.roll = pose.roll;
  return target;
}

function between(a: TrialGhostPose, b: TrialGhostPose, fraction: number, target: TrialGhostPose): TrialGhostPose {
  target.x = a.x + (b.x - a.x) * fraction; target.y = a.y + (b.y - a.y) * fraction; target.z = a.z + (b.z - a.z) * fraction;
  target.heading = wrap(a.heading + wrap(b.heading - a.heading) * fraction);
  target.pitch = a.pitch + (b.pitch - a.pitch) * fraction; target.roll = a.roll + (b.roll - a.roll) * fraction;
  return target;
}

/** Layout identity, not an anti-cheat signature. Cosmetic names/colors and pace targets may change without invalidating a replay. */
export function trialGhostFingerprint(course: TrialCourse): string {
  const point = (p: TrialPoint) => [p.x, p.y, p.z];
  const text = JSON.stringify([course.id, course.vehicle, course.maxSpeed,
    [...point(course.start), course.start.heading],
    course.gates.map(gate => [...point(gate), gate.heading, gate.radius, gate.halfHeight]), course.path.map(point)]);
  let first = 2166136261, second = 0x9e3779b9;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822519);
  }
  return `g1-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}-${text.length}`;
}

function freezeTrack(track: TrialGhostTrack): TrialGhostTrack {
  return Object.freeze({...track, splits: Object.freeze([...track.splits]), samples: Object.freeze(track.samples.map(sample => Object.freeze({...sample})))});
}

/**
 * Receives race elapsed time, never a second clock. Record active running frames;
 * finish() takes the final frame instead of record(), preserving fractional gate time.
 * Long runs progressively thin old samples instead of growing without a bound.
 */
export class TrialGhostRecorder {
  private readonly course: TrialCourse;
  private readonly fingerprint: string;
  private samples: TrialGhostSample[];
  private previous: TrialGhostSample;
  private interval = TRIAL_GHOST_SAMPLE_SECONDS;
  private valid = true;
  private closed = false;

  constructor(course: TrialCourse) {
    this.course = course; this.fingerprint = trialGhostFingerprint(course);
    this.previous = {time: 0, ...course.start, heading: wrap(course.start.heading), pitch: 0, roll: 0};
    this.samples = [this.previous];
    this.valid = validId(course.id) && validVehicle(course.vehicle) && finitePoint(course.start)
      && Number.isFinite(course.start.heading) && Number.isFinite(course.maxSpeed) && course.maxSpeed > 0;
  }

  get recording() { return this.valid && !this.closed; }

  record(elapsed: number, input: TrialGhostInput): boolean {
    if (!this.recording) return false;
    const pose = poseOf(input);
    if (!finiteTime(elapsed) || !pose || input.vehicle !== this.course.vehicle || input.onFoot !== false
      || elapsed < this.previous.time - 1e-9) { this.valid = false; return false; }
    const delta = elapsed - this.previous.time;
    if (separation(this.previous, pose) > this.course.maxSpeed * Math.max(0, delta) + this.course.maxSpeed / 60 + .1) {
      this.valid = false; return false;
    }
    if (delta < 1e-9) {
      // Countdown / pause never invents trajectory time. Only a true start pose can replace sample zero.
      if (elapsed === 0 && separation(pose, this.course.start) <= .1) {
        this.previous = {time: 0, ...pose}; this.samples[0] = this.previous;
      }
      return true;
    }
    this.previous = {time: elapsed, ...pose};
    if (elapsed - this.samples[this.samples.length - 1].time >= this.interval - 1e-9) this.append(this.previous);
    return true;
  }

  private append(sample: TrialGhostSample): void {
    if (this.samples.length >= TRIAL_GHOST_MAX_SAMPLES - 1) {
      this.samples = this.samples.filter((_value, index) => index % 2 === 0);
      this.interval *= 2;
    }
    this.samples.push(sample);
  }

  finish(run: Pick<TrialRun, 'course' | 'status' | 'finish' | 'splits' | 'next'>, input: TrialGhostInput): TrialGhostTrack | null {
    if (!this.recording) return null;
    this.closed = true;
    const seconds = run.finish, pose = poseOf(input);
    if (run.status !== 'finished' || !finiteTime(seconds) || seconds <= 0 || !pose
      || input.vehicle !== this.course.vehicle || input.onFoot !== false
      || run.next !== this.course.gates.length || !run.splits.length || run.splits.length !== this.course.gates.length
      || run.splits.some((split, index) => !finiteTime(split) || split <= 0 || split > seconds
        || (index > 0 && split < run.splits[index - 1]))
      || Math.abs(run.splits[run.splits.length - 1] - seconds) > 1e-7
      || trialGhostFingerprint(run.course) !== this.fingerprint || seconds <= this.previous.time) return null;
    const gate = this.course.gates[this.course.gates.length - 1];
    const fraction = trialGateCrossing(this.previous, pose, gate, this.course.vehicle === 'hoverbike' ? SKY_GATE_PADDING : 0);
    if (fraction === null) return null;
    const final = between(this.previous, pose, fraction, createTrialGhostPose());
    if (separation(this.previous, final) > this.course.maxSpeed * (seconds - this.previous.time) + this.course.maxSpeed / 60 + .1) return null;
    this.append({time: seconds, ...final});
    return freezeTrack({kind: 'recorded', courseId: this.course.id, vehicle: this.course.vehicle, fingerprint: this.fingerprint,
      seconds, splits: run.splits, samples: this.samples});
  }
}

/** Reuses a caller-owned pose when supplied. Time outside a run hides its ghost. */
export function sampleTrialGhost(track: TrialGhostTrack | null, elapsed: number, target: TrialGhostPose = createTrialGhostPose()): TrialGhostPose | null {
  if (!track || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > track.seconds || !track.samples.length) return null;
  const samples = track.samples, last = samples.length - 1;
  if (elapsed <= samples[0].time) return copyPose(samples[0], target);
  if (elapsed >= samples[last].time) return copyPose(samples[last], target);
  let low = 0, high = last;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (samples[middle].time <= elapsed) low = middle; else high = middle;
  }
  const a = samples[low], b = samples[high], span = b.time - a.time;
  return between(a, b, span > 0 ? clamp((elapsed - a.time) / span, 0, 1) : 0, target);
}

/** Authored path + target time, explicitly a generated pace guide rather than a player record. */
export function createTrialPaceGhost(course: TrialCourse, targetSeconds?: number): TrialGhostTrack | null {
  if (!validId(course.id) || !validVehicle(course.vehicle) || !finitePoint(course.start)
    || !Number.isFinite(course.start.heading) || !Number.isFinite(course.maxSpeed) || course.maxSpeed <= 0
    || course.path.length < 2 || course.path.length > 20_000) return null;
  const points: TrialPoint[] = [{x: course.start.x, y: course.start.y, z: course.start.z}];
  for (const point of course.path) {
    if (!finitePoint(point)) return null;
    if (separation(points[points.length - 1], point) > 1e-7) points.push(point);
  }
  if (points.length < 2) return null;
  const lengths = points.slice(1).map((point, index) => separation(points[index], point));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  const authored = targetSeconds ?? (course as TrialCourse & {targetSeconds?: number}).targetSeconds;
  const seconds = authored ?? total / (course.vehicle === 'onewheel' ? 8.5 : 17);
  if (!finiteTime(seconds) || seconds <= 0 || total <= 0) return null;
  const closed = separation(points[0], points[points.length - 1]) < .01;
  const headings = points.map((point, index) => {
    if (index === 0) return wrap(course.start.heading);
    if (closed && index === points.length - 1) return wrap(course.start.heading);
    const before = points[index - 1], after = points[Math.min(index + 1, points.length - 1)];
    return Math.atan2(after.x - before.x, after.z - before.z);
  });
  const bends = points.map((point, index) => {
    const before = index === 0 ? closed ? points[points.length - 2] : point : points[index - 1];
    const after = index === points.length - 1 ? closed ? points[1] : point : points[index + 1];
    if (separation(before, point) < 1e-7 || separation(point, after) < 1e-7) return 0;
    return Math.abs(wrap(Math.atan2(after.x - point.x, after.z - point.z) - Math.atan2(point.x - before.x, point.z - before.z)));
  });
  // More of the fixed target time is spent near bends, without cutting corners across terrain.
  const weights = lengths.map((span, index) => span * (1 + Math.max(bends[index], bends[index + 1]) / Math.PI * (course.vehicle === 'onewheel' ? .8 : .5)));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0), speed = total / seconds;
  if (weights.some((weight, index) => lengths[index] / (weight / weightTotal * seconds) > course.maxSpeed + 1e-7)) return null;
  let time = 0;
  const samples = points.map((point, index): TrialGhostSample => {
    if (index > 0) time += weights[index - 1] / weightTotal * seconds;
    const before = points[Math.max(0, index - 1)], after = points[Math.min(index + 1, points.length - 1)];
    const span = Math.max(1, separation(before, after));
    const turn = wrap(headings[Math.min(index + 1, headings.length - 1)] - headings[Math.max(0, index - 1)]);
    return {time: index === points.length - 1 ? seconds : time, ...point, heading: headings[index],
      pitch: clamp(-Math.atan2(after.y - before.y, Math.hypot(after.x - before.x, after.z - before.z)), -.35, .35),
      roll: clamp(-Math.atan(speed * speed * turn / span / 9.81) * .45, -.35, .35)};
  });
  return freezeTrack({kind: 'pace', courseId: course.id, vehicle: course.vehicle, fingerprint: trialGhostFingerprint(course), seconds, splits: [], samples});
}

function browserStorage(): TrialStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function readRecorded(raw: unknown): TrialGhostTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (value.kind !== 'recorded' || !validId(value.courseId) || !validVehicle(value.vehicle)
    || typeof value.fingerprint !== 'string' || !/^g1-[a-f0-9]{16}-\d{1,8}$/.test(value.fingerprint)
    || !finiteTime(value.seconds) || value.seconds <= 0 || !Array.isArray(value.samples)
    || value.samples.length < 2 || value.samples.length > TRIAL_GHOST_MAX_SAMPLES
    || !Array.isArray(value.splits) || !value.splits.length || value.splits.length > 512) return null;
  const seconds = value.seconds, splits: number[] = [];
  for (const split of value.splits) {
    if (!finiteTime(split) || split <= 0 || split > seconds || (splits.length > 0 && split < splits[splits.length - 1])) return null;
    splits.push(split);
  }
  if (Math.abs(splits[splits.length - 1] - seconds) > 1e-7) return null;
  const samples: TrialGhostSample[] = [];
  for (const tuple of value.samples) {
    if (!Array.isArray(tuple) || tuple.length !== 7 || !tuple.every(number => typeof number === 'number' && Number.isFinite(number))) return null;
    const [time, x, y, z, heading, pitch, roll] = tuple;
    if (!finiteTime(time) || time > seconds || (samples.length > 0 && time <= samples[samples.length - 1].time)
      || Math.abs(heading) > TAU || Math.abs(pitch) > 1.4 || Math.abs(roll) > 1.4 || !finitePoint({x, y, z})) return null;
    samples.push({time, x, y, z, heading: wrap(heading), pitch, roll});
  }
  if (samples[0].time !== 0 || Math.abs(samples[samples.length - 1].time - seconds) > 1e-7) return null;
  return freezeTrack({kind: 'recorded', courseId: value.courseId, vehicle: value.vehicle, fingerprint: value.fingerprint, seconds, splits, samples});
}

const rounded = (value: number, scale: number) => Math.round(value * scale) / scale;
function compact(track: TrialGhostTrack) {
  return {kind: track.kind, courseId: track.courseId, vehicle: track.vehicle, fingerprint: track.fingerprint, seconds: track.seconds, splits: track.splits,
    samples: track.samples.map(sample => [sample.time,
      rounded(sample.x, 100), rounded(sample.y, 100), rounded(sample.z, 100), rounded(sample.heading, 10000), rounded(sample.pitch, 10000), rounded(sample.roll, 10000)])};
}

function compatible(track: TrialGhostTrack, course: TrialCourse): boolean {
  if (track.kind !== 'recorded' || track.courseId !== course.id || track.vehicle !== course.vehicle
    || track.fingerprint !== trialGhostFingerprint(course) || track.splits.length !== course.gates.length
    || !course.gates.length || separation(track.samples[0], course.start) > .12) return false;
  const last = track.samples[track.samples.length - 1], gate = course.gates[course.gates.length - 1];
  const nx = Math.sin(gate.heading), nz = Math.cos(gate.heading), padding = course.vehicle === 'hoverbike' ? SKY_GATE_PADDING : 0;
  const plane = (last.x - gate.x) * nx + (last.z - gate.z) * nz;
  const lateral = (last.x - gate.x) * nz - (last.z - gate.z) * nx;
  if (Math.abs(plane) > .03 || (lateral / (gate.radius + padding)) ** 2 + ((last.y - gate.y) / (gate.halfHeight + padding)) ** 2 > 1.02) return false;
  for (let index = 1; index < track.samples.length; index++) {
    const previous = track.samples[index - 1], next = track.samples[index];
    if (separation(previous, next) > course.maxSpeed * (next.time - previous.time) + course.maxSpeed / 60 + .15) return false;
  }
  return true;
}

/** Device-local replay archive. It neither changes official time records nor submits multiplayer/reward data. */
export class TrialGhostStore {
  available = false;
  private storage: TrialStorage | null;
  private records = new Map<string, TrialGhostTrack>();

  constructor(storage: TrialStorage | null = browserStorage()) {
    this.storage = storage;
    if (!storage) return;
    let text: string | null;
    try { text = storage.getItem(TRIAL_GHOST_STORAGE_KEY); this.available = true; }
    catch { this.storage = null; return; }
    if (!text || text.length > TRIAL_GHOST_STORAGE_BUDGET) return;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 || !('records' in parsed) || !Array.isArray(parsed.records)) return;
      for (const raw of parsed.records.slice(0, TRIAL_GHOST_MAX_RECORDS)) {
        const track = readRecorded(raw); if (!track) continue;
        const key = keyOf(track), previous = this.records.get(key);
        if (!previous || track.seconds < previous.seconds) this.records.set(key, track);
      }
    } catch { /* Corrupt ghost data never affects time records or other game saves. */ }
  }

  best(course: TrialCourse): TrialGhostTrack | null {
    const track = this.records.get(keyOf({courseId: course.id, vehicle: course.vehicle, fingerprint: trialGhostFingerprint(course)}));
    return track && compatible(track, course) ? track : null;
  }

  save(track: TrialGhostTrack): TrialGhostSaveResult {
    const key = keyOf(track), previous = this.records.get(key);
    if (track.kind !== 'recorded' || track.samples.length < 2 || track.samples.length > TRIAL_GHOST_MAX_SAMPLES)
      return {improved: false, saved: false, seconds: previous?.seconds ?? null};
    const normalized = readRecorded(compact(track));
    if (!normalized) return {improved: false, saved: false, seconds: previous?.seconds ?? null};
    const improved = !previous || normalized.seconds < previous.seconds;
    this.records.delete(key); this.records.set(key, improved ? normalized : previous!);
    while (this.records.size > TRIAL_GHOST_MAX_RECORDS) this.records.delete(this.records.keys().next().value!);
    let serialized = JSON.stringify({version: 1, records: [...this.records.values()].map(compact)});
    while (serialized.length > TRIAL_GHOST_STORAGE_BUDGET && this.records.size > 1) {
      this.records.delete(this.records.keys().next().value!);
      serialized = JSON.stringify({version: 1, records: [...this.records.values()].map(compact)});
    }
    let saved = false;
    if (this.storage && serialized.length <= TRIAL_GHOST_STORAGE_BUDGET) {
      try { this.storage.setItem(TRIAL_GHOST_STORAGE_KEY, serialized); saved = true; this.available = true; }
      catch { this.available = false; }
    }
    return {improved, saved, seconds: this.records.get(key)?.seconds ?? null};
  }
}
