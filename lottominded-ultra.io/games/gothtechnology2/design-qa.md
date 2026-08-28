# Hybrid cinematic storefront — work in progress

final result: blocked

## Source and scope

- Visual direction: cathedral-armory concept, with the user's hybrid cinematic feature brief taking precedence.
- Source visual: C:/Users/digit/.codex/generated_images/01a0476c-5c6c-7a91-a924-77d203aafef0/exec-85c65b81-0826-46a1-8acb-ca6632c7f900.png
- Runtime: http://127.0.0.1:4180/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/
- User explicitly approved continuing on feature/gothtechnology-cinematic-store instead of upgrade-redesign. Existing unrelated changes preserved.

## Blocking findings

- [P1] Actual hoodie/charm model exports are missing. The supplied to3D tool opens a manual-upload widget; no generation job ID or output has been returned. Model paths deliberately remain null in store/content/cinematic-models.ts. The finished 3D scene must not be claimed complete.
- [P2] Final visual comparison remains pending the models. Current artwork is a safe static fallback, not the centered finished 3D composition. No fidelity pass is claimed.
- Browser capture is affected by a 0.75 scale: requested 293x633 resolves to 390x844 CSS pixels, but screenshots include clipped raster content and black padding. Do not treat these captures as a native-size visual sign-off.

## Implemented and checked

- Actual Three.js cathedral architecture, plinths, lights, dust, mist, camera approach, pointer movement, scroll response, adaptive quality, disposal and GLTF loaders. Activation is gated until both model paths exist; 3D runtime behavior is not yet verified.
- Hero chapter links, global motion pause, reduced-motion proxy, opt-in sound proxy.
- Product material inspection/zoom dialog; original product routes remain intact.
- Per-signal cyan/gold/silver/shadow lighting and existing image-based inspect controls.
- Lightweight portal animation and opt-in transition audio; no game engine changes.
- Demo/payment-disabled notice now remains visible above the hero.
- TypeScript passes; 20 store tests pass; production build passes with a Three.js chunk-size warning. No commit or deployment.
- Browser: meaningful page, no error overlay, no observed warning/error logs; pause changed to Resume motion with aria-pressed=true; reduced-motion state updated; embroidery dialog opened and closed; Analog display selected cool lighting.
- Viewports: 1920x1200 and 390x844 CSS measured. Mobile document scrollWidth 370 <= innerWidth 390; no document-level horizontal overflow. Further layout checks pending.

## Fidelity surfaces (not final acceptance)

- Typography: existing Cormorant Garamond and Share Tech Mono preserved; centered mixed-case hero hierarchy added.
- Spacing/layout: chapter and motion rail reserved; ordinary document scrolling retained. Product hero composition pending GLTFs.
- Colors: black, cream and restrained gold retained; cyan/silver/shadow distinguish chambers.
- Imagery: supplied artwork retained. Failed alpha generations were rejected and never copied into the project.
- Copy: commerce disclaimer preserved; honest model-pending status. Existing catalog/game names and pricing unchanged by this work.

## Evidence and next pass

Mobile fallback screenshot: C:/Users/digit/.codex/visualizations/2026/08/28/01a0476c-5c6c-7a91-a924-77d203aafef0/hybrid-mobile-pending.png

No combined native-size visual comparison has been completed; blocked, not passed. Next: obtain to3D glTF/GLB exports, inspect mesh/textures and bounds, wire verified local assets, test real 3D and context loss, inspect on mobile and reduced motion, compare full and focused regions with the reference, and re-run store/game navigation checks.
