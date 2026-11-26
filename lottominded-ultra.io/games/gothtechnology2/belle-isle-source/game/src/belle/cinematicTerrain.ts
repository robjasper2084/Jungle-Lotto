import type * as T from 'three';
import {LAWN_DETAIL} from './cinematicPolicy.ts';
import {inheritAtmosphereProgram} from './atmosphereProgramIdentity.ts';
import {LAWN_DETAIL_GRAIN_GUARD,LAWN_GRAIN_GUARD_KEY} from './lawnFragmentOptimization.ts';
export type CinematicTerrainOptions={skipInvisibleGrain?:boolean};
/** Dresses existing lawn materials. No new textures, meshes or frame callbacks. */
export class CinematicTerrain {
  private originals = new Map<T.Material, {compile: T.Material['onBeforeCompile']; key: T.Material['customProgramCacheKey']}>();
  private pending = new Set<T.Object3D>(); private queued = false; private disposed = false;
  private scene: T.Scene;
  private skipInvisibleGrain: boolean;
  constructor(scene: T.Scene, options: CinematicTerrainOptions = {}) { this.scene = scene; this.skipInvisibleGrain = options.skipInvisibleGrain === true; scene.addEventListener('childadded', this.added); this.enqueue(scene); }
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
          const detail = this.skipInvisibleGrain ? LAWN_DETAIL_GRAIN_GUARD : LAWN_DETAIL;
          this.originals.set(material, {compile, key});
          material.onBeforeCompile = (shader, renderer) => {
            compile.call(material, shader, renderer);
            // A realistic-material clone can inherit this hook before being discovered again.
            // Compose the inherited hook first, then inject our exact block only once.
            if (shader.fragmentShader.includes('varying vec2 terrainXZ;')) {
              if (shader.fragmentShader.includes(LAWN_DETAIL)) {
                shader.fragmentShader = shader.fragmentShader.replace(LAWN_DETAIL, detail);
              } else if (shader.fragmentShader.includes(LAWN_DETAIL_GRAIN_GUARD)) {
                shader.fragmentShader = shader.fragmentShader.replace(LAWN_DETAIL_GRAIN_GUARD, detail);
              } else {
                shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + detail);
              }
            }
          };
          inheritAtmosphereProgram(material,compile);
          const baseIdentity = identity.split('|').filter(part => part !== LAWN_GRAIN_GUARD_KEY).join('|');
          const detailIdentity = baseIdentity.split('|').includes('belle-lawn-detail-v1') ? baseIdentity : baseIdentity + '|belle-lawn-detail-v1';
          material.customProgramCacheKey = () => detailIdentity + (this.skipInvisibleGrain ? '|' + LAWN_GRAIN_GUARD_KEY : '');
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
