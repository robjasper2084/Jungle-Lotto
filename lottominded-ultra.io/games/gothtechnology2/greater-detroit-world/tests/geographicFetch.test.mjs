import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {acquireSource, validateBbox, writeAcquisition} from '../tools/fetch-geographic-source.mjs';

const BBOX = [-83.005, 42.343, -83.001, 42.349];
const FIXED_TIME = new Date('2026-11-24T18:00:00.000Z');
const FIELDS = {
  'detroit-buildings': ['objectid', 'building_id', 'semcog_id', 'status'],
  'detroit-streets': ['objectid', 'street_id', 'street_name', 'street_type', 'full_street_name'],
  'semcog-buildings': ['objectid', 'building_id', 'stories', 'median_hgt', 'demolished', 'year_built', 'ref_name', 'source'],
};

function feature(id, source = 'detroit-buildings') {
  const points = [[-83.003, 42.345], [-83.002, 42.345], [-83.002, 42.346], [-83.003, 42.345]];
  return {type: 'Feature', id, properties: {objectid: id}, geometry: source === 'detroit-streets'
    ? {type: 'LineString', coordinates: points.slice(0, 2)}
    : {type: 'Polygon', coordinates: [points]}};
}

function service({source = 'detroit-buildings', ids = [0, 2, 3], mutate} = {}) {
  const calls = [];
  const metadata = {
    geometryType: source === 'detroit-streets' ? 'esriGeometryPolyline' : 'esriGeometryPolygon',
    objectIdField: 'objectid', maxRecordCount: 2000,
    spatialReference: {wkid: source === 'semcog-buildings' ? 2253 : 4326},
    fields: FIELDS[source].map(name => ({name, type: name === 'objectid' ? 'esriFieldTypeOID' : 'esriFieldTypeString'})),
  };
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    calls.push({url, options});
    const kind = !url.pathname.endsWith('/query') ? 'metadata' : url.searchParams.get('returnIdsOnly') === 'true' ? 'ids' : 'features';
    let payload = kind === 'metadata' ? structuredClone(metadata)
      : kind === 'ids' ? {objectIdFieldName: 'objectid', objectIds: ids}
      : {type: 'FeatureCollection', features: url.searchParams.get('objectIds').split(',').reverse().map(id => feature(Number(id), source))};
    if (mutate) payload = mutate({kind, payload, url, call: calls.length}) ?? payload;
    if (payload instanceof Response) return payload;
    return new Response(JSON.stringify(payload), {status: 200, headers: {'Content-Type': 'application/json'}});
  };
  return {fetchImpl, calls, metadata};
}

