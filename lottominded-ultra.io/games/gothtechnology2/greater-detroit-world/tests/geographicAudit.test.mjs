import test from 'node:test';
import assert from 'node:assert/strict';
import {auditGeography, createAudit} from '../tools/audit-geography.mjs';

function fixture() {
  return {
    park: {origin: [-83.00175, 42.34680], axes: 'x east, y up, z south; metres; river 0 m, island 2 m', island: [[0, 0]], mainland: [[0, 0]], shoreline: [[0, 0]], roads: [
      {id: 'widened', width: 6.8, sourceWidth: 5, points: [[0, 0], [10, 0]]},
      {id: 'unchanged', width: 5, sourceWidth: 5, points: [[10, 0], [10, 10]]},
      {id: 'unspecified', width: 5, points: [[10, 10], [0, 10]]},
    ], buildings: [{id: 'height-with-evidence', height: 10, heightEvidence: 'fixture', points: [[1, 1], [2, 1], [2, 2], [1, 1]]}], bridge: {a: [0, 0], b: [10, 0]}},
    districts: {roads: [{id: 'city-a', width: 8, points: [[0, 0], [10, 0]]}], buildings: [
      {id: 'detroit-a', height: 6.8, points: [[1, 1], [2, 1], [2, 2], [1, 1]]},
      {id: 'other-a', height: 6.8, points: [[4, 4], [5, 4], [5, 5], [4, 4]]},
    ], grid: {x0: 0, z0: 0, nx: 2, nz: 2, step: 8, heights: [0, 0, 0, 0]}},
  };
}

test('inventory separates authored width, absent evidence, and municipal default heights', () => {
  const {park, districts} = fixture(), report = auditGeography(park, districts);
  assert.equal(report.roads.parkRecordsWithSourceWidth, 2);
  assert.equal(report.roads.parkRecordsDifferentFromSourceWidth, 1);
  assert.equal(report.roads.maximumAbsoluteWidthAdjustmentM, 1.8);
  assert.equal(report.buildings.districtCityFootprintRecords, 1);
  assert.equal(report.buildings.districtCityRecordsUsing6_8mHeight, 1);
  assert.equal(report.buildings.recordsWithoutHeightEvidence, 2);
  assert.equal(report.geographicAccuracyCertified, false);
  assert.equal(report.independentSurveyCheckpoints, 0);
  assert.match(report.projectionModelComparison.interpretation, /NOT real-world positional error/);
});
test('origin drift, invalid positions, malformed grids and recorded zero width fail rather than yielding a reassuring report', () => {
  for (const mutate of [
    f => { f.park.origin[0] = -83; },
    f => { f.park.origin.push(0); },
    f => { f.park.axes = 'x north, y up, z east'; },
    f => { delete f.park.axes; },
    f => { f.park.roads[0].points[0][0] = NaN; },
    f => { f.park.roads[0].sourceWidth = 0; },
    f => { f.districts.grid.heights.pop(); },
    f => { f.districts.grid.step = -8; },
    f => { f.districts.grid.x0 = NaN; },
    f => { f.park.roads[0].width = 1e308; },
  ]) {
    const data = fixture(); mutate(data);
    assert.throws(() => auditGeography(data.park, data.districts));
  }
});
test('real map audit reports hashes and never calls an internal round trip independent survey evidence', async () => {
  const report = await createAudit();
  assert.equal(report.independentSurveyCheckpoints, 0);
  assert.equal(report.geographicAccuracyCertified, false);
  assert.ok(report.counts.parkRoadRecords > 0);
  assert.ok(report.projectionModelComparison.park.sampledVertices > report.counts.parkRoadRecords);
  for (const file of Object.values(report.provenance.inputFiles)) assert.match(file.sha256, /^[a-f0-9]{64}$/);
  assert.equal(report.provenance.analysisFiles.length, 2);
  for (const file of report.provenance.analysisFiles) assert.match(file.sha256, /^[a-f0-9]{64}$/);
  assert.match(report.terrain.interpretation, /No absolute vertical datum/);
});
