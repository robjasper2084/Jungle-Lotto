#!/usr/bin/env node
/**
 * Offline geographic staging only. This tool does not attach data to a game,
 * infer missing elevations, resolve a vertical datum, or grant source rights.
 * The 25 km horizontal radius is this project's intake bound, not a claim
 * about source accuracy or a general-purpose map projection's valid extent.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, open, link, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_ORIGIN, geodeticToLocal } from './lib/georeference.mjs';

const MAX_DISTANCE_M = 25_000;
const UNIT_TO_METRES = Object.freeze({ m: 1, ft: 0.3048, 'us-ft': 1200 / 3937 });
const GEOMETRY_DEPTH = Object.freeze({
  Point: 0, MultiPoint: 1, LineString: 1,
  MultiLineString: 2, Polygon: 2, MultiPolygon: 3,
});
const EPSILON_M2 = 1e-8;

function fail(message) { throw new TypeError(message); }
function record(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail(`${path} must be a JSON object`);
  }
}
function nonemptyString(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail(`${path} must be a nonempty string`);
}
function canonicalId(value, path) {
  if (!(typeof value === 'string' && value.trim()) && !(typeof value === 'number' && Number.isSafeInteger(value))) {
    fail(`${path} must be a nonempty string or safe integer identifier`);
  }
  return String(value);
}
function webUrl(value, path) {
  nonemptyString(value, path);
  let parsed;
  try { parsed = new URL(value); } catch { fail(`${path} must be an absolute HTTP(S) URL`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    fail(`${path} must be an absolute HTTP(S) URL without credentials`);
  }
}
function jsonData(value, path, parents = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') fail(`${path} must contain JSON values only`);
  if (parents.has(value)) fail(`${path} must not contain a circular reference`);
  if (!Array.isArray(value)) record(value, path);
  else for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) fail(`${path} must not contain sparse array entries`);
  parents.add(value);
  for (const [key, child] of Object.entries(value)) jsonData(child, `${path}.${key}`, parents);
  parents.delete(value);
}
function zonedTimestamp(value, path) {
  nonemptyString(value, path);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) fail(`${path} must be an ISO timestamp with seconds and a timezone`);
  const [, y, m, d, h, minute, second, zone] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zoneHour = zone === 'Z' ? 0 : Number(zone.slice(1, 3));
  const zoneMinute = zone === 'Z' ? 0 : Number(zone.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]
      || Number(h) > 23 || Number(minute) > 59 || Number(second) > 59
      || zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)
      || !Number.isFinite(Date.parse(value))) fail(`${path} is not a valid zoned timestamp`);
}
function validateManifest(manifest) {
  record(manifest, 'manifest');
  jsonData(manifest, 'manifest');
  if (manifest.schemaVersion !== 1) fail('manifest.schemaVersion must be 1');
  record(manifest.source, 'manifest.source');
  for (const key of ['id', 'title', 'attribution']) nonemptyString(manifest.source[key], `manifest.source.${key}`);
  webUrl(manifest.source.url, 'manifest.source.url');
  zonedTimestamp(manifest.source.retrievedAt, 'manifest.source.retrievedAt');
  if (manifest.source.acquiredAt !== null) nonemptyString(manifest.source.acquiredAt, 'manifest.source.acquiredAt');
  const license = manifest.source.license;
  record(license, 'manifest.source.license');
  if (!['confirmed', 'unresolved'].includes(license.status)) fail('manifest.source.license.status must be confirmed or unresolved');
  nonemptyString(license.name, 'manifest.source.license.name');
  if (!(license.status === 'unresolved' && license.url === null)) webUrl(license.url, 'manifest.source.license.url');
  record(manifest.coordinates, 'manifest.coordinates');
  if (manifest.coordinates.horizontal !== 'OGC:CRS84') {
    fail('manifest.coordinates.horizontal must be OGC:CRS84 (WGS84 longitude, latitude); reproject source data offline first');
  }
  const vertical = manifest.coordinates.vertical;
  record(vertical, 'manifest.coordinates.vertical');
  if (vertical.datum !== null) nonemptyString(vertical.datum, 'manifest.coordinates.vertical.datum');
  if (vertical.unit !== null && !Object.hasOwn(UNIT_TO_METRES, vertical.unit)) {
    fail('manifest.coordinates.vertical.unit must be m, ft, us-ft, or null');
  }
  if (!Number.isSafeInteger(manifest.expectedFeatureCount) || manifest.expectedFeatureCount < 0) {
    fail('manifest.expectedFeatureCount must be a nonnegative safe integer from an independent count or ID request');
  }
  if (Object.hasOwn(manifest, 'expectedFeatureIds')) {
    if (!Array.isArray(manifest.expectedFeatureIds) || manifest.expectedFeatureIds.length !== manifest.expectedFeatureCount) {
      fail('manifest.expectedFeatureIds must be an array matching expectedFeatureCount');
    }
    const expectedIds = new Set();
    for (const [index, id] of manifest.expectedFeatureIds.entries()) {
      const key = canonicalId(id, `manifest.expectedFeatureIds[${index}]`);
      if (expectedIds.has(key)) fail(`Duplicate expected feature id: ${key}`);
      expectedIds.add(key);
    }
    return expectedIds;
  }
  return null;
}

function rejectResponseFailure(collection) {
  // Inspect response metadata, never arbitrary feature attributes named error.
  const metadata = [['collection', collection]];
  for (const key of ['metadata', 'properties', 'pagination']) {
    if (collection[key] && typeof collection[key] === 'object' && !Array.isArray(collection[key])) {
      metadata.push([`collection.${key}`, collection[key]]);
    }
  }
  for (const [path, value] of metadata) {
    if (Object.hasOwn(value, 'error') && value.error !== null) fail(`${path}.error indicates a source response error`);
    if (Object.hasOwn(value, 'errors') && value.errors !== null
        && !(Array.isArray(value.errors) && value.errors.length === 0)) fail(`${path}.errors indicates source response errors`);
    for (const flag of ['exceededTransferLimit', 'transferLimitExceeded', 'truncated', 'isTruncated', 'hasMore', 'has_more']) {
      if (Object.hasOwn(value, flag) && value[flag] !== false) {
        fail(`${path}.${flag} must be false; combine every source page before intake`);
      }
    }
    for (const key of ['next', 'nextPage', 'next_page', 'nextCursor', 'next_cursor', 'nextPageToken']) {
      if (Object.hasOwn(value, key) && value[key] !== null && value[key] !== '') {
        fail(`${path}.${key} indicates unfinished pagination`);
      }
    }
    if (Array.isArray(value.links) && value.links.some(item => item?.rel === 'next')) {
      fail(`${path}.links contains a next page; combine every source page before intake`);
    }
  }
}
function noLegacyCrs(value, path) {
  if (Object.hasOwn(value, 'crs') || Object.hasOwn(value, 'spatialReference')) {
    fail(`${path} contains unsupported CRS metadata; provide unambiguous OGC:CRS84 GeoJSON without legacy crs/spatialReference`);
  }
}
function stableId(feature, index) {
  let id;
  if (Object.hasOwn(feature, 'id')) id = feature.id;
  else if (feature.properties && Object.hasOwn(feature.properties, 'OBJECTID')) id = feature.properties.OBJECTID;
  else if (feature.properties && Object.hasOwn(feature.properties, 'objectid')) id = feature.properties.objectid;
  if (!(typeof id === 'string' && id.trim()) && !(typeof id === 'number' && Number.isSafeInteger(id))) {
    fail(`features[${index}] needs a stable string or safe integer id, OBJECTID, or objectid`);
  }
  return id;
}
function samePosition(a, b) { return a.length === b.length && a.every((value, i) => value === b[i]); }
function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function onSegment(a, b, p) {
  return Math.abs(cross(a, b, p)) <= EPSILON_M2
    && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
    && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
}
function segmentsIntersect(a, b, c, d) {
  if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])
      || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) return false;
  const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
  if (((ac > EPSILON_M2 && ad < -EPSILON_M2) || (ac < -EPSILON_M2 && ad > EPSILON_M2))
      && ((ca > EPSILON_M2 && cb < -EPSILON_M2) || (ca < -EPSILON_M2 && cb > EPSILON_M2))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function validateLine(raw, projected, path, ring = false) {
  if (raw.length < (ring ? 4 : 2)) fail(`${path} needs at least ${ring ? 4 : 2} positions`);
  if (ring && !samePosition(raw[0], raw.at(-1))) fail(`${path} ring must be explicitly closed in every coordinate`);
  for (let i = 1; i < projected.length; i++) {
    if (samePosition(projected[i - 1], projected[i])) fail(`${path} has a zero-length horizontal segment`);
  }
  if (!ring) return;
  let rawDoubleArea = 0;
  for (let i = 1; i < raw.length - 1; i++) rawDoubleArea += cross(raw[0], raw[i], raw[i + 1]);
  if (Math.abs(rawDoubleArea) <= 1e-18) fail(`${path} ring has degenerate source-coordinate area`);
  const anchor = projected[0];
  let doubleArea = 0;
  for (let i = 1; i < projected.length - 1; i++) doubleArea += cross(anchor, projected[i], projected[i + 1]);
  if (Math.abs(doubleArea) <= EPSILON_M2) fail(`${path} ring has degenerate horizontal area`);
  const segmentCount = projected.length - 1;
  for (let i = 0; i < segmentCount; i++) {
    for (let j = i + 2; j < segmentCount; j++) {
      if (i === 0 && j === segmentCount - 1) continue;
      if (segmentsIntersect(projected[i], projected[i + 1], projected[j], projected[j + 1])) {
        fail(`${path} ring self-intersects or touches a nonadjacent segment`);
      }
    }
  }
}
function validatePositionNumbers(position, path) {
  if (!Array.isArray(position) || ![2, 3].includes(position.length)
      || !position.every(value => typeof value === 'number' && Number.isFinite(value))) {
    fail(`${path} must be a 2D or 3D position of finite numeric values`);
  }
  const [longitude, latitude] = position;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    fail(`${path} is outside WGS84 longitude/latitude ranges; projected coordinates are not accepted`);
  }
}
function validateSourcePolygon(polygon, path) {
  if (!Array.isArray(polygon) || !polygon.length) fail(`${path} must be a nonempty ring array`);
  for (const [index, raw] of polygon.entries()) {
    const ringPath = `${path}.rings[${index}].source`;
    if (!Array.isArray(raw) || raw.length < 4) fail(`${ringPath} needs at least 4 positions`);
    raw.forEach((position, i) => validatePositionNumbers(position, `${ringPath}[${i}]`));
    // A fixed affine scaling preserves straight source-coordinate segments and
    // their intersections. It is only a topology-check plane, not a geodetic
    // projection. This lets EPSILON_M2 retain metre-sized units, instead of
    // incorrectly using a metre-squared tolerance on longitude/latitude degrees.
    const northScale = 6378137 * Math.PI / 180;
    const eastScale = northScale * Math.cos(DEFAULT_ORIGIN.latitude * Math.PI / 180);
    const sourcePlane = raw.map(position => [
      (position[0] - raw[0][0]) * eastScale,
      (position[1] - raw[0][1]) * northScale,
    ]);
    validateLine(raw, sourcePlane, ringPath, true);
  }
}
function convertGeometry(geometry, vertical, dimensions, path) {
  record(geometry, path);
  noLegacyCrs(geometry, path);
  if (!Object.hasOwn(GEOMETRY_DEPTH, geometry.type)) fail(`${path}.type is unsupported`);
  // Check source topology before nonlinear ENU projection, which can turn a
  // retraced source segment into a tiny apparent area and hide the source defect.
  if (geometry.type === 'Polygon') validateSourcePolygon(geometry.coordinates, path);
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) fail(`${path} must contain a nonempty polygon array`);
    geometry.coordinates.forEach((polygon, i) => validateSourcePolygon(polygon, `${path}.polygons[${i}]`));
  }
  const convertPosition = (position, positionPath) => {
    validatePositionNumbers(position, positionPath);
    const [longitude, latitude, elevation] = position;
    if (dimensions.value !== null && dimensions.value !== position.length) fail('Mixed 2D/3D coordinate dimensions are not accepted');
    dimensions.value = position.length;
    if (position.length === 3 && (!vertical.datum || !vertical.unit)) {
      fail(`${positionPath} has a third coordinate but no explicit vertical datum and unit`);
    }
    const radians = Math.PI / 180;
    const hemisphereDot = Math.sin(latitude * radians) * Math.sin(DEFAULT_ORIGIN.latitude * radians)
      + Math.cos(latitude * radians) * Math.cos(DEFAULT_ORIGIN.latitude * radians)
        * Math.cos((longitude - DEFAULT_ORIGIN.longitude) * radians);
    const { eastM, northM } = geodeticToLocal({ longitude, latitude, ellipsoidalHeightM: 0 });
    if (hemisphereDot <= 0 || Math.hypot(eastM, northM) > MAX_DISTANCE_M) {
      fail(`${positionPath} is outside the project's 25 km local horizontal intake bound`);
    }
    return {
      coordinates: [eastM, -northM],
      elevations: position.length === 3 ? elevation * UNIT_TO_METRES[vertical.unit] : null,
    };
  };
  const walk = (coordinates, depth, positionPath) => {
    if (depth === 0) return convertPosition(coordinates, positionPath);
    if (!Array.isArray(coordinates) || !coordinates.length) fail(`${positionPath} must be a nonempty coordinate array`);
    const converted = coordinates.map((child, i) => walk(child, depth - 1, `${positionPath}[${i}]`));
    return { coordinates: converted.map(item => item.coordinates), elevations: converted.map(item => item.elevations) };
  };
  const converted = walk(geometry.coordinates, GEOMETRY_DEPTH[geometry.type], `${path}.coordinates`);
  if (geometry.type === 'LineString') validateLine(geometry.coordinates, converted.coordinates, path);
  if (geometry.type === 'MultiLineString') geometry.coordinates.forEach((line, i) => validateLine(line, converted.coordinates[i], `${path}[${i}]`));
  if (geometry.type === 'Polygon') geometry.coordinates.forEach((ring, i) => validateLine(ring, converted.coordinates[i], `${path}.rings[${i}]`, true));
  if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach((polygon, i) => polygon.forEach((ring, j) => {
    validateLine(ring, converted.coordinates[i][j], `${path}.polygons[${i}].rings[${j}]`, true);
  }));
  return { localGeometry: { type: geometry.type, coordinates: converted.coordinates }, sourceElevationsM: converted.elevations };
}

/** Pure conversion. The CLI hashes the original input bytes, including whitespace. */
export function buildGeographicPackage(collection, manifest, inputSha256) {
  const expectedIds = validateManifest(manifest);
  if (typeof inputSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(inputSha256)) fail('inputSha256 must be a 64-character SHA-256 hex digest');
  record(collection, 'collection');
  rejectResponseFailure(collection);
  jsonData(collection, 'collection');
  noLegacyCrs(collection, 'collection');
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) fail('Input must be a GeoJSON FeatureCollection');
  if (collection.features.length !== manifest.expectedFeatureCount) {
    fail(`Feature count mismatch: expected ${manifest.expectedFeatureCount} from independent count/IDs, received ${collection.features.length}`);
  }
  for (const key of ['numberReturned', 'numberMatched', 'totalFeatures', 'totalFeatureCount']) {
    if (Object.hasOwn(collection, key) && collection[key] !== collection.features.length) fail(`collection.${key} disagrees with the complete feature count`);
  }
  const ids = new Set();
  const dimensions = { value: null };
  const features = collection.features.map((feature, index) => {
    const path = `features[${index}]`;
    record(feature, path);
    noLegacyCrs(feature, path);
    if (feature.type !== 'Feature') fail(`${path}.type must be Feature`);
    if (feature.properties !== null) record(feature.properties, `${path}.properties`);
    const id = stableId(feature, index);
    // Numeric and string variants of the same identifier must not silently collide.
    const key = canonicalId(id, `${path}.id`);
    if (ids.has(key)) fail(`Duplicate feature id: ${key}`);
    if (expectedIds && !expectedIds.has(key)) fail(`Feature ID set mismatch: unexpected id ${key}`);
    ids.add(key);
    const converted = convertGeometry(feature.geometry, manifest.coordinates.vertical, dimensions, `${path}.geometry`);
    return { id, source: structuredClone(feature), ...converted };
  });
  return {
    schema: 'greater-detroit-geographic-staging/v1',
    stagingOnly: true,
    productionReady: false,
    requiresTerrainDatumAlignment: true,
    requiresTopologyReview: true,
    validationScope: 'Individual-ring closure, degeneracy and self-intersection checks in source and projected coordinates; full inter-ring and MultiPolygon topology requires GIS review',
    licenseUnresolved: manifest.source.license.status === 'unresolved',
    inputSha256: inputSha256.toLowerCase(),
    manifest: structuredClone(manifest),
    coordinateFrame: {
      horizontal: 'WGS84 local ENU horizontal coordinates evaluated on the ellipsoid at h=0',
      origin: { ...DEFAULT_ORIGIN },
      axes: { x: 'eastM', z: '-northM' },
      unit: 'm',
      distanceLimitM: MAX_DISTANCE_M,
      sourceCoordinateDimensions: dimensions.value,
      sourceCoordinates: 'Longitude and latitude use OGC:CRS84. Third coordinates follow the manifest-declared datum and unit; non-ellipsoidal datums or non-metre units are project-specific staging extensions, not standard RFC 7946 3D coordinates, which specify WGS84 ellipsoidal height in metres',
      vertical: 'Source elevations converted to metres independently; no game Y or terrain datum alignment is assigned',
    },
    featureCount: features.length,
    features,
  };
}

