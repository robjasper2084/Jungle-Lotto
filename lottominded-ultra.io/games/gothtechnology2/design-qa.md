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

---

# Black Signal rail-adapter product update — 2026-08-29

final result: passed

## Source and scope

- Replaced the image-pending Black Signal product with the supplied front and underside rail-adapter references.
- Kept the existing `black-signal-digital-pack` route stable, changed the catalog type to Accessories, and retained the existing $12 preview price.
- Applied the requested shop-card title `Gun Charm Heavy Duty Rail Adapter` and product-detail title `Black Signal Gun Charm Rail Adaptern Pack`.
- Preserved concept-mode safeguards: no orders, payments, stock claims, or checkout were added.

## Visual comparison

- Compared the 800×800 supplied front reference with the rendered desktop gallery at the same primary-image state. The full adapter silhouette, white background, neutral color, and centered scale were preserved without stretching or unintended crop.
- Verified the distinct 300×300 underside reference through the labeled gallery thumbnail; the main image switches to the clamp/spring view.
- Desktop gallery and Accessories shop card retain the existing black, cream, and gold storefront system.
- Responsive browser pass crossed the mobile breakpoint and reported document `scrollWidth === clientWidth`; the browser host applies a capture scale, so the responsive pass is based on rendered DOM measurements plus the captured mobile state rather than native-pixel screenshot dimensions.

## Verification

- `npm.cmd run check:store` — passed.
- `npm.cmd run test:store` — 31 tests passed.
- `npm.cmd run build` — 31 routes built; existing large-chunk warning only.
- In-app browser — shop card title/image/$12 price passed; product H1/front image/underside switch passed; no warning or error console logs observed.

---

# Product-shoot and Mobster artwork update — 2026-08-29

final result: passed

## Source and scope

- Added three supplied Black Signal compositions to the existing rail-adapter product gallery: a black-background group reference, an equipment-context photograph, and a white-background charm-group reference.
- Kept the supplied front and underside adapter references, creating a five-image gallery without changing the stable product route, $12 preview price, or concept-only commerce safeguards.
- Made the black-background group reference the Black Signal shop-card image.
- Replaced the Mobster Luggage Charm product reference with the supplied cyan-arch composition.
- Reused that Mobster artwork in the first signal-card image slot with a dedicated centered 900×1205 crop. The existing `The Analog` name and collection mapping remain unchanged.

## Visual comparison

- Compared each supplied composition with its rendered storefront placement. The full-width product references retain their 16:9 framing and use the existing contained gallery treatment, avoiding stretching or clipped hardware.
- The signal-card derivative uses a separate portrait crop so the Mobster character, gold hardware, cyan arch, and black circuit strap remain legible in the narrow card.
- The black-background group reference integrates with the Shop card's dark media surface while preserving the supplied composition.
- Desktop and 365px mobile DOM measurements reported `scrollWidth === clientWidth` for the product, home, and Shop routes.

## Verification

- `npm.cmd run check:store` — passed.
- `npm.cmd run test:store` — 31 tests passed.
- `npm.cmd run build` — 31 routes built; existing large-chunk warning only.
- In-app browser — Mobster primary image, first signal image/title, Black Signal Shop card image/title/$12 price, five-image product gallery, and all thumbnail switches passed.
- Browser console — no warning or error logs observed.
- `git diff --check` — passed; existing line-ending notices only.

---

# Shop-card and rail-adapter reference swaps — 2026-08-29

final result: passed

## Source and scope

- Replaced the Mobster Luggage Charm Shop-card artwork with the supplied black-background product shot.
- Added an explicit product `cardImage` field so the Shop replacement does not alter the existing cyan-arch product-detail gallery reference or saved-cart image.
- Replaced the Black Signal gallery's fourth `Front reference` view with the supplied rail-adapter photograph on textured black fabric.
- Preserved product routes, titles, preview prices, image labels, and concept-only commerce safeguards.

## Visual and responsive verification

