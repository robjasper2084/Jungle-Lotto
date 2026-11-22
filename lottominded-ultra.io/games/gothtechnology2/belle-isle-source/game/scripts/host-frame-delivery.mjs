// Isolated diagnostic only. These fences are independent of the game's gate.
export function installFrameDelivery(){
 window.__startFrameDelivery=milliseconds=>{
  const renderer=window.__hostGameRenderer?.();if(!renderer)throw Error('Primary game renderer was not observed');
  const gl=renderer.getContext(),original=renderer.render;
  const start=performance.now(),end=start+milliseconds,queue=[],rows=[];
  let worldDraws=0,overflow=0,errors=0,contextLost=false,hidden=document.hidden,depth=0,lastPoll=start,maxPollGap=0,closed=false;
  const seen=new Map();
  function poll(){
   if(closed)return;
   const now=performance.now();maxPollGap=Math.max(maxPollGap,now-lastPoll);lastPoll=now;
   if(gl.isContextLost()){contextLost=true;return;}
   while(queue.length){
    const {fence,row}=queue[0];
    const status=gl.clientWaitSync(fence,0,0);
    if(status===gl.TIMEOUT_EXPIRED){
     // Commands execute in order: if the oldest fence has not signaled,
     // every later fence is also still pending at this observation.
     for(const item of queue)item.row.lastPending=now-start;
     break;
    }
    if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)row.observed=now-start;
    else{row.failed=true;errors++;}
    gl.deleteSync(fence);queue.shift();
   }
  }
  function timedRender(scene,camera){
   const measure=performance.now()<end&&!renderer.getRenderTarget()&&camera?.isPerspectiveCamera&&scene?.children?.length>20;
   const result=original.apply(this,arguments);
   const now=performance.now();
   if(!measure||now>=end)return result;
   poll();worldDraws++;
   seen.set(scene.uuid,(seen.get(scene.uuid)||0)+1);
   // Bound observer bookkeeping independently. Never block, flush, skip a
   // game's render or let a slow/failed driver create unlimited sync handles.
   if(queue.length>=8){overflow++;return result;}
   if(gl.isContextLost()){contextLost=true;return result;}
   const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
   if(!fence){errors++;return result;}
   const row={issued:now-start,lastPending:now-start,observed:null};
   rows.push(row);queue.push({fence,row});depth=Math.max(depth,queue.length);
   return result;
  }
  renderer.render=timedRender;
  const visibility=()=>{if(document.hidden)hidden=true;};
  document.addEventListener('visibilitychange',visibility);
  const timer=setInterval(poll,8);
  window.__finishFrameDelivery=async()=>{
   if(renderer.render===timedRender)renderer.render=original;
   const until=performance.now()+3500;
   while(queue.length&&performance.now()<until&&!contextLost){
    poll();if(queue.length)await new Promise(resolve=>setTimeout(resolve,8));
   }
   poll();closed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);
   const left=queue.length;for(const {fence} of queue)gl.deleteSync(fence);
   const done=rows.filter(r=>r.observed!==null),inside=done.filter(r=>r.observed<=milliseconds);
   const gaps=done.slice(1).map((r,i)=>Math.max(0,r.lastPending-done[i].observed));
   const upper=done.slice(1).map((r,i)=>Math.max(0,r.observed-done[i].lastPending));
   const summarize=a=>{const s=[...a].sort((a,b)=>a-b);return s.length?{p50:s[Math.floor(.5*(s.length-1))],p95:s[Math.floor(.95*(s.length-1))],max:s.at(-1)}:null;};
   const stallCounts=ms=>({confirmed:gaps.filter(gap=>gap>ms).length,possible:upper.filter(gap=>gap>ms).length});
   return{start,end,wantedMs:milliseconds,worldDraws,sceneCounts:[...seen.values()],tracked:rows.length,signaled:done.length,signaledDuring:inside.length,
    signaledAfterWindow:done.length-inside.length,lowerCompletedFps:inside.length*1000/milliseconds,completedAfterDrainFps:done.length*1000/milliseconds,
    maxOutstandingObserverFences:depth,untrackedOverflow:overflow,unsignaledAfterDrain:left,errors,contextLost,hidden,maxPollGapMs:maxPollGap,
    gpuCompletionLatencyUpperMs:summarize(done.map(r=>r.observed-r.issued)),completionGapLowerMs:summarize(gaps),completionGapUpperMs:summarize(upper),
    gapOver250ms:stallCounts(250),gapOver2000ms:stallCounts(2000),firstCompletionUpperMs:done[0]?.observed??null,
    lastCompletionBeforeEndUpperMs:inside.length?milliseconds-inside.at(-1).lastPending:null,
    valid:worldDraws>0&&done.length===worldDraws&&!overflow&&!errors&&!contextLost&&!hidden&&!left&&seen.size===1,
    scope:'Independently signaled GPU commands through the primary Three world draw on canvas #game. No observer flush or blocking wait. Not proof that every frame was physically scanned out.',
    rows};
  };
  return {start,end};
 };
}

export async function beginDisplayTrace(cdp,page){
 const counts={},timelines={},examples={};
 const keep=new Set(['FramePresented','Display::FrameDisplayed','PipelineReporter','Graphics.Pipeline','Graphics.Pipeline.DrawAndSwap']);
 const handler=({value})=>{for(const e of value){
  if(!keep.has(e.name))continue;
  const detail=e.args?.chrome_graphics_pipeline?.step??e.args?.chrome_frame_reporter?.state??e.args?.frameReporter?.state??'';
  const key=[e.name,e.ph,detail].filter(Boolean).join(':');
  counts[key]=(counts[key]||0)+1;
  if(!examples[key])examples[key]={pid:e.pid,tid:e.tid,args:e.args};
  if(e.name==='FramePresented'||e.name==='Display::FrameDisplayed'||String(detail).includes('PRESENT')||String(detail).includes('SWAP_BUFFERS')){
   const t=timelines[key]??=[];if(t.length<5000)t.push(e.ts);
  }
 }};
 cdp.on('Tracing.dataCollected',handler);
 let started;
 try{await cdp.send('Tracing.start',{transferMode:'ReportEvents',traceConfig:{recordMode:'recordContinuously',includedCategories:['benchmark']}});
  started=await page.evaluate(()=>performance.now());}
 catch(error){cdp.off('Tracing.dataCollected',handler);throw error;}
 return async()=>{
  const ended=await page.evaluate(()=>performance.now());
  const done=new Promise((yes,no)=>{const timeout=setTimeout(()=>no(Error('Trace collection timeout')),15000);cdp.once('Tracing.tracingComplete',()=>{clearTimeout(timeout);yes();});});
  try{await cdp.send('Tracing.end');await done;}finally{cdp.off('Tracing.dataCollected',handler);}
  return {started,ended,counts,examples,timelines,scope:'Chrome compositor feedback in the single-tab browser. Changes to HUD or browser surfaces may produce a presentation without a new game-world frame.'};
 };
}
