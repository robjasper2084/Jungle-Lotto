import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createOwnedSceneRoot, disposeOwnedScene, SceneVisibilityUnion } from './ownedScene.ts';
import { setPreviewTrafficFocus, clearPreviewTrafficFocus, previewTrafficDistance, previewTrafficObservers } from './swoopTrafficFocus.ts';
import { DistrictViewHolds } from './swoopViewHolds.ts';
import { SwoopStageError, describeSwoopLoadError } from './swoopLoadError.ts';

test('source image failures identify their preparation stage, original URL and cause', () => {
  const event = { type: 'error', target: { currentSrc: '', src: '/__swoop-assets__/textures/cut/brick.jpg' } };
  const error = new SwoopStageError('scenery', event);
  assert.equal(error.stage, 'scenery');
  assert.equal(error.cause, event);
  assert.equal(error.message, 'Source stage "scenery" failed: Asset load error: /__swoop-assets__/textures/cut/brick.jpg');
  assert.equal(describeSwoopLoadError(new Error('HTTP 404')), 'HTTP 404');
  assert.equal(describeSwoopLoadError({ type: 'error', currentTarget: { responseURL: '/__swoop-assets__/exports/original.glb' } }), 'Asset load error: /__swoop-assets__/exports/original.glb');
});

test('deferred district attachment isolates source materials from host construction and preserves its final transform', () => {
  const host = new T.Scene();
  const transform = new T.Matrix4().makeRotationY(.8).setPosition(120, 2, -900);
  const district = createOwnedSceneRoot(host, { name: 'source', matrix: transform.elements, deferAttachment: true });
  const material = new T.MeshStandardMaterial({ color: '#7c6457' });
  const mesh = new T.Mesh(new T.BoxGeometry(), material); mesh.position.set(7, 3, -11); district.add(mesh);
  district.updateWorldMatrix(true, true);
  const originalPosition = mesh.getWorldPosition(new T.Vector3());
  const originalColor = material.color.clone();
  host.traverse(object => { if (object instanceof T.Mesh) (object.material as T.MeshStandardMaterial).color.set('#ff0000'); });
  assert.equal(district.parent, null);
  assert.equal(material.color.equals(originalColor), true);
  assert.equal(originalPosition.distanceTo(new T.Vector3(7, 3, -11).applyMatrix4(transform)), 0);
  host.add(district); host.updateMatrixWorld(true);
  assert.equal(mesh.getWorldPosition(new T.Vector3()).distanceTo(originalPosition), 0);
  assert.equal(district.parent, host);
  const normal = createOwnedSceneRoot(host, { name: 'normal', matrix: transform.elements });
  assert.equal(normal.parent, host, 'default attachment behavior remains immediate');
});

test('district disposal preserves host-shared GPU resources and releases owned instances once', () => {
  const host = new T.Scene(), district = new T.Group(); host.add(district);
  const sharedGeometry = new T.BoxGeometry(), sharedTexture = new T.Texture(), sharedMaterial = new T.MeshStandardMaterial({ map: sharedTexture });
  const hostMesh = new T.Mesh(sharedGeometry, sharedMaterial); host.add(hostMesh);
  district.add(new T.Mesh(sharedGeometry, sharedMaterial));
  const geometry = new T.SphereGeometry(), texture = new T.Texture(), material = new T.MeshBasicMaterial({ map: texture });
  district.add(new T.Mesh(geometry, material), new T.Mesh(geometry, material));
  let sharedDisposals = 0, geometryDisposals = 0, materialDisposals = 0, textureDisposals = 0;
  for (const resource of [sharedGeometry, sharedTexture, sharedMaterial]) resource.addEventListener('dispose', () => { sharedDisposals++; });
  geometry.addEventListener('dispose', () => { geometryDisposals++; });
  material.addEventListener('dispose', () => { materialDisposals++; });
  texture.addEventListener('dispose', () => { textureDisposals++; });
  disposeOwnedScene(district, new Set([sharedGeometry, sharedTexture, sharedMaterial]));
  assert.equal(district.parent, null);
  assert.deepEqual(host.children, [hostMesh]);
  assert.equal(sharedDisposals, 0);
  assert.deepEqual([geometryDisposals, materialDisposals, textureDisposals], [1, 1, 1]);
  assert.equal(district.children.length, 0);
});

