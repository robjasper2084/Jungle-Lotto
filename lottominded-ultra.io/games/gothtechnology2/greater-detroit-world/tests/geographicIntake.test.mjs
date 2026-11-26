import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildGeographicPackage } from '../tools/geographic-intake.mjs';
import { DEFAULT_ORIGIN } from '../tools/lib/georeference.mjs';

const HASH = 'a'.repeat(64);
const origin = [DEFAULT_ORIGIN.longitude, DEFAULT_ORIGIN.latitude];
const point = (dx = 0, dy = 0) => [origin[0] + dx, origin[1] + dy];
const feature = (geometry = { type: 'Point', coordinates: point() }, id = 1, properties = {}) => ({ type: 'Feature', id, properties, geometry });
const collection = (...features) => ({ type: 'FeatureCollection', features });
const manifest = (count = 1) => ({
  schemaVersion: 1,
  source: {
    id: 'test-source', title: 'Synthetic test fixture', url: 'https://example.org/source',
    attribution: 'Synthetic fixture; not survey data', retrievedAt: '2026-11-24T15:00:00-05:00',
    acquiredAt: null, license: { name: 'Test fixture', url: 'https://example.org/license', status: 'confirmed' },
  },
  coordinates: { horizontal: 'OGC:CRS84', vertical: { datum: null, unit: null } },
  expectedFeatureCount: count,
});
const build = (input = collection(feature()), source = manifest()) => buildGeographicPackage(input, source, HASH);
const ring = (x = 0, y = 0, size = 0.001) => [point(x, y), point(x + size, y), point(x + size, y + size), point(x, y + size), point(x, y)];

test('2D staging preserves raw null heights and attributes without assigning game elevation', () => {
  const source = feature(undefined, 7, { height: null, median_hgt: 420, stories: 8, name: 'Original' });
  const input = collection(source);
  const before = structuredClone(input);
  const output = build(input);
  assert.deepEqual(input, before);
  assert.deepEqual(output.features[0].source, source);
  assert.notEqual(output.features[0].source, source);
  assert.equal(output.features[0].sourceElevationsM, null);
  assert.equal(output.features[0].localGeometry.coordinates.length, 2);
  assert.ok(output.features[0].localGeometry.coordinates.every(value => Math.abs(value) < 1e-6));
  assert.equal(output.features[0].source.properties.height, null);
  assert.equal(output.productionReady, false);
  assert.equal(output.requiresTerrainDatumAlignment, true);
  assert.equal(output.requiresTopologyReview, true);
  assert.match(output.validationScope, /full inter-ring and MultiPolygon topology requires GIS review/);
  assert.match(output.coordinateFrame.sourceCoordinates, /project-specific staging extensions/);
  assert.equal(output.stagingOnly, true);
  assert.equal(output.inputSha256, HASH);
});

test('international feet and US survey feet remain distinct and never change horizontal placement', () => {
  const input = collection(feature({ type: 'Point', coordinates: [...point(), 1000] }));
  for (const [unit, expected] of [['m', 1000], ['ft', 304.8], ['us-ft', 1000 * 1200 / 3937]]) {
    const source = manifest();
    source.coordinates.vertical = { datum: 'NAVD88', unit };
    const output = build(input, source);
    assert.equal(output.features[0].sourceElevationsM, expected);
    assert.deepEqual(output.features[0].localGeometry.coordinates, build().features[0].localGeometry.coordinates);
    assert.deepEqual(output.features[0].source.geometry.coordinates, [...point(), 1000]);
  }
});

test('3D values require a named datum and recognized unit; null z and mixed dimensions fail', () => {
  const threeD = collection(feature({ type: 'Point', coordinates: [...point(), 120] }));
  assert.throws(() => build(threeD), /third coordinate/);
  const source = manifest();
  source.coordinates.vertical = { datum: 'NAVD88', unit: null };
  assert.throws(() => build(threeD, source), /third coordinate/);
  source.coordinates.vertical.unit = 'feet';
  assert.throws(() => build(threeD, source), /unit must be/);
  assert.throws(() => build(collection(feature({ type: 'Point', coordinates: [...point(), null] }))), /finite numeric/);
  source.coordinates.vertical.unit = 'm';
  const mixed = collection(feature({ type: 'MultiPoint', coordinates: [point(), [...point(0.001), 120]] }));
  assert.throws(() => build(mixed, source), /Mixed 2D\/3D/);
});

