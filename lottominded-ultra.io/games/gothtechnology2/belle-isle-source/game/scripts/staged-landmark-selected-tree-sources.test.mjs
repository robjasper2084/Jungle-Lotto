import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { TreeInstanceVisibility, copySelectedTreeSource } from "../src/belle/farTreeVisibility.ts";
import { readStagedViewBounds } from "../src/belle/stagedLandmarkViewBounds.ts";
import { createExteriorViewScorer } from "./staged-landmark-exterior-view-advice.mjs";
const bounds = { min: [-5, 2, -5], max: [5, 20, 5], center: [0, 11, 0] };
function view(z) {
  const camera = new T.PerspectiveCamera(60, 1.6, 0.1, 1e3);
  camera.position.set(0, 3.55, z);
  camera.lookAt(0, 8, 0);
  camera.updateMatrixWorld(true);
  return camera;
}
function fixture(pool = "far", positions = [40, -40]) {
  const scene = new T.Scene(), root = new T.Group(), target = new T.LOD();
  scene.add(root);
  root.add(target);
  target.name = "107310050_STAGED_LODS";
  const meshes = [new T.BoxGeometry(1, 15, 1).translate(0, 7.5, 0), new T.BoxGeometry(14, 30, 4).translate(0, 15, 0)].map((geometry, part) => {
    const mesh = new T.InstancedMesh(geometry, new T.MeshBasicMaterial({ side: T.DoubleSide }), positions.length);
    mesh.name = pool + " source " + part;
    geometry.setAttribute("lodWeight", new T.InstancedBufferAttribute(new Float32Array(positions.length).fill(0.5), 1));
    geometry.setAttribute("canopyDensity", new T.InstancedBufferAttribute(new Float32Array(positions.length).fill(0.8), 1));
    positions.forEach((z, i) => {
      mesh.setMatrixAt(i, new T.Matrix4().makeTranslation(0, 0, z));
      mesh.setColorAt(i, new T.Color(i ? 0.4 : 0.2, 0.3, 0.5));
    });
    scene.add(mesh);
    return mesh;
  });
  scene.updateMatrixWorld(true);
  const helper = new TreeInstanceVisibility(meshes, void 0, pool);
  helper.capture();
  return { scene, root, target, meshes, helper };
}
function state(f) {
  const helper = f.helper;
  return { sourceCount: helper.count, shown: helper.shown, ready: helper.ready, indices: Array.from(helper.indices), bounds: Array.from(helper.bounds), saved: helper.parts.map((p) => ({ world: Array.from(p.world), streams: p.streams.map((s) => Array.from(s.source)) })), meshes: f.meshes.map((m) => ({ count: m.count, world: m.matrixWorld.toArray(), matrix: m.matrix.toArray(), visible: m.visible, layers: m.layers.mask, sphere: m.boundingSphere ? { center: m.boundingSphere.center.toArray(), radius: m.boundingSphere.radius } : null, attributes: [m.instanceMatrix, m.instanceColor, ...Object.values(m.geometry.attributes)].map((a) => ({ array: Array.from(a.array), version: a.version, ranges: a.updateRanges?.map((r) => ({ ...r })) })), index: Array.from(m.geometry.index.array), geometryBox: m.geometry.boundingBox ? { min: m.geometry.boundingBox.min.toArray(), max: m.geometry.boundingBox.max.toArray() } : null, geometrySphere: m.geometry.boundingSphere ? { center: m.geometry.boundingSphere.center.toArray(), radius: m.geometry.boundingSphere.radius } : null })) };
}
test("prospective bounds retain off-camera source trees without changing their rendered prefix or saved streams", () => {
  for (const pool of ["near", "far"]) {
    const f = fixture(pool, [40]), guide = view(20), future = view(60);
    assert.equal(f.helper.render(guide), 0);
    const before = state(f);
    const observed = readStagedViewBounds(f.root, "107310050", guide, bounds);
    assert.deepEqual(state(f), before);
    assert.equal(observed.currentRenderedTreeInstances, 0);
    assert.equal(observed.selectedTreePools, 2);
    assert.equal(observed.selectedTreeInstances, 2);
    assert.equal(observed.selectedTreeMatrixElements, 32);
    assert.equal(createExteriorViewScorer(observed)(future.position.toArray()).blockedSamples, 27, "An empty current-view prefix must not make a future view falsely clear");
    f.helper.render(future);
    assert.equal(f.meshes[0].count, 1);
    const actual = readStagedViewBounds(f.root, "107310050", future, bounds);
    assert.deepEqual(actual.boxes, observed.boxes);
    assert.equal(createExteriorViewScorer(actual)(future.position.toArray()).blockedSamples, 27);
  }
});
test("source indices and copied matrices survive compaction, independent callers, new captures and empty selection", () => {
  const f = fixture(), guide = view(20);
  f.helper.render(guide);
  assert.equal(f.meshes[0].count, 1);
  const before = state(f), first = copySelectedTreeSource(f.meshes[0]);
  assert.equal(first.count, 2);
  assert.equal(first.matrices[14], 40);
  assert.equal(first.matrices[30], -40);
  assert.deepEqual(state(f), before);
  first.matrices[14] = 900;
  assert.equal(copySelectedTreeSource(f.meshes[0]).matrices[14], 40, "Only the caller-owned copy can change");
  assert.deepEqual(state(f), before);
  for (const mesh of f.meshes) {
    mesh.count = 1;
    mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(12, 0, 80));
  }
  f.helper.capture();
  assert.equal(copySelectedTreeSource(f.meshes[0]).matrices[12], 12);
  assert.equal(copySelectedTreeSource(f.meshes[0]).matrices[14], 80);
  assert.equal(first.matrices[30], -40);
  for (const mesh of f.meshes) mesh.count = 0;
  f.helper.capture();
  assert.equal(copySelectedTreeSource(f.meshes[0]).count, 0);
  assert.equal(copySelectedTreeSource(f.meshes[0]).matrices.length, 0);
});
test("selected-source snapshots fail closed before copying beyond the original instance allowance", () => {
  const f = fixture(), before = state(f);
  assert.throws(() => copySelectedTreeSource(f.meshes[0], 1), /bounded selected tree sources/);
  assert.deepEqual(state(f), before);
  for (const maximum of [-1, 40001, 1.2, NaN, Infinity]) assert.throws(() => copySelectedTreeSource(f.meshes[0], maximum), /Invalid bounded tree source allowance/);
  const ordinary = new T.InstancedMesh(new T.BoxGeometry(), new T.MeshBasicMaterial(), 1);
  assert.equal(copySelectedTreeSource(ordinary), null);
  new TreeInstanceVisibility([ordinary]);
  assert.throws(() => copySelectedTreeSource(ordinary), /not ready/);
});
test("source advice preserves scene visibility, camera layers, target self-exclusion and world transforms", () => {
  const f = fixture("far", [40]), camera = view(20);
  f.helper.render(camera);
  f.meshes[0].visible = false;
  f.meshes[1].layers.set(1);
  assert.equal(readStagedViewBounds(f.root, "107310050", camera, bounds).boxes.length, 0);
  f.meshes[0].visible = true;
  f.meshes[1].layers.set(0);
  f.target.add(f.meshes[0]);
  f.meshes[1].position.x = 9;
  f.scene.updateMatrixWorld(true);
  const before = state(f), observed = readStagedViewBounds(f.root, "107310050", camera, bounds);
  assert.deepEqual(state(f), before);
  assert.equal(observed.selectedTreeInstances, 1);
  assert.equal(observed.boxes.length, 1);
  assert.equal(observed.boxes[0].uuid, f.meshes[1].uuid);
  assert.equal(observed.boxes[0].min[0], 2);
  assert.equal(observed.boxes[0].max[0], 16);
  f.meshes[1].material.visible = false;
  assert.equal(readStagedViewBounds(f.root, "107310050", camera, bounds).boxes.length, 0);
});
