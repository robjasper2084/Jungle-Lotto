import * as T from 'three';
import { scorePhotoQuest, type PhotoQuestCriteria, type PhotoQuestObservation, type PhotoQuestScore } from './photoQuestRules.ts';

export type PhotoQuestSubject = Readonly<{ id: string; label: string; meshes: readonly T.Mesh[] }>;
export type PhotoQuestCrop = Readonly<{ x: number; y: number; width: number; height: number; canvasWidth: number; canvasHeight: number }>;
export type PhotoQuestOptions = PhotoQuestCriteria & Readonly<{ crop: PhotoQuestCrop }>;

const localBounds = new WeakMap<T.BufferGeometry, T.Box3>();
const instanceBounds = new WeakMap<T.InstancedMesh, { version: number; count: number; geometry: T.BufferGeometry; bounds: T.Box3 }>();
function geometryBounds(mesh: T.Mesh): T.Box3 | undefined {
  if (mesh.geometry.boundingBox) return mesh.geometry.boundingBox;
  const cached = localBounds.get(mesh.geometry);
  if (cached) return cached;
  const positions = mesh.geometry.getAttribute('position');
  if (!positions || !positions.count) return undefined;
  const bounds = new T.Box3().setFromBufferAttribute(positions as T.BufferAttribute);
  localBounds.set(mesh.geometry, bounds);
  return bounds;
}

function meshBounds(mesh: T.Mesh): T.Box3 | undefined {
  const local = geometryBounds(mesh);
  if (!local || !(mesh instanceof T.InstancedMesh)) return local;
  const cached = instanceBounds.get(mesh);
  if (cached && cached.version === mesh.instanceMatrix.version && cached.count === mesh.count && cached.geometry === mesh.geometry) return cached.bounds;
  const bounds = new T.Box3(), matrix = new T.Matrix4(), transformed = new T.Box3();
  for (let index = 0; index < mesh.count; index++) {
    mesh.getMatrixAt(index, matrix);
    bounds.union(transformed.copy(local).applyMatrix4(matrix));
  }
  instanceBounds.set(mesh, { version: mesh.instanceMatrix.version, count: mesh.count, geometry: mesh.geometry, bounds });
  return bounds;
}

function visibleMaterial(material: T.Material): boolean {
  return material.visible && material.colorWrite && (!material.transparent || material.opacity > .05);
}

function visibleObject(object: T.Object3D, camera: T.Camera): boolean {
  if (!object.layers.test(camera.layers)) return false;
  for (let parent: T.Object3D | null = object; parent; parent = parent.parent) {
    if (!parent.visible || parent.userData.photoQuestIgnore === true) return false;
  }
  return true;
}

function visibleMesh(mesh: T.Mesh, camera: T.Camera): boolean {
  return visibleObject(mesh, camera) && (Array.isArray(mesh.material) ? mesh.material.some(visibleMaterial) : visibleMaterial(mesh.material));
}

function intersectionVisible(hit: T.Intersection): boolean {
  const mesh = hit.object as T.Mesh;
  const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
  return !!material && visibleMaterial(material);
}

const emptyObservation = (): PhotoQuestObservation => ({ available: false, inFront: false, bounds: { left: 0, top: 0, right: 0, bottom: 0 }, subjectSamples: 0, visibleSamples: 0 });

/**
 * Read the camera/world matrices used for the rendered frame; never move a subject
 * or update the world here. Up to nine rays sample its real geometry. Bounding-box
 * broad-phase rejects unrelated meshes before triangle raycasts. Alpha textures are
 * conservatively treated as solid; transparent effects without depth writes do not
 * block assignments. Call after the world render for a capture decision.
 */
