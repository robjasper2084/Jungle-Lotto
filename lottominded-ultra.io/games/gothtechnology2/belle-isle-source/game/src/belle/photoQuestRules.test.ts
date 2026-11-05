import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { scorePhotoQuest, type PhotoQuestObservation } from './photoQuestRules.ts';
import { evaluatePhotoSubject } from './photoQuestScene.ts';

const clear: PhotoQuestObservation = { available: true, inFront: true, bounds: { left: .25, top: .25, right: .75, bottom: .75 }, subjectSamples: 9, visibleSamples: 9, cameraHeight: 20 };
test('clear, well-framed real subject qualifies and the result is immutable', () => {
  const score = scorePhotoQuest(clear);
  assert.equal(score.valid, true);
  assert.ok(score.score >= 95);
  assert.ok(Object.isFrozen(score));
});
test('behind, off-frame, partially cut-off and hidden subjects do not qualify', () => {
  assert.equal(scorePhotoQuest({ ...clear, inFront: false }).reason, 'behind');
  assert.equal(scorePhotoQuest({ ...clear, bounds: { left: 1.1, top: .2, right: 1.4, bottom: .7 } }).reason, 'out-of-frame');
  assert.equal(scorePhotoQuest({ ...clear, bounds: { left: -.3, top: .2, right: .4, bottom: .7 } }).reason, 'cut-off');
  assert.equal(scorePhotoQuest({ ...clear, available: false }).valid, false);
  assert.equal(scorePhotoQuest({ ...clear, nearClipped: true }).valid, false);
});
test('coverage, occlusion and altitude requirements cannot be overridden by framing', () => {
  assert.equal(scorePhotoQuest(clear, { minCoverage: .3 }).reason, 'too-small');
  assert.equal(scorePhotoQuest(clear, { desiredCoverage: [.05, .2] }).reason, 'too-large');
  assert.equal(scorePhotoQuest({ ...clear, visibleSamples: 6 }).reason, 'occluded');
  assert.equal(scorePhotoQuest({ ...clear, subjectSamples: 0, visibleSamples: 0 }).reason, 'occluded');
  assert.equal(scorePhotoQuest(clear, { aerialMinHeight: 25 }).reason, 'too-low');
  assert.equal(scorePhotoQuest(clear, { desiredCoverage: [.2, .4], aerialMinHeight: 15 }).valid, true);
});
test('qualifying composition scores distinguish a small edge view from a centered view', () => {
  const weak = scorePhotoQuest({ ...clear, bounds: { left: .79, top: .79, right: .99, bottom: .99 }, visibleSamples: 7 });
  assert.equal(weak.valid, true);
  assert.ok(weak.score >= 55 && weak.score < 75);
  assert.ok(scorePhotoQuest(clear).score >= 95);
});
test('non-finite measurements and invalid sample counts fail safely', () => {
  assert.equal(scorePhotoQuest({ ...clear, bounds: { ...clear.bounds, left: NaN } }).valid, false);
  assert.equal(scorePhotoQuest({ ...clear, visibleSamples: Infinity }).valid, false);
  assert.equal(scorePhotoQuest({ ...clear, visibleSamples: 10 }).valid, false);
});

function fixture() {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, .1, 100);
  const subjectMesh = new T.Mesh(new T.BoxGeometry(4, 4, 2), new T.MeshBasicMaterial());
  subjectMesh.position.z = -10;
  scene.add(subjectMesh, camera);
  scene.updateMatrixWorld(true);
  const subject = { id: 'landmark', label: 'Landmark', meshes: [subjectMesh] };
  const crop = { x: 0, y: 0, width: 1000, height: 1000, canvasWidth: 1000, canvasHeight: 1000 };
  const evaluate = () => evaluatePhotoSubject(subject, camera, scene, { crop, minCoverage: .02 });
  return { scene, camera, subjectMesh, subject, crop, evaluate };
}
test('scene adapter scores rendered geometry and rejects objects behind the camera', () => {
  const f = fixture();
  assert.equal(f.evaluate().valid, true);
  f.subjectMesh.position.z = 10; f.scene.updateMatrixWorld(true);
  assert.equal(f.evaluate().reason, 'behind');
});
test('actual crop and lens projection control the saved composition', () => {
  const f = fixture();
  assert.equal(f.evaluate().valid, true);
  f.crop.x = 750; f.crop.width = 250;
  assert.equal(f.evaluate().reason, 'out-of-frame');
  f.crop.x = 500; f.crop.width = 500;
  assert.equal(f.evaluate().reason, 'cut-off');
  f.crop.x = 0; f.crop.width = 1000;
  f.camera.fov = 10; f.camera.updateProjectionMatrix();
  assert.equal(f.evaluate().reason, 'cut-off');
});
test('solid occluders block a photograph; ignored ancestors and hidden meshes do not', () => {
  const f = fixture();
  const group = new T.Group();
  const wall = new T.Mesh(new T.BoxGeometry(6, 6, 1), new T.MeshBasicMaterial());
  wall.position.z = -5; group.add(wall); f.scene.add(group); f.scene.updateMatrixWorld(true);
  assert.equal(f.evaluate().reason, 'occluded');
  group.userData.photoQuestIgnore = true;
  assert.equal(f.evaluate().valid, true);
  group.userData.photoQuestIgnore = false; group.visible = false;
  assert.equal(f.evaluate().valid, true);
  f.subjectMesh.visible = false;
  assert.equal(f.evaluate().reason, 'unavailable');
});
test('evaluation reads current matrices without moving the scene or editing geometry', () => {
  const f = fixture();
  const before = f.subjectMesh.matrixWorld.toArray();
  assert.equal(f.subjectMesh.geometry.boundingBox, null);
  f.evaluate();
  assert.deepEqual(f.subjectMesh.matrixWorld.toArray(), before);
  assert.equal(f.subjectMesh.geometry.boundingBox, null);
});
test('translated instances occlude at their rendered positions, and moved instance bounds are refreshed', () => {
  const f = fixture();
  const wall = new T.InstancedMesh(new T.BoxGeometry(6, 6, 1), new T.MeshBasicMaterial(), 1);
  wall.position.x = 20;
  wall.setMatrixAt(0, new T.Matrix4().makeTranslation(-20, 0, -5));
  wall.instanceMatrix.needsUpdate = true;
  f.scene.add(wall); f.scene.updateMatrixWorld(true);
  assert.equal(f.evaluate().reason, 'occluded');
  wall.setMatrixAt(0, new T.Matrix4().makeTranslation(0, 0, -5));
  wall.instanceMatrix.needsUpdate = true;
  wall.boundingSphere = null;
  assert.equal(f.evaluate().valid, true);
});
