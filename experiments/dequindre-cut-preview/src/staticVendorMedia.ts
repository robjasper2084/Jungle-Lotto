import * as T from 'three';

/** Preview-only replacement for the source vendor media controller.
 * Keeps the exact idle poster and LCD geometry, with no DOM, video, or account UI.
 * The Vite preview adapter resolves only Swoop's foodVendorMedia import here.
 */
const pending = new Set<Promise<unknown>>();
export class FoodVendorMedia {
  private readonly poster: T.Texture;
  private readonly material: T.MeshBasicMaterial;

  constructor() {
    let finish!: () => void;
    let fail!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
    // Keep rejected promises observable by the startup barrier without an
    // unhandled-rejection event before the complete world has been assembled.
    void ready.catch(() => {});
    pending.add(ready);
    this.poster = new T.TextureLoader().load('/__swoop-assets__/exports/street-life/paradise-poster.jpg', finish, undefined, fail);
    this.poster.colorSpace = T.SRGBColorSpace;
    this.material = new T.MeshBasicMaterial({ map: this.poster, toneMapped: false });
  }

  add(root: T.Object3D) {
    let found = false;
    root.traverse(object => {
      if (object instanceof T.Mesh && object.name.startsWith('LCD_Pixels')) {
        object.material = this.material;
        found = true;
      }
    });
    if (found) return;
    const bezel = new T.Mesh(new T.BoxGeometry(.06, .72, 1.2), new T.MeshStandardMaterial({ color: '#141b1d', metalness: .6, roughness: .35 }));
    bezel.position.set(1.445, 3.17, -.15);
    const pixels = new T.Mesh(new T.PlaneGeometry(1.12, .63), this.material);
    pixels.name = 'LCD_Pixels';
    pixels.rotation.y = Math.PI / 2;
    pixels.position.set(1.478, 3.17, -.15);
    root.add(bezel, pixels);
  }

  update(_distance: number, _vendor: string, _reduced: boolean) {}
  dispose() { this.poster.dispose(); this.material.dispose(); }
}

export async function waitForVendorPosters() {
  const current = [...pending];
  await Promise.all(current);
  current.forEach(promise => pending.delete(promise));
}
