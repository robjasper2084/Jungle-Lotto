/** Isolated native audio buffering observation, not a game playtest or a repair. */
import assert from 'node:assert/strict';import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';import {previewMediaMiddleware} from './preview-media-server.mjs';
const root=resolve(process.env.GITHUB_WORKSPACE,'work'),store=resolve(root,'lottominded-ultra.io/games/gothtechnology2'),publicDir=resolve(store,'belle-isle-source/game/public'),out=resolve(root,'native-media-evidence');await mkdir(out,{recursive:true});
const mode=process.env.MEDIA_CASE;assert(['no-validator','strong-revalidate','strong-fresh'].includes(mode));
const bytes=await readFile(resolve(publicDir,'audio/swoop/track-01.mp3')),sha=createHash('sha256').update(bytes).digest('hex'),etag='"sha256-'+sha+'"';
const report={mode,head:process.env.GITHUB_SHA,scope:'Native HTMLAudioElement prime/pause/resume with actual pinned soundtrack; isolated fixture, not game acceptance. Raw request events, server completion and media state retained.',sha256:sha,bytes:bytes.length,server:[],network:[],pageErrors:[],finished:false};
const html=`<!doctype html><meta charset="utf-8"><button id="prime">Prime in menu</button><button id="resume">Resume</button><button id="pause">Pause</button><script>
window.mediaEvents=[];let a;function state(type){if(a)mediaEvents.push({at:performance.now(),type,paused:a.paused,currentTime:a.currentTime,network:a.networkState,ready:a.readyState,buffered:Array.from({length:a.buffered.length},(_,i)=>[a.buffered.start(i),a.buffered.end(i)])});}
function make(){if(a)return;a=window.media=new Audio();a.preload='none';a.volume=0;a.loop=false;a.src='/audio/swoop/track-01.mp3';for(const e of ['loadstart','progress','suspend','abort','error','emptied','stalled','loadedmetadata','canplay','playing','pause','waiting','ended'])a.addEventListener(e,()=>state(e));}
document.querySelector('#prime').onclick=()=>{make();state('prime-click');a.play().then(()=>{a.pause();state('primed');},e=>state('play-error:'+e));};document.querySelector('#resume').onclick=()=>{make();state('resume-click');a.play().then(()=>state('resumed'),e=>state('play-error:'+e));};document.querySelector('#pause').onclick=()=>{a.pause();state('pause-click');};
</script>`;
const middleware=previewMediaMiddleware(publicDir);
const server=createServer((request,response)=>{
 if(request.url==='/favicon.ico'){response.writeHead(204).end();return;}
 if(request.url==='/'){response.writeHead(200,{'Content-Type':'text/html','Content-Length':Buffer.byteLength(html)}).end(html);return;}
 const record={at:new Date().toISOString(),method:request.method,url:request.url,headers:request.headers,finished:false};report.server.push(record);
 const writeHead=response.writeHead;response.writeHead=function(status,headers){const updated={...headers};if(mode!=='no-validator')updated.ETag=etag;if(mode==='strong-fresh')updated['Cache-Control']='public, max-age=600';record.status=status;record.responseHeaders=updated;return writeHead.call(this,status,updated);};
 response.once('finish',()=>{record.finished=true;record.finishedAt=new Date().toISOString();});response.once('close',()=>record.closedAt=new Date().toISOString());response.once('error',error=>record.error=String(error));
 middleware(request,response,()=>response.writeHead(404,{'Content-Length':'0'}).end());
});
const require=createRequire(resolve(store,'package.json')),{chromium}=require('@playwright/test');let browser,context,page,phase='initial';
try{
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});browser=await chromium.launch({channel:'chromium',headless:false});report.browser=browser.version();context=await browser.newContext();await context.tracing.start({screenshots:false,snapshots:true,sources:true});page=await context.newPage();
 for(const event of ['request','requestfinished','requestfailed'])page.on(event,r=>report.network.push({event,phase,url:r.url(),error:r.failure()?.errorText??null,at:new Date().toISOString()}));page.on('pageerror',e=>report.pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#prime').click();await page.waitForFunction(()=>window.mediaEvents.some(e=>e.type==='primed'),null,{timeout:30000});await page.waitForTimeout(2000);
 phase='playing';await page.locator('#resume').click();await page.waitForTimeout(60000);
 phase='menu-paused';await page.locator('#pause').click();await page.waitForTimeout(90000);
 phase='resumed';await page.locator('#resume').click();await page.waitForTimeout(30000);
 phase='paused';await page.locator('#pause').click();await page.waitForTimeout(5000);
 report.media=await page.evaluate(()=>({events:window.mediaEvents,paused:media.paused,network:media.networkState,ready:media.readyState,currentTime:media.currentTime,error:media.error?.message??null}));report.finished=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;}finally{
 phase='cleanup';if(context)await context.tracing.stop({path:resolve(out,'trace.zip')});if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));report.failedRequests=report.network.filter(e=>e.event==='requestfailed');await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
