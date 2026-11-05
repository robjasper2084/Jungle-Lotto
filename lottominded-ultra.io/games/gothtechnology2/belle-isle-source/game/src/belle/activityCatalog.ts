import * as T from 'three';
import {inside} from './terrain.ts';
import type {ParkMap, ParkTerrain, Point} from './terrain.ts';
import type {DispatchStop} from './dispatchRules.ts';

export type DispatchStopCatalog = {hub: DispatchStop; stops: DispatchStop[]};
export type PhotoSubjectRegistration = {id: string; label: string; meshes: T.Mesh[]};

/** Existing map landmark IDs, in launch preference order; Nature Center is the fallback. */
export const DISPATCH_LANDMARK_IDS = Object.freeze([
  '106948123', '107227742', '659605208', '107205459', '107208288', '368859182',
]);
export const DISPATCH_PATH_SAMPLE_METRES = 6;
export const DISPATCH_CLEARANCE_METRES = 1.5;
export const DISPATCH_STOP_SEPARATION_METRES = 16;
export const DISPATCH_LANDMARK_APPROACH_METRES = 150;
export const DISPATCH_HUB_APPROACH_METRES = 250;

type SafePathPoint = {x: number; y: number; z: number};

function finitePoint(point: Point): boolean {
  return Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function safeIslandPathPoints(data: ParkMap, terrain: ParkTerrain): SafePathPoint[] {
  const points: SafePathPoint[] = [], seen = new Set<string>();
  for (const road of data.roads) {
    for (let segmentIndex = 1; segmentIndex < road.points.length; segmentIndex++) {
      const a = road.points[segmentIndex - 1], b = road.points[segmentIndex];
      if (!finitePoint(a) || !finitePoint(b)) continue;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!Number.isFinite(length)) continue;
      const steps = Math.max(1, Math.ceil(length / DISPATCH_PATH_SAMPLE_METRES));
      // Include endpoints, including the final endpoint of a one-segment path.
      for (let step = 0; step <= steps; step++) {
        const t = step / steps, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const key = `${x.toFixed(3)},${z.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // terrain.land also accepts the mainland and bridge deck. Dispatch starts
        // on the island itself, so those distant approach roads are excluded.
        if (!inside(x, z, data.island) || !terrain.land(x, z) || terrain.obstructed(x, z, DISPATCH_CLEARANCE_METRES)) continue;
        const y = terrain.height(x, z);
        if (Number.isFinite(y)) points.push({x, y, z});
      }
    }
  }
  return points;
}

function nearestPoint(
  points: readonly SafePathPoint[], x: number, z: number, maxDistance: number,
  occupied: readonly SafePathPoint[] = [],
): SafePathPoint | undefined {
  let best: SafePathPoint | undefined, bestDistance = maxDistance * maxDistance;
  for (const point of points) {
    const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (distance > bestDistance || occupied.some(stop => Math.hypot(point.x - stop.x, point.z - stop.z) < DISPATCH_STOP_SEPARATION_METRES)) continue;
    if (distance === bestDistance && best && (point.x > best.x || (point.x === best.x && point.z >= best.z))) continue;
    best = point;
    bestDistance = distance;
  }
  return best;
}

/**
 * Resolve handoff anchors from the real mapped road/path network, not landmark
 * centroids (which can be inside buildings). No mainland-spawn fallback is used.
 * Missing or inaccessible landmarks are omitted. Fewer than three safe stops
 * makes the five-contract set unavailable and produces a descriptive error.
 */
export function createDispatchStops(data: ParkMap, terrain: ParkTerrain): DispatchStopCatalog {
  if (!finitePoint(data.bridge.b)) throw new Error('Swoop Dispatch unavailable: the island bridge entrance is missing.');
  const safePoints = safeIslandPathPoints(data, terrain);
  const hubPoint = nearestPoint(safePoints, data.bridge.b[0], data.bridge.b[1], DISPATCH_HUB_APPROACH_METRES);
  if (!hubPoint) throw new Error('Swoop Dispatch unavailable: no clear island path near the bridge entrance.');
  const hub: DispatchStop = {id: 'dispatch-hub', name: 'Island Bridge Dispatch Hub', ...hubPoint};
  const stops: DispatchStop[] = [];
  for (const id of DISPATCH_LANDMARK_IDS) {
    const landmark = data.landmarks.find(item => item.id === id);
    if (!landmark || !landmark.name?.trim() || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.z)) continue;
    const point = nearestPoint(safePoints, landmark.x, landmark.z, DISPATCH_LANDMARK_APPROACH_METRES, [hub, ...stops]);
    if (!point) continue;
    stops.push({id: landmark.id, name: landmark.name, ...point});
    if (stops.length === 5) break;
  }
  if (stops.length < 3) throw new Error('Swoop Dispatch unavailable: at least three mapped landmarks need clear nearby paths.');
  return {hub, stops};
}

function modeledMesh(object: T.Object3D): object is T.Mesh {
  const mesh = object as T.Mesh;
  if (!mesh.isMesh || !mesh.geometry?.getAttribute('position')?.count || mesh.geometry.drawRange.count === 0) return false;
  // Permanent replacements and activity helpers are not architecture subjects.
  if (mesh.userData.staticSprayReplaced || mesh.userData.activityMarker || mesh.userData.photoMarker
    || mesh.userData.collisionOnly || mesh.userData.helper) return false;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some(material => material.visible && material.colorWrite && material.opacity > 0);
}

/**
 * Register only actual named model geometry belonging to mapped landmarks.
 * The GLB uses `${landmark.id}_` mesh names. No synthetic bounding-box meshes or
 * invisible markers are created. Empty/missing model groups cannot become quests.
 *
 * Distance-culled real meshes remain registered: world.update toggles visibility
 * as the rider travels. The photo evaluator must check current effective visibility
 * at capture time. Permanently invisible materials/helpers are excluded here.
 */
export function registerPhotoSubjects(scene: T.Scene, data: ParkMap): PhotoSubjectRegistration[] {
  scene.updateMatrixWorld(true);
  const subjects = new Map<string, PhotoSubjectRegistration>();
  for (const landmark of data.landmarks) {
    if (landmark.id && landmark.name?.trim() && !subjects.has(landmark.id)) {
      subjects.set(landmark.id, {id: landmark.id, label: landmark.name, meshes: []});
    }
  }
  scene.traverse(object => {
    if (!modeledMesh(object)) return;
    // Split only at the first underscore: model/material suffixes may contain more.
    const separator = object.name.indexOf('_');
    if (separator <= 0) return;
    subjects.get(object.name.slice(0, separator))?.meshes.push(object);
  });
  return [...subjects.values()].filter(subject => subject.meshes.length > 0);
}
