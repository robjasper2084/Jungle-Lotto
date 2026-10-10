$ErrorActionPreference = 'Stop'
# Unity's full installed toolchain. No freestanding-header shims are used.
$engineSdk = 'C:\Users\digit\Documents\Unity\Editors\6000.3.24f1\Editor\Data\PlaybackEngines\WebGLSupport\BuildTools\Emscripten'
$env:EM_CONFIG = Join-Path $engineSdk '.emscripten'
$enginePython = Join-Path $engineSdk 'python/python.exe'
$engineCompiler = Join-Path $engineSdk 'emscripten/emcc.py'
$engineEvidence = 'lottominded-ultra.io/games/gothtechnology2/docs/engine-merge/evidence'
& $enginePython $engineCompiler --version 2>&1 | Tee-Object "$engineEvidence/compiler-version.log"
& $enginePython $engineCompiler 'lottominded-ultra.io/games/gothtechnology2/docs/engine-merge/preflight/probe-components.cpp' '-I.game-builds/breadflowerdos-upstream/src' '-std=c++17' '-O0' '-sSINGLE_FILE=1' '-sENVIRONMENT=node' '-sEXIT_RUNTIME=1' '-o' '.game-builds/engine-merge-preflight/component-probe.cjs' 2>&1 | Tee-Object "$engineEvidence/wasm-compile.log"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node .game-builds/engine-merge-preflight/component-probe.cjs 2>&1 | Tee-Object "$engineEvidence/wasm-probe.log"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
# Audit a real candidate without altering or disabling upstream layout assertions.
# Expected incompatibility is recorded separately from the passing input probe.
& $enginePython $engineCompiler '-fsyntax-only' '-std=c++20' '-I.game-builds/breadflowerdos-upstream/src' '.game-builds/breadflowerdos-upstream/src/dice/hfe/EventManager.cpp' 2>&1 | Tee-Object "$engineEvidence/event-manager-wasm-portability.log"
$portabilityExit = $LASTEXITCODE
@{ componentProbe='PASS'; eventManagerPortabilityExit=$portabilityExit; providedBridgeSuite='See provided-* evidence; not executed by this probe'; fullEngineBuild='NOT_ATTEMPTED' } | ConvertTo-Json | Set-Content "$engineEvidence/wasm-preflight-status.json"
exit 0
