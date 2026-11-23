/** Explicit local manual diagnosis. Timer queries observe existing commands only;
 * they never block, flush, draw, choose quality, or change frame acceptance. */
type Callable=(this:unknown,...args:unknown[])=>unknown;
type TimerExtension={TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};
type TimerGL=Pick<WebGL2RenderingContext,'getExtension'|'isContextLost'|'getParameter'|'getQuery'|'createQuery'|'deleteQuery'|'beginQuery'|'endQuery'|'getQueryParameter'|'CURRENT_QUERY'|'QUERY_RESULT_AVAILABLE'|'QUERY_RESULT'>;
type Lane='frame'|'scene'|'shadow'|'draw';
type DrawPhase='shadow'|'color';
interface Identity {
 lane:Lane;pass:string;objectId:number|null;object:string;parent:string;
 materialId:number|null;material:string;materialType:string;geometryId:number|null;
 vertices:number|null;indices:number|null;instances:number|null;lightCount:number|null;
 groupStart:number|null;groupCount:number|null;targetId:number|null;targetWidth:number|null;targetHeight:number|null;
}
interface Pending {query:WebGLQuery;identity:Identity;frame:number;capture:number;beganWallMs:number;endedWallMs:number|null;}
interface Group extends Identity {samples:number;totalGpuMs:number;minGpuMs:number;maxGpuMs:number;}
interface Hook {target:object;name:string;own:PropertyDescriptor|undefined;wrapper:Callable;}
const lanes:readonly Lane[]=['frame','scene','shadow','draw'];
const drawPhases:readonly DrawPhase[]=['shadow','color'];
export const GPU_DIAGNOSTIC_LIMITS=Object.freeze({pending:48,queriesPerFrame:4,groups:512,rawSamples:256,pollsPerCall:12,pendingFrames:240});
const object=(v:unknown):v is object=>v!==null&&(typeof v==='object'||typeof v==='function');
const read=(v:unknown,key:string):unknown=>object(v)?Reflect.get(v,key):undefined;
const id=(v:unknown):number|null=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null;
const label=(v:unknown):string=>typeof v==='string'?v.slice(0,96):'';
const emptyIdentity=(lane:Lane,pass:string):Identity=>({lane,pass,objectId:null,object:'',parent:'',materialId:null,material:'',materialType:'',geometryId:null,vertices:null,indices:null,instances:null,lightCount:null,groupStart:null,groupCount:null,targetId:null,targetWidth:null,targetHeight:null});

export function gpuDiagnosticRequested(target:{hostname:string;search:string}){
 const query=new URLSearchParams(target.search);
 return ['localhost','127.0.0.1','[::1]'].includes(target.hostname)&&query.get('profile')==='manual'&&query.get('gpuProbe')==='1';
}

/** Separate lanes on successive callbacks prevent nested TIME_ELAPSED queries.
 * Draw sampling rotates across the original submission order; it is not a census
 * and does not estimate unsampled GPU time or actual displayed FPS. */
