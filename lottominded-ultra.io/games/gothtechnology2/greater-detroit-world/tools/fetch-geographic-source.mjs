#!/usr/bin/env node
/** Read-only, bounded acquisition from the three reviewed public ArcGIS layers. */
import {readFile, mkdir, writeFile, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_ORIGIN, geodeticToLocal} from './lib/georeference.mjs';

const CATALOG_URL = new URL('../data/geographic-sources.json', import.meta.url);
const MAX_DISTANCE_M = 25000;
const MAX_AREA_KM2 = 100;
const MAX_FEATURES = 20000;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const RAD = Math.PI / 180;
const ARCGIS_GEOJSON_CONTRACT_URL = 'https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/';
const SOURCES = Object.freeze({
  'detroit-buildings': {
    catalogId: 'detroit-current-building-footprints',
    layer: 'https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/BaseUnitFeatures/FeatureServer/2',
    fields: ['objectid', 'building_id', 'semcog_id', 'status'],
    geometryType: 'esriGeometryPolygon',
    geojsonTypes: ['Polygon', 'MultiPolygon'],
    where: '1=1',
    licenseStatus: 'unresolved',
  },
  'detroit-streets': {
    catalogId: 'detroit-current-street-segments',
    layer: 'https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/BaseUnitFeatures/FeatureServer/1',
    fields: ['objectid', 'street_id', 'street_name', 'street_type', 'full_street_name'],
    geometryType: 'esriGeometryPolyline',
    geojsonTypes: ['LineString', 'MultiLineString'],
    where: '1=1',
    licenseStatus: 'unresolved',
  },
  'semcog-buildings': {
    catalogId: 'semcog-buildings-2024',
    layer: 'https://gis.semcog.org/server/rest/services/Hosted/Buildings_2024/FeatureServer/2',
    fields: ['objectid', 'building_id', 'stories', 'median_hgt', 'demolished', 'year_built', 'ref_name', 'source'],
    geometryType: 'esriGeometryPolygon',
    geojsonTypes: ['Polygon', 'MultiPolygon'],
    where: 'demolished IS NULL',
    licenseStatus: 'confirmed',
  },
});

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function checkLocalPosition(longitude, latitude, label) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error(`${label} contains invalid longitude/latitude`);
  }
  // The spherical gate rejects far-side points that can alias in an ENU plane.
  const dLat = (latitude - DEFAULT_ORIGIN.latitude) * RAD;
  const dLon = (longitude - DEFAULT_ORIGIN.longitude) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(latitude * RAD) * Math.cos(DEFAULT_ORIGIN.latitude * RAD) * Math.sin(dLon / 2) ** 2;
  const distanceM = 6378137 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  const {eastM, northM} = geodeticToLocal({longitude, latitude, ellipsoidalHeightM: 0});
  if (distanceM > MAX_DISTANCE_M || Math.hypot(eastM, northM) > MAX_DISTANCE_M) {
    throw new Error(`${label} must be within 25 km of the Belle Isle reference origin`);
  }
}

export function validateBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new Error('bbox must contain four finite numbers: west,south,east,north');
  }
  const [west, south, east, north] = bbox;
  if (west >= east || south >= north) throw new Error('bbox must have west < east and south < north');
  for (const [lon, lat] of [[west, south], [west, north], [east, south], [east, north]]) checkLocalPosition(lon, lat, 'bbox');
  const areaKm2 = 6378137 ** 2 * (east - west) * RAD * (Math.sin(north * RAD) - Math.sin(south * RAD)) / 1e6;
  if (areaKm2 > MAX_AREA_KM2) throw new Error('bbox area must not exceed 100 square kilometres; request a smaller district');
  return [...bbox];
}

