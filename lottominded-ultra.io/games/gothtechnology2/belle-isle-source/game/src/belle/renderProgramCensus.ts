import {LessEqualDepth,Material,MeshPhysicalMaterial,NoBlending,NormalBlending,Object3D} from 'three';

/** Manual observer only. Identities describe normally returning useProgram
 * requests, not independently verified GL state. No GL queries are made. */
export const programCensusPhases=['opaque','shadow','transparent','transmissive','offscreen','xr','unknown'] as const;
export type ProgramCensusPhase=typeof programCensusPhases[number];
export const programCensusLimits=Object.freeze({sampleEvery:16,maxSamples:96,maxDrawsPerSample:1024,maxProgramEventsPerSample:2048,maxTextureEventsPerSample:64,maxProgramIdentities:4096,maxScopeDepth:64});
export const uniformCensusMethods=[
 'uniform1f','uniform2f','uniform3f','uniform4f','uniform1fv','uniform2fv','uniform3fv','uniform4fv',
 'uniform1i','uniform2i','uniform3i','uniform4i','uniform1iv','uniform2iv','uniform3iv','uniform4iv',
 'uniform1ui','uniform2ui','uniform3ui','uniform4ui','uniform1uiv','uniform2uiv','uniform3uiv','uniform4uiv',
 'uniformMatrix2fv','uniformMatrix3fv','uniformMatrix4fv','uniformMatrix2x3fv','uniformMatrix2x4fv',
 'uniformMatrix3x2fv','uniformMatrix3x4fv','uniformMatrix4x2fv','uniformMatrix4x3fv',
] as const;
export const textureCensusMethods=[
 'texImage2D','texSubImage2D','texImage3D','texSubImage3D',
 'compressedTexImage2D','compressedTexSubImage2D','compressedTexImage3D','compressedTexSubImage3D',
 'texStorage2D','texStorage3D','copyTexImage2D','copyTexSubImage2D','copyTexSubImage3D','generateMipmap',
] as const;
export const programCensusBarriers=Object.freeze({
 unknownMetadata:1,depthTestOff:2,depthWriteOff:4,nonDefaultDepth:8,colorWriteOff:16,stencilWrite:32,
 nonOpaqueBlend:64,alphaCoverageOrDiscard:128,objectRenderCallback:256,materialRenderCallback:512,
 shaderMaterial:1024,variantObject:2048,unknownProgram:4096,multipleObservedPrograms:8192,
 noCoreDrawObservation:16384,nestedDirectDraw:32768,
 customCompile:65536,polygonOffset:131072,displacementMap:262144,clipping:524288,
});
const phaseCountNames=[
 'directDraws','directDrawThrows','coreDrawCalls','coreDrawThrows','knownProgramDraws','unknownProgramDraws','unboundProgramDraws',
 'useProgramCalls','useProgramReturned','useProgramThrew','observedProgramChanges','repeatedProgramRequests','unknownPreviousProgram',
 'uniformCalls','uniformThrows','textureCalls','textureThrows','foreignReceiverCalls',
] as const;
type Counts=Record<typeof phaseCountNames[number],number>;
type MethodCounts={calls:number;threw:number};
type TargetKind='default'|'offscreen'|'xr'|'unknown';
type MaterialClass='opaque'|'transparent'|'transmissive'|'unknown';
type ProgramId=number|null; // null: unknown; zero: observed useProgram(null).
export interface ProgramCensusDraw {
 index:number;parentIndex:number|null;renderPass:number|null;cameraId:number|null;sceneId:number|null;
 phase:ProgramCensusPhase;target:TargetKind;materialClass:MaterialClass;
 groupOrder:number|null;renderOrder:number|null;objectId:number|null;geometryId:number|null;materialId:number|null;
 object:string;material:string;materialType:string;objectFlags:number;barrierMask:number;
 programBefore:ProgramId;programAfter:ProgramId;firstCoreProgram:ProgramId;lastCoreProgram:ProgramId;
 coreDrawCalls:number;useProgramCalls:number;uniformCalls:number;textureCalls:number;threw:boolean;
}
export interface ProgramCensusProgramEvent {
 index:number;directIndex:number|null;phase:ProgramCensusPhase;previous:ProgramId;requested:ProgramId;
 returned:boolean;receiverMatches:boolean;
}
export interface ProgramCensusTextureEvent {
 index:number;directIndex:number|null;phase:ProgramCensusPhase;method:string;
 objectId:number|null;materialId:number|null;width:number|null;height:number|null;depth:number|null;returned:boolean;
}
export interface ProgramCensusFrame {
 version:1;frameSequence:number;sampled:boolean;observerErrors:number;metadataUnavailable:number;identityLimitHits:number;
 renderCalls:number;shadowCalls:number;targetChanges:number;
 phases:Record<ProgramCensusPhase,Counts>;uniformMethods:Record<string,MethodCounts>;textureMethods:Record<string,MethodCounts>;
 draws:ProgramCensusDraw[];programEvents:ProgramCensusProgramEvent[];textureEvents:ProgramCensusTextureEvent[];
 droppedDraws:number;droppedProgramEvents:number;droppedTextureEvents:number;
}
export type CensusKind='direct'|'render'|'shadow'|'target'|'program'|'draw'|'texture';
type RenderScope={scene:unknown;camera:unknown;pass:number;parent:RenderScope|null};
type ShadowScope={render:RenderScope|null;parent:ShadowScope|null};
export type CensusOwner={epoch:number;phase:ProgramCensusPhase;row:ProgramCensusDraw|null;index:number|null;parent:CensusOwner|null};
export type CensusToken={epoch:number;kind:CensusKind;owner:CensusOwner;render?:RenderScope;shadow?:ShadowScope;event?:ProgramCensusProgramEvent|ProgramCensusTextureEvent;method:string;receiverMatches:boolean;requested?:ProgramId};
const isObject=(v:unknown):v is object=>v!==null&&(typeof v==='object'||typeof v==='function');
const count=()=>Object.fromEntries(phaseCountNames.map(name=>[name,0])) as Counts;
const methods=(names:readonly string[])=>Object.fromEntries(names.map(name=>[name,{calls:0,threw:0}])) as Record<string,MethodCounts>;
const id=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null;
const order=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const label=(v:unknown)=>typeof v==='string'?v.slice(0,96):'';
const zero=()=>({calls:0,threw:0});
const transmissionAccessor=Object.getOwnPropertyDescriptor(MeshPhysicalMaterial.prototype,'transmission');
const alphaTestAccessor=Object.getOwnPropertyDescriptor(Material.prototype,'alphaTest');

