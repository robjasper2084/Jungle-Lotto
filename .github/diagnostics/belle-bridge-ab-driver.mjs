/** Generate a diagnostic-only variant of the pinned, otherwise unchanged
 * real native 90s full-scene driver. No app, shader or renderer modifications.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const [sourcePath,outputPath]=process.argv.slice(2);
assert(sourcePath&&outputPath,'Expected exact original strict driver and derived output paths');
const source=await readFile(sourcePath,'utf8');
const originalSha='c722b5810a7693e5ece72ed00b4401e7cde7267a';
function gitBlob(text){return createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0'+text).digest('hex')}
assert.equal(gitBlob(source),originalSha,'Original strict driver changed; refuse automatic patch');
const anchor=" await expect(page.locator('#quality')).toHaveValue(quality);";
assert.equal(source.split(anchor).length,2,'Expected one fixed strict-quality assertion');
const insertion=`
 // Diagnostic-only comparison: actual browser UI changes only the optional
 // artistic stone railing. All native full-scene rendering and original 90s
 // strict input, frame and GPS evaluation below remain unchanged.
 const bridgeVariant=process.env.BELLE_STONE_BRIDGE_AB;
 if(bridgeVariant!=='on'&&bridgeVariant!=='off')throw Error('Explicit bridge AB mode missing');
 const bridgeSwitch=page.locator('#bridge-stone-style');
 await expect(bridgeSwitch).toBeVisible();
 // The archived 'sustained-profile-game' build is the ordinary production
 // default: picture stone is OFF. It was NOT built with the gallery's preview flag.
 // Fail closed if the baseline differs, rather than comparing unknown styles.
 await expect(bridgeSwitch).not.toBeChecked();
 if(bridgeVariant==='on')await bridgeSwitch.check(); // genuine trusted input via existing UI
 if(bridgeVariant==='on')await expect(bridgeSwitch).toBeChecked();
 else await expect(bridgeSwitch).not.toBeChecked();
 report.bridgeAB={mode:bridgeVariant,source:'unchanged archived game build 5220c1a',initialChecked:false,
   uiChecked:await bridgeSwitch.isChecked(),
   toggleInput:bridgeVariant==='on'?'trusted Playwright native check':'original default OFF; no toggle',
   strictQuality:quality,fullScene:true,profileSeconds:seconds};
`;
const patched=source.replace(anchor,anchor+insertion);
// Prove byte-for-byte that only the single UI toggle was inserted.
assert.equal(patched.replace(anchor+insertion,anchor),source,'Diagnostic may insert only the real UI comparison');
assert(patched.includes("await page.keyboard.down('w');")&&patched.includes("pendingHeartbeat=page.keyboard.down('w').then(")&&patched.includes("await page.keyboard.up('w')"),'Original genuine input and heartbeat must remain');
assert(patched.includes("await page.waitForTimeout(seconds*1000)"),'Strict duration removed');
assert(patched.includes("stats.metrics?.frameMs?.p95<=50&&stats.over250ms===0"),'Strict threshold changed');
assert(patched.includes("await checkGpsFullScene({page,expect,game,output,device"),'Original GPS checks removed');
await writeFile(outputPath,patched);
console.log(JSON.stringify({originalBlob:originalSha,derivedSha256:createHash('sha256').update(patched).digest('hex'),insertedOneTrustedUIComparison:true}));
