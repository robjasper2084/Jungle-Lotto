import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gitBlob,pins,sha256} from './provenance.mjs';

// Exact function bodies from the immutable original controls driver. The
// separate diagnostic calls only its initial native UI sequence. No function
// is reimplemented, transformed, evaluated inside the page or written to app.
const sections=[
 ['tap','async function tap(locator){','// Only the existing, explicit command call sites'],
 ['diagnosticActivate','async function diagnosticActivate(locator){','/** Read geometry before requesting'],
 ['scrollIfNeeded','async function scrollIfNeeded(locator){','async function openMenu('],
 ['menus','async function openMenu(','/** Use actual native key events'],
 ['selectWithKeyboard','async function selectWithKeyboard(selector,value){','async function setReduced('],
 ['setReduced','async function setReduced(value){','async function setCorner('],
 ['painted','async function painted(){','async function capture('],
];

export function deriveNativeSetup(source){
 assert.equal(gitBlob(Buffer.from(source)),pins.scripts['cadillac-mods-browser-smoke.mjs'],'Original controls driver changed');
 const receipts=[],chunks=[];
 for(const [name,start,end] of sections){
  const a=source.indexOf(start);assert(a>=0,'Missing native section '+name);
  assert.equal(source.indexOf(start,a+start.length),-1,'Ambiguous native section '+name);
  const b=source.indexOf(end,a+start.length);assert(b>a,'Missing native section end '+name);
  const content=source.slice(a,b);chunks.push(content);
  receipts.push({name,startByte:a,endByte:b,sha256:sha256(content)});
 }
 const module="import assert from 'node:assert/strict';\n"+
  'export function createOriginalNativeSetup({page,nativeInput,caseLifecycle,operationTiming,report,expect}){\n'+
  'const mobile=false;\nconst checkResult=(key,value)=>caseLifecycle.publish(()=>{report.checks[key]=value;});\n'+
  chunks.join('\n')+'\nreturn {tap,tapStart,openMods,closeSettings,setReduced,selectWithKeyboard,painted};\n}\n';
 return{module,receipts};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [original,output,receipt]=process.argv.slice(2);
 const derived=deriveNativeSetup(await readFile(original,'utf8'));
 await writeFile(output,derived.module);
 await writeFile(receipt,JSON.stringify({originalGitBlob:pins.scripts['cadillac-mods-browser-smoke.mjs'],derivedSha256:sha256(derived.module),sections:derived.receipts},null,2)+'\n');
}
