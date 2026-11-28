import * as T from 'three';

/** Assemble in the final coordinate frame while optionally remaining outside
 * host traversals until its own world construction and masking are complete.
 */
export function createOwnedSceneRoot(host: T.Scene, options: { name: string; matrix: readonly number[]; deferAttachment?: boolean }) {
  const root = new T.Scene();
  root.name = options.name;
  root.matrix.fromArray([...options.matrix]);
  root.matrixAutoUpdate = false;
  root.matrixWorldNeedsUpdate = true;
  if (!options.deferAttachment) host.add(root);
  return root;
}

type VisibilityState = { object: T.Object3D; frame: number; visible: boolean; castShadow: boolean; count?: number };

/** Pool union records without caching scene topology. Streamed objects can be
 * added or removed between views; every capture still traverses the live root.
 * Weak keys and clearing the frame list leave removed source art collectible.
 */
export class SceneVisibilityUnion {
  private states = new WeakMap<T.Object3D, VisibilityState>();
  private active: VisibilityState[] = [];
  private frame = 0;
  allocatedRecords = 0;

  begin() { this.frame++; this.active.length = 0; }

  private capture = (object: T.Object3D) => {
    const instanced = object as T.InstancedMesh;
    let state = this.states.get(object);
    if (!state) {
      state = { object, frame: 0, visible: false, castShadow: false };
      this.states.set(object, state);
      this.allocatedRecords++;
    }
    if (state.frame !== this.frame) {
      state.frame = this.frame;
      state.visible = object.visible;
      state.castShadow = object.castShadow;
      state.count = instanced.isInstancedMesh ? instanced.count : undefined;
      this.active.push(state);
    } else {
      state.visible ||= object.visible;
      state.castShadow ||= object.castShadow;
      if (instanced.isInstancedMesh) state.count = Math.max(state.count ?? 0, instanced.count);
    }
  };

  include(root: T.Object3D) { root.traverse(this.capture); }

  apply() {
    for (let i = 0; i < this.active.length; i++) {
      const state = this.active[i], object = state.object;
      object.visible = state.visible;
      object.castShadow = state.castShadow;
      if (state.count !== undefined) (object as T.InstancedMesh).count = state.count;
    }
    this.active.length = 0;
  }

  clear() { this.active.length = 0; this.states = new WeakMap(); }
}

/** Dispose an owned visual subtree without invalidating host/shared prototypes.
 * Each GPU resource is released once even when many instances reference it.
 */
export function disposeOwnedScene(root: T.Object3D, protectedResources: ReadonlySet<unknown>, extraOwnedRoots: readonly T.Object3D[] = []) {
  root.removeFromParent();
  const resources = new Set<unknown>();
  const release = (resource: unknown) => {
    if (!resource || resources.has(resource) || protectedResources.has(resource)) return;
    resources.add(resource);
    (resource as { dispose?: () => void }).dispose?.();
  };
  const releaseObject = (object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (mesh.geometry) release(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if ((value as T.Texture)?.isTexture) release(value);
      release(material);
    }
    if ((object as T.SkinnedMesh).skeleton) release((object as T.SkinnedMesh).skeleton);
  };
  root.traverse(releaseObject);
  for (const extra of extraOwnedRoots) extra.traverse(releaseObject);
  root.clear();
  return resources.size;
}
