import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BrowserLocationTracker, RealLocationFilter, projectRealLocation,
  REAL_LOCATION_ORIGIN, REAL_LOCATION_METRES_PER_DEGREE,
} from './realLocation.ts';
import type {
  LocationPositionInput, LocationWatchSource, LocationVisibilitySource,
  LocationClock, RealLocationSnapshot, RealLocationFilterOptions,
} from './realLocation.ts';

const WALL = 1800000000000;
const contains = (x: number, z: number) => Math.abs(x) < 5000 && Math.abs(z) < 5000;
function position(x = 0, z = 0, timestamp = WALL, accuracy = 5): LocationPositionInput {
  return {timestamp, coords: {
    latitude: REAL_LOCATION_ORIGIN[1] - z / REAL_LOCATION_METRES_PER_DEGREE,
    longitude: REAL_LOCATION_ORIGIN[0] + x / (REAL_LOCATION_METRES_PER_DEGREE * Math.cos(REAL_LOCATION_ORIGIN[1] * Math.PI / 180)),
    accuracy, speed: null, heading: null,
  }};
}

class FakeEvents implements LocationVisibilitySource {
  hidden = false;
  listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void) { this.listeners.get(type)?.delete(listener); }
  emit(type: string) { for (const listener of this.listeners.get(type) ?? []) listener(); }
}

function fixture(overrides: Partial<RealLocationFilterOptions> = {}) {
  let monotonic = 1000, wall = WALL;
  const watches: {id: number; success: (p: LocationPositionInput) => void; error: (e: {code: number}) => void; options: PositionOptions}[] = [];
  const cleared: number[] = [], timers = new Set<() => void>(), changes: RealLocationSnapshot[] = [];
  const events = new FakeEvents();
  const geolocation: LocationWatchSource = {
    watchPosition(success, error, options) {
      const id = watches.length;
      watches.push({id, success, error, options});
      return id;
    },
    clearWatch(id) { cleared.push(id); },
  };
  const clock: LocationClock = {
    now: () => monotonic, wallNow: () => wall,
    setInterval(callback) { timers.add(callback); return callback; },
    clearInterval(handle) { timers.delete(handle as () => void); },
  };
  const tracker = new BrowserLocationTracker({
    contains, onChange: state => changes.push(state), geolocation,
    secureContext: true, document: events, page: events, clock, ...overrides,
  });
  return {
    tracker, watches, cleared, timers, changes, events, geolocation, clock,
    advance(ms: number) { monotonic += ms; wall += ms; for (const timer of [...timers]) timer(); },
    fix(x = 0, z = 0, accuracy = 5) { watches.at(-1)!.success(position(x, z, wall, accuracy)); },
  };
}

test('GPS projection uses the existing map origin, metres, east x and south z', () => {
  assert.deepEqual(projectRealLocation(REAL_LOCATION_ORIGIN[1], REAL_LOCATION_ORIGIN[0]), {x: 0, z: 0});
  const p = projectRealLocation(REAL_LOCATION_ORIGIN[1] + .001, REAL_LOCATION_ORIGIN[0] + .001);
  assert.ok(p.x > 82 && p.x < 83);
  assert.ok(Math.abs(p.z + 111.32) < .000001);
  for (const coordinates of [[NaN, 0], [0, Infinity], [91, 0], [0, -181]]) {
    assert.throws(() => projectRealLocation(coordinates[0], coordinates[1]), RangeError);
  }
});

test('pure filter rejects invalid, old, future and out-of-order fixes without a usable position', () => {
  const filter = new RealLocationFilter({contains});
  assert.equal(filter.accept(position(), WALL, 1000).status, 'tracking');
  for (const p of [
    position(0, 0, WALL), position(0, 0, WALL - 1), position(0, 0, WALL - 16000),
  ]) assert.deepEqual(filter.accept(p, WALL, 1001), {status: 'stale'});
  for (const p of [
    position(0, 0, WALL + 6000), position(0, 0, NaN), position(0, 0, WALL + 1, 0),
    position(0, 0, WALL + 1, -1), position(0, 0, WALL + 1, Infinity),
    {timestamp: WALL + 1, coords: {...position().coords, latitude: NaN}},
  ]) assert.deepEqual(filter.accept(p, WALL + 1, 1001), {status: 'unavailable'});
});

test('poor accuracy, outside-map and implausible jumps make follow unusable', () => {
  const f = fixture();
  f.tracker.start(); f.fix();
  f.advance(1000); f.fix(0, 0, 50);
  assert.equal(f.tracker.snapshot.status, 'poor-accuracy');
  assert.equal(f.tracker.snapshot.fix, undefined);
  f.advance(1000); f.fix(6000);
  assert.equal(f.tracker.snapshot.status, 'outside-map');
  f.advance(1000); f.fix(1000);
  assert.equal(f.tracker.snapshot.status, 'jump-rejected');
  assert.equal(f.tracker.snapshot.fix, undefined);
  f.advance(1000); f.fix(4);
  assert.equal(f.tracker.snapshot.status, 'tracking', 'a plausible returning sample can recover');
  assert.ok(f.tracker.snapshot.fix!.x < 4.001);
  f.tracker.dispose();
});