function emptyFrame(sequence:number,sampled:boolean):ProgramCensusFrame {
 return {version:1,frameSequence:sequence,sampled,observerErrors:0,metadataUnavailable:0,identityLimitHits:0,renderCalls:0,shadowCalls:0,targetChanges:0,
  phases:Object.fromEntries(programCensusPhases.map(phase=>[phase,count()])) as Record<ProgramCensusPhase,Counts>,
  uniformMethods:methods(uniformCensusMethods),textureMethods:methods(textureCensusMethods),draws:[],programEvents:[],textureEvents:[],
  droppedDraws:0,droppedProgramEvents:0,droppedTextureEvents:0};
}

/** This state is called only from active observer wrappers. There are no clocks,
 * private material-program lookups, renderer writes or added native GL calls. */
export class RenderProgramCensus {
 private frame=emptyFrame(0,false);private epoch=0;private sequence=0;private active=false;
 private identities=new WeakMap<object,number>();private nextIdentity=1;private observedProgram:ProgramId=null;
 private render:RenderScope|null=null;private direct:CensusOwner|null=null;private shadowDepth=0;private scopeDepth=0;
 private shadow:ShadowScope|null=null;
 private outside={} as Record<ProgramCensusPhase,CensusOwner>;private target:unknown=undefined;private xr=false;
 private renderer:object;private gl:object;private targetGetter:((...args:unknown[])=>unknown)|undefined;
 constructor(renderer:object,gl:object){
  this.renderer=renderer;this.gl=gl;
  const getter=this.data(renderer,'getRenderTarget',true);
  if(typeof getter==='function')this.targetGetter=getter as (...args:unknown[])=>unknown;
 }
 /** Descriptor reads avoid invoking application getters merely for metadata. */
 private data(value:unknown,key:string,inherited=false):unknown {
  if(!isObject(value))return;
  try{
   let object:object|null=value;
   for(let level=0;object&&level<programCensusLimits.maxScopeDepth;level++){
    const descriptor=Object.getOwnPropertyDescriptor(object,key);
    if(descriptor){
     if('value' in descriptor)return descriptor.value;
     if(this.active)this.frame.metadataUnavailable++;
     return;
    }
    if(!inherited)return;
    object=Object.getPrototypeOf(object);
   }
  }catch{if(this.active)this.frame.metadataUnavailable++;}
 }
 /** Only these two exact installed Three accessors have a known stored scalar.
  * Overrides and unfamiliar accessors are left unread, never executed. */
 private scalar(value:unknown,key:string,stored:string,known:PropertyDescriptor|undefined):unknown {
  if(!isObject(value))return;
  try{
   let object:object|null=value;
   for(let level=0;object&&level<programCensusLimits.maxScopeDepth;level++,object=Object.getPrototypeOf(object)){
    const descriptor=Object.getOwnPropertyDescriptor(object,key);if(!descriptor)continue;
    if('value' in descriptor)return descriptor.value;
    if(descriptor.get===known?.get&&descriptor.set===known?.set)return this.data(value,stored);
    this.frame.metadataUnavailable++;return;
   }
  }catch{this.frame.metadataUnavailable++;}
 }
 fault(){if(this.active)this.frame.observerErrors++;}
 begin(){
  this.cancel();this.active=true;this.sequence++;
  this.frame=emptyFrame(this.sequence,(this.sequence-1)%programCensusLimits.sampleEvery===0);
  for(const phase of programCensusPhases)this.outside[phase]={epoch:this.epoch,phase,row:null,index:null,parent:null};
  // getRenderTarget is Three's JS field getter, not a GL state query. Existing
  // successful setRenderTarget calls below keep this initial snapshot current.
  if(this.targetGetter)try{this.target=Reflect.apply(this.targetGetter,this.renderer,[]);}catch{this.fault();}
  const xr=this.data(this.renderer,'xr');this.xr=this.data(xr,'isPresenting')===true;
 }
 cancel(){this.active=false;this.epoch++;this.observedProgram=null;this.render=null;this.direct=null;this.shadow=null;this.shadowDepth=0;this.scopeDepth=0;this.target=undefined;this.xr=false;}
 finish(){
  if(!this.active)return;
  if(this.render||this.direct||this.shadowDepth||this.scopeDepth)this.fault();
  const frame=this.frame;this.cancel();return frame;
 }
 private targetKind():TargetKind {
  if(this.xr||this.data(this.target,'isXRRenderTarget')===true)return 'xr';
  return this.target===null?'default':isObject(this.target)?'offscreen':'unknown';
 }
 private outsidePhase():ProgramCensusPhase {
  if(this.shadow&&this.shadow.render===this.render)return 'shadow';
  const target=this.targetKind();return target==='offscreen'?'offscreen':target==='xr'?'xr':'unknown';
 }
 owner():CensusOwner{return this.direct??this.outside[this.outsidePhase()];}
 private program(value:unknown):ProgramId {
  if(value===null)return 0;
  if(!isObject(value))return null;
  const existing=this.identities.get(value);if(existing!==undefined)return existing;
  if(this.nextIdentity>programCensusLimits.maxProgramIdentities){this.frame.identityLimitHits++;return null;}
  const next=this.nextIdentity++;this.identities.set(value,next);return next;
 }
 private groupOrder(object:unknown):number|null {
  if(!this.render)return null;
  let current:unknown=object,nearest:number|null=null;
  for(let level=0;isObject(current)&&level<programCensusLimits.maxScopeDepth;level++){
   if(this.data(current,'isGroup')===true&&nearest===null){nearest=order(this.data(current,'renderOrder'));if(nearest===null)return null;}
   if(current===this.render.scene)return nearest??0;
   current=this.data(current,'parent');
  }
  return null;
 }
 private materialClass(material:unknown):MaterialClass {
  const unavailable=this.frame.metadataUnavailable;
  const transmission=this.scalar(material,'transmission','_transmission',transmissionAccessor),transparent=this.data(material,'transparent');
  if(this.frame.metadataUnavailable!==unavailable)return 'unknown';
  if(typeof transmission==='number'&&transmission>0)return 'transmissive';
  return transparent===true?'transparent':transparent===false?'opaque':'unknown';
 }
 private barriers(object:unknown,material:unknown,geometry:unknown,groupOrder:number|null,renderOrder:number|null,flags:number){
  const b=programCensusBarriers;let mask=flags?b.variantObject:0;
  if(groupOrder===null||renderOrder===null)mask|=b.unknownMetadata;
  for(const [key,bit]of [['depthTest',b.depthTestOff],['depthWrite',b.depthWriteOff],['colorWrite',b.colorWriteOff]] as const){
   const value=this.data(material,key);if(value!==true)mask|=value===false?bit:b.unknownMetadata;
  }
  const depth=this.data(material,'depthFunc');if(depth!==LessEqualDepth)mask|=depth===undefined?b.unknownMetadata:b.nonDefaultDepth;
  const stencil=this.data(material,'stencilWrite');if(stencil!==false)mask|=stencil===true?b.stencilWrite:b.unknownMetadata;
  const blend=this.data(material,'blending');if(blend!==NormalBlending&&blend!==NoBlending)mask|=blend===undefined?b.unknownMetadata:b.nonOpaqueBlend;
  const opacity=this.data(material,'opacity');if(opacity!==1)mask|=opacity===undefined?b.unknownMetadata:b.nonOpaqueBlend;
  // alphaTest is an accessor in Three. Read its stored scalar, never invoke it.
  const alpha=this.scalar(material,'alphaTest','_alphaTest',alphaTestAccessor);
  if((typeof alpha==='number'&&alpha>0)||this.data(material,'alphaToCoverage')===true||this.data(material,'alphaHash')===true)mask|=b.alphaCoverageOrDiscard;
  if(alpha===undefined)mask|=b.unknownMetadata;
  if(this.data(object,'onBeforeRender',true)!==Object3D.prototype.onBeforeRender||this.data(object,'onAfterRender',true)!==Object3D.prototype.onAfterRender)mask|=b.objectRenderCallback;
  if(this.data(material,'onBeforeRender',true)!==Material.prototype.onBeforeRender)mask|=b.materialRenderCallback;
  if(this.data(material,'isShaderMaterial')===true||this.data(material,'isRawShaderMaterial')===true)mask|=b.shaderMaterial;
  if(this.data(material,'onBeforeCompile',true)!==Material.prototype.onBeforeCompile)mask|=b.customCompile;
  if(this.data(material,'polygonOffset')===true)mask|=b.polygonOffset;
  if(isObject(this.data(material,'displacementMap')))mask|=b.displacementMap;
  const clipping=this.data(material,'clippingPlanes');if(Array.isArray(clipping)&&clipping.length)mask|=b.clipping;
  const morph=this.data(geometry,'morphAttributes');
  if(isObject(morph)&&Object.keys(morph).length)mask|=b.variantObject;
  return mask;
 }
 enter(kind:CensusKind,method:string,args:unknown[],receiver:unknown):CensusToken|undefined {
  if(!this.active)return;
  const owner=this.owner(),token:CensusToken={epoch:this.epoch,kind,owner,method,receiverMatches:receiver===(kind==='render'||kind==='target'||kind==='direct'?this.renderer:this.gl)};
  if(kind==='render'){
   this.frame.renderCalls++;
   if(++this.scopeDepth>programCensusLimits.maxScopeDepth){this.fault();return token;}
   const scope:RenderScope={scene:args[0],camera:args[1],pass:this.frame.renderCalls,parent:this.render};this.render=scope;token.render=scope;
  }else if(kind==='shadow'){
   this.frame.shadowCalls++;this.shadowDepth++;
   const shadow:ShadowScope={render:this.render,parent:this.shadow};this.shadow=shadow;token.shadow=shadow;
  }else if(kind==='direct'){
   const material=args[3],object=args[4],target=this.targetKind(),materialClass=this.materialClass(material);
   const phase:ProgramCensusPhase=this.shadow&&this.shadow.render===this.render?'shadow':target==='offscreen'?'offscreen':target==='xr'?'xr':target==='default'&&this.render?materialClass:'unknown';
   const stats=this.frame.phases[phase];stats.directDraws++;
   const index=programCensusPhases.reduce((n,p)=>n+this.frame.phases[p].directDraws,0);
   let row:ProgramCensusDraw|null=null;
   if(this.frame.sampled){
    if(this.frame.draws.length<programCensusLimits.maxDrawsPerSample){
     const flags=(this.data(object,'isInstancedMesh')===true?1:0)|(this.data(object,'isSkinnedMesh')===true?2:0)|(this.data(object,'isBatchedMesh')===true?4:0);
     const groupOrder=phase==='opaque'?this.groupOrder(object):null,renderOrder=order(this.data(object,'renderOrder'));
     row={index,parentIndex:this.direct?.index??null,renderPass:this.render?.pass??null,cameraId:id(this.data(args[0],'id')),sceneId:id(this.data(this.render?.scene,'id')),
      phase,target,materialClass,groupOrder,renderOrder,objectId:id(this.data(object,'id')),geometryId:id(this.data(args[2],'id')),materialId:id(this.data(material,'id')),
      object:label(this.data(object,'name')),material:label(this.data(material,'name')),materialType:label(this.data(material,'type')),objectFlags:flags,
      barrierMask:this.barriers(object,material,args[2],groupOrder,renderOrder,flags)|(this.direct?programCensusBarriers.nestedDirectDraw:0),
      programBefore:this.observedProgram,programAfter:null,firstCoreProgram:null,lastCoreProgram:null,coreDrawCalls:0,useProgramCalls:0,uniformCalls:0,textureCalls:0,threw:false};
     this.frame.draws.push(row);
    }else this.frame.droppedDraws++;
   }
   const direct:CensusOwner={epoch:this.epoch,phase,row,index,parent:this.direct};this.direct=direct;token.owner=direct;
  }else if(kind==='program'){
   const stats=this.frame.phases[owner.phase];stats.useProgramCalls++;if(owner.row)owner.row.useProgramCalls++;
   token.requested=this.program(args[0]);
   if(this.frame.sampled){
    if(this.frame.programEvents.length<programCensusLimits.maxProgramEventsPerSample){
     const event:ProgramCensusProgramEvent={index:this.frame.programEvents.length+this.frame.droppedProgramEvents+1,directIndex:owner.index,phase:owner.phase,previous:this.observedProgram,requested:token.requested,returned:false,receiverMatches:token.receiverMatches};
     this.frame.programEvents.push(event);token.event=event;
    }else this.frame.droppedProgramEvents++;
   }
  }else if(kind==='draw'){
   const stats=this.frame.phases[owner.phase];stats.coreDrawCalls++;
   const observed=token.receiverMatches?this.observedProgram:null;
   stats[observed===null?'unknownProgramDraws':observed===0?'unboundProgramDraws':'knownProgramDraws']++;
   if(owner.row){
    const row=owner.row;if(!row.coreDrawCalls)row.firstCoreProgram=observed;
    else if(row.lastCoreProgram!==observed)row.barrierMask|=programCensusBarriers.multipleObservedPrograms;
    row.lastCoreProgram=observed;row.coreDrawCalls++;
   }
  }else if(kind==='texture'){
   this.frame.phases[owner.phase].textureCalls++;this.frame.textureMethods[method].calls++;if(owner.row)owner.row.textureCalls++;
   if(this.frame.sampled){
    if(this.frame.textureEvents.length<programCensusLimits.maxTextureEventsPerSample){
     const dimensions=textureDimensions(method,args);
     const event:ProgramCensusTextureEvent={index:this.frame.textureEvents.length+this.frame.droppedTextureEvents+1,directIndex:owner.index,phase:owner.phase,method,
      objectId:owner.row?.objectId??null,materialId:owner.row?.materialId??null,...dimensions,returned:false};
     this.frame.textureEvents.push(event);token.event=event;
    }else this.frame.droppedTextureEvents++;
   }
  }
  if(['program','draw','texture'].includes(kind)&&!token.receiverMatches)this.frame.phases[owner.phase].foreignReceiverCalls++;
  return token;
 }
 leave(token:CensusToken,args:unknown[],returned:boolean){
  if(!this.active||token.epoch!==this.epoch)return;
  const stats=this.frame.phases[token.owner.phase];
  if(token.kind==='render'){
   this.scopeDepth--;if(token.render)this.render=token.render.parent;
  }else if(token.kind==='shadow'){this.shadowDepth--;this.shadow=token.shadow?.parent??null;}
  else if(token.kind==='target'){
   if(returned&&token.receiverMatches){this.target=args[0]===null||isObject(args[0])?args[0]:undefined;this.frame.targetChanges++;}
   else this.target=undefined;
  }else if(token.kind==='direct'){
   if(!returned)stats.directDrawThrows++;
   const row=token.owner.row;
   if(row){
    row.programAfter=this.observedProgram;row.threw=!returned;
    if(!row.coreDrawCalls)row.barrierMask|=programCensusBarriers.noCoreDrawObservation;
    if(row.programAfter===null||row.firstCoreProgram===null)row.barrierMask|=programCensusBarriers.unknownProgram;
   }
   this.direct=token.owner.parent;
  }else if(token.kind==='program'){
   const previous=this.observedProgram,requested=token.requested??null;
   if(returned){
    stats.useProgramReturned++;
    if(token.receiverMatches){
     if(previous===null)stats.unknownPreviousProgram++;
     else if(requested!==null)stats[previous===requested?'repeatedProgramRequests':'observedProgramChanges']++;
     this.observedProgram=requested;
    }
   }else{stats.useProgramThrew++;if(token.receiverMatches)this.observedProgram=null;}
   if(token.event)token.event.returned=returned;
  }else if(token.kind==='draw'){
   if(!returned)stats.coreDrawThrows++;
  }else if(token.kind==='texture'){
   if(!returned){stats.textureThrows++;this.frame.textureMethods[token.method].threw++;}
   if(token.event)token.event.returned=returned;
  }
 }
 /** Uniform hooks allocate no token, read no arguments, and call no clock. */
 uniformEnter(method:string,receiver:unknown):CensusOwner|undefined {
  if(!this.active)return;
  const owner=this.owner();this.frame.phases[owner.phase].uniformCalls++;this.frame.uniformMethods[method].calls++;
  if(receiver!==this.gl)this.frame.phases[owner.phase].foreignReceiverCalls++;
  if(owner.row)owner.row.uniformCalls++;return owner;
 }
 uniformLeave(owner:CensusOwner,method:string,returned:boolean){
  if(!this.active||owner.epoch!==this.epoch||returned)return;
  this.frame.phases[owner.phase].uniformThrows++;this.frame.uniformMethods[method].threw++;
 }
}