const HELP = 'Usage: node tools/geographic-intake.mjs --input input.geojson --manifest source.json --out staged-package.json\nOffline staging only. Output must not already exist. Source data is never modified.';

async function main(args) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(`${HELP}\n`); return; }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    if (!['--input', '--manifest', '--out'].includes(name) || Object.hasOwn(options, name)
        || !args[i + 1] || args[i + 1].startsWith('--')) fail(HELP);
    options[name] = args[i + 1];
  }
  if (Object.keys(options).length !== 3) fail(HELP);
  const inputPath = resolve(options['--input']);
  const manifestPath = resolve(options['--manifest']);
  const outputPath = resolve(options['--out']);
  if (outputPath === inputPath || outputPath === manifestPath) fail('Output must not replace either input file');
  const [inputBytes, manifestBytes] = await Promise.all([readFile(inputPath), readFile(manifestPath)]);
  const collection = JSON.parse(inputBytes.toString('utf8'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const output = buildGeographicPackage(collection, manifest, createHash('sha256').update(inputBytes).digest('hex'));
  const temporaryPath = join(dirname(outputPath), `.${basename(outputPath)}.${randomUUID()}.tmp`);
  let created = false;
  try {
    const handle = await open(temporaryPath, 'wx', 0o600);
    created = true;
    try {
      await handle.writeFile(`${JSON.stringify(output, null, 2)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    // Hard-link publication is atomic and refuses an existing file or symlink.
    await link(temporaryPath, outputPath);
  } finally {
    if (created) await unlink(temporaryPath);
  }
  process.stdout.write(`Staged ${output.featureCount} features at ${outputPath}. productionReady=false; terrain datum alignment remains required.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`Geographic intake failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
