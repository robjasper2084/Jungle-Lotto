# Targeted asphalt and MacArthur shader reuse

This candidate removes work from two existing material paths. Its image gate is a targeted shipped-asset fixture. It is not a full-scene performance result, architectural visual approval, or controls acceptance. The original ninety-second performance workloads, their p95 ≤ 50 ms and zero frames above 250 ms requirements, and the original 32/34 minute controls workloads remain unchanged.

## Application changes

The asphalt finish already computes a repair seed and a derivative-based resolution weight. The candidate evaluates the existing remaining repair shape only when that weight can be nonzero. Both `fwidth` evaluations remain outside the branch. Every active repair operation, its constants, its relative order, the wetness binding, the roughness finish, and the material textures are retained. The material cache identity changes once to distinguish the altered shader source.

The final MacArthur warm-limestone material uses one Texture as both its native albedo and native bump source. The helper reuses the albedo center value only for that audited final material owner. The native bump offsets, derivatives, perturbation, normalization, realistic detail, weather, atmosphere, textures, geometry, and shadows remain. Its existing realistic profile is `brick|triplanar`; this candidate does not reclassify it.

The helper is installed after final landmark decoration and distant preparation. A material replacement does not generate a scene child-added event, so this explicit boundary is necessary. It preserves the existing atmosphere/shared-geometry ownership annotations and forwards the original compile/cache callbacks with their receiver, arguments, return value, exception and one-call semantics.

Eligibility is evaluated from the native uniform table during Three's own upload. The renderer refreshes map samplers and texture matrices before reading the flag getter. If it skips a same-material upload, it skips the samplers and flag together. There is no added material render callback, define mutation or eligibility-driven program invalidation.

Each compiled program also contains a constant safety decision for its actual native UV channels, video decoding, alpha/discard, clipping and depth variant. An old unequal-UV or video program stays disabled even after same-feature texture replacement makes the current samplers alias. Foreign/inherited owners get independent false bindings to the same guarded shader form. Unsupported decorators and changed pinned chunks stay on the original center fetch. Disposal restores only hooks still owned by this helper; a fully frozen owner remains safe through its disabled getter.

## Independent baseline and source identity

The immutable comparison source is commit `75906273c0cd414c0d004320fc6f654b4783e5b1`, tree `9f0351be133dd370a676090d27559a0adaf00605`. The workflow checks out that commit separately and reads the original asphalt source. It verifies both the full file and literal block hashes before using them. The baseline bump path is the untouched native Three chunk, captured before installing the production helper. Sixteen exported shader chunks are checked against the locked Three 0.185.1 runtime and saved with their hashes.

The driver binds the candidate head/tree, all bundled source Git blobs, locked dependencies, unchanged material factories, and every served source asset to the two exact Git trees. Actual HTTP response bodies must match the served asset hashes. This includes `landmarks.glb`, the pavement metadata/buffer and the actual asphalt/brick color/detail maps. It verifies the fixture cloud sampler is the exact existing `islandSky.ts` function. No full game build or generated timing metadata is changed by this fixture.

## Actual rendered coverage

The fixture loads the shipped MacArthur limestone primitive and joined island asphalt. It applies the real surface, realistic, photo, sunset, atmosphere, span-culling and pavement-range functions. The target retains its supplied position, normal, index and UV0 bytes in both alternatives. The fixture adds a documented offset UV1 and an exact UV0 copy as UV2 solely for native channel/transform regression cases; application geometry is unchanged.

Twenty-three paired cases cover near and distant pavement, repair-resolution transitions, grazing views, limestone near/far views, daytime/dusk lighting, real native shadows, nonzero UV channels and changed texture transforms. They also cover same-feature non-alias replacement, a nonforwarding render callback, a returned cached unequal-UV program, video-to-ordinary replacement, a later owner wrapper, frozen/replaced defines, no-map and injected-discard paths. Positive controls remove the actual repair/bump contribution, remove native light shadow membership, and hide the actual target. Required close cases must show nonzero changes on visible target pixels.

Mip cases keep actual native mipmapped samplers. Two UV2 controls calibrate the median projected source-triangle isotropic footprint just below and above an integer level, while near/far cases span a wider interval. The report labels these as geometric estimates; they are not hardware-selected anisotropic LOD measurements. The native images still exercise the actual sampler and original asset on both sides.

The read-only direct-draw observer forwards each native call once and records successful onscreen target submissions. Shader/sampler inspection requires that the current native program is the last successful color draw of the exact target and material. Reports save linked vertex/fragment sources, actual compiled UV/decode/safety flags, uploaded reuse flags, native sampler identity/filter receipts, profiles, cameras and geometry hashes. A fixture assertion cannot substitute an unrelated final draw for its target.

## Image acceptance and artifacts

The fixed canvas is 960 × 600 at DPR 1. Both alternatives use the same scene, target geometry, camera, lighting, sampler settings and native draw/range functions. Every pair requires exactly zero changed RGBA pixels and zero maximum channel delta across the entire image. There is no image tolerance, masked primary comparison or percentage allowance.

For each case the artifact retains five actual PNGs: baseline, candidate, target hidden, shadows disabled and effect disabled. GPU `readPixels` follows a completion fence. The Node driver independently decodes each saved PNG using the existing locked Playwright PNG implementation, checks its pixels against the GPU receipt after only the required row reversal, then independently compares baseline/candidate RGBA bytes. It also requires equal draw/triangle counts, exact camera/geometry receipts and all positive controls. Partial failure reports and already produced images remain available.

The two additive CI jobs explicitly require actual Metal on macOS and actual SwiftShader on Ubuntu. A software fallback cannot pass the Metal contract. Foreground visibility/focus, source identity, native shader errors, failed requests and context loss are checked. No local native image result is claimed until those jobs complete on the reviewed candidate.

## Reproduce

Use the exact candidate checkout and existing locked game/browser dependencies. Create a separate sparse checkout of the original commit above at the repository's `.shader-reuse-baseline` path, or set `SHADER_REUSE_BASELINE_REPO` to that checkout. From the game directory:

```sh
node --experimental-strip-types --test src/belle/bumpCenterReuse.test.ts src/belle/asphaltPolish.test.ts scripts/shader-reuse-proof-contract.test.mjs
npx tsc --noEmit
npx tsc --noEmit --pretty false --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --lib ES2022,DOM --skipLibCheck --strict --types vite/client scripts/shader-reuse-proof-browser.ts
SHADER_REUSE_SOURCE_SHA="$(git rev-parse HEAD)" SHADER_REUSE_BACKEND=metal node scripts/shader-reuse-native-proof.mjs
```

Use `SHADER_REUSE_BACKEND=swiftshader` for the separately labeled software run. Reports and images are written to `output/shader-reuse-proof/`, or to `SHADER_REUSE_OUT`. Passing this targeted fixture proves the recorded image equivalence cases; any performance gain must be measured independently with the original full-scene gates.
