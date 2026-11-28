import type { Object3D } from 'three';

const sourceRoots = new WeakSet<Object3D>();

/** Source-only preparation policy; original Belle roots retain their existing
 * hidden-model warmup. Registration follows the district visual lifetime.
 */
export function registerSwoopTextureRoot(root: Object3D) {
  sourceRoots.add(root);
  return () => { sourceRoots.delete(root); };
}

export function shouldWarmPreviewTexture(object: Object3D) {
  let source = false, visible = true;
  for (let ancestor: Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (sourceRoots.has(ancestor)) source = true;
    if (!ancestor.visible) visible = false;
  }
  return !source || visible;
}
