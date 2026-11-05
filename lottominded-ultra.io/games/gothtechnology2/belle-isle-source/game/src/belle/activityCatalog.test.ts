import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {ParkTerrain, inside, segment} from './terrain.ts';
import type {ParkMap} from './terrain.ts';
import {
  createDispatchStops, registerPhotoSubjects, DISPATCH_CLEARANCE_METRES,
  DISPATCH_HUB_APPROACH_METRES, DISPATCH_LANDMARK_APPROACH_METRES,
  DISPATCH_STOP_SEPARATION_METRES,
} from './activityCatalog.ts';
import {createDispatchContracts} from './dispatchRules.ts';

// Use the actual shipped map, including in a sparse source checkout. git show is
// read-only and only needed when public assets have not yet been materialized.
const mapUrl = new URL('../../public/belle/map.json', import.meta.url);
const data = JSON.parse(existsSync(mapUrl) ? readFileSync(mapUrl, 'utf8') : execFileSync('git', [
  'show', 'origin/main:lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/public/belle/map.json',
], {cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024})) as ParkMap;
const terrain = new ParkTerrain(data);

test('actual-map dispatch anchors stay on clear island paths at real terrain height', () => {
  const catalog = createDispatchStops(data, terrain);
  assert.equal(catalog.stops.length, 5);
  assert.equal(catalog.hub.id, 'dispatch-hub');
  assert(Math.hypot(catalog.hub.x - data.bridge.b[0], catalog.hub.z - data.bridge.b[1]) <= DISPATCH_HUB_APPROACH_METRES);
  assert(Math.hypot(catalog.hub.x - data.spawn.x, catalog.hub.z - data.spawn.z) > 500, 'the hub must not be the mainland spawn');
  for (const stop of [catalog.hub, ...catalog.stops]) {
    assert(inside(stop.x, stop.z, data.island), stop.name);
    assert(terrain.land(stop.x, stop.z), stop.name);
    assert(!terrain.obstructed(stop.x, stop.z, DISPATCH_CLEARANCE_METRES), stop.name);
    assert.equal(stop.y, terrain.height(stop.x, stop.z));
    assert(data.roads.some(road => road.points.slice(1).some((point, i) => segment(stop.x, stop.z, road.points[i], point).d < 1e-6)), `${stop.name} must lie on a mapped path segment`);
  }
  for (const stop of catalog.stops) {
    const landmark = data.landmarks.find(item => item.id === stop.id)!;
    assert(landmark);
    assert.equal(stop.name, landmark.name);
    assert(Math.hypot(stop.x - landmark.x, stop.z - landmark.z) <= DISPATCH_LANDMARK_APPROACH_METRES);
  }
  const anchors = [catalog.hub, ...catalog.stops];
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) {
    assert.notEqual(anchors[i].id, anchors[j].id);
    assert(Math.hypot(anchors[i].x - anchors[j].x, anchors[i].z - anchors[j].z) >= DISPATCH_STOP_SEPARATION_METRES);
  }
  assert.equal(createDispatchContracts(catalog).length, 5, 'the real anchors must support the launch contract set');
  assert(Math.hypot(catalog.stops[0].x - catalog.hub.x, catalog.stops[0].z - catalog.hub.z) < 1000, 'First Drop must not begin with a mainland crossing');
});

test('missing landmarks are omitted, Nature Center is a fallback, and unavailable catalogs fail clearly', () => {
  const withoutLighthouse = {...data, landmarks: data.landmarks.filter(item => item.id !== '107208288')};
  const fallback = createDispatchStops(withoutLighthouse, terrain);
  assert.equal(fallback.stops.length, 5);
  assert(fallback.stops.some(stop => stop.id === '368859182'));
  assert(!fallback.stops.some(stop => stop.id === '107208288'));
  const three = {...data, landmarks: data.landmarks.filter(item => ['106948123', '107227742', '659605208'].includes(item.id))};
  assert.equal(createDispatchStops(three, terrain).stops.length, 3);
  assert.throws(() => createDispatchStops({...three, landmarks: three.landmarks.slice(0, 2)}, terrain), /at least three/);
  assert.throws(() => createDispatchStops({...data, roads: []}, terrain), /no clear island path/);
});

test('each sampled candidate is revalidated so an obstructed former stop moves to another safe path point', () => {
  const original = createDispatchStops(data, terrain).stops[0];
  const changedTerrain = new ParkTerrain(data);
  const actualObstructed = changedTerrain.obstructed.bind(changedTerrain);
  changedTerrain.obstructed = (x, z, margin = 0) => Math.hypot(x - original.x, z - original.z) < 12 || actualObstructed(x, z, margin);
  const updated = createDispatchStops(data, changedTerrain).stops.find(stop => stop.id === original.id)!;
  assert(updated);
  assert(Math.hypot(updated.x - original.x, updated.z - original.z) >= 12);
  assert(!changedTerrain.obstructed(updated.x, updated.z, DISPATCH_CLEARANCE_METRES));
});

function modelMesh(name: string, material = new T.MeshBasicMaterial()): T.Mesh {
  const mesh = new T.Mesh(new T.BoxGeometry(2, 4, 6), material);
  mesh.name = name;
  return mesh;
}

test('photo subjects contain real prefixed mesh groups and exclude missing models, helpers and invisible materials', () => {
  const scene = new T.Scene();
  const casino = modelMesh('106948123_Casino_buff_masonry');
  const roof = modelMesh('106948123_Casino_roof');
  const fountain = modelMesh('9146545_Fountain_stone');
  const invisible = modelMesh('107227742_Invisible_marker', new T.MeshBasicMaterial({transparent: true, opacity: 0}));
  const helper = modelMesh('107205459_Activity_target');
  helper.userData.activityMarker = true;
  const replacement = modelMesh('9146545_Old_spray');
  replacement.userData.staticSprayReplaced = true;
  const wrongPrefix = modelMesh('1069481239_Unrelated_building');
  const empty = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial());
  empty.name = '107310050_Empty_model';
  scene.add(casino, roof, fountain, invisible, helper, replacement, wrongPrefix, empty, modelMesh('unmapped_Architecture'));
  const subjects = registerPhotoSubjects(scene, data);
  assert.deepEqual(new Set(subjects.map(subject => subject.id)), new Set(['106948123', '9146545']));
  assert.deepEqual(subjects.find(subject => subject.id === '106948123')?.meshes, [casino, roof]);
  assert.equal(subjects.find(subject => subject.id === '9146545')?.label, 'James Scott Memorial Fountain');
  assert.equal(scene.children.length, 9, 'registration must not create synthetic target geometry');
});

test('photo registration updates full parent transforms and retains real meshes hidden temporarily by distance culling', () => {
  const scene = new T.Scene(), parent = new T.Group();
  parent.position.set(100, 5, 200);
  parent.scale.set(2, 3, 4);
  const mesh = modelMesh('659605208_Carillon_stone');
  mesh.position.set(10, 2, -5);
  mesh.visible = false; // world.update uses this for distant, still-existing architecture.
  parent.add(mesh);
  scene.add(parent);
  const subjects = registerPhotoSubjects(scene, data);
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].meshes[0], mesh);
  const bounds = mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox!);
  const worldBounds = bounds.clone().applyMatrix4(mesh.matrixWorld);
  assert.deepEqual(worldBounds.getCenter(new T.Vector3()).toArray(), [120, 11, 180]);
  assert.deepEqual(worldBounds.getSize(new T.Vector3()).toArray(), [4, 12, 24]);
  assert.equal(mesh.visible, false, 'registration must not defeat world distance culling');
});
