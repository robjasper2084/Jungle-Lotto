import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const game=resolve(import.meta.dirname,'../..'),require=createRequire(resolve(game,'../../package.json'));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[],cases=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:8346/scripts/photo-reference-review/site-review.html');
 await page.waitForFunction(()=>window.READY===true,{},{timeout:120000});
 for(const view of ['bridge','bridgeWide','casino','playground','beach','fountain'])for(const hour of [12,17.5]){
  const result=await page.evaluate(([view,hour])=>window.review(view,hour),[view,hour]);
  const name=view+'-'+hour;await page.screenshot({path:resolve(game,'output/playwright',name+'.png'),timeout:60000});cases.push({name,...result});
 }
 assert.equal(errors.length,0,errors.join('\n'));
}finally{await browser.close();await writeFile(resolve(game,'output/playwright','site-render-report.json'),JSON.stringify({errors,cases,scope:'Production components under isolated review lighting; full game verified separately.'},null,2));}
console.log(JSON.stringify({errors,cases}));
