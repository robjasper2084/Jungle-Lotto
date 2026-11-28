import type { Camera } from 'three';

export type DistrictFrameView = { x: number; z: number; camera: Camera };
export type PreparedDistrictView = DistrictFrameView & { interestId?: string; preparationOnly?: boolean };
type Hold = { active: DistrictFrameView[]; target: PreparedDistrictView };

/** Travel preparation keeps its target and all starting camera interests alive
 * while normal host frames continue. New live positions supersede snapshots;
 * targets have separate identities and never become simulated rider inputs.
 */
export class DistrictViewHolds {
  private latest: DistrictFrameView[] = [];
  private holds: Hold[] = [];
  private combined: PreparedDistrictView[] = [];
  private identities = new Set<string>();
  private serial = 0;

  get pendingTargets() { return this.holds.length; }

  update(live: readonly DistrictFrameView[]) {
    for (let i = 0; i < live.length; i++) {
      const value = live[i], saved = this.latest[i];
      if (saved) { saved.x = value.x; saved.z = value.z; saved.camera = value.camera; }
      else this.latest.push({ x: value.x, z: value.z, camera: value.camera });
    }
    this.latest.length = live.length;
    return this.current();
  }

  hold(target: DistrictFrameView, active: readonly DistrictFrameView[] = this.latest) {
    const hold: Hold = {
      active: active.map(view => ({ x: view.x, z: view.z, camera: view.camera })),
      target: { ...target, interestId: 'preview-travel-' + ++this.serial, preparationOnly: true },
    };
    this.holds.push(hold);
    return () => {
      const index = this.holds.indexOf(hold);
      if (index >= 0) this.holds.splice(index, 1);
      // Do not trigger reculling here: the awaiting native travel callback
      // moves the rider before the next regular host frame establishes views.
      this.combined.length = 0;
      this.identities.clear();
    };
  }

  private append(view: PreparedDistrictView) {
    const id = view.interestId ?? view.camera.uuid;
    if (this.identities.has(id)) return;
    this.identities.add(id);
    this.combined.push(view);
  }

  current(): readonly PreparedDistrictView[] {
    if (!this.holds.length) return this.latest;
    this.combined.length = 0;
    this.identities.clear();
    for (let i = 0; i < this.latest.length; i++) this.append(this.latest[i]);
    for (let i = 0; i < this.holds.length; i++) {
      const hold = this.holds[i];
      for (let j = 0; j < hold.active.length; j++) this.append(hold.active[j]);
      this.append(hold.target);
    }
    return this.combined;
  }

  clear() {
    this.latest.length = this.holds.length = this.combined.length = 0;
    this.identities.clear();
  }
}
