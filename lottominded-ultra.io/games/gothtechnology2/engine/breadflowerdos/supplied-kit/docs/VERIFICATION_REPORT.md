# Verification report — October 9, 2026

This is evidence for the **isolated engine input component**, not the two games.

| Check | Result |
|---|---|
| Header and license Git blob verification | Passed |
| Native C++ CMake/CTest | 1 test program passed |
| Native AddressSanitizer + UndefinedBehaviorSanitizer | Passed for exercised input cases |
| Raw LLVM/wasm32 compilation | Passed; compiled binary included |
| Node WebAssembly tests | 14 passed, 0 failed |
| TypeScript strict check and emission | Passed; TypeScript 5.8.3 |
| Full upstream CMake build | Not attempted |
| Game source edits or source merge | Not performed |
| Browser/device game tests | Not performed |
| Multiplayer server / six-human tests / hosted internet | Not implemented or tested here |

The tests exercise all 64 channels across six slots, independent steering and aim,
invalid input rejection including channel 64, reset/release behavior, full-frame
validation, input snapshots, and isolated Wasm instances. They do not establish
physics correctness, network authority, browser compatibility, or engine completeness.

See the evidence directory and PROVENANCE.json for the underlying outputs and hashes.
