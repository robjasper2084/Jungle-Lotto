// Keep this projection aligned with ../tools/prepare-map.mjs and map.json.
// This module never persists, transmits, or logs device coordinates.
export const REAL_LOCATION_ORIGIN = [-83.00175, 42.34680] as const;
export const REAL_LOCATION_METRES_PER_DEGREE = 111320;
export const REAL_LOCATION_AXES = 'x east, y up, z south; metres; river 0 m, island 2 m';

export type RealLocationStatus =
  | 'off' | 'requesting' | 'tracking' | 'poor-accuracy' | 'stale'
  | 'outside-map' | 'denied' | 'unavailable' | 'timeout'
  | 'unsupported' | 'insecure' | 'paused' | 'jump-rejected';

export interface RealLocationFix {
  readonly x: number;
  readonly z: number;
  readonly accuracy: number;
  readonly timestampMs: number;
  readonly receivedAtMs: number;
  /** Direction of travel clockwise from north; not device orientation. */
  readonly headingDegrees: number | null;
  readonly speedMps: number | null;
}

export interface RealLocationSnapshot {
  readonly status: RealLocationStatus;
  readonly fix?: RealLocationFix;
  readonly highAccuracy: boolean;
}

export interface LocationPositionInput {
  readonly timestamp: number;
  readonly coords: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracy: number;
    readonly heading?: number | null;
    readonly speed?: number | null;
  };
}

export interface RealLocationFilterOptions {
  /** Use actual loaded map geometry. No guessed park bounding box is supplied. */
  contains: (x: number, z: number) => boolean;
  maxAccuracyM?: number;
  staleAfterMs?: number;
  maxSpeedMps?: number;
  smoothingTimeMs?: number;
  jumpSlackM?: number;
  futureToleranceMs?: number;
}

type FilterResult = Readonly<{status: RealLocationStatus; fix?: RealLocationFix}>;

function setting(value: number | undefined, fallback: number, maximum: number, allowZero = false): number {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result > maximum || (allowZero ? result < 0 : result <= 0)) {
    throw new RangeError('Invalid real-location filter setting.');
  }
  return result;
}

export function projectRealLocation(latitude: number, longitude: number): {x: number; z: number} {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new RangeError('Invalid geographic coordinates.');
  }
  const x = REAL_LOCATION_METRES_PER_DEGREE
    * Math.cos(REAL_LOCATION_ORIGIN[1] * Math.PI / 180)
    * (longitude - REAL_LOCATION_ORIGIN[0]);
  const z = -REAL_LOCATION_METRES_PER_DEGREE * (latitude - REAL_LOCATION_ORIGIN[1]);
  return {x: x === 0 ? 0 : x, z: z === 0 ? 0 : z};
}

/** Pure fix validation and target filtering. Invalid samples never retain a usable fix. */
export class RealLocationFilter {
  readonly staleAfterMs: number;
  private readonly contains: (x: number, z: number) => boolean;
  private readonly maxAccuracyM: number;
  private readonly maxSpeedMps: number;
  private readonly smoothingTimeMs: number;
  private readonly jumpSlackM: number;
  private readonly futureToleranceMs: number;
  private lastTimestampMs = -Infinity;
  private accepted: RealLocationFix | undefined;
  private raw: {x: number; z: number; timestampMs: number; accuracy: number} | undefined;

  constructor(options: RealLocationFilterOptions) {
    if (typeof options.contains !== 'function') throw new TypeError('Map containment is required.');
    this.contains = options.contains;
    this.maxAccuracyM = setting(options.maxAccuracyM, 30, 1000);
    this.staleAfterMs = setting(options.staleAfterMs, 15000, 300000);
    this.maxSpeedMps = setting(options.maxSpeedMps, 12, 100);
    this.smoothingTimeMs = setting(options.smoothingTimeMs, 900, 10000, true);
    this.jumpSlackM = setting(options.jumpSlackM, 8, 100, true);
    this.futureToleranceMs = setting(options.futureToleranceMs, 5000, 60000, true);
  }

  reset(): void {
    this.lastTimestampMs = -Infinity;
    this.accepted = undefined;
    this.raw = undefined;
  }