test('complete ID batches retain raw bytes, source metadata, hashes, and unresolved City rights', async () => {
  const mock = service();
  const result = await acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl, batchSize: 2, now: () => FIXED_TIME});
  assert.deepEqual(result.manifest.expectedFeatureIds, [0, 2, 3]);
  assert.equal(result.manifest.expectedFeatureCount, 3);
  assert.deepEqual(new Set(result.collection.features.map(f => f.id)), new Set([0, 2, 3]));
  assert.equal(result.manifest.source.retrievedAt, FIXED_TIME.toISOString());
  assert.equal(result.manifest.source.acquiredAt, null);
  assert.equal(result.manifest.source.license.status, 'unresolved');
  assert.equal(result.manifest.coordinates.horizontal, 'OGC:CRS84');
  assert.deepEqual(result.manifest.coordinates.vertical, {datum: null, unit: null});
  assert.equal(result.manifest.acquisition.productionAccepted, false);
  assert.equal(result.manifest.acquisition.geographicAccuracyCertified, false);
  assert.equal(result.manifest.acquisition.transactionalSnapshot, false);
  assert.deepEqual(result.metadata, mock.metadata);
  assert.equal(mock.calls.length, 4);
  for (const {url, options} of mock.calls) {
    assert.equal(url.protocol, 'https:');
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(url.searchParams.has('token'), false);
  }
  for (const {url} of mock.calls.filter(c => c.url.searchParams.get('f') === 'geojson')) {
    assert.equal(url.searchParams.get('outSR'), '4326');
    assert.equal(url.searchParams.get('outFields'), 'objectid,building_id,semcog_id,status');
    assert.equal(url.searchParams.get('geometry'), BBOX.join(','));
    assert.equal(url.searchParams.get('returnZ'), 'false');
  }
  for (const response of result.rawResponses) {
    assert.equal(createHash('sha256').update(response.text).digest('hex'), response.sha256);
  }
  assert.equal(createHash('sha256').update(result.featuresText).digest('hex'), result.manifest.acquisition.output.sha256);
  for (const entry of result.manifest.acquisition.collectorFiles) {
    const actual = await readFile(new URL(`../${entry.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(actual).digest('hex'), entry.sha256);
  }
});

test('SEMCOG preserves unknown height units and source CRS while filtering demolished buildings', async () => {
  const mock = service({source: 'semcog-buildings', ids: [11], mutate: ({kind, payload}) => {
    if (kind === 'features') payload.features[0].properties.median_hgt = 32;
  }});
  const result = await acquireSource('semcog-buildings', BBOX, {fetchImpl: mock.fetchImpl});
  assert.equal(result.manifest.source.license.status, 'confirmed');
  assert.match(result.manifest.source.license.name, /SEMCOG/);
  assert.equal(result.manifest.acquisition.sourceSpatialReference.wkid, 2253);
  assert.equal(result.collection.features[0].properties.median_hgt, 32);
  assert.ok(result.manifest.acquisition.notes.some(note => /units remain unverified/.test(note)));
  for (const {url} of mock.calls.filter(c => c.url.pathname.endsWith('/query'))) {
    assert.equal(url.searchParams.get('where'), 'demolished IS NULL');
    assert.equal(url.searchParams.has('owner'), false);
  }
});

test('current City street service uses its verified field schema and does not reuse legacy names', async () => {
  const mock = service({source: 'detroit-streets', ids: [4]});
  const result = await acquireSource('detroit-streets', BBOX, {fetchImpl: mock.fetchImpl});
  assert.equal(result.collection.features[0].geometry.type, 'LineString');
  assert.match(mock.calls[0].url.pathname, /BaseUnitFeatures\/FeatureServer\/1$/);
  assert.equal(mock.calls[2].url.searchParams.get('outFields'), FIELDS['detroit-streets'].join(','));
});

test('empty ID lists are explicit empty snapshots and cause no feature-page requests', async () => {
  const mock = service({ids: []});
  const result = await acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl});
  assert.equal(result.manifest.expectedFeatureCount, 0);
  assert.deepEqual(result.manifest.expectedFeatureIds, []);
  assert.deepEqual(result.collection.features, []);
  assert.equal(mock.calls.length, 2);
});

test('missing, extra, duplicate, and disagreeing feature IDs never become a successful snapshot', async t => {
  const cases = [
    ['missing ID', ({kind, payload}) => { if (kind === 'features') payload.features.pop(); }, /missing IDs/],
    ['unexpected ID', ({kind, payload}) => { if (kind === 'features') payload.features.push(feature(99)); }, /unexpected feature ID/],
    ['duplicate ID', ({kind, payload}) => { if (kind === 'features') payload.features.push(payload.features[0]); }, /duplicate feature ID/],
    ['ID disagreement', ({kind, payload}) => { if (kind === 'features') payload.features[0].properties.objectid = 99; }, /disagrees/],
    ['no ID', ({kind, payload}) => { if (kind === 'features') { delete payload.features[0].id; delete payload.features[0].properties.objectid; } }, /feature ID/],
    ['wrong second batch', ({kind, payload, call}) => { if (kind === 'features' && call === 4) payload.features = [feature(0)]; }, /unexpected feature ID/],
  ];
  for (const [name, mutate, expected] of cases) await t.test(name, async () => {
    const mock = service({mutate});
    await assert.rejects(acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl, batchSize: 2}), expected);
  });
});

test('ID inventory and metadata must be unambiguous before feature retrieval', async t => {
  const cases = [
    ['duplicate inventory', ({kind, payload}) => { if (kind === 'ids') payload.objectIds = [1, 1]; }, /duplicate object IDs/],
    ['unsafe inventory ID', ({kind, payload}) => { if (kind === 'ids') payload.objectIds = [Number.MAX_SAFE_INTEGER + 1]; }, /safe integers/],
    ['missing inventory', ({kind, payload}) => { if (kind === 'ids') delete payload.objectIds; }, /object-ID schema/],
    ['wrong inventory field', ({kind, payload}) => { if (kind === 'ids') payload.objectIdFieldName = 'other_id'; }, /object-ID schema/],
    ['wrong metadata field', ({kind, payload}) => { if (kind === 'metadata') payload.objectIdField = 'FID'; }, /object-ID metadata/],
    ['two metadata OIDs', ({kind, payload}) => { if (kind === 'metadata') payload.fields.push({name: 'FID', type: 'esriFieldTypeOID'}); }, /object-ID metadata/],
    ['missing attribute', ({kind, payload}) => { if (kind === 'metadata') payload.fields.pop(); }, /missing a required/],
    ['wrong source type', ({kind, payload}) => { if (kind === 'metadata') payload.geometryType = 'esriGeometryPoint'; }, /geometry\/schema/],
  ];
  for (const [name, mutate, expected] of cases) await t.test(name, async () => {
    const mock = service({mutate});
    await assert.rejects(acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl}), expected);
    assert.ok(mock.calls.length <= 2);
  });
});

test('truncation, HTTP errors, server JSON errors, malformed JSON, and timeouts fail without retries', async t => {
  const cases = [
    ['truncated IDs', ({kind, payload}) => { if (kind === 'ids') payload.exceededTransferLimit = true; }, /exceededTransferLimit/],
    ['truncated page', ({kind, payload}) => { if (kind === 'features') payload.exceededTransferLimit = true; }, /exceededTransferLimit/],
    ['nested truncation', ({kind, payload}) => { if (kind === 'features') payload.properties = {truncated: true}; }, /truncated/],
    ['nonboolean truncation', ({kind, payload}) => { if (kind === 'features') payload.properties = {exceededTransferLimit: 'false'}; }, /exceededTransferLimit/],
    ['nested error with features', ({kind, payload}) => { if (kind === 'features') payload.properties = {error: {code: 500}}; }, /server error/],
    ['nested errors array', ({kind, payload}) => { if (kind === 'features') payload.metadata = {errors: ['partial result']}; }, /server error/],
    ['nested next cursor', ({kind, payload}) => { if (kind === 'features') payload.pagination = {nextCursor: 'page-2'}; }, /unfinished pagination/],
    ['nested next link', ({kind, payload}) => { if (kind === 'features') payload.properties = {links: [{rel: 'next', href: 'https://example.test/page2'}]}; }, /unfinished pagination/],
    ['server error', ({kind}) => kind === 'features' ? {error: {code: 500, message: 'Query failed'}} : undefined, /ArcGIS server error/],
    ['HTTP error', () => new Response('unavailable', {status: 503}), /HTTP failure/],
    ['malformed JSON', () => new Response('{incomplete'), /not valid JSON/],
  ];
  for (const [name, mutate, expected] of cases) await t.test(name, async () => {
    const mock = service({mutate});
    await assert.rejects(acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl}), expected);
    assert.ok(mock.calls.length <= 3);
  });
  await t.test('timeout', async () => {
    let calls = 0;
    await assert.rejects(acquireSource('detroit-buildings', BBOX, {fetchImpl: () => { calls++; return new Promise(() => {}); }, timeoutMs: 10}), /timed out/);
    assert.equal(calls, 1);
  });
});

test('only recognized WGS84 declarations are normalized, and exact original pages remain retained', async () => {
  const mock = service({ids: [1], mutate: ({kind, payload}) => {
    if (kind === 'features') {
      payload.crs = {type: 'name', properties: {name: 'EPSG:4326'}};
      payload.features[0].geometry.spatialReference = {wkid: 4326, latestWkid: 4326};
    }
  }});
  const result = await acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl});
  assert.equal(result.collection.crs, undefined);
  assert.equal(result.collection.features[0].geometry.spatialReference, undefined);
  assert.equal(result.manifest.acquisition.removedRecognizedReferenceDeclarations.length, 2);
  const original = JSON.parse(result.rawResponses[1].text);
  assert.equal(original.crs.properties.name, 'EPSG:4326');
  assert.equal(original.features[0].geometry.spatialReference.wkid, 4326);
});

test('registered ArcGIS 10.8+ GeoJSON/outSR4326 requests normalize literal null CRS with a documented receipt', async t => {
  for (const version of [10.8, 11.5]) await t.test(`ArcGIS ${version}`, async () => {
    const mock = service({source: 'semcog-buildings', ids: [1], mutate: ({kind, payload}) => {
      if (kind === 'metadata') payload.currentVersion = version;
      if (kind === 'features') {
        payload.crs = null;
        payload.features[0].crs = null;
        payload.features[0].geometry.crs = null;
      }
    }});
    const result = await acquireSource('semcog-buildings', BBOX, {fetchImpl: mock.fetchImpl});
    assert.equal(result.collection.features[0].geometry.crs, undefined);
    assert.equal(result.collection.features[0].crs, undefined);
    assert.equal(result.manifest.acquisition.sourceSpatialReference.wkid, 2253);
    const receipts = result.manifest.acquisition.removedRecognizedReferenceDeclarations;
    assert.deepEqual(receipts.map(entry => entry.path), [
      'page[1].crs', 'page[1].features[0].crs', 'page[1].features[0].geometry.crs',
    ]);
    for (const receipt of receipts) {
      assert.equal(receipt.value, null);
      assert.equal(receipt.serviceVersion, version);
      assert.match(receipt.reason, /explicitly used f=geojson and outSR=4326/);
      assert.equal(receipt.documentationUrl, 'https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/');
      const request = new URL(receipt.requestUrl);
      assert.equal(request.searchParams.get('f'), 'geojson');
      assert.equal(request.searchParams.get('outSR'), '4326');
      assert.match(request.pathname, /Hosted\/Buildings_2024\/FeatureServer\/2\/query$/);
    }
    assert.equal(JSON.parse(result.rawResponses[1].text).features[0].geometry.crs, null);
  });
});

test('literal null CRS still fails when the server version is old, missing, or unverified', async t => {
  for (const version of [10.7, null, undefined, '11.5']) await t.test(`version ${String(version)}`, async () => {
    const mock = service({source: 'semcog-buildings', ids: [1], mutate: ({kind, payload}) => {
      if (kind === 'metadata' && version !== undefined) payload.currentVersion = version;
      if (kind === 'features') payload.features[0].geometry.crs = null;
    }});
    await assert.rejects(acquireSource('semcog-buildings', BBOX, {fetchImpl: mock.fetchImpl}), /unrecognized CRS/);
  });
});

test('the null-CRS compatibility path does not accept unknown non-null CRS or ambiguous spatialReference', async t => {
  const declarations = [
    {crs: {type: 'name', properties: {name: 'EPSG:2253'}}},
    {crs: {}},
    {crs: 'null'},
    {crs: null, spatialReference: null},
    {crs: null, spatialReference: {wkid: 2253}},
  ];
  for (const declaration of declarations) await t.test(JSON.stringify(declaration), async () => {
    const mock = service({source: 'semcog-buildings', ids: [1], mutate: ({kind, payload}) => {
      if (kind === 'metadata') payload.currentVersion = 11.5;
      if (kind === 'features') Object.assign(payload.features[0].geometry, declaration);
    }});
    await assert.rejects(acquireSource('semcog-buildings', BBOX, {fetchImpl: mock.fetchImpl}), /unrecognized CRS|unrecognized spatialReference/);
  });
});

test('a validated object-ID attribute becomes an explicit Feature ID with recorded normalization', async () => {
  const mock = service({ids: [3], mutate: ({kind, payload}) => {
    if (kind === 'features') {
      delete payload.features[0].id;
      payload.features[0].properties = {ObjectId: 3};
      payload.properties = {errors: [], exceededTransferLimit: false, next: null};
    }
  }});
  const result = await acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl});
  assert.equal(result.collection.features[0].id, 3);
  assert.equal(result.manifest.acquisition.assignedFeatureIdsFromValidatedObjectIdProperties[0].fromProperty, 'ObjectId');
  assert.equal(JSON.parse(result.rawResponses[1].text).features[0].id, undefined);
});

test('unrecognized CRS, unexpected fields, and invalid geographic coordinates are rejected', async t => {
  const cases = [
    ['projected CRS', ({kind, payload}) => { if (kind === 'features') payload.crs = {type: 'name', properties: {name: 'EPSG:3857'}}; }, /unrecognized CRS/],
    ['mixed spatial reference', ({kind, payload}) => { if (kind === 'features') payload.spatialReference = {wkid: 3857, latestWkid: 4326}; }, /unrecognized spatialReference/],
    ['unrequested attribute', ({kind, payload}) => { if (kind === 'features') payload.features[0].properties.owner_name = 'not requested'; }, /unrequested attribute/],
    ['far-side coordinates', ({kind, payload}) => { if (kind === 'features') payload.features[0].geometry.coordinates[0][0] = [96.99825, -42.3468]; }, /within 25 km/],
    ['third coordinate', ({kind, payload}) => { if (kind === 'features') payload.features[0].geometry.coordinates[0][0].push(20); }, /two-dimensional/],
    ['polygon nesting', ({kind, payload}) => { if (kind === 'features') payload.features[0].geometry.coordinates = payload.features[0].geometry.coordinates[0]; }, /nesting/],
  ];
  for (const [name, mutate, expected] of cases) await t.test(name, async () => {
    const mock = service({mutate});
    await assert.rejects(acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl}), expected);
  });
});

test('invalid and oversized bounds or unknown sources trigger no network access', async () => {
  let calls = 0;
  const fetchImpl = () => { calls++; throw new Error('must not fetch'); };
  for (const bbox of [
    [], ['-83', 42.34, -82.99, 42.35], [-83, 42.35, -83, 42.36],
    [-83, 42.36, -82.99, 42.35], [-83, NaN, -82.99, 42.36],
    [-84, 42, -83.9, 42.1], [96.99, -42.35, 97, -42.34],
    [-83.10, 42.28, -82.90, 42.42],
  ]) await assert.rejects(acquireSource('detroit-buildings', bbox, {fetchImpl}));
  await assert.rejects(acquireSource('https://example.com/other-layer', BBOX, {fetchImpl}), /Unknown source/);
  assert.equal(calls, 0);
  assert.deepEqual(validateBbox(BBOX), BBOX);
});

test('disk snapshots are exclusive, preserve exact raw responses, and include the completion manifest', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'detroit-geographic-fetch-'));
  t.after(() => rm(parent, {recursive: true, force: true}));
  const destination = join(parent, 'new-snapshot');
  const mock = service({ids: [1]});
  const result = await acquireSource('detroit-buildings', BBOX, {fetchImpl: mock.fetchImpl});
  assert.equal(await writeAcquisition(destination, result), destination);
  assert.equal(await readFile(join(destination, 'metadata.json'), 'utf8'), result.metadataText);
  assert.equal(await readFile(join(destination, 'features.geojson'), 'utf8'), result.featuresText);
  for (const response of result.rawResponses) assert.equal(await readFile(join(destination, response.filename), 'utf8'), response.text);
  const manifest = JSON.parse(await readFile(join(destination, 'source-manifest.json'), 'utf8'));
  assert.equal(manifest.expectedFeatureCount, 1);
  await assert.rejects(writeAcquisition(destination, result), {code: 'EEXIST'});
  assert.equal(await readFile(join(destination, 'features.geojson'), 'utf8'), result.featuresText);
});