export class ManualGpuProbe {
 private gl:TimerGL|undefined;private extension:TimerExtension|undefined;
 private hooks:Hook[]=[];private hookStatus:{name:string;status:string}[]=[];
 private supported=false;private disposed=false;private running=false;
 private capture=0;private frame=0;private lane:Lane='frame';private frameOpen=false;
 private shadowDepth=0;private renderDepth=0;private issuedInFrame=0;private drawCycle=0;
 private drawIndex={shadow:0,color:0};private drawTargets:{shadow:number[];color:number[]}={shadow:[],color:[]};
 private drawCoverage=this.newDrawCoverage();
 private current:Pending|undefined;private pending:Pending[]=[];
 private groups=new Map<string,Group>();private raw:{frame:number;resolvedFrame:number;gpuMs:number;queryCpuWindowMs:number|null;observedAvailabilityDelayMs:number|null;identity:Identity}[]=[];
 private errors:string[]=[];
 private counts=this.newCounts();
 private renderer:object;
 private now:()=>number;
 constructor(renderer:object,now:()=>number=()=>performance.now()){
  this.now=now;
  this.renderer=renderer;
  try{
   const getContext=read(renderer,'getContext');
   if(typeof getContext!=='function')return;
   const gl=Reflect.apply(getContext,renderer,[]) as TimerGL;
   const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;
   if(!extension)return;
   for(const name of ['isContextLost','getParameter','getQuery','createQuery','deleteQuery','beginQuery','endQuery','getQueryParameter'])
    if(typeof read(gl,name)!=='function')return;
   this.gl=gl;this.extension=extension;this.supported=true;
   this.install(renderer,'render','renderer.render',(original,self,args)=>this.render(original,self,args));
   const shadow=read(renderer,'shadowMap');
   this.install(object(shadow)?shadow:undefined,'render','renderer.shadowMap.render',(original,self,args)=>this.shadow(original,self,args));
   this.install(renderer,'renderBufferDirect','renderer.renderBufferDirect',(original,self,args)=>this.draw(original,self,args));
  }catch(error){this.error('install',error);}
 }
 private newCounts(){return {callbacks:0,eligibleCallbacks:0,issued:0,resolved:0,pendingPeak:0,budgetSkipped:0,foreignQuerySkipped:0,nestedSkipped:0,disjointEvents:0,disjointDiscarded:0,contextLostDiscarded:0,expired:0,invalidResults:0,groupOverflow:0,rawSamplesOmitted:0,queryErrors:0};}
 private newDrawCoverage(){const phase=()=>({observedCalls:0,nonemptyCallbacks:0,lastNonemptyCalls:0,maxCallsPerCallback:0,samplingCallbacks:0,targets:0,targetEncounters:0,targetMisses:0});return {shadow:phase(),color:phase()};}
 private error(stage:string,error:unknown){this.counts.queryErrors++;if(this.errors.length<20)this.errors.push(stage+': '+String(error).slice(0,220));}
 private install(target:object|undefined,name:string,title:string,invoke:(original:Callable,self:unknown,args:unknown[])=>unknown){
  const status={name:title,status:'missing'};this.hookStatus.push(status);if(!target)return;
  try{
   const original=Reflect.get(target,name);if(typeof original!=='function')return;
   const own=Object.getOwnPropertyDescriptor(target,name);
   const wrapper:Callable=function(...args){return invoke(original,this,args);};
   Object.defineProperty(target,name,{configurable:true,writable:true,enumerable:own?.enumerable??false,value:wrapper});
   this.hooks.push({target,name,own,wrapper});status.status='installed';
  }catch(error){status.status='failed';this.error(title,error);}
 }
 private target(identity:Identity){
  const method=read(this.renderer,'getRenderTarget');
  if(typeof method!=='function')return identity;
  const target=Reflect.apply(method,this.renderer,[]);
  if(target){identity.targetId=id(read(read(target,'texture'),'id'));identity.targetWidth=id(read(target,'width'));identity.targetHeight=id(read(target,'height'));}
  else{const canvas=read(this.renderer,'domElement');identity.targetWidth=id(read(canvas,'width'));identity.targetHeight=id(read(canvas,'height'));}
  return identity;
 }
 private discardPending(reason:'disjointDiscarded'|'contextLostDiscarded'|'expired'){
  this.counts[reason]+=this.pending.length;
  if(reason!=='contextLostDiscarded')for(const entry of this.pending)this.delete(entry.query);
  this.pending=[];
 }
 private delete(query:WebGLQuery){try{this.gl?.deleteQuery(query);}catch(error){this.error('delete-query',error);}}
 /** Polls only availability. A result is read only after the native available bit;
  * no finish(), flush(), waitSync(), or busy wait is used. */
 poll(){
  if(!this.supported||this.disposed||!this.gl||!this.extension||this.current)return;
  try{
   if(this.gl.isContextLost()){this.discardPending('contextLostDiscarded');return;}
   if(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)){this.counts.disjointEvents++;this.discardPending('disjointDiscarded');return;}
   for(let n=0;n<GPU_DIAGNOSTIC_LIMITS.pollsPerCall&&this.pending.length;n++){
    const entry=this.pending[0];
    if(!this.gl.getQueryParameter(entry.query,this.gl.QUERY_RESULT_AVAILABLE)){
     if(this.frame-entry.frame>GPU_DIAGNOSTIC_LIMITS.pendingFrames){this.pending.shift();this.counts.expired++;this.delete(entry.query);continue;}
     break;
    }
    const ns=this.gl.getQueryParameter(entry.query,this.gl.QUERY_RESULT);
    // A reset observed between availability and result invalidates the entire batch.
    if(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)){this.counts.disjointEvents++;this.discardPending('disjointDiscarded');break;}
    this.pending.shift();this.delete(entry.query);
    if(typeof ns!=='number'||!Number.isFinite(ns)||ns<0){this.counts.invalidResults++;continue;}
    if(entry.capture!==this.capture)continue;
    const gpuMs=ns/1e6;this.counts.resolved++;
    const key=JSON.stringify(entry.identity);let group=this.groups.get(key);
    if(!group&&this.groups.size<GPU_DIAGNOSTIC_LIMITS.groups){group={...entry.identity,samples:0,totalGpuMs:0,minGpuMs:Infinity,maxGpuMs:0};this.groups.set(key,group);}
    if(group){group.samples++;group.totalGpuMs+=gpuMs;group.minGpuMs=Math.min(group.minGpuMs,gpuMs);group.maxGpuMs=Math.max(group.maxGpuMs,gpuMs);}else this.counts.groupOverflow++;
    const resolvedWallMs=this.now(),cpuWindow=entry.endedWallMs===null?NaN:entry.endedWallMs-entry.beganWallMs,
     availabilityDelay=entry.endedWallMs===null?NaN:resolvedWallMs-entry.endedWallMs;
    const row={frame:entry.frame,resolvedFrame:this.frame,gpuMs,queryCpuWindowMs:Number.isFinite(cpuWindow)&&cpuWindow>=0?cpuWindow:null,
     observedAvailabilityDelayMs:Number.isFinite(availabilityDelay)&&availabilityDelay>=0?availabilityDelay:null,identity:{...entry.identity}};
    if(this.raw.length<GPU_DIAGNOSTIC_LIMITS.rawSamples)this.raw.push(row);
    else{this.counts.rawSamplesOmitted++;let least=0;for(let i=1;i<this.raw.length;i++)if(this.raw[i].gpuMs<this.raw[least].gpuMs)least=i;if(gpuMs>this.raw[least].gpuMs)this.raw[least]=row;}
   }
  }catch(error){this.error('poll',error);}
 }
 private begin(identity:Identity):Pending|undefined{
  if(!this.supported||!this.running||!this.frameOpen||this.disposed||!this.gl||!this.extension)return;
  if(this.current){this.counts.nestedSkipped++;return;}
  if(this.pending.length>=GPU_DIAGNOSTIC_LIMITS.pending||this.issuedInFrame>=GPU_DIAGNOSTIC_LIMITS.queriesPerFrame){this.counts.budgetSkipped++;return;}
  let query:WebGLQuery|null=null;
  try{
   if(this.gl.isContextLost())return;
   if(this.gl.getQuery(this.extension.TIME_ELAPSED_EXT,this.gl.CURRENT_QUERY)!==null){this.counts.foreignQuerySkipped++;return;}
   query=this.gl.createQuery();if(!query)throw Error('createQuery returned null');
   const beganWallMs=this.now();this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,query);
   const token={query,identity,frame:this.frame,capture:this.capture,beganWallMs,endedWallMs:null};this.current=token;this.issuedInFrame++;this.counts.issued++;return token;
  }catch(error){if(query)this.delete(query);this.error('begin-query',error);return;}
 }
 private end(token:Pending|undefined){
  if(!token||this.current!==token||!this.gl||!this.extension)return;
  this.current=undefined;
  try{
   if(this.gl.isContextLost()){this.counts.contextLostDiscarded++;this.discardPending('contextLostDiscarded');return;}
   this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);token.endedWallMs=this.now();this.pending.push(token);this.counts.pendingPeak=Math.max(this.counts.pendingPeak,this.pending.length);
  }catch(error){this.delete(token.query);this.error('end-query',error);}
 }
 private observe<T>(identity:()=>Identity,call:()=>T):T{
  let token:Pending|undefined;try{token=this.begin(identity());}catch(error){this.error('identity',error);}
  try{return call();}finally{this.end(token);}
 }
 private render(original:Callable,self:unknown,args:unknown[]){
  const outer=this.renderDepth++===0;
  try{
   if(!this.frameOpen||this.lane!=='scene'||!outer)return Reflect.apply(original,self,args);
   return this.observe(()=>{const scene=args[0],value=this.target(emptyIdentity('scene','render'));value.objectId=id(read(scene,'id'));value.object=label(read(scene,'name'));value.pass=value.targetId===null?'screen-scene':'offscreen-scene';return value;},()=>Reflect.apply(original,self,args));
  }finally{this.renderDepth--;}
 }
 private shadow(original:Callable,self:unknown,args:unknown[]){
  this.shadowDepth++;
  try{
   if(!this.frameOpen||this.lane!=='shadow')return Reflect.apply(original,self,args);
   const lights=args[0];
   if(!Array.isArray(lights)||lights.length===0)return Reflect.apply(original,self,args);
   const shadowMap=read(this.renderer,'shadowMap');
   if(read(shadowMap,'enabled')===false||(!read(shadowMap,'autoUpdate')&&!read(shadowMap,'needsUpdate')))return Reflect.apply(original,self,args);
   return this.observe(()=>{const value=emptyIdentity('shadow','shadow-map');value.object=lights.map(x=>label(read(x,'name'))||String(id(read(x,'id')))).join(', ').slice(0,96);value.lightCount=lights.length;
    if(lights.length===1){const shadow=read(lights[0],'shadow'),map=read(shadow,'map'),size=read(shadow,'mapSize');value.targetId=id(read(read(map,'texture'),'id'));value.targetWidth=id(read(map,'width'))??id(read(size,'x'));value.targetHeight=id(read(map,'height'))??id(read(size,'y'));}return value;},()=>Reflect.apply(original,self,args));
  }finally{this.shadowDepth--;}
 }
 private draw(original:Callable,self:unknown,args:unknown[]){
  if(!this.frameOpen)return Reflect.apply(original,self,args);
  const phase:DrawPhase=this.shadowDepth?'shadow':'color',index=this.drawIndex[phase]++;
  const target=this.drawTargets[phase].indexOf(index);
  if(this.lane!=='draw'||target===-1)return Reflect.apply(original,self,args);
  this.drawTargets[phase].splice(target,1);this.drawCoverage[phase].targetEncounters++;
  return this.observe(()=>{
   const geometry=args[2],material=args[3],mesh=args[4],group=args[5],attributes=read(geometry,'attributes');
   const value=this.target(emptyIdentity('draw',this.shadowDepth?'shadow-draw':'color-draw'));
   value.objectId=id(read(mesh,'id'));value.object=label(read(mesh,'name'));value.parent=label(read(read(mesh,'parent'),'name'));
   value.materialId=id(read(material,'id'));value.material=label(read(material,'name'));value.materialType=label(read(material,'type'));
   value.geometryId=id(read(geometry,'id'));value.vertices=id(read(read(attributes,'position'),'count'));value.indices=id(read(read(geometry,'index'),'count'));
   value.instances=read(mesh,'isInstancedMesh')===true?id(read(mesh,'count')):read(mesh,'isBatchedMesh')===true?null:1;
   value.groupStart=id(read(group,'start'));value.groupCount=id(read(group,'count'));return value;
  },()=>Reflect.apply(original,self,args));
 }
 startCapture(){
  // No live query can be opened by a UI event between animation callbacks.
  if(this.current){this.error('start-capture','query still active');return;}
  for(const entry of this.pending)this.delete(entry.query);this.pending=[];
  this.capture++;this.frame=0;this.counts=this.newCounts();this.groups.clear();this.raw=[];this.drawCycle=0;this.drawCoverage=this.newDrawCoverage();this.running=true;
 }
 stopCapture(){this.running=false;return this.snapshot();}
 runFrame<T>(callback:()=>T,eligible:boolean):T{
  this.poll();if(this.running)this.counts.callbacks++;
  const previous=this.frameOpen;
  this.frameOpen=this.running&&eligible&&!this.disposed;
  if(this.frameOpen){
   this.frame++;this.counts.eligibleCallbacks++;this.lane=lanes[(this.frame-1+Math.floor((this.frame-1)/4))%lanes.length];this.drawIndex={shadow:0,color:0};this.issuedInFrame=0;
   if(this.lane==='draw'){
    const rotation=(this.drawCycle++*0.6180339887498949)%1;
    for(const phase of drawPhases){
     const coverage=this.drawCoverage[phase],count=coverage.lastNonemptyCalls;
     // Separate phase budgets prevent a large shadow pass starving color draws.
     // Spaced targets span each complete last nonempty pass, with a rotating offset.
     this.drawTargets[phase]=count<=2?Array.from({length:Math.max(1,count)},(_,i)=>i):[Math.floor(rotation*count),Math.floor(((rotation+0.5)%1)*count)];
     coverage.samplingCallbacks++;coverage.targets+=this.drawTargets[phase].length;
    }
   }
  }
  try{
   if(this.frameOpen&&this.lane==='frame')return this.observe(()=>this.target(emptyIdentity('frame','animation-callback')),callback);
   return callback();
  }finally{
   if(this.frameOpen)for(const phase of drawPhases){
    const coverage=this.drawCoverage[phase],count=this.drawIndex[phase];coverage.observedCalls+=count;
    if(count){coverage.nonemptyCallbacks++;coverage.lastNonemptyCalls=count;coverage.maxCallsPerCallback=Math.max(coverage.maxCallsPerCallback,count);}
    if(this.lane==='draw')coverage.targetMisses+=this.drawTargets[phase].length;
   }
   this.frameOpen=previous;
  }
 }
 snapshot(){
  this.poll();
  return {version:1,supported:this.supported,status:this.disposed?'disposed':!this.supported?'unavailable':this.running?'capturing':'stopped',capture:this.capture,
   extension:'EXT_disjoint_timer_query_webgl2',limits:{...GPU_DIAGNOSTIC_LIMITS},counts:{...this.counts},pendingQueries:this.pending.length,activeQuery:!!this.current,
   hooks:this.hookStatus.map(x=>({...x})),errors:[...this.errors],drawSampling:{queriesPerPhase:2,shadow:{...this.drawCoverage.shadow},color:{...this.drawCoverage.color}},
   groups:[...this.groups.values()].map(x=>({...x,meanGpuMs:x.totalGpuMs/x.samples})).sort((a,b)=>b.totalGpuMs-a.totalGpuMs),
   largestSamples:this.raw.slice().sort((a,b)=>b.gpuMs-a.gpuMs).map(x=>({...x,identity:{...x.identity}})),
   notes:[
    'Manual local diagnostic only. Native timer results are nanoseconds converted to milliseconds, read only when available and discarded on observed GPU disjoint/context loss.',
    'GPU callbacks use foreground manual-capture eligibility; they are a separate sample population from the strict frame-acceptance samples, including the first resume callback.',
    'Four separate callback lanes sample whole callback, scene render, shadow map, or sparse individual renderBufferDirect calls. They never nest timer queries. Lane totals cover different callbacks and must not be added together.',
    'Scene timing includes its shadow pass and any nested commands. Whole callback includes every submitted pass and GPU idle gaps while CPU prepares commands. These are elapsed query durations, not display/present latency.',
    'Observed availability delay runs from the CPU endQuery call to a later availability poll; it includes browser scheduling and is not fence execution time. QueryCpuWindowMs is CPU wall time around the queried commands. The whole-callback query ends before the existing GPU gate submits its fence.',
    'Sparse draw samples use two spaced positions across each last nonempty shadow/color pass, rotating their offset on each draw-sampling callback. Each phase has a separate two-query budget. Changed or absent passes can miss targets; drawSampling reports these misses. Groups and raw samples are bounded; unsampled and unavailable work is not zero cost. LargestSamples retains the largest bounded durations, not a representative distribution.',
    'Vertex/index counts describe geometry buffers, not clipped or actually drawn primitives. Group ranges and instance count are reported separately. BatchedMesh instance count is unknown; its query encloses its real multidraw submission.',
    'Queries add diagnostic driver overhead. Original rendering calls, graphics choices, input, frame accounting, and strict acceptance remain unchanged. No flush, fence, waits, extra draw, or readPixels is issued by this probe.',
   ]};
 }
 dispose(){
  if(this.disposed)return;this.running=false;this.end(this.current);for(const entry of this.pending)this.delete(entry.query);this.pending=[];this.disposed=true;
  for(const hook of this.hooks)try{if(Object.getOwnPropertyDescriptor(hook.target,hook.name)?.value!==hook.wrapper)continue;if(hook.own)Object.defineProperty(hook.target,hook.name,hook.own);else Reflect.deleteProperty(hook.target,hook.name);}catch(error){this.error('restore-hook',error);}
  this.hooks=[];
 }
}
