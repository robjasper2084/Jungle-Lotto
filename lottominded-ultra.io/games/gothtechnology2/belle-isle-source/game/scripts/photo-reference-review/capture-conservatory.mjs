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
 await page.goto('http://127.0.0.1:8346/scripts/photo-reference-review/conservatory-review.html');
 await page.waitForFunction(()=>window.READY===true,{},{timeout:90000});
 for(const view of ['fernery','tropical','palm','pond','pondWide'])for(const enabled of [false,true]){
  const result=await page.evaluate(([view,enabled])=>window.review(view,enabled),[view,enabled]);
  const name=view+(enabled?'-after':'-before');await page.screenshot({path:resolve(game,'output/playwright',name+'.png'),timeout:60000});cases.push({name,...result});
 }
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{window.resizeReview();window.review('fernery');});await page.screenshot({path:resolve(game,'output/playwright','fernery-phone.png')});
 assert.equal(errors.length,0,errors.join('\n'));
}finally{await browser.close();await writeFile(resolve(game,'output/playwright','render-report.json'),JSON.stringify({errors,cases,scope:'Production conservatory geometry, materials, water and koi in an isolated local scene; not full-world FPS or physical-device certification.'},null,2));}
console.log(JSON.stringify({errors,cases}));
