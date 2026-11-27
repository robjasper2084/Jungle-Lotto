/** Separate diagnostic preload; the original sustained harness is not edited. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RECEIPT,writeBuildInputs,writeBuildReceipt,verifyBuildReceipt,failExit} from './sustained-trace-contract.mjs';
import {installSustainedTrace} from './sustained-trace-observer.mjs';

const game=resolve(import.meta.dirname,'..');
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)&&['--write-build-inputs','--write-build-receipt'].includes(process.argv[2])){
 const receipt=await (process.argv[2]==='--write-build-inputs'?writeBuildInputs:writeBuildReceipt)(game);
 console.log(JSON.stringify({head:receipt.head,tree:receipt.tree,files:receipt.files?.length??null,diagnosticOnly:true}));
}else{
 const output=resolve(game,'output/sustained-trace/diagnostic/phone');await mkdir(output,{recursive:true});
 let observer;
 process.on('exit',code=>{writeFileSync(resolve(output,'process-exit.json'),JSON.stringify({code,diagnosticOnly:true,releaseAcceptance:false,
  collectionComplete:observer?.evidence.verdict?.collectionComplete??false,originalHarnessPassed:observer?.evidence.verdict?.originalHarnessPassed??null},null,2)+'\n');});
 try{
  assert.equal(process.platform,'darwin','This diagnostic requires native macOS Metal');
  assert.equal(resolve(process.argv[1]||''),resolve(game,'scripts/sustained-ride-profile.mjs'),'Run the original harness entry point');
  assert.equal(process.env.BELLE_PROFILE_DEVICE,'phone');assert.equal(process.env.BELLE_PROFILE_MODE,'diagnostic');assert.equal(process.env.BELLE_PROFILE_SECONDS,'90');
  const receipt=JSON.parse(await readFile(resolve(game,'dist',RECEIPT),'utf8'));
  const source=await verifyBuildReceipt(game,receipt);
  const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
  observer=await installSustainedTrace(chromium,{game,output,source,onFailure:()=>{process.exitCode=failExit(process.exitCode);}});
 }catch(error){await writeFile(resolve(output,'preload-failure.json'),JSON.stringify({diagnosticOnly:true,releaseAcceptance:false,error:error.stack||String(error)},null,2)+'\n');throw error;}
}