/** Explicit numeric overload dimensions only. Never inspect a DOM/image source,
 * pixel arrays, texture binding, byte size, or private Three texture storage. */
function textureDimensions(method:string,args:unknown[]){
 const indices:Record<string,readonly number[]>={texImage2D:[3,4],texSubImage2D:[4,5],texImage3D:[3,4,5],texSubImage3D:[5,6,7],
  compressedTexImage2D:[3,4],compressedTexSubImage2D:[4,5],compressedTexImage3D:[3,4,5],compressedTexSubImage3D:[5,6,7],
  texStorage2D:[3,4],texStorage3D:[3,4,5],copyTexImage2D:[5,6],copyTexSubImage2D:[6,7],copyTexSubImage3D:[7,8]};
 let positions=indices[method];
 if((method==='texImage2D'||method==='texSubImage2D')&&args.length<9)positions=[];
 const dimensions=(positions??[]).map(index=>id(args[index]));
 return {width:dimensions[0]??null,height:dimensions[1]??null,depth:dimensions[2]??null};
}

const frameCountNames=['frameSequence','observerErrors','metadataUnavailable','identityLimitHits','renderCalls','shadowCalls','targetChanges','droppedDraws','droppedProgramEvents','droppedTextureEvents'] as const;
const drawCountNames=['index','objectFlags','barrierMask','coreDrawCalls','useProgramCalls','uniformCalls','textureCalls'] as const;
const drawIdNames=['parentIndex','renderPass','cameraId','sceneId','objectId','geometryId','materialId','programBefore','programAfter','firstCoreProgram','lastCoreProgram'] as const;
const targets=['default','offscreen','xr','unknown'],materialClasses=['opaque','transparent','transmissive','unknown'];
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const optionalId=(v:unknown)=>v===null||integer(v);
const drawKeys=[...drawCountNames,...drawIdNames,'phase','target','materialClass','groupOrder','renderOrder','object','material','materialType','threw'] as const;
const pick=<T extends object,K extends keyof T>(value:T,keys:readonly K[])=>Object.fromEntries(keys.map(key=>[key,value[key]])) as Pick<T,K>;

