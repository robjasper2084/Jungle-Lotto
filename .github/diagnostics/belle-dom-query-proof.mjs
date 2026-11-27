// Native Chrome DOM semantic proof and microbenchmark only; NOT gameplay acceptance.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const app=resolve(process.argv[2]),out=resolve(process.argv[3]);
await mkdir(out,{recursive:true});
const runtime=resolve(app,'lottominded-ultra.io/games/gothtechnology2');
const game=resolve(runtime,'belle-isle-source/game');
const require=createRequire(resolve(runtime,'package.json'));
const {chromium}=require('@playwright/test');
const {createOpenDialogProbe}=await import(pathToFileURL(resolve(game,'src/belle/renderDomQueries.ts')).href);
const html=await readFile(resolve(game,'index.html'),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/*',route=>route.abort());
 const result=await page.evaluate(({html,source})=>{
  const fixture=new DOMParser().parseFromString(html,'text/html');
  fixture.querySelectorAll('script,link,iframe,object,embed,base').forEach(n=>n.remove());
  for(const el of fixture.querySelectorAll('*'))for(const a of Array.from(el.attributes))if(/^on/i.test(a.name))el.removeAttribute(a.name);
  document.body.replaceWith(document.importNode(fixture.body,true));
  const createProbe=Function('return ('+source+')')();
  const native=()=>!!document.querySelector('dialog[open]');
  const probe=createProbe(document),checks=[];
  for(const d of document.querySelectorAll('dialog[open]'))d.removeAttribute('open');
  const check=(label,expected)=>{
   const original=native(),actual=probe();
   checks.push({label,original,actual,expected});
   if(actual!==original||actual!==expected)throw Error('DOM mismatch: '+label);
  };
  check('all closed',false);
  const d=document.createElement('dialog'),second=document.createElement('dialog');
  d.setAttribute('open','false');check('detached open attribute',false);
  document.body.append(d);check('insert already-open dialog',true);
  d.removeAttribute('open');check('remove open attribute synchronously',false);
  d.showModal();check('showModal synchronously',true);
  d.close();check('close synchronously',false);
  document.body.append(second);second.open=true;check('second dialog opens',true);
  d.open=true;second.remove();check('remove another open dialog',true);
  d.remove();check('remove final open dialog',false);
  const host=document.createElement('div');document.body.append(host);
  const shadow=host.attachShadow({mode:'open'}),inside=document.createElement('dialog');inside.open=true;shadow.append(inside);
  check('shadow-root dialog excluded by both document queries',false);
  host.remove();
  const foreign=document.createElementNS('http://www.w3.org/2000/svg','dialog');foreign.setAttribute('open','');document.body.append(foreign);
  check('foreign lowercase dialog matches native selector',true);foreign.remove();
  const upper=document.createElement('DIALOG');upper.open=true;document.body.append(upper);check('HTML case normalization',true);upper.remove();
  check('final close/remove',false);
  const target=document.createElement('dialog'),hud=document.createElement('div');document.body.append(target,hud);
  const samples=[],iterations=15000;
  const methods={selector:native,live:probe};
  for(const mode of ['closed','mutating'])for(const method of ['selector','live','live','selector','live','selector','selector','live']){
   target.open=false;hud.textContent='0';
   const read=methods[method];let hits=0;const start=performance.now();
   for(let i=0;i<iterations;i++){
    if(mode==='mutating'){hud.textContent=String(i&7);if((i&15)===0)target.open=((i>>4)&1)===1;}
    if(read())hits++;
   }
   samples.push({mode,method,iterations,hits,wallMs:performance.now()-start});
  }
  for(const mode of ['closed','mutating']){
   const values=samples.filter(s=>s.mode===mode).map(s=>s.hits);
   if(!values.every(v=>v===values[0]))throw Error('Microbenchmark semantic mismatch: '+mode);
  }
  target.remove();hud.remove();check('benchmark teardown',false);
  const median=a=>{a.sort((x,y)=>x-y);return(a[1]+a[2])/2;};
  const comparisons=['closed','mutating'].map(mode=>({mode,selectorMedianMs:median(samples.filter(s=>s.mode===mode&&s.method==='selector').map(s=>s.wallMs)),liveMedianMs:median(samples.filter(s=>s.mode===mode&&s.method==='live').map(s=>s.wallMs))}));
  return {scope:'Actual native Chrome DOM semantics and isolated query cost only. Inert game HTML fixture, not real-game performance or release acceptance.',documentElements:document.getElementsByTagName('*').length,checks,samples,comparisons};
 },{html,source:createOpenDialogProbe.toString()});
 assert(result.checks.every(x=>x.actual===x.original&&x.actual===x.expected));
 await writeFile(resolve(out,'dom-query-proof.json'),JSON.stringify({...result,chrome:browser.version(),platform:process.platform,sourceHead:process.env.EXPECTED_CANDIDATE},null,2)+'\n');
 console.log(JSON.stringify({checks:result.checks.length,comparisons:result.comparisons,scope:result.scope}));
}finally{await browser.close();}