  accept(position: LocationPositionInput, wallNowMs: number, receivedAtMs: number): FilterResult {
    if (!position || !position.coords || !Number.isFinite(wallNowMs) || !Number.isFinite(receivedAtMs)) {
      return {status: 'unavailable'};
    }
    const {latitude, longitude, accuracy} = position.coords;
    const timestampMs = position.timestamp;
    if (!Number.isFinite(timestampMs) || timestampMs < 0
      || timestampMs > wallNowMs + this.futureToleranceMs
      || !Number.isFinite(accuracy) || accuracy <= 0) return {status: 'unavailable'};
    if (wallNowMs - timestampMs > this.staleAfterMs || timestampMs <= this.lastTimestampMs) {
      return {status: 'stale'};
    }
    let projected: {x: number; z: number};
    try { projected = projectRealLocation(latitude, longitude); }
    catch { return {status: 'unavailable'}; }
    this.lastTimestampMs = timestampMs;
    if (accuracy > this.maxAccuracyM) return {status: 'poor-accuracy'};
    if (!this.inside(projected.x, projected.z)) return {status: 'outside-map'};

    const previous = this.accepted;
    if (this.raw) {
      // Do not make a long stale interval an unlimited teleport allowance.
      const seconds = Math.min(this.staleAfterMs, timestampMs - this.raw.timestampMs) / 1000;
      const allowance = this.jumpSlackM + this.maxSpeedMps * seconds
        + Math.min(accuracy, this.raw.accuracy);
      if (Math.hypot(projected.x - this.raw.x, projected.z - this.raw.z) > allowance) {
        return {status: 'jump-rejected'};
      }
    }

    let {x, z} = projected;
    if (previous) {
      const distance = Math.hypot(x - previous.x, z - previous.z);
      const deadband = Math.min(2.5, Math.max(.5, Math.min(accuracy, previous.accuracy) * .2));
      if (distance <= deadband) {
        x = previous.x;
        z = previous.z;
      } else {
        const elapsed = timestampMs - previous.timestampMs;
        const blend = this.smoothingTimeMs === 0 ? 1 : 1 - Math.exp(-elapsed / this.smoothingTimeMs);
        x = previous.x + (x - previous.x) * blend;
        z = previous.z + (z - previous.z) * blend;
      }
      // A chord between two accepted points can leave a concave mapped region.
      if (!this.inside(x, z)) return {status: 'outside-map'};
    }
    const reportedSpeed = position.coords.speed;
    const speedMps = typeof reportedSpeed === 'number' && Number.isFinite(reportedSpeed)
      && reportedSpeed >= 0 && reportedSpeed <= this.maxSpeedMps ? reportedSpeed : null;
    const reportedHeading = position.coords.heading;
    const headingDegrees = speedMps !== null && speedMps > .5
      && typeof reportedHeading === 'number' && Number.isFinite(reportedHeading)
      && reportedHeading >= 0 && reportedHeading < 360 ? reportedHeading : null;
    const fix: RealLocationFix = Object.freeze({
      x, z, accuracy, timestampMs, receivedAtMs, headingDegrees, speedMps,
    });
    this.accepted = fix;
    this.raw = {...projected, timestampMs, accuracy};
    return {status: 'tracking', fix};
  }

  private inside(x: number, z: number): boolean {
    try { return this.contains(x, z) === true; }
    catch { return false; }
  }
}

