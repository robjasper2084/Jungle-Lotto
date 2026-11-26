#!/usr/bin/env node
/** Offline inventory of the shipped map. This is not a survey accuracy test. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_ORIGIN, conversionDiscrepancy, geodeticToLocal, legacyToGeo} from './lib/georeference.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const inputPaths = {
  park: '../belle-isle-source/game/public/belle/map.json',
  districts: '../belle-isle-source/game/src/belle/detroitDistricts.json',
  generator: 'tools/build-mainland.mjs',
};
const analysisPaths = ['tools/audit-geography.mjs', 'tools/lib/georeference.mjs'];
const expectedAxes = 'x east, y up, z south; metres; river 0 m, island 2 m';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const validNumber = value => typeof value === 'number' && Number.isFinite(value);
const round = value => {
  if (!validNumber(value) || !Number.isFinite(value * 1000)) throw new RangeError('Audit value cannot be represented as finite millimetres.');
  return Math.round(value * 1000) / 1000;
};
function point(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(validNumber)) {
    throw new TypeError(`Invalid map point: ${label}`);
  }
  return value;
}
function lines(items, label) {
  if (!Array.isArray(items)) throw new TypeError(`Missing ${label}`);
  return items.flatMap((item, i) => {
    if (!Array.isArray(item.points) || item.points.length < 2) throw new TypeError(`Invalid ${label}[${i}]`);
    return item.points.map((p, j) => point(p, `${label}[${i}].points[${j}]`));
  });
}
function differenceSummary(points) {
  const values = points.map(([x, z]) => conversionDiscrepancy({x, z})).sort((a, b) => a - b);
  if (!values.length) return {sampledVertices: 0, medianM: null, p95M: null, maximumM: null};
  const middle = Math.floor(values.length / 2);
  return {
    sampledVertices: values.length,
    medianM: round(values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2),
    p95M: round(values[Math.ceil(values.length * .95) - 1]),
    maximumM: round(values.at(-1)),
  };
}

export function auditGeography(park, districts) {
  if (!Array.isArray(park.origin) || park.origin.length !== 2 || park.origin[0] !== DEFAULT_ORIGIN.longitude
    || park.origin[1] !== DEFAULT_ORIGIN.latitude) throw new Error('Map origin changed; review the audit reference frame.');
  if (park.axes !== expectedAxes) throw new Error('Map axes changed; review the audit reference frame.');
  const parkPoints = [...lines(park.roads, 'park.roads'), ...lines(park.buildings, 'park.buildings')];
  const districtPoints = [...lines(districts.roads, 'districts.roads'), ...lines(districts.buildings, 'districts.buildings')];
  for (const key of ['island', 'mainland', 'shoreline']) {
    if (!Array.isArray(park[key])) throw new TypeError(`Missing park.${key}`);
    parkPoints.push(...park[key].map((p, i) => point(p, `park.${key}[${i}]`)));
  }
  const allRoads = [...park.roads, ...districts.roads];
  if (allRoads.some(r => !validNumber(r.width) || r.width <= 0)) throw new Error('Invalid road width.');
  const allBuildings = [...park.buildings, ...districts.buildings];
  if (allBuildings.some(b => !validNumber(b.height) || b.height <= 0)) throw new Error('Invalid rendered building height.');
  const documentedWidths = park.roads.filter(r => Object.hasOwn(r, 'sourceWidth'));
  if (documentedWidths.some(r => !validNumber(r.sourceWidth) || r.sourceWidth <= 0)) throw new Error('Invalid recorded source road width.');
  const authoredWidths = documentedWidths.filter(r => Math.abs(r.width - r.sourceWidth) > 1e-6);
  const cityBuildings = districts.buildings.filter(b => String(b.id).startsWith('detroit-'));
  const cityRoads = districts.roads.filter(r => String(r.id).startsWith('city-'));
  const bridgeA = point(park.bridge?.a, 'bridge.a'), bridgeB = point(park.bridge?.b, 'bridge.b');
  const enu = p => geodeticToLocal({...legacyToGeo({x: p[0], z: p[1]}), ellipsoidalHeightM: 0});
  const a = enu(bridgeA), b = enu(bridgeB);
  const grid = districts.grid;
  if (!grid || !Number.isInteger(grid.nx) || !Number.isInteger(grid.nz) || grid.nx < 2 || grid.nz < 2
    || !validNumber(grid.x0) || !validNumber(grid.z0)
    || !validNumber(grid.step) || grid.step <= 0 || !Array.isArray(grid.heights)
    || grid.heights.length !== grid.nx * grid.nz || !grid.heights.every(validNumber)) throw new Error('Invalid district terrain grid.');
  return {
    schema: 'greater-detroit-geographic-audit/v1',
    scope: 'Inventory of existing source-map records and mathematical coordinate comparison; no surveyed checkpoints or visual acceptance.',
    geographicAccuracyCertified: false,
    independentSurveyCheckpoints: 0,
    runtimeCoordinateFrame: {origin: park.origin, axes: park.axes, horizontalMethod: '111320 metres per degree, longitude scaled by cosine of origin latitude', verticalDatum: 'Game-relative river 0 m / island 2 m; not NAVD88 or ellipsoidal height'},
    counts: {parkRoadRecords: park.roads.length, districtRoadRecords: districts.roads.length, parkBuildingRecords: park.buildings.length, districtBuildingRecords: districts.buildings.length},
    roads: {
      parkRecordsWithSourceWidth: documentedWidths.length,
      parkRecordsDifferentFromSourceWidth: authoredWidths.length,
      maximumAbsoluteWidthAdjustmentM: authoredWidths.length ? round(Math.max(...authoredWidths.map(r => Math.abs(r.width - r.sourceWidth)))) : 0,
      districtMunicipalRoadRecords: cityRoads.length,
      districtMunicipalWidthValuesM: [...new Set(cityRoads.map(r => r.width))].sort((a, b) => a - b),
      interpretation: 'sourceWidth records preserve earlier imported/derived width, not necessarily survey measurements. build-mainland.mjs assigns municipal road widths by name. Preserve gameplay clearance until a separately tested road/collision migration.',
    },
    buildings: {
      districtCityFootprintRecords: cityBuildings.length,
      districtCityRecordsUsing6_8mHeight: cityBuildings.filter(b => b.height === 6.8).length,
      recordsWithoutHeightEvidence: allBuildings.filter(b => !b.heightEvidence && !b.heightSource && !b.heightMethod).length,
      interpretation: 'The current generator assigns 6.8 m to added City footprints. Missing per-building height evidence does not mean every other height is invented; it means this audit cannot certify its provenance.',
    },
    terrain: {
      districtGrid: {x0: grid.x0, z0: grid.z0, nx: grid.nx, nz: grid.nz, stepM: grid.step, samples: grid.heights.length},
      interpretation: 'Elmwood grid is resampled into the game-relative frame. Jefferson mainland is rendered separately at a constant game elevation. No absolute vertical datum is established by this grid.',
    },
    projectionModelComparison: {
      reference: 'WGS84 ECEF to local ENU; both geographic input and origin use ellipsoidal height 0 for the horizontal comparison only.',
      interpretation: 'Coordinate-model difference reconstructed from existing map points, NOT real-world positional error, independent survey residual, correction offsets, or a reason to move only one district.',
      sampling: 'Existing road/building/outline vertices, including repeated ring endpoints; not uniformly spaced spatial samples. Median averages the middle pair; p95 uses nearest rank.',
      park: differenceSummary(parkPoints),
      districts: differenceSummary(districtPoints),
    },
    bridge: {
      legacyEndpointDistanceM: round(Math.hypot(bridgeB[0] - bridgeA[0], bridgeB[1] - bridgeA[1])),
      enuHorizontalEndpointDistanceM: round(Math.hypot(b.eastM - a.eastM, b.northM - a.northM)),
      interpretation: 'Distances between current authored endpoints; neither establishes measured bridge deck length or grade.',
    },
    nextEvidence: [
      'Independent control locations with source, acquisition date, horizontal uncertainty and CRS.',
      'Ground DEM tiles with actual delivered horizontal/vertical CRS, units, datum transform and coverage.',
      'Building-specific roof height, facade and footprint observations with rights to reuse source imagery.',
      'Measured road widths, curb lines, bridge deck and shore/seawall geometry separated from ground.',
      'Matched camera captures plus unchanged collision, accessibility and native performance acceptance.',
    ],
  };
}

export async function createAudit() {
  const inputs = {};
  for (const [name, path] of Object.entries(inputPaths)) {
    const bytes = await readFile(resolve(project, path));
    inputs[name] = {path, bytes, sha256: sha256(bytes)};
  }
  const analysisFiles = [];
  for (const path of analysisPaths) analysisFiles.push({path, sha256: sha256(await readFile(resolve(project, path)))});
  let baseRevision = null;
  try { baseRevision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: project, encoding: 'utf8'}).trim(); } catch { /* Input hashes still identify the exact map. */ }
  return {
    ...auditGeography(JSON.parse(inputs.park.bytes), JSON.parse(inputs.districts.bytes)),
    provenance: {
      baseRevision,
      inputFiles: Object.fromEntries(Object.entries(inputs).map(([name, value]) => [name, {path: value.path, sha256: value.sha256}])),
      analysisFiles,
      note: 'The input hashes identify the inspected bytes; baseRevision alone does not assert a clean working tree.',
    },
  };
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node tools/audit-geography.mjs [--out NEW_REPORT.json]\nReads the existing map only. No network or runtime changes.');
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Use --help for supported arguments.');
  const report = JSON.stringify(await createAudit(), null, 2) + '\n';
  if (!args.length) { process.stdout.write(report); return; }
  const output = resolve(args[1]);
  if (Object.values(inputPaths).some(path => resolve(project, path) === output)) throw new Error('Cannot overwrite an audit input.');
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, report, {flag: 'wx'});
  console.log(`Geographic inventory written to ${output}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