/** Copy only bounded scalars and arrays. No source scene or native objects leak
 * into a frame, slow-frame association, or exported capture. */
export function copyProgramCensusFrame(value:unknown,detail=true):ProgramCensusFrame|null {
 try{
  const source=value as ProgramCensusFrame;
  if(!source||source.version!==1||typeof source.sampled!=='boolean'||frameCountNames.some(k=>!integer(source[k])))return null;
  const out=emptyFrame(source.frameSequence,source.sampled);for(const key of frameCountNames)out[key]=source[key];
  for(const phase of programCensusPhases){const counts=source.phases[phase];if(!counts||phaseCountNames.some(k=>!integer(counts[k])))return null;out.phases[phase]=pick(counts,phaseCountNames);}
  for(const [key,names]of [['uniformMethods',uniformCensusMethods],['textureMethods',textureCensusMethods]] as const){
   for(const name of names){const entry=source[key][name];if(!entry||!integer(entry.calls)||!integer(entry.threw)||entry.threw>entry.calls)return null;out[key][name]={calls:entry.calls,threw:entry.threw};}
  }
  if(!Array.isArray(source.draws)||source.draws.length>programCensusLimits.maxDrawsPerSample||
     !Array.isArray(source.programEvents)||source.programEvents.length>programCensusLimits.maxProgramEventsPerSample||
     !Array.isArray(source.textureEvents)||source.textureEvents.length>programCensusLimits.maxTextureEventsPerSample)return null;
  for(const row of source.draws){
   if(!row||drawCountNames.some(k=>!integer(row[k]))||drawIdNames.some(k=>!optionalId(row[k]))||
    !programCensusPhases.includes(row.phase)||!targets.includes(row.target)||!materialClasses.includes(row.materialClass)||typeof row.threw!=='boolean')return null;
   if([row.groupOrder,row.renderOrder].some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v))))return null;
   if([row.object,row.material,row.materialType].some(v=>typeof v!=='string'||v.length>96))return null;
   if(detail)out.draws.push(pick(row,drawKeys));
  }
  for(const event of source.programEvents){
   if(!event||!integer(event.index)||!optionalId(event.directIndex)||!programCensusPhases.includes(event.phase)||
    !optionalId(event.previous)||!optionalId(event.requested)||typeof event.returned!=='boolean'||typeof event.receiverMatches!=='boolean')return null;
   if(detail)out.programEvents.push(pick(event,['index','directIndex','phase','previous','requested','returned','receiverMatches']));
  }
  for(const event of source.textureEvents){
   if(!event||!integer(event.index)||!optionalId(event.directIndex)||!programCensusPhases.includes(event.phase)||
    !(textureCensusMethods as readonly string[]).includes(event.method)||typeof event.returned!=='boolean'||
    [event.objectId,event.materialId,event.width,event.height,event.depth].some(v=>!optionalId(v)))return null;
   if(detail)out.textureEvents.push(pick(event,['index','directIndex','phase','method','objectId','materialId','width','height','depth','returned']));
  }
  return out;
 }catch{return null;}
}

