# STATIC ROYALE — actual BreadFlowerDos engine merge starter

Prepared October 9, 2026.

This replaces the previous **reference-only** direction. It contains a real,
compiled slice of BreadFlowerDos C++ plus a master prompt for integrating and
extending it across Swoop Detroit, Elmwood Explorer, and six-player downtown Royale.

## Exact current status

**Implemented and tested in this package:**

- Exact upstream `PlayerInput.hpp`, verified against the GitHub blob hash.
- A bounds-checked C ABI calling upstream `setInput()` / `getInput()`.
- Six independent input slots, separate aiming/steering channels, and input clearing.
- A compiled WebAssembly module and typed JavaScript/TypeScript adapter.
- Native CMake test, native AddressSanitizer/UndefinedBehaviorSanitizer run,
  TypeScript compilation, and 14 passing Node/WebAssembly tests.
- Different WebAssembly instances keep mutable input memory separate.

**NOT implemented or claimed:** Swoop/Explorer live source integration, a complete
BreadFlowerDos build, completed engine event dispatch, movement replacement,
combat/zone simulation, a downtown arena, online rooms, six-human network tests,
actual browser gameplay tests, or hosting/deployment. The included binary exports
capability bit 1 (input only). Six input slots are not six online players.

## Files to use

1. `01_ENGINE_MERGE_MASTER_PROMPT.md` — new authoritative Codex instructions.
2. `02_ENGINE_MERGE_ACCEPTANCE_TESTS.md` — separate proof/integration/release gates.
3. `03_STATIC_ROYALE_GAMEPLAY_SPEC.md` — retained design with old engine prohibitions removed.
4. `engine/`, `web/`, `third_party/`, `dist/` — actual first engine component.
5. `evidence/` — commands/test outputs; not game-playtest results.

## Run the already-built proof (Windows, macOS, Linux with Node)

```sh
node scripts/verify-source.mjs
node --test tests/wasm.test.mjs
```

These use `dist/bridge.js` and `dist/breadflower-input.wasm`; no install is required.
The standalone proof has no network dependency and makes no paid calls.

## Rebuild the native test

```sh
cmake -S . -B build/native -DCMAKE_BUILD_TYPE=Debug
cmake --build build/native --config Debug
ctest --test-dir build/native -C Debug --output-on-failure
```

## Rebuild the Wasm proof

In Bash/WSL with LLVM `clang++` and `wasm-ld` supporting wasm32:

```sh
bash scripts/build-wasm.sh
```

TypeScript adapter (tested here with TypeScript 5.8.3):

```sh
tsc --noEmit
tsc
node --test tests/wasm.test.mjs
```

The package intentionally does not run an automatic dependency install. Preserve
project lockfiles. Use the project's compatible TypeScript toolchain when merging.

## The freestanding proof is deliberately tiny

The two headers under `engine/freestanding/` provide just the declarations needed
by the verified, header-only input component when cross-compiling without an SDK.
They are NOT a C++ standard library, an Emscripten SDK, or a general engine port.
Only `build-wasm.sh` uses these shims. Normal native compilation uses real standard
headers. Expanded engine code needs a supported full toolchain such as a pinned
Emscripten SDK, with all target-layout and runtime assumptions explicitly tested.
Do not use these shims to hide missing dependencies in the rest of the engine.

## Integration boundary

Instantiate a new Wasm instance for each match, prediction world, and replay world.
Compiled `WebAssembly.Module` code may be shared; mutable instance memory may not.
The native proof uses process-global slot storage and is NOT a multi-room native
server library. Add an explicit context API before any such native deployment.

Normalized channels range from -1 to +1. Channel 64 is an unset sentinel in the
upstream header; it must never reach the shift or array access. Validate JavaScript
integers before Wasm's integer coercion, and authenticate room/slot ownership in
the authoritative server before invoking this bridge. The bridge does not provide
identity, rate limiting, physics limits, transport, permissions, or anti-cheat.

`ActionChannels.hop` maps to the upstream generic PIAction channel as NEW adapter
semantics; the header does not already implement EUC hopping. Aim units must be
converted explicitly in map/controller adapters. `snapshot()` captures inputs only;
it is not a full movement-state rollback solution.

## No live side effects

Nothing in this kit changes a GitHub branch or a public game, creates an online
service, consumes Higgsfield credits, or deploys to production. Build and test in
staging. Review the acceptance checklist before claiming either game is merged.