test('stationary uncertainty is held while actual motion is smoothed into a bounded target', () => {
  const filter = new RealLocationFilter({contains});
  const first = filter.accept(position(), WALL, 1000).fix!;
  const jitter = filter.accept(position(.5, .2, WALL + 1000), WALL + 1000, 2000).fix!;
  assert.equal(jitter.x, first.x); assert.equal(jitter.z, first.z);
  const moved = filter.accept(position(10, 0, WALL + 2000), WALL + 2000, 3000).fix!;
  assert.ok(moved.x > 0 && moved.x < 10);
  assert.equal(moved.timestampMs, WALL + 2000);
  assert.ok(Object.isFrozen(moved));
  assert.equal('latitude' in moved, false); assert.equal('longitude' in moved, false);
});

test('smoothed chords must also remain within the supplied mapped geometry', () => {
  const filter = new RealLocationFilter({contains: (x, z) => z > 5 || Math.abs(x) > 2});
  assert.equal(filter.accept(position(-3, 0), WALL, 0).status, 'tracking');
  assert.deepEqual(filter.accept(position(3, 0, WALL + 500), WALL + 500, 500), {status: 'outside-map'});
});

test('only finite bounded travel speed can carry a true-north travel heading', () => {
  const filter = new RealLocationFilter({contains});
  const read = (speed: number | null, heading: number | null, tick: number) => {
    const p = position(0, 0, WALL + tick);
    return filter.accept({...p, coords: {...p.coords, speed, heading}}, WALL + tick, tick).fix!;
  };
  assert.equal(read(0, 45, 0).headingDegrees, null);
  assert.equal(read(null, 45, 1).headingDegrees, null);
  assert.equal(read(2, 359, 2).headingDegrees, 359);
  assert.equal(read(2, NaN, 3).headingDegrees, null);
  assert.equal(read(Infinity, 90, 4).speedMps, null);
  assert.equal(read(200, 90, 5).headingDegrees, null);
  assert.equal(read(-1, 90, 6).speedMps, null);
  assert.equal(read(2, 360, 7).headingDegrees, null);
});

test('construction does not request location; double-start shares one watch and ID zero is cleared', () => {
  const f = fixture();
  assert.equal(f.watches.length, 0); assert.equal(f.tracker.snapshot.status, 'off');
  f.tracker.start(); f.tracker.start();
  assert.equal(f.watches.length, 1);
  assert.deepEqual(f.watches[0].options, {enableHighAccuracy: false, maximumAge: 0, timeout: 10000});
  f.fix(); assert.equal(f.tracker.snapshot.status, 'tracking');
  f.tracker.stop();
  assert.deepEqual(f.cleared, [0]); assert.equal(f.timers.size, 0);
  assert.deepEqual(f.tracker.snapshot, {status: 'off', highAccuracy: false});
  f.watches[0].success(position(20, 0, WALL + 1000));
  assert.equal(f.tracker.snapshot.status, 'off');
  f.tracker.dispose();
});

test('high-accuracy restart and rejected permission ignore callbacks from the previous session', () => {
  const f = fixture();
  f.tracker.start(); f.fix();
  f.tracker.start(true);
  assert.deepEqual(f.cleared, [0]); assert.equal(f.watches.length, 2);
  assert.equal(f.watches[1].options.enableHighAccuracy, true);
  assert.equal(f.tracker.snapshot.fix, undefined);
  f.watches[0].error({code: 1}); f.watches[0].success(position());
  assert.equal(f.tracker.snapshot.status, 'requesting');
  f.watches[1].error({code: 1});
  assert.equal(f.tracker.snapshot.status, 'denied'); assert.deepEqual(f.cleared, [0, 1]);
  f.watches[1].success(position());
  assert.equal(f.tracker.snapshot.status, 'denied'); assert.equal(f.timers.size, 0);
  f.tracker.dispose();
});

test('temporary provider errors remove the fix and recover only on a new valid sample', () => {
  const f = fixture();
  f.tracker.start(); f.fix();
  for (const [code, expected] of [[2, 'unavailable'], [3, 'timeout']] as const) {
    f.watches[0].error({code});
    assert.equal(f.tracker.snapshot.status, expected); assert.equal(f.tracker.snapshot.fix, undefined);
    f.advance(1000); f.fix(1);
    assert.equal(f.tracker.snapshot.status, 'tracking');
  }
  f.tracker.dispose();
});

