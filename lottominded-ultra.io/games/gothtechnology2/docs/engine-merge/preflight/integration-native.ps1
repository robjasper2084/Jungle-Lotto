$ErrorActionPreference='Stop'
# Explicit installed SDK paths: this machine's VsDevCmd does not populate VC vars.
$engineVc='C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC\14.50.35717'
$engineWin='C:\Program Files (x86)\Windows Kits\10'
$engineWinVersion='10.0.22621.0'
$env:PATH="$engineVc\bin\Hostx64\x64;"+$env:PATH
$env:INCLUDE="$engineVc\include;$engineWin\Include\$engineWinVersion\ucrt;$engineWin\Include\$engineWinVersion\shared;$engineWin\Include\$engineWinVersion\um"
$env:LIB="$engineVc\lib\x64;$engineWin\Lib\$engineWinVersion\ucrt\x64;$engineWin\Lib\$engineWinVersion\um\x64"
& "$engineVc\bin\Hostx64\x64\cl.exe" /nologo /std:c++17 /EHsc /W4 /fsanitize=address /Zi /I.game-builds/breadflowerdos-upstream/src 'lottominded-ultra.io/games/gothtechnology2/engine/breadflowerdos/integration/native_test.cpp' /Fo.game-builds/engine-merge-preflight/integration-native.obj /Fe.game-builds/engine-merge-preflight/integration-native.exe /Fd.game-builds/engine-merge-preflight/integration-native.pdb /link /INCREMENTAL:NO
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& '.game-builds/engine-merge-preflight/integration-native.exe'
exit $LASTEXITCODE

