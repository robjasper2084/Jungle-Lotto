import {setTimeout as delay} from 'node:timers/promises';

export function previewReadiness(state,{travel=false}={}){
 if(state.pageErrors?.length)return {terminal:true,ready:false,error:'Unhandled browser error: '+state.pageErrors[0]};
 if(state.preview?.error)return {terminal:true,ready:false,error:'Preview preparation failed: '+state.preview.error};
 if(/^(?:Island|Preview|Dequindre Cut district) could not (?:load|prepare)/i.test(state.loading?.trim()??''))return {terminal:true,ready:false,error:state.loading.trim()};
 if(travel&&state.travelState==='failed')return {terminal:true,ready:false,error:state.travelMessage||'Preview destination preparation failed'};
 const ready=travel?state.travelState==='ready'&&!state.preview?.travelPending:state.bannerAttached&&state.startEnabled&&state.preview?.ready===true;
 return {terminal:!!ready,ready:!!ready};
}

/** Poll real state, stopping at a successful or failed terminal state. In
 * particular an enabled startup retry button never counts as a ready world. */
export async function waitForPreviewReadiness(read,{travel=false,timeout=180000,poll=100,now=Date.now,wait=delay}={}){
 const started=now();let samples=0,lastState;
 while(true){
  lastState=await read();samples++;
  const result=previewReadiness(lastState,{travel});
  if(result.error){const error=Error(result.error);error.readiness={elapsedMs:now()-started,samples,state:lastState};throw error;}
  if(result.ready)return {elapsedMs:now()-started,samples,state:lastState};
  if(now()-started>=timeout){const error=Error('Preview '+(travel?'travel':'startup')+' did not become ready within '+timeout+'ms; last stage: '+(lastState.preview?.stage||lastState.loading||'initializing'));error.readiness={elapsedMs:now()-started,samples,state:lastState};throw error;}
  await wait(Math.min(poll,Math.max(0,timeout-(now()-started))));
 }
}