test('pooled multi-view visibility resets each frame and includes newly streamed objects', () => {
  const root = new T.Group(), mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  const instances = new T.InstancedMesh(mesh.geometry, mesh.material, 12);
  root.add(mesh, instances);
  const union = new SceneVisibilityUnion();
  union.begin();
  mesh.visible = true; mesh.castShadow = false; instances.count = 2;
  union.include(root);
  mesh.visible = false; mesh.castShadow = true; instances.count = 7;
  union.include(root);
  union.apply();
  assert.deepEqual([mesh.visible, mesh.castShadow, instances.count], [true, true, 7]);
  const initialAllocations = union.allocatedRecords;
  assert.equal(initialAllocations, 3);

  union.begin();
  mesh.visible = mesh.castShadow = false; instances.count = 0;
  union.include(root); union.include(root); union.apply();
  assert.deepEqual([mesh.visible, mesh.castShadow, instances.count], [false, false, 0], 'last frame must not keep a tile or shadow alive');
  assert.equal(union.allocatedRecords, initialAllocations, 'stable scene reuses all union records');

  union.begin();
  union.include(root);
  const streamed = new T.Group(); streamed.visible = true; root.add(streamed);
  mesh.removeFromParent();
  union.include(root);
  streamed.visible = false;
  union.apply();
  assert.equal(streamed.visible, true, 'a late source asset participates in the same frame union');
  assert.equal(mesh.parent, null, 'union restoration cannot reattach unloaded source objects');
  assert.equal(union.allocatedRecords, initialAllocations + 1);
  union.begin(); streamed.visible = false; union.include(root); union.apply();
  assert.equal(streamed.visible, false);
  assert.equal(union.allocatedRecords, initialAllocations + 1);
  union.clear();
});

test('async travel holds the target and active views while newer host positions keep updating', async () => {
  const first = new T.PerspectiveCamera(), second = new T.PerspectiveCamera(), destination = new T.PerspectiveCamera();
  const views = new DistrictViewHolds();
  const active = [{ x: 0, z: 10, camera: first }, { x: 1000, z: 20, camera: second }];
  views.update(active);
  let finish!: () => void;
  const assetWork = new Promise<void>(resolve => { finish = resolve; });
  const preparing = (async () => {
    const release = views.hold({ x: 3000, z: 30, camera: destination }, active);
    try { await assetWork; }
    finally { release(); }
  })();
  active.length = 0;
  let union = views.update([{ x: 12, z: 11, camera: first }]);
  assert.equal(views.pendingTargets, 1);
  assert.deepEqual(union.map(view => [view.x, view.z]), [[12, 11], [1000, 20], [3000, 30]]);
  assert.equal(union[2].preparationOnly, true, 'a preparation camera cannot become a simulated traffic driver');
  union = views.update([{ x: 15, z: 12, camera: first }, { x: 1010, z: 25, camera: second }]);
  assert.deepEqual(union.map(view => [view.x, view.z]), [[15, 12], [1010, 25], [3000, 30]], 'live positions supersede snapshots without dropping the target');
  finish(); await preparing;
  assert.equal(views.pendingTargets, 0);
  assert.deepEqual(views.current().map(view => [view.x, view.z]), [[15, 12], [1010, 25]]);
});

test('overlapping travel holds have independent identities and release on preparation failure', async () => {
  const camera = new T.PerspectiveCamera(), views = new DistrictViewHolds();
  views.update([{ x: 0, z: 0, camera }]);
  const releaseFirst = views.hold({ x: 2000, z: 0, camera });
  await assert.rejects(async () => {
    const releaseSecond = views.hold({ x: 4000, z: 0, camera });
    try {
      const union = views.current();
      assert.deepEqual(union.map(view => view.x), [0, 2000, 4000]);
      assert.notEqual(union[1].interestId, union[2].interestId);
      await Promise.reject(new Error('destination asset failed'));
    } finally { releaseSecond(); }
  }, /destination asset failed/);
  assert.equal(views.pendingTargets, 1);
  assert.deepEqual(views.current().map(view => view.x), [0, 2000]);
  releaseFirst(); releaseFirst();
  assert.equal(views.pendingTargets, 0);
  assert.deepEqual(views.current().map(view => view.x), [0]);
  views.clear();
  assert.equal(views.current().length, 0);
});

test('two distant views retain the original traffic activation thresholds for both drivers', () => {
  try {
    const drivers = [{ id: 'first', x: 0, z: 0, speed: 12, heading: 1 }, { id: 'second', x: 2000, z: 1000, speed: -4, heading: -1 }];
    setPreviewTrafficFocus(drivers, drivers);
    assert.equal(previewTrafficDistance(0, 0, 2000, 1000), 0);
    assert.equal(previewTrafficDistance(2000, 1000, 0, 0), 0);
    assert.equal(previewTrafficDistance(2115, 1000, 0, 0), 115);
    assert.ok(previewTrafficDistance(2115.001, 1000, 0, 0) > 115);
    assert.equal(previewTrafficDistance(0, 180, 2000, 1000), 180);
    assert.deepEqual(previewTrafficObservers(90, 90, { speed: 1, heading: 0 }), drivers);
    setPreviewTrafficFocus([...drivers].reverse(), [...drivers].reverse());
    assert.equal(previewTrafficDistance(0, 0, 2000, 1000), 0);
    assert.equal(previewTrafficDistance(2000, 1000, 0, 0), 0);
    clearPreviewTrafficFocus();
    assert.equal(previewTrafficDistance(3, 4, 0, 0), 5);
    assert.deepEqual(previewTrafficObservers(2, 3, { speed: 4, heading: 5 }), [{ id: 'source-player', x: 2, z: 3, speed: 4, heading: 5 }]);
  } finally { clearPreviewTrafficFocus(); }
});
