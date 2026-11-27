import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const game=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BELLE_DIALOG_CHECK_OUTPUT??resolve(game,'output/open-dialog-state'));
await mkdir(output,{recursive:true});
const helperPath=resolve(game,'src/belle/openDialogState.ts');
const boundaryPath=resolve(game,'src/belle/modalMeasurementBoundary.ts');
const helper=await readFile(helperPath,'utf8'),boundary=await readFile(boundaryPath,'utf8');
const compile=source=>stripTypeScriptTypes(source,{mode:'strip'});
let browser,result;
try{
 browser=await chromium.launch({headless:true,...(process.env.BELLE_DIALOG_BROWSER_EXECUTABLE?{executablePath:process.env.BELLE_DIALOG_BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage();
 await page.setContent('<!doctype html><html><head><title>Dialog state equivalence</title></head><body><main><section id="parent"><dialog id="one"></dialog><dialog id="two"></dialog></section></main></body></html>');
 result=await page.evaluate(async({helper,boundary})=>{
  const load=async source=>{const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));try{return await import(url);}finally{URL.revokeObjectURL(url);}};
  const helperExports=await load(helper),boundaryExports=await load(boundary);
  const query=document.querySelector.bind(document),original=Object.getOwnPropertyDescriptor(document,'querySelector');
  let scans=0,boundaries=0;
  Object.defineProperty(document,'querySelector',{configurable:true,writable:true,value:function(selector){if(selector==='dialog[open]')scans++;return query(selector);}});
  const state=helperExports.createOpenDialogState(document);
  const stopBoundary=boundaryExports.observeModalMeasurementBoundaries(document,()=>boundaries++);
  const observations=[];
  const check=name=>{
   const expected=!!query('dialog[open]'),actual=state.hasOpenDialog();
   if(actual!==expected)throw Error(name+': expected '+expected+', received '+actual);
   observations.push({name,expected,actual});
  };
  try{
   check('initial closed state');const afterInitial=scans;
   for(let i=0;i<10000;i++)if(state.hasOpenDialog())throw Error('Stable false changed');
   if(scans!==afterInitial)throw Error('Unchanged reads still scan the DOM');
   const one=query('#one'),two=query('#two'),parent=query('#parent');
   one.showModal();check('showModal before observer delivery');
   one.close();check('close before observer delivery');
   one.show();check('show before observer delivery');
   two.open=true;check('multiple open dialogs');
   one.close();check('closing one retains the other open dialog');
   parent.remove();check('remove open ancestor');
   document.body.append(parent);check('reinsert open ancestor');
   two.remove();check('remove last open dialog');
   parent.append(two);check('reparent already open dialog');
   two.removeAttribute('open');check('remove open attribute');
   two.setAttribute('open','false');check('attribute presence despite false text');
   two.toggleAttribute('open',false);check('toggle attribute off');
   const fragment=document.createDocumentFragment(),nested=document.createElement('div');
   nested.innerHTML='<section><dialog open></dialog></section>';fragment.append(nested);
   document.body.append(fragment);check('fragment with open descendant');
   nested.replaceChildren();check('replace open descendants');
   const host=document.createElement('div');document.body.append(host);
   const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<dialog open></dialog>';
   check('shadow dialogs remain outside document query scope');
   const details=document.createElement('details');document.body.append(details);check('new details stays false');
   details.open=true;check('unrelated open attribute stays false');
   const beforeClass=scans;host.className='changed';check('unrelated class stays false');
   if(scans!==beforeClass)throw Error('Unobserved irrelevant class invalidated presence');
   await Promise.resolve();
   const beforeBoundary=boundaries;
   one.show();check('short transition open, cache queue drained');
   one.close();check('short transition close, cache queue drained');
   if(boundaries!==beforeBoundary)throw Error('Boundary callback unexpectedly ran synchronously');
   await Promise.resolve();
   if(boundaries!==beforeBoundary+1)throw Error('Private cache stole or changed the measurement observer batch');
   const nextBody=document.createElement('body');nextBody.innerHTML='<dialog open></dialog>';
   document.body.replaceWith(nextBody);check('body replacement with open dialog');
   nextBody.firstElementChild.remove();check('new body dialog removal');
   const nextRoot=document.createElement('html');nextRoot.innerHTML='<head><title>Replacement</title></head><body><div><dialog open></dialog></div></body>';
   document.documentElement.replaceWith(nextRoot);check('documentElement replacement with open descendant');
   query('dialog').close();check('close after documentElement replacement');
   state.dispose();state.dispose();const beforeDisposed=scans;
   query('dialog').open=true;check('disposed state delegates current open DOM');
   query('dialog').open=false;check('disposed state delegates current closed DOM');
   if(scans!==beforeDisposed+2)throw Error('Disposed reads did not stay live');
   return {observations,stableReads:10000,stableReadScans:0,initialReadScans:afterInitial,totalScans:scans,independentBoundaryBatchPreserved:true};
  }finally{
   state.dispose();stopBoundary();
   if(original)Object.defineProperty(document,'querySelector',original);else delete document.querySelector;
  }
 },{helper:compile(helper),boundary:compile(boundary)});
 assert(result.observations.every(x=>x.expected===x.actual));
 const receipt={passed:true,browser:await browser.version(),platform:process.platform,
  helperSha256:createHash('sha256').update(helper).digest('hex'),boundarySha256:createHash('sha256').update(boundary).digest('hex'),
  actualNativeDom:true,actualOriginalBoundaryObserver:true,nativeRidePerformanceAcceptance:false,
  limitations:'This headless Chromium fixture proves DOM/mutation behavior and selector elimination, not frame-time improvement or Metal rendering acceptance.',...result};
 await writeFile(resolve(output,'native-dom-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
}catch(error){
 await writeFile(resolve(output,'native-dom-receipt.json'),JSON.stringify({passed:false,error:String(error?.stack??error),nativeRidePerformanceAcceptance:false},null,2)+'\n');
 throw error;
}finally{await browser?.close();}