test('polygon holes and multipart geometries retain every part and ring', () => {
  const polygon = [ring(), ring(0.0002, 0.0002, 0.0002)];
  const geometries = [
    { type: 'Polygon', coordinates: polygon },
    { type: 'MultiPolygon', coordinates: [polygon, [ring(0.004)]] },
    { type: 'MultiLineString', coordinates: [[point(), point(0.001)], [point(0.002), point(0.003, 0.001)]] },
    { type: 'MultiPoint', coordinates: [point(), point(0.003)] },
    { type: 'LineString', coordinates: [point(), point(0.001, 0.001)] },
  ];
  const input = collection(...geometries.map((geometry, i) => feature(geometry, i)));
  const output = build(input, manifest(geometries.length));
  assert.deepEqual(output.features.map(item => item.source.geometry), geometries);
  assert.equal(output.features[0].localGeometry.coordinates.length, 2);
  assert.equal(output.features[1].localGeometry.coordinates.length, 2);
  assert.equal(output.features[1].localGeometry.coordinates[0].length, 2);
  assert.deepEqual(output.features[0].sourceElevationsM, [[null, null, null, null, null], [null, null, null, null, null]]);
});

test('incomplete ArcGIS and paginated responses are rejected even if their count happens to match', () => {
  for (const extra of [
    { error: { code: 500, message: 'Query failed' } },
    { properties: { errors: [{ code: 500, message: 'Query failed' }] } },
    { exceededTransferLimit: true },
    { metadata: { truncated: true } },
    { properties: { exceededTransferLimit: true } },
    { pagination: { nextCursor: 'page-two' } },
    { hasMore: true },
    { links: [{ rel: 'next', href: 'https://example.org/page/2' }] },
  ]) assert.throws(() => build({ ...collection(feature()), ...extra }), /error|page|pagination/);
  assert.throws(() => build(collection(feature()), manifest(2)), /Feature count mismatch/);
  assert.throws(() => build({ ...collection(feature()), numberMatched: 2 }), /complete feature count/);
  assert.equal(build({ ...collection(feature()), exceededTransferLimit: false }).featureCount, 1);
});

test('CRS ambiguity, projected coordinates, numeric strings, nonfinite values, and distant points fail', () => {
  const source = manifest();
  source.coordinates.horizontal = 'EPSG:4326';
  assert.throws(() => build(undefined, source), /OGC:CRS84/);
  assert.throws(() => build({ ...collection(feature()), crs: { type: 'name', properties: { name: 'EPSG:3857' } } }), /unsupported CRS/);
  const geometries = [
    { type: 'Point', coordinates: [500000, 4700000] },
    { type: 'Point', coordinates: [String(origin[0]), origin[1]] },
    { type: 'Point', coordinates: [NaN, origin[1]] },
    { type: 'Point', coordinates: [origin[0], Infinity] },
    { type: 'Point', coordinates: point(1) },
    // ENU horizontal coordinates alone nearly alias the antipode to the origin.
    { type: 'Point', coordinates: [origin[0] + 180, -origin[1]] },
    { type: 'Point', coordinates: point(), spatialReference: { wkid: 4326 } },
  ];
  for (const geometry of geometries) assert.throws(() => build(collection(feature(geometry))), /ranges|finite|25 km|unsupported CRS/);
});

test('feature IDs are stable, unique, and preserve original types without index fallbacks', () => {
  const upper = { type: 'Feature', properties: { OBJECTID: 0 }, geometry: { type: 'Point', coordinates: point() } };
  const lower = { type: 'Feature', properties: { objectid: 'building-2' }, geometry: { type: 'Point', coordinates: point(0.001) } };
  assert.deepEqual(build(collection(upper, lower), manifest(2)).features.map(item => item.id), [0, 'building-2']);
  assert.throws(() => build(collection(feature(undefined, 1), feature(undefined, '1')), manifest(2)), /Duplicate feature id/);
  assert.throws(() => build(collection({ ...upper, properties: {} })), /stable/);
  assert.throws(() => build(collection(feature(undefined, null))), /stable/);
  assert.throws(() => build(collection(feature(undefined, Number.MAX_SAFE_INTEGER + 1))), /stable/);
});