export const PROGRAM_CENSUS_NOTES=[
 'Counts cover accepted manual render-window callbacks. Samples retain every 16th observed callback; at most 96 recent sampled callbacks are retained. Dropped detail is explicit; totals continue beyond storage limits.',
 'Program IDs identify arguments of normally returning original gl.useProgram calls on the observed context. null means unknown; 0 is an observed null request. WebGL errors can occur without throwing, so these are requested identities, not independently verified accepted GPU bindings. No getError/getParameter is added.',
 'Identity is unknown at each render-window start because inactive wrappers do not observe bindings. Successful original useProgram invocations establish it. Throwing requests invalidate it; foreign receivers do not establish this context binding.',
 'Shadow phase comes from actual shadowMap.render nesting. Otherwise the original renderer target getter and successful target-setting calls identify offscreen/XR/default work; material flags classify default-target color calls. Unproven contexts remain unknown. The camera/pass IDs distinguish separate views.',
 'groupOrder is the nearest Group renderOrder on a proven ancestor path to the current render root, matching Three traversal; renderOrder is the object scalar. Both are snapshots at original renderBufferDirect entry, not reads of Three cached RenderItems. Arbitrary prior callbacks can mutate order/hierarchy after list collection; detected callbacks remain barriers. Unknown ancestry/order stays null. No render list, sort order, shader, material, geometry or quality setting is changed.',
 'Structural barrier bits are conservative descriptions, not proof of order independence or pixel equivalence. A zero mask does not establish screen overlap, equal/near-equal depth, shader deformation, displacement or clipping equivalence. Custom compile/callback, polygon-offset, displacement and clipping flags are warnings, not a shader analysis. Variant bits identify instanced, skinned and batched objects. Core draw hooks exclude extension multi-draw, so noCoreDrawObservation does not mean no rendering.',
 'Uniform calls are count-only, with no added per-uniform clocks or argument inspection. Texture method counts reuse existing hooks; sample dimensions are only explicit numeric call arguments, never inferred transferred bytes, GPU cost, private texture identity or successful upload acceptance.',
];

