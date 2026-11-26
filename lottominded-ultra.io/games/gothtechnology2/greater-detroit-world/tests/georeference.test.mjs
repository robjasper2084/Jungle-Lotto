import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ORIGIN,
  geodeticToEcef,
  geodeticToLocal,
  legacyFromGeo,
  legacyToGeo,
  conversionDiscrepancy,
} from '../tools/lib/georeference.mjs';

const close = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Number.isFinite(actual), `Expected a finite result, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);
};
const point = (longitude, latitude, ellipsoidalHeightM = 0) => ({ longitude, latitude, ellipsoidalHeightM });

test('the default audit origin preserves the existing Belle Isle geographic anchor', () => {
  assert.deepEqual(DEFAULT_ORIGIN, point(-83.00175, 42.34680));
  assert.ok(Object.isFrozen(DEFAULT_ORIGIN));
  const atOrigin = geodeticToLocal(DEFAULT_ORIGIN);
  close(atOrigin.eastM, 0);
  close(atOrigin.northM, 0);
  close(atOrigin.upM, 0);
});

test('WGS84 cardinal positions produce independently known ECEF axes and radii', () => {
  // Published WGS84 defining radii; these fixtures do not reuse the conversion.
  const a = 6378137;
  const b = 6356752.314245179;
  for (const [geo, expected] of [
    [point(0, 0), { xM: a, yM: 0, zM: 0 }],
    [point(90, 0), { xM: 0, yM: a, zM: 0 }],
    [point(-90, 0), { xM: 0, yM: -a, zM: 0 }],
    [point(180, 0), { xM: -a, yM: 0, zM: 0 }],
    [point(0, 90), { xM: 0, yM: 0, zM: b }],
    [point(0, -90), { xM: 0, yM: 0, zM: -b }],
    [point(0, 0, -100), { xM: a - 100, yM: 0, zM: 0 }],
  ]) {
    const result = geodeticToEcef(geo);
    for (const axis of ['xM', 'yM', 'zM']) close(result[axis], expected[axis]);
  }
});

test('an equatorial tangent frame has independent east, north and up expectations', () => {
  const origin = point(0, 0);
  const eastQuarterTurn = geodeticToLocal(point(90, 0), origin);
  close(eastQuarterTurn.eastM, 6378137);
  close(eastQuarterTurn.northM, 0);
  close(eastQuarterTurn.upM, -6378137);
  const pole = geodeticToLocal(point(0, 90), origin);
  close(pole.eastM, 0);
  close(pole.northM, 6356752.314245179);
  close(pole.upM, -6378137);
  const above = geodeticToLocal(point(0, 0, 120), origin);
  close(above.eastM, 0);
  close(above.northM, 0);
  close(above.upM, 120);
});

test('ENU matches the PROJ geographic-to-topocentric published worked example', () => {
  // https://proj.org/en/stable/operations/conversions/topocentric.html
  // PROJ's example defaults to GRS80 and rounds to millimetres. WGS84 differs
  // negligibly here; a 2 mm tolerance covers both that difference and rounding.
  const actual = geodeticToLocal(point(2.12955, 53.80939444, 73), point(5, 55, 200));
  close(actual.eastM, -189013.869, 0.002);
  close(actual.northM, -128642.040, 0.002);
  close(actual.upM, -4220.171, 0.002);
});

test('altitude changes align with local up at a non-equatorial origin', () => {
  const origin = { ...DEFAULT_ORIGIN, ellipsoidalHeightM: 175 };
  const actual = geodeticToLocal({ ...origin, ellipsoidalHeightM: 225 }, origin);
  close(actual.eastM, 0);
  close(actual.northM, 0);
  close(actual.upM, 50);
});

test('pole and antimeridian tangent frames remain finite without longitude division', () => {
  for (const origin of [point(0, 90), point(90, 90), point(-180, -90), point(180, 0)]) {
    const same = geodeticToLocal(origin, origin);
    close(same.eastM, 0);
    close(same.northM, 0);
    close(same.upM, 0);
    const lifted = geodeticToLocal({ ...origin, ellipsoidalHeightM: 10 }, origin);
    close(lifted.eastM, 0);
    close(lifted.northM, 0);
    close(lifted.upM, 10);
  }
  const crossing = geodeticToLocal(point(-179.999, 0), point(179.999, 0));
  assert.ok(crossing.eastM > 222 && crossing.eastM < 223);
  close(crossing.northM, 0);
  assert.ok(crossing.upM < 0 && crossing.upM > -0.01);
});

test('legacy projection keeps the existing exact arithmetic and east/south signs', () => {
  assert.deepEqual(legacyFromGeo(DEFAULT_ORIGIN), { x: 0, z: 0 });
  const fixed = legacyFromGeo({ longitude: -83, latitude: 42.34 });
  close(fixed.x, 143.9803934159889);
  close(fixed.z, 756.9759999998178);
  assert.ok(legacyFromGeo({ longitude: -83, latitude: 42.35 }).x > 0);
  assert.ok(legacyFromGeo({ longitude: -83, latitude: 42.35 }).z < 0);
  // Exact equality protects the legacy evaluation order, not a new projection.
  for (const geo of [point(-83.00060, 42.34535), point(-82.99648, 42.33985)]) {
    assert.deepEqual(legacyFromGeo(geo), {
      x: (geo.longitude - -83.00175) * 111320 * Math.cos(42.34680 * (Math.PI / 180)),
      z: (42.34680 - geo.latitude) * 111320,
    });
  }
});

test('legacy inverse round trips finite local positions without changing conventions', () => {
  for (const world of [{ x: 0, z: 0 }, { x: 1000, z: -2000 }, { x: -4000, z: 3000 }]) {
    const roundtrip = legacyFromGeo(legacyToGeo(world));
    close(roundtrip.x, world.x);
    close(roundtrip.z, world.z);
  }
});

test('the horizontal model discrepancy is zero at origin and nonzero away from it', () => {
  close(conversionDiscrepancy({ x: 0, z: 0 }), 0);
  // A fixed legacy point north of the origin reflects the different meridional
  // scales. This is a model difference, not a measured geographic error.
  const north = conversionDiscrepancy({ x: 0, z: -1000 });
  assert.ok(north > 2 && north < 3);
  const east = conversionDiscrepancy({ x: 1000, z: 0 });
  assert.ok(east > 1 && east < 2);
});

test('geographic converters reject absent, nonnumeric, nonfinite and out-of-range inputs', () => {
  const invalidNumbers = [undefined, null, '', '42', true, NaN, Infinity, -Infinity];
  for (const field of ['longitude', 'latitude', 'ellipsoidalHeightM']) {
    for (const invalid of invalidNumbers) {
      const invalidPoint = { ...DEFAULT_ORIGIN, [field]: invalid };
      assert.throws(() => geodeticToEcef(invalidPoint), RangeError);
      assert.throws(() => geodeticToLocal(invalidPoint), RangeError);
      assert.throws(() => geodeticToLocal(DEFAULT_ORIGIN, invalidPoint), RangeError);
      if (field !== 'ellipsoidalHeightM') assert.throws(() => legacyFromGeo(invalidPoint), RangeError);
    }
  }
  for (const invalid of [point(180.001, 0), point(-180.001, 0), point(0, 90.001), point(0, -90.001)]) {
    assert.throws(() => geodeticToEcef(invalid), RangeError);
    assert.throws(() => geodeticToLocal(invalid), RangeError);
    assert.throws(() => geodeticToLocal(DEFAULT_ORIGIN, invalid), RangeError);
    assert.throws(() => legacyFromGeo(invalid), RangeError);
  }
  for (const invalid of [undefined, null, [], 3, 'coordinate']) {
    assert.throws(() => geodeticToEcef(invalid), TypeError);
    assert.throws(() => geodeticToLocal(invalid), TypeError);
    assert.throws(() => legacyFromGeo(invalid), TypeError);
  }
});

test('world converters reject invalid axes, non-geographic extents and overflow', () => {
  for (const axis of ['x', 'z']) {
    for (const invalid of [undefined, null, '0', NaN, Infinity, -Infinity]) {
      const invalidPoint = { x: 0, z: 0, [axis]: invalid };
      assert.throws(() => legacyToGeo(invalidPoint), RangeError);
      assert.throws(() => conversionDiscrepancy(invalidPoint), RangeError);
    }
  }
  assert.throws(() => legacyToGeo({ x: 1e9, z: 0 }), RangeError);
  assert.throws(() => legacyToGeo({ x: 0, z: 1e9 }), RangeError);
  assert.throws(() => conversionDiscrepancy({ x: 0, z: 1e9 }), RangeError);
  assert.throws(() => geodeticToLocal(point(180, 0, 1e308), point(0, 0, 1e308)), RangeError);
});
