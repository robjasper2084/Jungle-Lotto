// Offline diagnosis using Three's devtools observe event. This workflow has
// its own game session, distinct from the uninstrumented hosted acceptance run.
export function installObserver(){
 const events=new EventTarget();
 window.__THREE_DEVTOOLS__=events;
 let renderer;
 events.addEventListener('observe',e=>{if(typeof e.detail?.renderBufferDirect==='function')renderer=e.detail;});
 window.__objectCostSample=async function(){
  if(!renderer)throw Error('Game renderer was not observed');
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
   return {frames,disjoint,queries:queries.length,rows:[...rows.values()].sort((a,b)=>b.gpuMs-a.gpuMs)};
  }finally{for(const [q] of queries)gl.deleteQuery(q);}
 };
}