export interface LocationWatchSource {
  watchPosition(
    success: (position: LocationPositionInput) => void,
    error: (error: {code: number}) => void,
    options: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

export interface LocationEventSource {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface LocationVisibilitySource extends LocationEventSource {
  readonly hidden: boolean;
}

export interface LocationClock {
  now(): number;
  wallNow(): number;
  setInterval(callback: () => void, milliseconds: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface BrowserLocationTrackerOptions extends RealLocationFilterOptions {
  onChange: (snapshot: RealLocationSnapshot) => void;
  geolocation?: LocationWatchSource | null;
  secureContext?: boolean;
  document?: LocationVisibilitySource | null;
  page?: LocationEventSource | null;
  clock?: LocationClock;
}

const defaultClock: LocationClock = {
  now: () => typeof performance === 'undefined' ? Date.now() : performance.now(),
  wallNow: () => Date.now(),
  setInterval: (callback, milliseconds) => globalThis.setInterval(callback, milliseconds),
  clearInterval: handle => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
};

function browserGeolocation(): LocationWatchSource | null {
  try { return typeof navigator === 'undefined' ? null : navigator.geolocation ?? null; }
  catch { return null; }
}

/** Call start only from an explicit user action. Construction never asks for location. */
export class BrowserLocationTracker {
  private readonly filter: RealLocationFilter;
  private readonly onChange: (snapshot: RealLocationSnapshot) => void;
  private readonly geolocation: LocationWatchSource | null;
  private readonly secureContext: boolean;
  private readonly document: LocationVisibilitySource | null;
  private readonly page: LocationEventSource | null;
  private readonly clock: LocationClock;
  private current: RealLocationSnapshot = Object.freeze({status: 'off', highAccuracy: false});
  private watchId: number | null = null;
  private timer: unknown = null;
  private session = 0;
  private active = false;
  private disposed = false;
  private highAccuracy = false;
  private readonly onHidden = (): void => { if (this.document?.hidden) this.pause(); };
  private readonly onPageHide = (): void => { this.pause(); };

  constructor(options: BrowserLocationTrackerOptions) {
    this.filter = new RealLocationFilter(options);
    this.onChange = options.onChange;
    this.geolocation = options.geolocation === undefined ? browserGeolocation() : options.geolocation;
    this.secureContext = options.secureContext ?? (globalThis.isSecureContext === true);
    this.document = options.document === undefined
      ? (typeof document === 'undefined' ? null : document) : options.document;
    this.page = options.page === undefined ? (typeof window === 'undefined' ? null : window) : options.page;
    this.clock = options.clock ?? defaultClock;
    this.document?.addEventListener('visibilitychange', this.onHidden);
    this.page?.addEventListener('pagehide', this.onPageHide);
  }

  get snapshot(): RealLocationSnapshot { return this.current; }

  start(highAccuracy = false): void {
    if (this.disposed || (this.active && this.highAccuracy === Boolean(highAccuracy)
      && (this.current.status === 'requesting' || this.current.status === 'tracking'))) return;
    this.release();
    this.filter.reset();
    this.highAccuracy = Boolean(highAccuracy);
    if (this.document?.hidden) { this.publish('paused'); return; }
    if (!this.secureContext) { this.publish('insecure'); return; }
    if (!this.geolocation) { this.publish('unsupported'); return; }
    const session = this.session;
    this.active = true;
    this.publish('requesting');
    if (!this.isCurrent(session)) return;
    try {
      const id = this.geolocation.watchPosition(
        position => {
          if (!this.isCurrent(session)) return;
          if (this.document?.hidden) { this.pause(); return; }
          const result = this.filter.accept(position, this.clock.wallNow(), this.clock.now());
          this.publish(result.status, result.fix);
        },
        error => {
          if (!this.isCurrent(session)) return;
          if (error.code === 1) {
            this.release();
            this.filter.reset();
            this.publish('denied');
          } else this.publish(error.code === 3 ? 'timeout' : 'unavailable');
        },
        {enableHighAccuracy: this.highAccuracy, maximumAge: 0, timeout: 10000},
      );
      // A synchronous callback or UI listener can stop/restart during watch creation.
      if (!this.isCurrent(session)) { this.geolocation.clearWatch(id); return; }
      this.watchId = id;
      const timer = this.clock.setInterval(() => this.checkStale(session), 1000);
      if (this.isCurrent(session)) this.timer = timer;
      else this.clock.clearInterval(timer);
    } catch (error) {
      if (!this.isCurrent(session)) return;
      this.release();
      this.filter.reset();
      const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
      this.publish(name === 'SecurityError' || name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }

  stop(): void {
    if (this.disposed) return;
    this.release();
    this.filter.reset();
    this.publish('off');
  }

  pause(): void {
    if (this.disposed || this.current.status === 'off' || this.current.status === 'paused') return;
    this.release();
    this.filter.reset();
    this.publish('paused');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.filter.reset();
    this.document?.removeEventListener('visibilitychange', this.onHidden);
    this.page?.removeEventListener('pagehide', this.onPageHide);
    this.publish('off');
  }

  private isCurrent(session: number): boolean {
    return !this.disposed && this.active && session === this.session;
  }

  private checkStale(session: number): void {
    if (!this.isCurrent(session)) return;
    if (this.document?.hidden) { this.pause(); return; }
    const fix = this.current.fix;
    if (fix && Math.max(
      this.clock.now() - fix.receivedAtMs,
      this.clock.wallNow() - fix.timestampMs,
    ) > this.filter.staleAfterMs) this.publish('stale');
  }

  private release(): void {
    this.session++;
    this.active = false;
    const id = this.watchId;
    this.watchId = null;
    if (id !== null) {
      try { this.geolocation?.clearWatch(id); } catch { /* Session invalidation still rejects late fixes. */ }
    }
    if (this.timer !== null) this.clock.clearInterval(this.timer);
    this.timer = null;
  }

  private publish(status: RealLocationStatus, fix?: RealLocationFix): void {
    this.current = Object.freeze(fix
      ? {status, highAccuracy: this.highAccuracy, fix}
      : {status, highAccuracy: this.highAccuracy});
    this.onChange(this.current);
  }
}
