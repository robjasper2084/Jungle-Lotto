// Offline diagnosis using Three's devtools observe event. This workflow has
// its own game session, distinct from the uninstrumented hosted acceptance run.
export function installObserver(){
 const events=new EventTarget();
 window.__THREE_DEVTOOLS__=events;
 const renderers=new Set();
 events.addEventListener('observe',e=>{if(typeof e.detail?.renderBufferDirect==='function')renderers.add(e.detail);});
 window.__objectCostSample=async function(){
  const renderer=[...renderers].find(r=>r.domElement===document.querySelector('#game'));
  if(!renderer)throw Error('Game renderer was not observed: '+[...renderers].map(r=>r.domElement?.id));
  const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const orig=renderer.renderBufferDirect,rows=new Map(),queries=[];
  let sample,firstFrame,frames=0;
  renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){
   if(firstFrame===undefined)firstFrame=renderer.info.render.frame;
   const frame=renderer.info.render.frame-firstFrame;
   if(frame>=4)return orig.apply(this,arguments);
   if(sample!==frame){sample=frame;frames++;}
   const ancestry=[];let parent=object;
   for(let i=0;parent&&i<6;i++,parent=parent.parent)if(parent.name)ancestry.push(parent.name);
   const name=[camera.type,ancestry.join(' ← '),material.name||material.type].join(' | ');
   let row=rows.get(name);
   if(!row){row={name,calls:0,triangles:0,gpuMs:0};rows.set(name,row);}
   const meshCount=object.isInstancedMesh?object.count:1;
   row.calls++;row.triangles+=Math.min((geometry.index?.count??geometry.attributes.position?.count??0),group?.count??Infinity,geometry.drawRange.count)*meshCount/3;
   const q=ext?gl.createQuery():null;
   if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
   try{return orig.apply(this,arguments);}
   finally{if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push([q,row]);}}
  };
  try{
   const until=performance.now()+6000;
   while((firstFrame===undefined||renderer.info.render.frame-firstFrame<4)&&performance.now()<until)await new Promise(ok=>setTimeout(ok,50));
  }finally{renderer.renderBufferDirect=orig;}
  try{
   const until=performance.now()+5000;
   while(queries.length&&!gl.getQueryParameter(queries.at(-1)[0],gl.QUERY_RESULT_AVAILABLE)&&performance.now()<until)await new Promise(ok=>setTimeout(ok,80));
   const disjoint=ext?gl.getParameter(ext.GPU_DISJOINT_EXT):true;
   if(!disjoint)for(const [q,row] of queries)if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))row.gpuMs+=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;
   if(!frames||!queries.length)throw Error('The game produced no timed samples');
   return {frames,disjoint,queries:queries.length,rows:[...rows.values()].sort((a,b)=>b.gpuMs-a.gpuMs)};
  }finally{for(const [q] of queries)gl.deleteQuery(q);}
 };
 window.__matchedWorldCosts=async function(){
  const renderer=[...renderers].find(r=>r.domElement===document.querySelector('#game'));
  if(!renderer)throw Error('Game renderer unavailable');
  const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(!timer)throw Error('GPU timer unsupported');
  const render=renderer.render,draw=renderer.renderBufferDirect;
  const [scene,camera]=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{renderer.render=render;reject(Error('No live world draw'));},10000);
   renderer.render=function(scene,camera){
    if(scene.children.length>20 && camera.isPerspectiveCamera && !renderer.getRenderTarget()){
     renderer.render=render;clearTimeout(timeout);resolve([scene,camera]);
    }
    return render.apply(this,arguments);
   };
  });
  // This is the terminal diagnostic, after the recorded ride. Each case uses
  // the same frozen camera, actor, lighting, canvas and simulation state.
  renderer.setAnimationLoop(null);
  const ratio=renderer.getPixelRatio(),groups=new WeakMap();
  function category(o){
   if(groups.has(o))return groups.get(o);
   const parts=[];for(let a=o;a;a=a.parent)parts.push(a.name);
   const name=parts.join(' ');
   let key='other';
   if(/Spine|Hips|Helmet skin|EUC_ROOT|DS_Armored|Balance_Pivot|static_grip|Ghoulies|rider|one.wheel/i.test(name))key='rider';
   else if(/meadow|leaf|leaves|foliage|crown|tree|trunk|canop|flora|cedars|flower|groundcover/i.test(name))key='vegetation';
   else if(/river|water|lagoon|vessel|rolling waves|lake|skyline|changing sky/i.test(name))key='waterSky';
   else if(/building|bridge|MacArthur|courtyard|landmark|roof|growing.house|facilit|Scene|pavilion|club|Inselruhe|street/i.test(name))key='structures';
   else if(!o.name || /pavement|ground|lawn|terrain|paving|woodland|sediment/i.test(name))key='ground';
   groups.set(o,key);return key;
  }
  let mode='full',submissions=0;
  renderer.renderBufferDirect=function(c,s,g,m,o){
   if(mode==='noDraw'||mode==='omit-'+category(o))return;
   submissions++;return draw.apply(this,arguments);
  };
  async function sample(name){
   mode=name;submissions=0;
   const desired=name==='halfResolution'?ratio*.5:ratio;
   if(renderer.getPixelRatio()!==desired)renderer.setPixelRatio(desired);
   const query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
   const cpu=performance.now();try{render.call(renderer,scene,camera);}finally{gl.endQuery(timer.TIME_ELAPSED_EXT);}
   const cpuMs=performance.now()-cpu;gl.flush();
   const until=performance.now()+10000;
   while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)&&performance.now()<until)await new Promise(ok=>setTimeout(ok,4));
   try{
    if(gl.getParameter(timer.GPU_DISJOINT_EXT)||!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))throw Error('Invalid frame query');
    return {mode:name,submissions,gpuMs:gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6,cpuMs};
   }finally{gl.deleteQuery(query);}
  }
  const cases=['full','omit-rider','omit-ground','omit-vegetation','omit-structures','omit-waterSky','omit-other','halfResolution','noDraw'],rows=[];
  try{
   for(let pass=0;pass<5;pass++)for(const name of pass%2?[...cases].reverse():cases){
    const row=await sample(name);if(pass)rows.push(row);
   }
  }finally{renderer.renderBufferDirect=draw;renderer.setPixelRatio(ratio);}
  return {position:camera.position.toArray(),ratio,rows};
 };
}
