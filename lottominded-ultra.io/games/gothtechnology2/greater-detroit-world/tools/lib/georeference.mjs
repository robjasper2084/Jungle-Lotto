/**
 * Build-time geographic audit helpers. Nothing in this module migrates the
 * game's existing coordinates, terrain, collision, routes, or saved positions.
 *
 * WGS84 geodetic longitude/latitude use degrees; all heights and Cartesian
 * components use metres. Ellipsoidal height is required explicitly: a DEM's
 * orthometric elevation must be datum-converted before it can be used here.
 */

export const DEFAULT_ORIGIN = Object.freeze({
  longitude: -83.00175,
  latitude: 42.34680,
  ellipsoidalHeightM: 0,
});

const RAD = Math.PI / 180;
const WGS84_A_M = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const LEGACY_METRES_PER_DEGREE = 111320;
const LEGACY_LONGITUDE_SCALE = Math.cos(DEFAULT_ORIGIN.latitude * RAD);

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be a coordinate object`);
  }
  return value;
}

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
  return value;
}

function geographic(value, name, requireHeight = false) {
  record(value, name);
  const longitude = finiteNumber(value.longitude, `${name}.longitude`);
  const latitude = finiteNumber(value.latitude, `${name}.latitude`);
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new RangeError(`${name} longitude/latitude is outside WGS84 bounds`);
  }
  if (!requireHeight) return { longitude, latitude };
  const ellipsoidalHeightM = finiteNumber(value.ellipsoidalHeightM, `${name}.ellipsoidalHeightM`);
  return { longitude, latitude, ellipsoidalHeightM };
}

function worldPoint(value) {
  record(value, 'point');
  return {
    x: finiteNumber(value.x, 'point.x'),
    z: finiteNumber(value.z, 'point.z'),
  };
}

function ecefFromValidated({ longitude, latitude, ellipsoidalHeightM }) {
  const lambda = longitude * RAD;
  const phi = latitude * RAD;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const primeVerticalRadiusM = WGS84_A_M / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  return {
    xM: finiteNumber((primeVerticalRadiusM + ellipsoidalHeightM) * cosPhi * Math.cos(lambda), 'ECEF xM'),
    yM: finiteNumber((primeVerticalRadiusM + ellipsoidalHeightM) * cosPhi * Math.sin(lambda), 'ECEF yM'),
    zM: finiteNumber((primeVerticalRadiusM * (1 - WGS84_E2) + ellipsoidalHeightM) * sinPhi, 'ECEF zM'),
  };
}

/** Convert an explicit WGS84 geodetic position to Earth-centred metres. */
export function geodeticToEcef(point) {
  return ecefFromValidated(geographic(point, 'point', true));
}

/**
 * Convert WGS84 geodetic coordinates to a local east/north/up tangent frame.
 * The origin's longitude determines the frame orientation even at a pole.
 * Up includes Earth curvature relative to that plane; it is not terrain height.
 * This is a coordinate conversion, not a survey datum/epoch transformation.
 */
export function geodeticToLocal(point, origin = DEFAULT_ORIGIN) {
  const source = geographic(point, 'point', true);
  const anchor = geographic(origin, 'origin', true);
  const position = ecefFromValidated(source);
  const reference = ecefFromValidated(anchor);
  const dx = finiteNumber(position.xM - reference.xM, 'ECEF delta xM');
  const dy = finiteNumber(position.yM - reference.yM, 'ECEF delta yM');
  const dz = finiteNumber(position.zM - reference.zM, 'ECEF delta zM');
  const lambda = anchor.longitude * RAD;
  const phi = anchor.latitude * RAD;
  const sinLambda = Math.sin(lambda);
  const cosLambda = Math.cos(lambda);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  return {
    eastM: finiteNumber(-sinLambda * dx + cosLambda * dy, 'ENU eastM'),
    northM: finiteNumber(-sinPhi * cosLambda * dx - sinPhi * sinLambda * dy + cosPhi * dz, 'ENU northM'),
    upM: finiteNumber(cosPhi * cosLambda * dx + cosPhi * sinLambda * dy + sinPhi * dz, 'ENU upM'),
  };
}

/**
 * Preserve connectionMath.ts's existing Belle Isle east/south approximation,
 * including its 111320 constant and multiplication order. No ENU substitution.
 */
export function legacyFromGeo(point) {
  const { longitude, latitude } = geographic(point, 'point');
  return {
    x: (longitude - DEFAULT_ORIGIN.longitude) * LEGACY_METRES_PER_DEGREE * LEGACY_LONGITUDE_SCALE,
    z: (DEFAULT_ORIGIN.latitude - latitude) * LEGACY_METRES_PER_DEGREE,
  };
}

/** Invert the legacy frame without silently wrapping invalid coordinates. */
export function legacyToGeo(point) {
  const { x, z } = worldPoint(point);
  return geographic({
    longitude: DEFAULT_ORIGIN.longitude + x / (LEGACY_METRES_PER_DEGREE * LEGACY_LONGITUDE_SCALE),
    latitude: DEFAULT_ORIGIN.latitude - z / LEGACY_METRES_PER_DEGREE,
  }, 'converted point');
}

/**
 * Horizontal difference in metres between two mathematical coordinate models:
 * legacy (x, -z) and WGS84 ENU for the same reconstructed longitude/latitude at
 * ellipsoidal height zero. This is NOT measured real-world positional error,
 * source-data accuracy, an instruction to move assets, or a terrain-height test.
 */
export function conversionDiscrepancy(point) {
  const { x, z } = worldPoint(point);
  const geo = legacyToGeo({ x, z });
  const { eastM, northM } = geodeticToLocal({ ...geo, ellipsoidalHeightM: 0 });
  return finiteNumber(Math.hypot(eastM - x, northM + z), 'horizontal model difference');
}
