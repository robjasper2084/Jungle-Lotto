import type * as T from 'three';
import {LAWN_DETAIL} from './cinematicPolicy.ts';
/** Dresses existing lawn materials. No new textures, meshes or frame callbacks. */
export class CinematicTerrain {
  private originals = new Map<T.Material, {compile: T.Material['onBeforeCompile']; key: T.Material['customProgramCacheKey']}>();
  private pending = new Set<T.Object3D>(); private queued = false; private disposed = false;
  private scene: T.Scene;
  constructor(scene: T.Scene) { this.scene = scene; scene.addEventListener('childadded', this.added); this.enqueue(scene); }
  private added = (event: {child: T.Object3D}) => this.enqueue(event.child);
  private enqueue(root: T.Object3D) {
    this.pending.add(root); if (this.queued) return; this.queued = true;
    queueMicrotask(() => {
      this.queued = false; if (this.disposed) return;
      for (const root of this.pending) root.traverse(object => {
        const mesh = object as T.Mesh; if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (material.name !== 'Park lawn' || this.originals.has(material)) continue;
          const compile = material.onBeforeCompile, key = material.customProgramCacheKey, identity = key.call(material);
          this.originals.set(material, {compile, key});
          material.onBeforeCompile = (shader, renderer) => {
            compile.call(material, shader, renderer);
            // A realistic-material clone can inherit this hook before being discovered again.
            // Compose the inherited hook first, then inject our exact block only once.
            if (shader.fragmentShader.includes('varying vec2 terrainXZ;') && !shader.fragmentShader.includes(LAWN_DETAIL)) {
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + LAWN_DETAIL);
            }
          };
          material.customProgramCacheKey = () => identity.split('|').includes('belle-lawn-detail-v1') ? identity : identity + '|belle-lawn-detail-v1';
          material.needsUpdate = true;
        }
      });
      this.pending.clear();
    });
  }
  dispose() {
    this.disposed = true; this.scene.removeEventListener('childadded', this.added); this.pending.clear();
    for (const [material, original] of this.originals) { material.onBeforeCompile = original.compile; material.customProgramCacheKey = original.key; material.needsUpdate = true; }
    this.originals.clear();
  }
}