export class ProgramCensusSummary {
 private total=emptyFrame(0,false);private observed=0;private sampled=0;private dropped=0;private truncated=0;
 private samples:(ProgramCensusFrame&{sample:number})[]=[];
 private limit:number;
 constructor(limit:number=programCensusLimits.maxSamples){if(!integer(limit)||limit>programCensusLimits.maxSamples)throw Error('Invalid census sample limit');this.limit=limit;}
 add(frame:ProgramCensusFrame,sample:number){
  this.observed++;
  for(const key of frameCountNames)if(key!=='frameSequence')this.total[key]+=frame[key];
  for(const phase of programCensusPhases)for(const key of phaseCountNames)this.total.phases[phase][key]+=frame.phases[phase][key];
  for(const key of ['uniformMethods','textureMethods'] as const)for(const [method,value]of Object.entries(frame[key])){
   const total=this.total[key][method]??=zero();total.calls+=value.calls;total.threw+=value.threw;
  }
  if(!frame.sampled)return;
  this.sampled++;if(frame.droppedDraws||frame.droppedProgramEvents||frame.droppedTextureEvents)this.truncated++;
  if(!this.limit){this.dropped++;return;}
  if(this.samples.length===this.limit){this.samples.shift();this.dropped++;}
  this.samples.push({...copyProgramCensusFrame(frame)!,sample});
 }
 report(){
  const total=copyProgramCensusFrame(this.total)!;
  return {version:1,observedCallbacks:this.observed,observerErrors:total.observerErrors,metadataUnavailable:total.metadataUnavailable,identityLimitHits:total.identityLimitHits,
   renderCalls:total.renderCalls,shadowCalls:total.shadowCalls,targetChanges:total.targetChanges,phases:total.phases,uniformMethods:total.uniformMethods,textureMethods:total.textureMethods,
   ...programCensusLimits,sampledCallbacks:this.sampled,retainedSamples:this.samples.length,droppedSamples:this.dropped,truncatedSamples:this.truncated,
   droppedDraws:total.droppedDraws,droppedProgramEvents:total.droppedProgramEvents,droppedTextureEvents:total.droppedTextureEvents,
   samples:this.samples.map(frame=>({...copyProgramCensusFrame(frame)!,sample:frame.sample})),barrierDefinitions:{...programCensusBarriers},notes:[...PROGRAM_CENSUS_NOTES]};
 }
}