export function measurePhotoSubject(subject: PhotoQuestSubject, camera: T.PerspectiveCamera, scene: T.Scene, crop: PhotoQuestCrop): PhotoQuestObservation {
  if (![crop.x, crop.y, crop.width, crop.height, crop.canvasWidth, crop.canvasHeight].every(Number.isFinite) || crop.width <= 0 || crop.height <= 0 || crop.canvasWidth <= 0 || crop.canvasHeight <= 0) return emptyObservation();
  const meshes = subject.meshes.filter(mesh => visibleMesh(mesh, camera));
  const bounds = new T.Box3();
  for (const mesh of meshes) {
    const local = meshBounds(mesh);
    if (local) bounds.union(local.clone().applyMatrix4(mesh.matrixWorld));
  }
  if (!meshes.length || bounds.isEmpty()) return emptyObservation();
  const cameraPosition = new T.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const center = bounds.getCenter(new T.Vector3()).applyMatrix4(camera.matrixWorldInverse);
  const projected = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  let nearClipped = false;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    if (point.z >= -camera.near) nearClipped = true;
    point.applyMatrix4(camera.projectionMatrix);
    const px = ((point.x + 1) * .5 * crop.canvasWidth - crop.x) / crop.width;
    const py = ((1 - point.y) * .5 * crop.canvasHeight - crop.y) / crop.height;
    projected.left = Math.min(projected.left, px); projected.right = Math.max(projected.right, px);
    projected.top = Math.min(projected.top, py); projected.bottom = Math.max(projected.bottom, py);
  }
  const base = { available: true, inFront: center.z < -camera.near, nearClipped, bounds: projected, cameraHeight: cameraPosition.y - bounds.min.y };
  if (!base.inFront || nearClipped || projected.right <= 0 || projected.left >= 1 || projected.bottom <= 0 || projected.top >= 1) return { ...base, subjectSamples: 0, visibleSamples: 0 };

  const targets = new Set<T.Object3D>(meshes);
  const occluders: { mesh: T.Mesh; bounds: T.Box3 }[] = [];
  scene.traverseVisible(object => {
    if (!(object instanceof T.Mesh) || targets.has(object) || !visibleMesh(object, camera)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some(material => visibleMaterial(material) && material.depthWrite)) return;
    const local = meshBounds(object);
    if (local) occluders.push({ mesh: object, bounds: local.clone().applyMatrix4(object.matrixWorld) });
  });
  const raycaster = new T.Raycaster();
  raycaster.layers.mask = camera.layers.mask;
  let subjectSamples = 0, visibleSamples = 0;
  const blockerPoint = new T.Vector3();
  for (const u of [.2, .5, .8]) for (const v of [.2, .5, .8]) {
    const x = projected.left + (projected.right - projected.left) * u;
    const y = projected.top + (projected.bottom - projected.top) * v;
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    raycaster.setFromCamera(new T.Vector2(((crop.x + x * crop.width) / crop.canvasWidth) * 2 - 1, 1 - ((crop.y + y * crop.height) / crop.canvasHeight) * 2), camera);
    raycaster.near = camera.near;
    raycaster.far = camera.far;
    const targetHit = raycaster.intersectObjects(meshes, false).find(intersectionVisible);
    if (!targetHit) continue;
    subjectSamples++;
    raycaster.far = Math.max(camera.near, targetHit.distance - Math.max(.015, targetHit.distance * .00001));
    let blocked = false;
    for (const candidate of occluders) {
      const point = raycaster.ray.intersectBox(candidate.bounds, blockerPoint);
      if (!point || (!candidate.bounds.containsPoint(cameraPosition) && point.distanceTo(cameraPosition) > raycaster.far)) continue;
      if (raycaster.intersectObject(candidate.mesh, false).some(intersectionVisible)) { blocked = true; break; }
    }
    if (!blocked) visibleSamples++;
  }
  return { ...base, subjectSamples, visibleSamples };
}

export function evaluatePhotoSubject(subject: PhotoQuestSubject, camera: T.PerspectiveCamera, scene: T.Scene, options: PhotoQuestOptions): PhotoQuestScore {
  return scorePhotoQuest(measurePhotoSubject(subject, camera, scene, options.crop), options);
}
