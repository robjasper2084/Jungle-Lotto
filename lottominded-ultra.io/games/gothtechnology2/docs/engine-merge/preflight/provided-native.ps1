$ErrorActionPreference='Stop'
$vc='C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC\14.50.35717'
$sdk='C:\Program Files (x86)\Windows Kits\10'
$env:PATH="$vc\bin\Hostx64\x64;"+$env:PATH
$env:INCLUDE="$vc\include;$sdk\Include\10.0.22621.0\ucrt;$sdk\Include\10.0.22621.0\shared;$sdk\Include\10.0.22621.0\um"
$env:LIB="$vc\lib\x64;$sdk\Lib\10.0.22621.0\ucrt\x64;$sdk\Lib\10.0.22621.0\um\x64"
$kit='lottominded-ultra.io/games/gothtechnology2/engine/breadflowerdos/supplied-kit'
& "$vc\bin\Hostx64\x64\cl.exe" /nologo /std:c++17 /EHsc /W4 /fsanitize=address /Zi "/I$kit/engine/include" "/I$kit/third_party/breadflowerdos/src" "$kit/tests/native_test.cpp" "$kit/engine/src/input_bridge.cpp" /Fo.game-builds/engine-merge-preflight/ /Fe.game-builds/engine-merge-preflight/provided-native.exe /Fd.game-builds/engine-merge-preflight/provided-native.pdb /link /INCREMENTAL:NO
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& '.game-builds/engine-merge-preflight/provided-native.exe'
exit $LASTEXITCODE
