import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {shareUnityStage,UNITY_STAGE_SOURCE,UNITY_WASM_SOURCE} from './share-unity-stage.mjs';

test('stage keeps the local loader and references exact immutable program and film bytes',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'unity-stage-'));
 try {
  const stage=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/exports/jazz-stage');
  await mkdir(resolve(stage,'Build'),{recursive:true});await mkdir(resolve(stage,'StreamingAssets'));
  await writeFile(resolve(stage,'index.html'),'dataUrl:"Build/WebGL.data",codeUrl:"Build/WebGL.wasm",frameworkUrl:"Build/WebGL.framework.js",streamingAssetsUrl:"StreamingAssets"');
  for(const name of ['Build/WebGL.data','Build/WebGL.wasm','StreamingAssets/BloomPerformance.mp4'])await writeFile(resolve(stage,name),Buffer.alloc(2048,42));
  const source=resolve(root,'original.data');await writeFile(source,Buffer.alloc(2048,42));
  const result=await shareUnityStage(root),html=await readFile(resolve(stage,'index.html'),'utf8');
  assert(result.saved>0);assert(html.includes('frameworkUrl:"Build/WebGL.framework.js"'));
  for(const name of ['Build/WebGL.data','StreamingAssets'])assert(html.includes('"'+UNITY_STAGE_SOURCE+name+'"'));
  assert(html.includes('"'+UNITY_WASM_SOURCE+'"'));
  assert.equal((await readFile(source)).length,2048);
  await assert.rejects(stat(resolve(stage,'Build/WebGL.data')),{code:'ENOENT'});
 } finally {await rm(root,{recursive:true,force:true});}
});
