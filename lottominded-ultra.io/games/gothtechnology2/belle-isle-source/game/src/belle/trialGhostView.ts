import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {TrialCourse, TrialPoint, TrialVehicle} from './trialRules.ts';
import {createTrialGhostPose, sampleTrialGhost, trialGhostFingerprint, type TrialGhostPose, type TrialGhostTrack} from './trialGhost.ts';

export const TRIAL_GHOST_COLORS = {pace: '#7de9de', recorded: '#d7afff'} as const;
export type TrialGhostObservation = Readonly<TrialGhostPose & {kind: 'recorded' | 'pace'; time: number; opacity: number}>;
type Ghost = {mesh: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>; pose: TrialGhostPose};
type Point = [number, number, number];
const smooth = (value: number) => value * value * (3 - 2 * value);
const unit = (value: number) => Math.max(0, Math.min(1, value));

/** Original simple silhouette: one merged texture-free mesh per rider and vehicle. */
export function createTrialGhostGeometry(vehicle: TrialVehicle): T.BufferGeometry {
  const parts: T.BufferGeometry[] = [];
  const from = new T.Vector3(), to = new T.Vector3(), direction = new T.Vector3(), up = new T.Vector3(0, 1, 0), rotation = new T.Quaternion();
  const box = (size: Point, center: Point, tilt = 0) => {
    parts.push(new T.BoxGeometry(...size).rotateX(tilt).translate(...center));
  };
  const sphere = (radius: number, center: Point, scale: Point = [1, 1, 1]) => {
    parts.push(new T.SphereGeometry(radius, 8, 5).scale(...scale).translate(...center));
  };
  const limb = (a: Point, b: Point, radius: number) => {
    from.fromArray(a); to.fromArray(b); direction.subVectors(to, from);
    const length = direction.length(); if (length < 1e-7) return;
    rotation.setFromUnitVectors(up, direction.normalize());
    parts.push(new T.CylinderGeometry(radius * .86, radius, length, 6, 1).applyQuaternion(rotation)
      .translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2));
  };
  if (vehicle === 'onewheel') {
    parts.push(new T.TorusGeometry(.23, .1, 5, 16).rotateY(Math.PI / 2).translate(0, .33, 0));
    box([.23, .1, .4], [-.2, .48, 0]); box([.23, .1, .4], [.2, .48, 0]);
    for (const side of [-1, 1]) {
      const x = side * .19;
      box([.16, .09, .3], [x, .58, .025]);
      limb([x, .62, .01], [x * 1.05, .94, .1], .073);
      limb([x * 1.05, .94, .1], [x * .8, 1.28, -.035], .09);
      limb([side * .23, 1.61, 0], [side * .32, 1.37, .15], .065);
      limb([side * .32, 1.37, .15], [side * .3, 1.25, .36], .05);
      sphere(.058, [side * .3, 1.25, .36]);
    }
    sphere(.26, [0, 1.46, -.005], [.86, 1.05, .58]);
    sphere(.15, [0, 1.86, .015], [.92, 1.12, 1]);
    box([.23, .28, .12], [0, 1.5, -.17]);
  } else {
    box([.55, .2, 1.45], [0, .4, 0]); box([.4, .15, .58], [0, .57, -.28]);
    box([.3, .24, .55], [0, .59, .5], -.15);
    for (const side of [-1, 1]) {
      for (const z of [-.58, .62]) {
        parts.push(new T.TorusGeometry(.25, .055, 4, 12).rotateX(Math.PI / 2).translate(side * .56, .35, z));
        box([.23, .07, .09], [side * .4, .35, z]);
      }
      limb([side * .17, .84, -.3], [side * .32, .65, .16], .087);
      limb([side * .32, .65, .16], [side * .32, .28, .03], .068);
      box([.18, .1, .3], [side * .32, .23, .13]);
      limb([side * .2, 1.28, -.04], [side * .31, 1.09, .22], .066);
      limb([side * .31, 1.09, .22], [side * .34, 1.03, .53], .052);
      sphere(.06, [side * .34, 1.03, .53]);
      limb([side * .34, 1.03, .53], [side * .21, 1.03, .63], .027);
    }
    limb([0, .67, .55], [0, 1.03, .63], .035);
    limb([-.21, 1.03, .63], [.21, 1.03, .63], .027);
    sphere(.25, [0, 1.07, -.16], [.88, 1.02, .62]);
    sphere(.15, [0, 1.48, .015], [.92, 1.12, 1]);
    box([.23, .3, .12], [0, 1.1, -.34], -.12);
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('Ghost silhouette geometry could not merge');
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Display-only rivals: no simulation body, shadows, textures, audio, or raycasts.
 * There is no idle bob, pulsing, or spinning cosmetic layer to disable for reduced motion.
 * Race elapsed time alone determines replay movement, so pause and countdown freeze it.
 */
export class TrialGhostView {
  readonly group = new T.Group();
  private readonly recorded: Ghost;
  private readonly pace: Ghost;
  private readonly geometries = new Map<TrialVehicle, T.BufferGeometry>();
  private readonly empty = new T.BufferGeometry();
  private courseId = '';
  private vehicle: TrialVehicle | null = null;
  private fingerprint = '';
  private disposed = false;
  private elapsed = 0;

  constructor(scene: T.Scene) {
    this.group.name = 'Time trial ghost riders'; this.group.userData.photoQuestIgnore = true; this.group.visible = false;
    const make = (kind: 'pace' | 'recorded'): Ghost => {
      const material = new T.MeshBasicMaterial({color: TRIAL_GHOST_COLORS[kind], transparent: true, opacity: 0, depthWrite: false, toneMapped: false});
      const mesh = new T.Mesh(this.empty, material);
      mesh.name = kind === 'pace' ? 'Pace guide ghost' : 'Recorded run ghost'; mesh.visible = false;
      mesh.userData.photoQuestIgnore = true; mesh.userData.trialGhost = kind;
      mesh.raycast = () => {}; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 4;
      this.group.add(mesh);
      return {mesh, pose: createTrialGhostPose()};
    };
    this.recorded = make('recorded'); this.pace = make('pace'); scene.add(this.group);
  }

  get visibleCount(): number { return Number(this.group.visible && this.recorded.mesh.visible) + Number(this.group.visible && this.pace.mesh.visible); }

  /** Read-only copies of what this view actually presents, never synthetic opponents or results. */
  snapshot(): readonly TrialGhostObservation[] {
    if (!this.group.visible) return [];
    const observations: TrialGhostObservation[] = [];
    for (const [kind, ghost] of [['pace', this.pace], ['recorded', this.recorded]] as const) {
      if (ghost.mesh.visible) observations.push({kind, time: this.elapsed, ...ghost.pose, opacity: ghost.mesh.material.opacity});
    }
    return observations;
  }

  setCourse(course: TrialCourse): void {
    if (this.disposed) return;
    this.clear();
    let geometry = this.geometries.get(course.vehicle);
    if (!geometry) { geometry = createTrialGhostGeometry(course.vehicle); this.geometries.set(course.vehicle, geometry); }
    this.recorded.mesh.geometry = geometry; this.pace.mesh.geometry = geometry;
    this.courseId = course.id; this.vehicle = course.vehicle; this.fingerprint = trialGhostFingerprint(course);
  }

  update(elapsed: number, recordedTrack: TrialGhostTrack | null, paceTrack: TrialGhostTrack | null, player: TrialPoint, enabled = true): void {
    this.recorded.mesh.visible = this.pace.mesh.visible = false;
    this.group.visible = !this.disposed && enabled && this.vehicle !== null;
    if (!this.group.visible || !Number.isFinite(elapsed) || !Number.isFinite(player.x) || !Number.isFinite(player.y) || !Number.isFinite(player.z)) { this.group.visible = false; return; }
    this.elapsed = elapsed;
    this.present(this.pace, paceTrack, 'pace', elapsed, player, .4);
    this.present(this.recorded, recordedTrack, 'recorded', elapsed, player, .52);
  }

  private present(ghost: Ghost, track: TrialGhostTrack | null, kind: 'recorded' | 'pace', elapsed: number, player: TrialPoint, opacity: number): void {
    if (!track || track.kind !== kind || track.courseId !== this.courseId || track.vehicle !== this.vehicle || track.fingerprint !== this.fingerprint) return;
    const pose = sampleTrialGhost(track, elapsed, ghost.pose); if (!pose) return;
    const distance = Math.hypot(pose.x - player.x, pose.y - player.y, pose.z - player.z);
    const fade = smooth(unit((distance - 2.5) / 4.5)) * smooth(unit((450 - distance) / 100));
    if (fade <= .01) return;
    ghost.mesh.position.set(pose.x, pose.y, pose.z);
    ghost.mesh.rotation.set(pose.pitch, pose.heading, pose.roll, 'YXZ');
    ghost.mesh.material.opacity = opacity * fade; ghost.mesh.visible = true;
  }

  clear(): void {
    this.group.visible = false; this.recorded.mesh.visible = false; this.pace.mesh.visible = false;
    this.recorded.mesh.material.opacity = this.pace.mesh.material.opacity = 0;
    this.courseId = ''; this.vehicle = null; this.fingerprint = ''; this.elapsed = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear(); this.disposed = true;
    this.group.removeFromParent(); this.group.clear();
    for (const geometry of this.geometries.values()) geometry.dispose(); this.geometries.clear(); this.empty.dispose();
    this.recorded.mesh.material.dispose(); this.pace.mesh.material.dispose();
  }
}
