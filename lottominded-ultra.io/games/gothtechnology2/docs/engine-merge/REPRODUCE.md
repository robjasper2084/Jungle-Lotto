# Local engine review and continuation

Run PowerShell from C:/Users/digit/Documents/phone/_goth_swoop_release_20260916. All paths below are relative to that repository. Do not run the normal release/promote/deploy scripts for this review.

```powershell
$pack='lottominded-ultra.io/games/gothtechnology2'
node "$pack/docs/engine-merge/preflight/source-preflight.mjs"
Push-Location "$pack/engine/breadflowerdos/supplied-kit"
node scripts/verify-source.mjs
node --test tests/wasm.test.mjs
Pop-Location
node "$pack/swoop-source/node_modules/typescript/bin/tsc" -p "$pack/engine/breadflowerdos/supplied-kit/tsconfig.json" --noEmit
& "$pack/docs/engine-merge/preflight/provided-native.ps1"
& "$pack/engine/breadflowerdos/integration/build.ps1"
& "$pack/docs/engine-merge/preflight/integration-native.ps1"
& "$pack/docs/engine-merge/preflight/integration-wasm-sanitizer.ps1"
Push-Location "$pack/ride-core"
npm run build
node --experimental-transform-types --test tests/engine-royale.test.ts
node --experimental-transform-types --test tests/royale.test.ts
Pop-Location
Push-Location "$pack/love-tag-server"
npm run build
node --test tests/royale-clock.mjs
$env:BREADFLOWER_ENGINE='1'
$env:PORT='8212'
$env:HOST='127.0.0.1'
node dist/server.js
```

The final server command remains running. In another terminal, from the server directory:

```powershell
node tests/engine-royale-online.mjs
node tests/engine-royale-round.mjs
```

The second command runs a real-time round (up to about 6.5 minutes), tests a new client object reconnecting and immediately firing, requires bot shots and authoritative hits, then tests rematch. It is one automated client plus five AI. It is not a six-human test. It writes a bounded evidence file without reconnect credentials.

Build and serve the separate packages from repository root:

```powershell
node .game-builds/build-engine-staging.mjs
node .game-builds/engine-review-server.mjs
```

Swoop: http://127.0.0.1:4191/arcade/swoop-detroit/?engine=breadflower

Actual Elmwood: http://127.0.0.1:4191/arcade/elmwood-explorer/elmwood.html?engine=breadflower

Royale: use each game's menu entry. Both enter the same royale.html with from=swoop or from=elmwood. The dialog and header each return to the correct game. Online local testing uses http://127.0.0.1:8212; disable the Supabase-test checkbox if an older shared configuration enables it. The existing Supabase relay is not evidence for this new engine revision until explicitly tested with it.

Removing engine=breadflower restores the existing input/rules implementation. Current staging has no effect on public/live packages. To abandon this review, stop only the loopback processes started for ports 4191/4192/8212 and leave previous live files intact. Do not reset/clean the shared dirty repository.

Fault test, repository root: node "$pack/docs/engine-merge/preflight/failure-server.mjs". Port 4192 deliberately returns invalid Wasm bytes. Visit both normal-game routes with the engine flag: expect the hash-error alert and working normal riding. Do not publish this server.

Unity: open swoop-source/art/animation-polish/Unity/Assets/EngineReview/EngineAssetPreview.unity with the installed 6000.3.24f1 editor. The new editor command BreadflowerAssetReview.Run reads six copied shipping assets and writes a report via -engineEvidence. Existing master scenes/import settings are untouched. Blender validation: run docs/engine-merge/preflight/blender-assets.py with installed Blender in background mode; it writes evidence only.

## Remaining CORE_RELEASE gates

1. Finalize the compact downtown visual scene using existing original assets. Reconcile the other chat's full-map request with the kit's single compact arena before replacing its collision/layout contract. Keep original exploration maps and LOVE TAG independent.
2. Add actual multi-touch and controller-device playtests, focus/rearm and saved-settings comparisons for both products. Profile original maps and Royale on physical iPad/Android hardware; viewport resizing is not hardware validation.
3. Extend packet-delay/loss and sustained multi-room load tests; record correction distributions and p95/p99 server/frame timings. A single maximum-step metric and localhost round are insufficient WAN/load evidence.
4. Stage this exact module/client revision on an authorized HTTPS/WSS test destination (or update the already authorized private Supabase + computer test relay with matching hashes). Do not deploy live games. **Six-human acceptance is pending at the user's explicit request.** When the user resumes that gate, use six independent human participants on different networks and record ready/start/combat, pause, reconnect near elimination, zone end, outcome, rematch and both return paths. Automated clients cannot replace those participants.
5. Reconcile every remaining acceptance row, obtain release authorization, then use the normal scoped release process. Until then this is a local engine integration in progress, not a completed engine merge or released multiplayer game.

After source changes, run `node "$pack/docs/engine-merge/preflight/snapshot-evidence.mjs"` to refresh the scoped source manifest. Read ACCEPTANCE.json for the next action on each gate. Historical/preparation results are not current PASS entries without executing the named check.

## Original-map correction

The isolated Royale page now loads the original Swoop map for both origins. Run `node tests/downtown-royale.mjs` from love-tag-server to verify six starts, supplies, routes and compiled field coordinates. Then run the existing engine-royale-online.mjs and engine-royale-round.mjs; both now load the same canonical downtown fixture. Set TAG_BIND_HOST=127.0.0.1 for the local authority. Use each original game menu and its return link; normal Elmwood remains its separate cemetery. No production package is promoted.
