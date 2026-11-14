import {appendFile} from 'node:fs/promises';
/** Passive CDP observer. No media methods, clocks, requests, or game state are changed. */
export async function observeMedia(context,page,path){
 const cdp=await context.newCDPSession(page);let writes=Promise.resolve();const ids=new Set();
 const log=(kind,event)=>{writes=writes.then(()=>appendFile(path,JSON.stringify({at:new Date().toISOString(),kind,event})+'\n'));};
 for(const event of ['playersCreated','playerPropertiesChanged','playerEventsAdded','playerMessagesLogged','playerErrorsRaised'])cdp.on('Media.'+event,e=>log('Media.'+event,e));
 cdp.on('Network.requestWillBeSent',e=>{if(/\/audio\/swoop\/track-\d+\.mp3/.test(e.request.url)){ids.add(e.requestId);log('Network.requestWillBeSent',e);}});
 for(const event of ['responseReceived','loadingFinished','loadingFailed','dataReceived'])cdp.on('Network.'+event,e=>{if(ids.has(e.requestId))log('Network.'+event,e);});
 await cdp.send('Network.enable');await cdp.send('Media.enable');
 await page.addInitScript(()=>{
  // Read-only event capture also covers detached HTMLAudioElements: native events
  // reach capture listeners on a prototype-installed listener only via construction.
  window.__belleMediaDiagnostics={clicks:[]};
  for(const name of ['click','keydown','blur','focus','visibilitychange'])window.addEventListener(name,e=>{const d=window.__belleMediaDiagnostics;if(d.clicks.length<500)d.clicks.push({at:performance.now(),type:e.type,target:e.target?.id||e.target?.tagName,hidden:document.hidden,focus:document.hasFocus()});},true);
 });
 return async()=>{log('ui',await page.evaluate(()=>window.__belleMediaDiagnostics));await writes;await cdp.detach();};
}