function featureKey(value, label) {
  if ((typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || (typeof value === 'string' && value.trim().length > 0)) {
    return String(value);
  }
  throw new Error(`${label} must be a nonempty string or nonnegative safe integer`);
}

function sourceIdKey(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('ArcGIS objectIds must be nonnegative safe integers');
  return String(value);
}

function rejectIncompleteResponse(json) {
  const scopes = [['response', json]];
  for (const key of ['metadata', 'properties', 'pagination']) {
    if (json[key] && typeof json[key] === 'object' && !Array.isArray(json[key])) scopes.push([`response.${key}`, json[key]]);
  }
  for (const [path, value] of scopes) {
    if ((Object.hasOwn(value, 'error') && value.error !== null) ||
        (Object.hasOwn(value, 'errors') && value.errors !== null && !(Array.isArray(value.errors) && value.errors.length === 0))) {
      throw new Error(`ArcGIS server error in ${path}; refusing a response with error metadata`);
    }
    for (const flag of ['exceededTransferLimit', 'transferLimitExceeded', 'truncated', 'isTruncated', 'hasMore', 'has_more']) {
      if (Object.hasOwn(value, flag) && value[flag] !== false) throw new Error(`ArcGIS ${path}.${flag} must be false; incomplete responses are not accepted`);
    }
    for (const key of ['next', 'nextPage', 'next_page', 'nextCursor', 'next_cursor', 'nextPageToken']) {
      if (Object.hasOwn(value, key) && value[key] !== null && value[key] !== '') throw new Error(`ArcGIS ${path}.${key} indicates unfinished pagination`);
    }
    if (Array.isArray(value.links) && value.links.some(link => link?.rel === 'next')) throw new Error(`ArcGIS ${path}.links indicates unfinished pagination`);
  }
}

async function requestJson(url, {fetchImpl, timeoutMs}) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`ArcGIS request timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url.toString(), {
          method: 'GET', credentials: 'omit', redirect: 'error',
          headers: {Accept: 'application/json'}, signal: controller.signal,
        });
        if (!response || !response.ok) throw new Error(`ArcGIS HTTP failure (${response?.status ?? 'unknown status'})`);
        const text = await response.text();
        if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw new Error('ArcGIS response exceeded the 16 MiB response limit');
        let json;
        try { json = JSON.parse(text); } catch { throw new Error('ArcGIS response is not valid JSON'); }
        object(json, 'ArcGIS response');
        rejectIncompleteResponse(json);
        return {json, text, sha256: sha256(text), url: url.toString()};
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const KNOWN_CRS_NAMES = new Set([
  'EPSG:4326', 'OGC:CRS84',
  'urn:ogc:def:crs:EPSG::4326', 'urn:ogc:def:crs:EPSG:6.6:4326',
  'urn:ogc:def:crs:OGC:1.3:CRS84', 'urn:ogc:def:crs:OGC::CRS84',
]);

function normalizeReference(node, path, declarations, requestContract) {
  if (Object.hasOwn(node, 'crs')) {
    const crs = node.crs;
    if (crs === null && requestContract?.rfc7946Request === true) {
      declarations.push({
        path: `${path}.crs`, value: null,
        reason: 'Literal legacy crs:null declares no alternate CRS; the registered ArcGIS request explicitly used f=geojson and outSR=4326 on version 10.8 or later.',
        documentationUrl: ARCGIS_GEOJSON_CONTRACT_URL,
        serviceVersion: requestContract.serviceVersion,
        requestUrl: requestContract.requestUrl,
      });
    } else if (!crs || crs.type !== 'name' || !KNOWN_CRS_NAMES.has(crs.properties?.name)) {
      throw new Error(`${path} has an unrecognized CRS; expected requested WGS84 GeoJSON`);
    } else {
      declarations.push({path: `${path}.crs`, value: crs});
    }
    delete node.crs;
  }
  if (Object.hasOwn(node, 'spatialReference')) {
    const reference = node.spatialReference;
    if (!reference || typeof reference !== 'object' || Array.isArray(reference) || !Object.keys(reference).length ||
        Object.keys(reference).some(key => !['wkid', 'latestWkid'].includes(key) || reference[key] !== 4326)) {
      throw new Error(`${path} has an unrecognized spatialReference; expected requested EPSG:4326`);
    }
    declarations.push({path: `${path}.spatialReference`, value: reference});
    delete node.spatialReference;
  }
}

function validateGeometryCoordinates(geometry) {
  const point = value => {
    if (!Array.isArray(value) || value.length !== 2 || value.some(component => typeof component !== 'number')) {
      throw new Error('Returned geometry must contain two-dimensional coordinates with type-specific nesting');
    }
    checkLocalPosition(value[0], value[1], 'Returned geometry');
  };
  const list = (value, minimum, visitor) => {
    if (!Array.isArray(value) || value.length < minimum) throw new Error('Returned geometry has invalid coordinate nesting or too few positions');
    value.forEach(visitor);
  };
  const line = value => list(value, 2, point);
  const polygon = value => list(value, 1, ring => list(ring, 4, point));
  if (geometry.type === 'LineString') line(geometry.coordinates);
  else if (geometry.type === 'MultiLineString') list(geometry.coordinates, 1, line);
  else if (geometry.type === 'Polygon') polygon(geometry.coordinates);
  else if (geometry.type === 'MultiPolygon') list(geometry.coordinates, 1, polygon);
}

function normalizePage(page, config, batchIds, oidField, pageNumber, requestContract) {
  if (page.type !== 'FeatureCollection' || !Array.isArray(page.features)) throw new Error('ArcGIS query did not return a GeoJSON FeatureCollection');
  const declarations = [];
  const assignedFeatureIds = [];
  normalizeReference(page, `page[${pageNumber}]`, declarations, requestContract);
  const expected = new Set(batchIds.map(sourceIdKey));
  const seen = new Set();
  const allowedFields = new Set(config.fields.map(name => name.toLowerCase()));
  for (let index = 0; index < page.features.length; index++) {
    const feature = object(page.features[index], 'GeoJSON feature');
    if (feature.type !== 'Feature') throw new Error('ArcGIS query contained a non-Feature record');
    const properties = object(feature.properties, 'GeoJSON feature properties');
    if (Object.keys(properties).some(name => !allowedFields.has(name.toLowerCase()))) {
      throw new Error('ArcGIS returned unrequested attribute fields; refusing to retain an unreviewed schema');
    }
    const propertyNames = Object.keys(properties).filter(name => name.toLowerCase() === oidField.toLowerCase());
    if (propertyNames.length > 1) throw new Error('GeoJSON feature has ambiguous object-ID properties');
    const propertyId = propertyNames.length ? properties[propertyNames[0]] : undefined;
    const id = feature.id ?? propertyId;
    const key = featureKey(id, 'GeoJSON feature ID');
    if (feature.id !== undefined && propertyId !== undefined && featureKey(feature.id, 'Feature ID') !== featureKey(propertyId, 'Object-ID property')) {
      throw new Error('GeoJSON feature ID disagrees with its object-ID property');
    }
    if (!expected.has(key)) throw new Error(`ArcGIS returned unexpected feature ID ${key}`);
    if (seen.has(key)) throw new Error(`ArcGIS returned duplicate feature ID ${key}`);
    seen.add(key);
    if (feature.id === undefined) {
      feature.id = propertyId;
      assignedFeatureIds.push({path: `page[${pageNumber}].features[${index}].id`, value: propertyId, fromProperty: propertyNames[0]});
    }
    const geometry = object(feature.geometry, 'GeoJSON geometry');
    if (!config.geojsonTypes.includes(geometry.type)) throw new Error(`ArcGIS returned unexpected geometry type ${String(geometry.type)}`);
    normalizeReference(feature, `page[${pageNumber}].features[${index}]`, declarations, requestContract);
    normalizeReference(geometry, `page[${pageNumber}].features[${index}].geometry`, declarations, requestContract);
    validateGeometryCoordinates(geometry);
  }
  if (seen.size !== expected.size) throw new Error(`ArcGIS returned ${seen.size} of ${expected.size} requested feature IDs; missing IDs are not accepted`);
  return {features: page.features, declarations, assignedFeatureIds};
}

function queryUrl(layer, params) {
  const url = new URL(`${layer}/query`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
}

/**
 * Acquire a complete bounded snapshot in memory. This function writes nothing,
 * changes no remote data, and does not accept arbitrary provider URLs or tokens.
 * fetchImpl and now exist for deterministic, network-free failure-path tests.
 */
export async function acquireSource(source, bbox, {fetchImpl = globalThis.fetch, now = () => new Date(), timeoutMs = 30000, batchSize = 100} = {}) {
  if (!Object.hasOwn(SOURCES, source)) throw new Error(`Unknown source; choose ${Object.keys(SOURCES).join(', ')}`);
  const bounds = validateBbox(bbox);
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('timeoutMs must be between 1 and 30000');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('batchSize must be between 1 and 100');
  const config = SOURCES[source];
  const [catalogText, collectorText, georeferenceText] = await Promise.all([
    readFile(CATALOG_URL, 'utf8'),
    readFile(new URL(import.meta.url), 'utf8'),
    readFile(new URL('./lib/georeference.mjs', import.meta.url), 'utf8'),
  ]);
  const catalog = JSON.parse(catalogText);
  const entry = catalog.sources.find(candidate => candidate.id === config.catalogId);
  if (!entry || entry.urls.layer !== config.layer) throw new Error('Reviewed source catalog does not match the pinned ArcGIS source');
  const requestOptions = {fetchImpl, timeoutMs};
  const metadataUrl = new URL(config.layer);
  metadataUrl.searchParams.set('f', 'json');
  const metadataResponse = await requestJson(metadataUrl, requestOptions);
  const metadata = metadataResponse.json;
  if (metadata.geometryType !== config.geometryType || !Array.isArray(metadata.fields)) throw new Error('ArcGIS source geometry/schema differs from the reviewed layer');
  const oidFields = metadata.fields.filter(field => field.type === 'esriFieldTypeOID');
  if (oidFields.length !== 1 || metadata.objectIdField !== oidFields[0].name || metadata.objectIdField !== 'objectid') {
    throw new Error('ArcGIS object-ID metadata differs from the reviewed source');
  }
  const fieldNames = new Set(metadata.fields.map(field => field.name));
  if (config.fields.some(name => !fieldNames.has(name))) throw new Error('ArcGIS source is missing a required reviewed attribute');
  if (!Number.isSafeInteger(metadata.maxRecordCount) || metadata.maxRecordCount < 1) throw new Error('ArcGIS maxRecordCount is missing or invalid');
  const actualBatchSize = Math.min(batchSize, metadata.maxRecordCount);
  const common = {where: config.where, geometry: bounds.join(','), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects'};
  const idsResponse = await requestJson(queryUrl(config.layer, {...common, f: 'json', returnIdsOnly: true, returnGeometry: false}), requestOptions);
  const idsPayload = idsResponse.json;
  if (idsPayload.objectIdFieldName !== metadata.objectIdField || !Array.isArray(idsPayload.objectIds)) throw new Error('ArcGIS ID query did not return the expected object-ID schema');
  if (idsPayload.objectIds.length > MAX_FEATURES) throw new Error('Acquisition exceeds 20000 features; request a smaller bbox');
  const keys = idsPayload.objectIds.map(sourceIdKey);
  if (new Set(keys).size !== keys.length) throw new Error('ArcGIS ID query returned duplicate object IDs');
  const ids = [...idsPayload.objectIds].sort((a, b) => a - b);
  const rawResponses = [{filename: 'responses/object-ids.json', ...idsResponse}];
  const features = [];
  const removedReferences = [];
  const assignedFeatureIds = [];
  for (let offset = 0; offset < ids.length; offset += actualBatchSize) {
    const batchIds = ids.slice(offset, offset + actualBatchSize);
    const pageNumber = 1 + Math.floor(offset / actualBatchSize);
    const featureUrl = queryUrl(config.layer, {
      ...common, objectIds: batchIds.join(','), f: 'geojson', outSR: 4326,
      returnGeometry: true, returnZ: false, returnM: false,
      outFields: config.fields.join(','), resultRecordCount: batchIds.length,
    });
    const response = await requestJson(featureUrl, requestOptions);
    const requestContract = {
      rfc7946Request: featureUrl.origin + featureUrl.pathname === `${config.layer}/query`
        && featureUrl.searchParams.get('f') === 'geojson' && featureUrl.searchParams.get('outSR') === '4326'
        && typeof metadata.currentVersion === 'number' && Number.isFinite(metadata.currentVersion) && metadata.currentVersion >= 10.8,
      serviceVersion: metadata.currentVersion ?? null,
      requestUrl: featureUrl.toString(),
    };
    const normalized = normalizePage(response.json, config, batchIds, metadata.objectIdField, pageNumber, requestContract);
    features.push(...normalized.features);
    removedReferences.push(...normalized.declarations);
    assignedFeatureIds.push(...normalized.assignedFeatureIds);
    rawResponses.push({filename: `responses/features-${String(pageNumber).padStart(4, '0')}.geojson`, ...response});
  }
  if (features.length !== ids.length) throw new Error('Aggregate feature count does not match the ID query');
  const collection = {type: 'FeatureCollection', features};
  const featuresText = `${JSON.stringify(collection, null, 2)}\n`;
  const date = now();
  if (!(date instanceof Date) || !Number.isFinite(date.valueOf())) throw new Error('Retrieval clock did not return a valid Date');
  const manifest = {
    schemaVersion: 1,
    source: {
      id: entry.id, title: entry.name, url: config.layer,
      attribution: entry.license.attribution,
      retrievedAt: date.toISOString(), acquiredAt: null,
      license: {
        name: entry.license.name ?? 'City of Detroit data terms not established',
        url: entry.license.termsUrl, status: config.licenseStatus,
      },
    },
    coordinates: {horizontal: 'OGC:CRS84', vertical: {datum: null, unit: null}},
    expectedFeatureCount: ids.length,
    expectedFeatureIds: ids,
    acquisition: {
      method: 'ArcGIS metadata and complete object-ID list followed by bounded ID batches',
      requestBbox: bounds, where: config.where, fields: config.fields,
      objectIdField: metadata.objectIdField, batchSize: actualBatchSize,
      sourceSpatialReference: metadata.spatialReference ?? metadata.extent?.spatialReference ?? null,
      outputCoordinates: 'Longitude, latitude in degrees; requested GeoJSON outSR=4326. No elevation inferred.',
      removedRecognizedReferenceDeclarations: removedReferences,
      assignedFeatureIdsFromValidatedObjectIdProperties: assignedFeatureIds,
      catalog: {file: 'data/geographic-sources.json', verifiedDate: catalog.verifiedDate, sha256: sha256(catalogText)},
      collectorFiles: [
        {file: 'tools/fetch-geographic-source.mjs', sha256: sha256(collectorText)},
        {file: 'tools/lib/georeference.mjs', sha256: sha256(georeferenceText)},
      ],
      rawResponses: [
        {file: 'metadata.json', url: metadataResponse.url, sha256: metadataResponse.sha256},
        ...rawResponses.map(response => ({file: response.filename, url: response.url, sha256: response.sha256})),
      ],
      output: {file: 'features.geojson', sha256: sha256(featuresText)},
      transactionalSnapshot: false,
      productionAccepted: false,
      geographicAccuracyCertified: false,
      notes: [
        'Exact ID coverage was checked; the public service does not provide an atomic multi-request snapshot here.',
        'The license status records whether source terms were identified, not blanket clearance of all derived assets or intended uses.',
        'No georeferenced terrain or measured building height is established by this acquisition.',
        'Coordinate type and nesting were checked; complete geometry topology and visual acceptance remain separate intake/review steps.',
        ...(source === 'semcog-buildings' ? ['median_hgt units remain unverified; preserve raw values without using them as measured metre heights.'] : []),
      ],
    },
  };
  return {collection, featuresText, metadata, metadataText: metadataResponse.text, manifest, rawResponses};
}

export async function writeAcquisition(outDir, result) {
  const destination = resolve(outDir);
  await mkdir(destination, {recursive: false});
  await mkdir(join(destination, 'responses'));
  const options = {encoding: 'utf8', flag: 'wx', mode: 0o444};
  await writeFile(join(destination, 'metadata.json'), result.metadataText, options);
  for (const response of result.rawResponses) await writeFile(join(destination, response.filename), response.text, options);
  await writeFile(join(destination, 'features.geojson'), result.featuresText, options);
  // A manifest is written only after every referenced artifact has been saved.
  await writeFile(join(destination, 'source-manifest.json'), `${JSON.stringify(result.manifest, null, 2)}\n`, options);
  return destination;
}

async function assertNewDirectory(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error('Output directory already exists; choose a new directory to preserve the original acquisition');
}

export async function main(args = process.argv.slice(2)) {
  const usage = 'Usage: node tools/fetch-geographic-source.mjs --source detroit-buildings|detroit-streets|semcog-buildings --bbox west,south,east,north --out-dir NEW_DIR';
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!['--source', '--bbox', '--out-dir'].includes(flag) || !args[index + 1] || Object.hasOwn(options, flag)) throw new Error(usage);
    options[flag] = args[index + 1];
  }
  if (Object.keys(options).length !== 3) throw new Error(usage);
  const pieces = options['--bbox'].split(',');
  if (pieces.some(piece => !piece.trim())) throw new Error('bbox must contain four numbers');
  const bbox = validateBbox(pieces.map(Number));
  const outDir = resolve(options['--out-dir']);
  await assertNewDirectory(outDir);
  const result = await acquireSource(options['--source'], bbox);
  const destination = await writeAcquisition(outDir, result);
  console.log(JSON.stringify({status: 'acquired-for-review', source: options['--source'], features: result.manifest.expectedFeatureCount, directory: destination, licenseStatus: result.manifest.source.license.status, productionAccepted: false}, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Geographic acquisition failed: ${error.message}`); process.exitCode = 1; });
}
