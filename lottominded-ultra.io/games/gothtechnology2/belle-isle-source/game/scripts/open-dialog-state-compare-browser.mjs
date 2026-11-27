// Exact-source, inert-DOM cost comparison. This is not gameplay or release acceptance.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const game=resolve(process.argv[2]||fileURLToPath(new URL('..',import.meta.url)));
const output=resolve(process.argv[3]||resolve(game,'output/open-dialog-state-compare'));
const runtimeRequire=createRequire(resolve(game,'package.json'));
const {chromium}=runtimeRequire('playwright');
const files={old:'src/belle/renderDomQueries.ts',cache:'src/belle/openDialogState.ts',
 boundary:'src/belle/modalMeasurementBoundary.ts',html:'index.html',main:'src/belle/main.ts'};
const source={},receipts={};
for(const [key,path] of Object.entries(files)){
 const bytes=await readFile(resolve(game,path));source[key]=bytes.toString('utf8');
 receipts[key]={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
  gitBlob:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')};
}
assert.equal(receipts.old.gitBlob,'519499351386b2868dfde95225db8523890d340c');
assert.equal(receipts.cache.gitBlob,'241263873ab49b285984a3c0e0a63b29ad3585b0');
assert.equal(receipts.boundary.gitBlob,'0d13b56223fa136ca8f6c05c130b3cb32d418c9c');
const meta={scope:'Inert exact game HTML with native DOM APIs. No WebGL, gameplay, frames, input, screenshots or release acceptance.',
 sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim(),receipts,
 scriptSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
 trials:'Fixed balanced order; every sample retained. No threshold-based retries or outlier removal.',
 platform:process.platform,node:process.version};
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'source-receipt.json'),JSON.stringify(meta,null,2)+'\n');
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BELLE_DIALOG_BROWSER_EXECUTABLE?
  {executablePath:process.env.BELLE_DIALOG_BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage();await page.route('**/*',route=>route.abort());
 const result=await page.evaluate(async input=>{
  const html=new DOMParser().parseFromString(input.html,'text/html');
  html.querySelectorAll('script,link,iframe,object,embed,base').forEach(n=>n.remove());
  for(const node of html.querySelectorAll('*'))for(const attr of Array.from(node.attributes))
   if(/^on/i.test(attr.name))node.removeAttribute(attr.name);
  document.body.replaceWith(document.importNode(html.body,true));
  const nativeQuery=document.querySelector.bind(document),nativeAll=document.querySelectorAll.bind(document);
  const load=async text=>{const url=URL.createObjectURL(new Blob([text],{type:'text/javascript'}));
   try{return await import(url);}finally{URL.revokeObjectURL(url);}};
  const oldModule=await load(input.old),cacheModule=await load(input.cache),boundaryModule=await load(input.boundary);
  let boundaries=0;
  const stopBoundary=boundaryModule.observeModalMeasurementBoundaries(document,()=>boundaries++);
  const host=document.createElement('section');host.id='bounded-dom-cost-fixture';
  const dialog=document.createElement('dialog'),second=document.createElement('dialog');
  const hud=Array.from({length:5},()=>document.createElement('span'));
  host.append(dialog,second,...hud);document.body.append(host);
  const closeAll=()=>nativeAll('dialog[open]').forEach(node=>node.removeAttribute('open'));
  const correctness=[],samples=[];
  const methods=['selector','live','cache'];
  const factory=method=>{
   if(method==='selector')return {read:()=>!!nativeQuery('dialog[open]'),dispose(){}};
   if(method==='live')return {read:oldModule.createOpenDialogProbe(document),dispose(){}};
   const state=cacheModule.createOpenDialogState(document);
   return {read:state.hasOpenDialog,dispose:state.dispose};
  };
  try{
   closeAll();await Promise.resolve();
   const states=Object.fromEntries(methods.map(name=>[name,factory(name)]));
   const check=name=>{
    const expected=!!nativeQuery('dialog[open]'),actual=Object.fromEntries(methods.map(name=>[name,states[name].read()]));
    if(Object.values(actual).some(value=>value!==expected))throw Error('DOM semantic mismatch '+name);
    correctness.push({name,expected,actual});
   };
   try{
    check('initial closed');
    dialog.showModal();check('showModal same task');
    dialog.close();check('close same task');
    dialog.setAttribute('open','false');check('open false attribute still matches');
    dialog.removeAttribute('open');check('remove open attribute');
    second.open=true;check('second opens');second.remove();check('remove open element');
    host.append(second);check('reinsert already open');second.open=false;check('close reinserted');
    const count=boundaries;dialog.open=true;dialog.open=false;check('open-close batch final false');
    await Promise.resolve();
    if(boundaries<=count)throw Error('Independent modal-boundary observer lost the open-close batch');
    correctness.push({name:'independent measurement observer retained batch',before:count,after:boundaries});
    const shadowHost=document.createElement('div'),inside=document.createElement('dialog');
    inside.open=true;shadowHost.attachShadow({mode:'open'}).append(inside);host.append(shadowHost);
    check('shadow-root dialog excluded');shadowHost.remove();
    const foreign=document.createElementNS('http://www.w3.org/2000/svg','dialog');
    foreign.setAttribute('open','');host.append(foreign);check('foreign lowercase dialog included');
    foreign.remove();check('foreign dialog removal');
   }finally{for(const state of Object.values(states))state.dispose();}
   const orders=[
    ['selector','live','cache','cache','live','selector'],
    ['live','cache','selector','selector','cache','live'],
    ['cache','selector','live','live','selector','cache']];
   const cases=[
    {name:'stable',hudWrites:0,interleaved:false,toggle:false},
    {name:'one-hud-child-list-update-per-20-reads',hudWrites:1,interleaved:false,toggle:false},
    {name:'five-hud-child-list-updates-per-20-reads',hudWrites:5,interleaved:false,toggle:false},
    {name:'synchronous-dialog-toggle-with-hud',hudWrites:1,interleaved:false,toggle:true},
    {name:'child-list-update-before-every-read',hudWrites:1,interleaved:true,toggle:false}];
   const frames=2000,readsPerFrame=20;
   // These are synthetic task batches, not actual rendered or measurement frames.
   for(const scenario of cases)for(let block=0;block<orders.length;block++)
    for(let slot=0;slot<orders[block].length;slot++){
     const method=orders[block][slot];closeAll();for(const node of hud)node.textContent='reset';
     await Promise.resolve();
     const state=factory(method);if(state.read())throw Error('Trial began open');
     let hits=0,expectedHits=0;
     const started=performance.now();
     try{
      for(let frame=0;frame<frames;frame++){
       const expected=scenario.toggle&&(Math.floor(frame/16)%2===0);
       if(scenario.toggle)dialog.open=expected;
       if(!scenario.interleaved)for(let j=0;j<scenario.hudWrites;j++)hud[j].textContent=String(frame&7);
       for(let read=0;read<readsPerFrame;read++){
        if(scenario.interleaved)hud[0].textContent=String((frame*readsPerFrame+read)&7);
        const actual=state.read();if(actual!==expected)throw Error('Timed semantics mismatch '+method+'/'+scenario.name);
        hits+=Number(actual);expectedHits+=Number(expected);
       }
       // Include delivery of each method's own observer and the independent original observer.
       await Promise.resolve();
      }
     }finally{state.dispose();}
     const wallMs=performance.now()-started;
     if(hits!==expectedHits)throw Error('Hit count mismatch');
     samples.push({scenario:scenario.name,block,slot,method,frames,readsPerFrame,reads:frames*readsPerFrame,
      hits,expectedHits,wallMs,microsecondsPerRead:wallMs*1000/(frames*readsPerFrame)});
    }
   const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return (sorted[2]+sorted[3])/2;};
   const summaries=cases.map(scenario=>{
    const methodRows=Object.fromEntries(methods.map(method=>{
     const rows=samples.filter(row=>row.scenario===scenario.name&&row.method===method);
     if(rows.length!==6)throw Error('Missing balanced samples');
     return [method,{count:rows.length,medianMs:median(rows.map(r=>r.wallMs)),
      meanMs:rows.reduce((sum,row)=>sum+row.wallMs,0)/rows.length,
      minMs:Math.min(...rows.map(r=>r.wallMs)),maxMs:Math.max(...rows.map(r=>r.wallMs))}];
    }));
    return {scenario:scenario.name,methods:methodRows,
     cacheVsExistingLiveMedianRatio:methodRows.cache.medianMs/methodRows.live.medianMs};
   });
   return {documentElements:nativeAll('*').length,dialogElements:document.getElementsByTagName('dialog').length,
    correctness,samples,summaries,independentBoundaryCalls:boundaries};
  }finally{stopBoundary();host.remove();}
 },{html:source.html,old:stripTypeScriptTypes(source.old,{mode:'strip'}),
  cache:stripTypeScriptTypes(source.cache,{mode:'strip'}),boundary:stripTypeScriptTypes(source.boundary,{mode:'strip'})});
 const report={...meta,chrome:browser.version(),...result};
 await writeFile(resolve(output,'comparison.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({correctness:result.correctness.length,samples:result.samples.length,summaries:result.summaries,
  scope:meta.scope},null,2));
}catch(error){
 await writeFile(resolve(output,'failure.json'),JSON.stringify({...meta,error:String(error),stack:error?.stack},null,2)+'\n');
 throw error;
}finally{await browser?.close();}
