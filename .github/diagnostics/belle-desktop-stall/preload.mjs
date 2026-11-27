/** Loaded externally by Node --import. The original driver is executed directly. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {verifyPinnedInputs,PIN,sha256} from './contract.mjs';
import {installDesktopStallTrace} from './observer.mjs';

const game=resolve(dirname(process.argv[1]||''),'..');
const evidenceDirectory=resolve(process.env.BELLE_STALL_EVIDENCE||'');
const output=resolve(evidenceDirectory,'capture');
await mkdir(output,{recursive:true});
let observer;
process.on('exit',code=>{
 try{writeFileSync(resolve(output,'process-exit.json'),JSON.stringify({code,diagnosticOnly:true,releaseAcceptance:false,
  collectorNeverSetProcessExitCode:true,collectionComplete:observer?.evidence.verdict?.collectionComplete??false,
  originalHarnessPassed:observer?.evidence.verdict?.originalHarnessPassed??null,observerErrors:observer?.evidence.errorRecords??[]},null,2)+'\n');}
 catch(error){console.error('Diagnostic exit receipt could not be saved:',String(error));}
});
try{
 assert.equal(process.platform,'darwin','Native macOS Metal is required');
 assert(process.env.BELLE_STALL_EVIDENCE,'Separate diagnostic evidence directory is required');
 assert.equal(resolve(process.argv[1]),resolve(game,'scripts/sustained-ride-profile.mjs'),'Execute the exact original driver');
 assert.equal(process.env.BELLE_PROFILE_DEVICE,'desktop');assert.equal(process.env.BELLE_PROFILE_MODE,'full');assert.equal(process.env.BELLE_PROFILE_SECONDS,'90');
 const source=await verifyPinnedInputs(game,evidenceDirectory);
 const diagnosticReceiptBytes=await readFile(resolve(evidenceDirectory,'diagnostic-source-receipt.json'));
 const diagnosticReceipt=JSON.parse(diagnosticReceiptBytes);
 assert.match(diagnosticReceipt.head,/^[a-f0-9]{40}$/);assert.match(diagnosticReceipt.tree,/^[a-f0-9]{40}$/);assert(diagnosticReceipt.files.length>0);
 const diagnosticSource={head:diagnosticReceipt.head,tree:diagnosticReceipt.tree,files:diagnosticReceipt.files.length,receiptSha256:sha256(diagnosticReceiptBytes)};
 const driver=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs'),'utf8');
 await writeFile(resolve(evidenceDirectory,'original-strict-driver.mjs'),driver);
 await writeFile(resolve(evidenceDirectory,'source-receipt.json'),JSON.stringify(source,null,2)+'\n');
 const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
 observer=await installDesktopStallTrace(chromium,{game,output,source,driver,diagnosticSource});
 // Normal finalization is before the original browser.close(), after its
 // finally wrote report.json. This fallback preserves early-error evidence.
 process.once('beforeExit',()=>{if(observer.evidence.status!=='finished'){
  void observer.finish().catch(error=>writeFile(resolve(output,'finalize-failure.json'),JSON.stringify({diagnosticOnly:true,releaseAcceptance:false,error:error.stack||String(error)},null,2)+'\n'))
   .catch(error=>console.error('Diagnostic finalization receipt could not be saved:',String(error)));
 }});
}catch(error){
 await writeFile(resolve(output,'preload-failure.json'),JSON.stringify({diagnosticOnly:true,releaseAcceptance:false,pinnedHead:PIN.head,error:error.stack||String(error)},null,2)+'\n');
 throw error;
}
