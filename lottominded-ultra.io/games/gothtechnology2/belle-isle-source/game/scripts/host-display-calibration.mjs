// Standalone workflow diagnostic. The blank-frame measurements run in their
// own tab. Draw timing attaches only after the full ride has been recorded.
export async function calibrate(browser,viewport){
 const system=await browser.newBrowserCDPSession();
 const {gpu}=await system.send('SystemInfo.getInfo');await system.detach();
 const page=await browser.newPage({viewport});
 try{
  await page.bringToFront();
  const clear=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=innerWidth;canvas.height=innerHeight;
   document.body.style.margin='0';document.body.append(canvas);
   const gl=canvas.getContext('webgl2',{powerPreference:'high-performance',antialias:true});
   if(!gl)throw Error('WebGL2 unavailable in calibration');
   const gaps=[],frames=[];let prev,prevFrame,fence;
   const start=performance.now(),extensions=gl.getSupportedExtensions();
   await new Promise(resolve=>{
    function frame(now){
     if(prev!==undefined)gaps.push(now-prev);prev=now;
     if(fence){
      const status=gl.clientWaitSync(fence,0,0);
      if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED){gl.deleteSync(fence);fence=null;}
     }
     if(!fence){
      if(prevFrame!==undefined)frames.push(now-prevFrame);prevFrame=now;
      gl.clearColor((frames.length%120)/120,.3,.2,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
     }
     if(now-start>=12000)resolve();else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
   });
   if(fence)gl.deleteSync(fence);
   const stats=list=>{const a=list.slice(2).sort((x,y)=>x-y);return {samples:a.length,p50:a[Math.floor(.5*a.length)],p95:a[Math.floor(.95*a.length)],worst:a.at(-1)};};
   return {raf:stats(gaps),fencedClear:stats(frames),resolution:[canvas.width,canvas.height],extensions};
  });
  return {clear,devices:gpu.devices,featureStatus:gpu.featureStatus,driverBugWorkarounds:gpu.driverBugWorkarounds};
 }finally{await page.close();}
}

export async function measurePrograms(page){
 const close=page.locator('[data-close="settings"]');
 if(await close.isVisible())await close.click();
 return page.evaluate(async()=>{
  const gl=document.querySelector('#game').getContext('webgl2'),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const orig={},labels=new Map(),rows=new Map(),pending=[];
  let program=gl.getParameter(gl.CURRENT_PROGRAM),sampling=false,samples=0,error=null;
  const getLabel=p=>{
   if(!p)return 'unknown';
   if(labels.has(p))return labels.get(p);
   const source=gl.getAttachedShaders(p).map(s=>gl.getShaderSource(s)).join('\n');
   const material=source.match(/#define SHADER_NAME ([^\n]*)/)?.[1]?.trim()||'unnamed';
   let label=material;
   for(const [marker,name] of [['localTreePos','seasonal trees'],['meadowClock','meadow'],['volumeRadiance','island sky'],['meadowVariation','ground'],['ripples[','water ripples'],['volumeReady','sky']])if(source.includes(marker)){label=name+' '+material;break;}
   labels.set(p,label);return label;
  };
  const use=gl.useProgram;gl.useProgram=function(p){program=p;return use.call(this,p);};
  for(const key of ['drawElements','drawElementsInstanced','drawArrays','drawArraysInstanced']){
   orig[key]=gl[key];
   gl[key]=function(...args){
    if(!sampling)return orig[key].apply(this,args);
    const name=getLabel(program),row=rows.get(name)||{calls:0,triangles:0,gpuMs:0};
    rows.set(name,row);row.calls++;
    if(args[0]===gl.TRIANGLES)row.triangles+=(key.includes('Elements')?args[1]:args[2])*(key.endsWith('Instanced')?args.at(-1):1)/3;
    let query;
    if(ext&&pending.length<5000){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
    try{return orig[key].apply(this,args);}
    finally{if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,row});}}
   };
  }
  try{
   // Include occasional shadow updates and allow all queries to retire.
   for(let window=0;window<6;window++){
    await new Promise(r=>setTimeout(r,450));
    sampling=true;await new Promise(r=>setTimeout(r,120));sampling=false;samples++;
    if(ext)await new Promise(r=>setTimeout(r,150));
   }
   const until=performance.now()+5000;
   while(ext&&pending.length&&!gl.getQueryParameter(pending.at(-1).query,gl.QUERY_RESULT_AVAILABLE)&&performance.now()<until)await new Promise(r=>setTimeout(r,100));
   if(ext&&!gl.getParameter(ext.GPU_DISJOINT_EXT)){
    for(const {query,row} of pending)if(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))row.gpuMs+=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;
   }else if(ext)error='disjoint GPU timer';
  }finally{gl.useProgram=use;for(const [key,fn] of Object.entries(orig))gl[key]=fn;for(const {query} of pending)gl.deleteQuery(query);}
  return {timer:!!ext,samples,error,rows:[...rows].sort((a,b)=>(b[1].gpuMs-a[1].gpuMs)||(b[1].triangles-a[1].triangles))};
 });
}
