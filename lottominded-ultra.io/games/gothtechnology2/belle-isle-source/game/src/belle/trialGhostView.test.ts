import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {TrialCourse} from './trialRules.ts';
import {createTrialPaceGhost, type TrialGhostTrack} from './trialGhost.ts';
import {createTrialGhostGeometry, TrialGhostView, TRIAL_GHOST_COLORS} from './trialGhostView.ts';

const course = (vehicle: TrialCourse['vehicle'] = 'hoverbike'): TrialCourse => ({
  id: `view-${vehicle}-v1`, vehicle, name: 'Ghost view fixture', description: '', distance: 200,
  start: {x: 0, y: 2, z: 0, heading: 0}, gates: [{x: 0, y: 2, z: 200, heading: 0, radius: 4, halfHeight: 3}],
  path: [{x: 0, y: 2, z: 0}, {x: 0, y: 2, z: 200}], maxSpeed: 35, color: '#ffcc88',
});
const meshes = (view: TrialGhostView) => view.group.children as T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>[];

test('both original rider silhouettes are bounded, joined and require one texture-free draw each', () => {
  for (const vehicle of ['onewheel', 'hoverbike'] as const) {
    const geometry = createTrialGhostGeometry(vehicle), bounds = geometry.boundingBox!, size = bounds.getSize(new T.Vector3());
    assert(geometry.index); assert(geometry.index.count / 3 < 2400); assert.equal(geometry.groups.length, 0);
    assert(size.y > 1.3 && size.y < 2.1, `${vehicle} rider silhouette has a plausible mounted height`);
    assert(size.x > .5 && size.x < 2); assert(size.z > .4 && size.z < 2);
    assert(bounds.min.y >= -.00001, 'feet and vehicle geometry do not sink below the supplied world base');
    geometry.dispose();
  }
});

test('two rivals share geometry but have distinct colors, no shadows and no interaction raycasts', () => {
  const scene = new T.Scene(), view = new TrialGhostView(scene), fixture = course(); view.setCourse(fixture);
  const items = meshes(view); assert.equal(items.length, 2); assert.equal(items[0].geometry, items[1].geometry);
  assert.equal(view.group.userData.photoQuestIgnore, true);
  assert.deepEqual(items.map(item => `#${item.material.color.getHexString()}`).sort(), Object.values(TRIAL_GHOST_COLORS).sort());
  for (const item of items) {
    assert.equal(item.material.map, null); assert.equal(item.material.depthWrite, false); assert(item.material.transparent);
    assert.equal(item.castShadow, false); assert.equal(item.receiveShadow, false);
    const hits: T.Intersection[] = []; item.raycast(new T.Raycaster(), hits); assert.deepEqual(hits, []);
  }
  view.dispose(); assert.equal(scene.children.length, 0);
});

test('display uses actual sampled time, freezes on pause and reports only the meshes actually shown', () => {
  const scene = new T.Scene(), view = new TrialGhostView(scene), fixture = course(), pace = createTrialPaceGhost(fixture, 20)!;
  const recorded: TrialGhostTrack = {...pace, kind: 'recorded'};
  view.setCourse(fixture); view.update(5, recorded, pace, {x: 0, y: 2, z: 0});
  assert.equal(view.visibleCount, 2);
  const observations = view.snapshot(); assert.equal(observations.length, 2);
  for (const observation of observations) {assert.equal(observation.time, 5); assert.equal(observation.z, 50); assert(observation.opacity > 0);}
  const transforms = meshes(view).map(mesh => ({position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray(), opacity: mesh.material.opacity}));
  view.update(5, recorded, pace, {x: 0, y: 2, z: 0}); assert.deepEqual(view.snapshot(), observations);
  assert.deepEqual(meshes(view).map(mesh => ({position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray(), opacity: mesh.material.opacity})), transforms, 'there is no wall-clock cosmetic bob or pulse');
  const copy = view.snapshot()[0] as {z: number}; copy.z = 999;
  assert.equal(view.snapshot()[0].z, 50, 'diagnostics cannot mutate presented poses');
  view.dispose();
});

test('near-player fade prevents obstructing the view and distant, finished or disabled ghosts disappear', () => {
  const view = new TrialGhostView(new T.Scene()), fixture = course(), pace = createTrialPaceGhost(fixture, 20)!;
  view.setCourse(fixture);
  view.update(0, null, pace, fixture.start); assert.equal(view.visibleCount, 0);
  view.update(1, null, pace, fixture.start); assert.equal(view.visibleCount, 1);
  view.update(1, null, pace, {x: 0, y: 2, z: -500}); assert.equal(view.visibleCount, 0);
  view.update(20.01, null, pace, fixture.start); assert.equal(view.visibleCount, 0);
  view.update(1, null, pace, fixture.start, false); assert.equal(view.visibleCount, 0); assert.deepEqual(view.snapshot(), []);
  view.update(1, null, pace, {x: NaN, y: 2, z: 0}); assert.equal(view.visibleCount, 0);
  view.dispose();
});

test('restart and course switches hide stale riders and reuse bounded geometry', () => {
  const scene = new T.Scene(), view = new TrialGhostView(scene), sky = course(), wheel = course('onewheel');
  const pace = createTrialPaceGhost(sky, 20)!; view.setCourse(sky); const skyGeometry = meshes(view)[0].geometry;
  view.update(2, null, pace, sky.start); assert.equal(view.visibleCount, 1);
  view.clear(); assert.equal(view.visibleCount, 0); assert.deepEqual(view.snapshot(), []);
  view.update(2, null, pace, sky.start); assert.equal(view.visibleCount, 0);
  view.setCourse(wheel); assert.notEqual(meshes(view)[0].geometry, skyGeometry);
  view.update(2, null, pace, sky.start); assert.equal(view.visibleCount, 0, 'a different vehicle/course cannot display the previous track');
  const wheelGeometry = meshes(view)[0].geometry;
  for (let count = 0; count < 12; count++) {view.setCourse(sky); assert.equal(meshes(view)[0].geometry, skyGeometry); view.setCourse(wheel);}
  assert.equal(meshes(view)[0].geometry, wheelGeometry); assert.equal(view.group.children.length, 2);
  let disposed = 0; skyGeometry.addEventListener('dispose', () => disposed++); wheelGeometry.addEventListener('dispose', () => disposed++);
  for (const mesh of meshes(view)) mesh.material.addEventListener('dispose', () => disposed++);
  view.dispose(); view.dispose(); assert.equal(disposed, 4); assert.equal(scene.children.length, 0);
  view.setCourse(sky); view.update(2, null, pace, sky.start); assert.equal(view.visibleCount, 0);
});