test('stale watchdog uses receipt time and clears the presentation fix without persisting history', () => {
  const f = fixture();
  f.tracker.start(); f.fix();
  f.advance(15001);
  assert.equal(f.tracker.snapshot.status, 'stale'); assert.equal(f.tracker.snapshot.fix, undefined);
  f.fix(1); assert.equal(f.tracker.snapshot.status, 'tracking');
  f.tracker.stop(); f.advance(100000);
  assert.equal(f.tracker.snapshot.status, 'off'); f.tracker.dispose();
});

test('a delayed but initially usable sample expires by acquisition age, not a new full lifetime', () => {
  const f = fixture();
  f.tracker.start(); f.watches[0].success(position(0, 0, WALL - 14000));
  assert.equal(f.tracker.snapshot.status, 'tracking');
  f.advance(1001);
  assert.equal(f.tracker.snapshot.status, 'stale'); assert.equal(f.tracker.snapshot.fix, undefined);
  f.tracker.dispose();
});

test('an explicit retry after a provider error replaces the old watch and starts a clean session', () => {
  const f = fixture();
  f.tracker.start(); f.watches[0].error({code: 3});
  f.tracker.start();
  assert.equal(f.watches.length, 2); assert.deepEqual(f.cleared, [0]);
  assert.equal(f.tracker.snapshot.status, 'requesting');
  f.watches[0].success(position());
  assert.equal(f.tracker.snapshot.status, 'requesting');
  f.fix(); assert.equal(f.tracker.snapshot.status, 'tracking');
  f.tracker.dispose();
});

test('hidden/pagehide releases sensors; becoming visible does not silently resume', () => {
  const f = fixture();
  f.tracker.start(); f.fix();
  f.events.hidden = true; f.events.emit('visibilitychange');
  assert.equal(f.tracker.snapshot.status, 'paused'); assert.equal(f.tracker.snapshot.fix, undefined);
  assert.deepEqual(f.cleared, [0]); assert.equal(f.timers.size, 0);
  f.watches[0].success(position()); assert.equal(f.tracker.snapshot.status, 'paused');
  f.events.hidden = false; f.events.emit('visibilitychange');
  assert.equal(f.watches.length, 1);
  f.tracker.start(); assert.equal(f.watches.length, 2);
  f.events.emit('pagehide');
  assert.equal(f.tracker.snapshot.status, 'paused'); assert.deepEqual(f.cleared, [0, 1]);
  f.tracker.dispose(); f.tracker.start();
  assert.equal(f.watches.length, 2);
  assert.ok([...f.events.listeners.values()].every(listeners => listeners.size === 0));
});

test('unsupported, insecure and hidden startup never invoke geolocation', () => {
  const f = fixture();
  const make = (extra: object) => new BrowserLocationTracker({
    contains, onChange() {}, clock: f.clock, geolocation: f.geolocation, secureContext: true,
    document: f.events, page: f.events, ...extra,
  });
  const unsupported = make({geolocation: null}); unsupported.start();
  assert.equal(unsupported.snapshot.status, 'unsupported');
  const insecure = make({secureContext: false}); insecure.start();
  assert.equal(insecure.snapshot.status, 'insecure');
  f.events.hidden = true; const hidden = make({}); hidden.start();
  assert.equal(hidden.snapshot.status, 'paused'); assert.equal(f.watches.length, 0);
  for (const tracker of [unsupported, insecure, hidden, f.tracker]) tracker.dispose();
});

test('synchronous callbacks during watch creation cannot leave a watch running after Stop', () => {
  const f = fixture();
  let tracker: BrowserLocationTracker;
  const cleared: number[] = [];
  tracker = new BrowserLocationTracker({
    contains, secureContext: true, clock: f.clock, document: null, page: null,
    onChange(snapshot) { if (snapshot.status === 'tracking') tracker.stop(); },
    geolocation: {
      watchPosition(success) { success(position()); return 0; },
      clearWatch(id) { cleared.push(id); },
    },
  });
  tracker.start();
  assert.equal(tracker.snapshot.status, 'off'); assert.deepEqual(cleared, [0]);
  assert.equal(f.timers.size, 0);
  tracker.dispose(); f.tracker.dispose();
});

test('synchronous policy failures and invalid tuning fail closed', () => {
  const f = fixture();
  const tracker = new BrowserLocationTracker({
    contains, secureContext: true, clock: f.clock, document: null, page: null, onChange() {},
    geolocation: {watchPosition() { throw {name: 'SecurityError'}; }, clearWatch() {}},
  });
  tracker.start(); assert.equal(tracker.snapshot.status, 'denied'); assert.equal(f.timers.size, 0);
  for (const overrides of [{maxAccuracyM: NaN}, {staleAfterMs: 0}, {maxSpeedMps: Infinity}, {smoothingTimeMs: -1}]) {
    assert.throws(() => new RealLocationFilter({contains, ...overrides}), RangeError);
  }
  tracker.dispose(); f.tracker.dispose();
});