- Compared both supplied 1376×768 compositions with their rendered placements. Each retains its original framing and aspect ratio without stretching or destructive crop.
- Desktop Shop card resolves the dedicated Mobster black-background image while the product-detail page continues to resolve the cyan-arch primary image.
- The Black Signal `Front reference` thumbnail switches the main gallery to the dark-fabric photograph and exposes the correct descriptive alternative text.
- Desktop and 365px mobile DOM measurements reported `scrollWidth === clientWidth` for both updated surfaces.
- Browser console reported no warning or error logs.

## Checks

- `npm.cmd run check:store` — passed.
- `npm.cmd run test:store` — 31 tests passed.
- `npm.cmd run build` — 31 routes built; existing large-chunk warning only.

---

# Signal-card artwork move and replacement — 2026-08-29

final result: passed

## Source and scope

- Replaced the first signal-card image with the supplied Mobster-and-rail-adapter composition.
- Produced a dedicated 900×1200 portrait crop matching the existing signal-card media ratio, retaining the Mobster character, gold hardware, and the black rail adapter without stretching.
- Moved the previous first-column cyan-arch artwork three columns over into the fourth signal-card image slot.
- Kept the existing signal names, collection destinations, merchandising labels, and card controls in place.

## Verification

- Desktop DOM — column one resolves `keychain-analog-mobster-adapter-black-reference.webp`; column four resolves `keychain-analog-mobster-cyan-arch-reference.webp`.
- Responsive DOM — the same first/fourth ordering passed with document `scrollWidth === clientWidth`; the browser host reported a scaled 405px CSS viewport for the mobile capture.
- All four signal images loaded at their expected portrait dimensions; no browser warning or error logs were observed.
- `npm.cmd run check:store` — passed.
- `npm.cmd run test:store` — 31 tests passed.
- `npm.cmd run build` — 31 routes built; existing large-chunk warning only.

---

# New Drop background music and Mobster gallery addition — 2026-08-29

final result: passed

## Source and scope

- Added the supplied 49.16-second LottoMind Vault track to the New Drop homepage as low-volume looping background music.
- The page attempts audible playback on open. Browser autoplay policy may block that attempt, so the existing Experience settings Sound control remains the accessible fallback and remembers an explicit off choice.
- Added the supplied Mobster equipment composition as a second product-gallery reference while retaining the cyan-arch image as the primary detail image and the existing black-background Shop card image.
- Preserved the stable Mobster route, $19.99 preview price, and concept-only commerce safeguards.

## Verification

- `npm.cmd run check:store` — passed.
- `npm.cmd run test:store` — 32 tests passed.
- `npm.cmd run build` — 31 routes built; existing large-chunk warning only.
- In-app browser — audible autoplay was blocked by browser policy; the existing Sound control started the supplied loop at volume 0.13 and reported the correct pressed state.
- In-app browser — Mobster primary and equipment-context thumbnails both loaded; the added image preserved its 1376×768 dimensions and descriptive alternative text.
- Responsive DOM — mobile override reported document `scrollWidth === clientWidth`; the browser host scaled the requested viewport to 520 CSS px.

---

# Collections Observer artwork override — 2026-08-29

final result: passed

## Source and scope

- Replaced only the fourth signal-card image on the Collections index with the supplied gold-arch Observer reference.
- Kept the New Drop fourth-column cyan-arch image unchanged, preserving the earlier page-specific artwork request.
- Kept the Observer name, Cyber Cathedral destination, Gold observer keychain label, Kalyx fighter link, and responsive card system unchanged.

## Verification

- `npm.cmd run check:store` — passed.
- `npm.cmd run test:store` — 32 tests passed.
- `npm.cmd run build` — 31 routes built; existing large-chunk warning only.
- In-app browser — Collections fourth signal resolves `keychain-observer-gold-arch-reference.webp` with the supplied-reference alternative text; all four card images loaded.
- In-app browser — New Drop fourth signal still resolves `keychain-analog-mobster-cyan-arch-reference.webp`.
- Responsive DOM — desktop and scaled-mobile passes reported document `scrollWidth === clientWidth`; the fourth Collections image loaded in both states.
