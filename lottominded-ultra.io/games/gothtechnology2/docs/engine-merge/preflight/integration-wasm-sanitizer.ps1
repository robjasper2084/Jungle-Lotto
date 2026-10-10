$ErrorActionPreference='Stop'
$engineSdk='C:/Users/digit/Documents/Unity/Editors/6000.3.24f1/Editor/Data/PlaybackEngines/WebGLSupport/BuildTools/Emscripten'
$env:EM_CONFIG=Join-Path $engineSdk '.emscripten'
& "$engineSdk/python/python.exe" "$engineSdk/emscripten/emcc.py" 'lottominded-ultra.io/games/gothtechnology2/engine/breadflowerdos/integration/native_test.cpp' '-I.game-builds/breadflowerdos-upstream/src' '-std=c++17' '-O1' '-fsanitize=undefined' '-fno-sanitize-recover=all' '-sSINGLE_FILE=1' '-sENVIRONMENT=node' '-sEXIT_RUNTIME=1' '-sTOTAL_STACK=1048576' '-o' '.game-builds/engine-merge-preflight/integration-test.cjs'
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
node .game-builds/engine-merge-preflight/integration-test.cjs
exit $LASTEXITCODE