test('independent expected ID sets detect equal-count substitution and duplicate expected identifiers', () => {
  const source = manifest(2);
  source.expectedFeatureIds = [1, 'second'];
  const input = collection(feature(undefined, '1'), feature(undefined, 'second'));
  assert.equal(build(input, source).featureCount, 2);
  assert.throws(() => build(collection(feature(undefined, '1'), feature(undefined, 'substitute')), source), /ID set mismatch/);
  source.expectedFeatureIds = [1, '1'];
  assert.throws(() => build(input, source), /Duplicate expected/);
  source.expectedFeatureIds = [1];
  assert.throws(() => build(input, source), /matching expectedFeatureCount/);
  source.expectedFeatureIds = [1, null];
  assert.throws(() => build(input, source), /identifier/);
});

test('malformed, degenerate, and self-intersecting geometry is rejected without repair', () => {
  const invalid = [
    null,
    { type: 'GeometryCollection', geometries: [] },
    { type: 'LineString', coordinates: [point()] },
    { type: 'LineString', coordinates: [point(), point()] },
    { type: 'Polygon', coordinates: [] },
    { type: 'Polygon', coordinates: [[point(), point(0.001), point(0.001, 0.001), point(0, 0.001)]] },
    { type: 'Polygon', coordinates: [[point(), point(0.001), point(0.002), point()]] },
    { type: 'Polygon', coordinates: [[point(), point(0.002, 0.002), point(0, 0.002), point(0.002), point()]] },
  ];
  for (const geometry of invalid) assert.throws(() => build(collection(feature(geometry))));
});

test('source ring retracing is rejected before ENU projection can disguise the overlap', () => {
  // The third point lies on the nonadjacent first segment. ENU's curvature can
  // separate it by a tiny amount, so projected-coordinate checks alone miss it.
  const spike = [point(), point(0.002), point(0.001), point(0.001, -0.001), point(0, -0.001), point()];
  for (const geometry of [
    { type: 'Polygon', coordinates: [spike] },
    { type: 'MultiPolygon', coordinates: [[ring(0.004)], [spike]] },
  ]) assert.throws(() => build(collection(feature(geometry))), /source ring self-intersects or touches/);
});

test('unresolved licensing remains explicit and does not prevent offline staging', () => {
  const source = manifest();
  source.source.license = { name: 'Reuse terms not verified', url: null, status: 'unresolved' };
  const output = build(undefined, source);
  assert.equal(output.licenseUnresolved, true);
  assert.equal(output.productionReady, false);
  assert.deepEqual(output.manifest.source.license, source.source.license);
  source.source.license.status = 'confirmed';
  assert.throws(() => build(undefined, source), /license.url/);
});

test('provenance requires a valid timestamp with timezone and never invents acquisition dates', () => {
  for (const retrievedAt of ['2026-11-24', '2026-11-24T15:00:00', '2026-02-30T15:00:00Z', '2026-11-24T25:00:00Z']) {
    const source = manifest(); source.source.retrievedAt = retrievedAt;
    assert.throws(() => build(undefined, source), /timestamp/);
  }
  assert.equal(build().manifest.source.acquiredAt, null);
  assert.throws(() => buildGeographicPackage(collection(feature()), manifest(), 'invalid'), /SHA-256/);
});

test('CLI hashes input bytes, refuses overwrites and input aliases, and leaves source bytes untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'geographic-intake-'));
  const script = fileURLToPath(new URL('../tools/geographic-intake.mjs', import.meta.url));
  try {
    const inputPath = join(directory, 'input.geojson');
    const manifestPath = join(directory, 'manifest.json');
    const outputPath = join(directory, 'package.json');
    const input = `${JSON.stringify(collection(feature()), null, 1)}\n`;
    const source = JSON.stringify(manifest());
    await writeFile(inputPath, input); await writeFile(manifestPath, source);
    const run = (out = outputPath) => spawnSync(process.execPath, [script, '--input', inputPath, '--manifest', manifestPath, '--out', out], { encoding: 'utf8' });
    const success = run();
    assert.equal(success.status, 0, success.stderr);
    const savedBytes = await readFile(outputPath, 'utf8');
    const saved = JSON.parse(savedBytes);
    assert.equal(saved.inputSha256, createHash('sha256').update(input).digest('hex'));
    assert.equal(run().status, 1);
    assert.equal(await readFile(outputPath, 'utf8'), savedBytes);
    assert.equal(run(inputPath).status, 1);
    const alias = join(directory, 'source-alias.json');
    await symlink(inputPath, alias);
    assert.equal(run(alias).status, 1);
    assert.equal(await readFile(inputPath, 'utf8'), input);
    assert.equal(await readFile(manifestPath, 'utf8'), source);
    assert.ok((await readdir(directory)).every(name => !name.endsWith('.tmp')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
