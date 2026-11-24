/** Opt-in CPU observations around existing renderer calls. No GPU queries,
 * synchronization, uploads or rendering decisions are added by this observer. */
import {RenderProgramCensus,copyProgramCensusFrame,textureCensusMethods,uniformCensusMethods,
  type CensusKind,type CensusOwner,type CensusToken,type ProgramCensusFrame} from './renderProgramCensus.ts';
export const renderSubmissionOperationNames = [
  'matrix', 'directDraw', 'bufferData', 'bufferSubData', 'textureUpload',
  'programCompile', 'programLink', 'programStatus', 'programUse', 'draw',
] as const;
export type RenderSubmissionOperationName = typeof renderSubmissionOperationNames[number];
const operationBits=Object.fromEntries(renderSubmissionOperationNames.map((name,index)=>[name,1<<index])) as Record<RenderSubmissionOperationName,number>;

export interface RenderSubmissionOperation {
  calls:number; cpuMs:number; maxCpuMs:number;
  outsideDirectCalls:number; outsideDirectCpuMs:number;
}
export interface RenderDirectDrawRow {
  cpuMs:number;
  objectId:number|null; object:string; parentId:number|null; parent:string;
  geometryId:number|null; materialId:number|null; material:string; materialType:string;
}
export interface RenderSubmissionFrame {
  operations:Record<RenderSubmissionOperationName,RenderSubmissionOperation>;
  invalidObservations:number;
  topDirectDraws:RenderDirectDrawRow[];
  programCensus?:ProgramCensusFrame;
}
export interface RenderSubmissionHookCoverage {
  name:string; status:'installed'|'missing'|'failed'; reason?:string;
}
export interface RenderSubmissionCoverage {
  installed:boolean;
  status:'complete'|'partial'|'unavailable'|'disposed';
  context:'available'|'missing'|'failed';
  hooks:RenderSubmissionHookCoverage[];
  notes:string[];
}
export interface RenderSubmissionProbe {
  beginFrame(enabled:boolean):void;
  finishFrame():RenderSubmissionFrame|undefined;
  cancelFrame():void;
  dispose():void;
  coverage():RenderSubmissionCoverage;
}

const notes = [
  'CPU wall-clock observations only; native call duration is not GPU execution time or proof of driver transfers. No byte counts are inferred.',
  'Each operation cpuMs is the union of its active call scopes. Same-operation reentry counts every call without counting its time twice. Different operation scopes can overlap and must not be added as disjoint phases.',
  'directDraw includes its nested GL work. outsideDirectCpuMs counts only portions with no active directDraw scope; outsideDirectCalls classifies call entry. Both outside fields are zero for directDraw itself.',
  'matrix wraps only the supplied world scene updateMatrixWorld; separate camera and other-object matrix updates are not intercepted.',
  'Only the listed core-context methods are intercepted. Extension calls, including WEBGL_multi_draw, are not intercepted. Missing or failed hooks make coverage partial.',
  'Program status includes status/log and uniform/attribute introspection calls. Texture operations include allocation, copy and mipmap calls. Calls and durations are observations of the original invocations.',
];
const glHooks:readonly (readonly [string,RenderSubmissionOperationName])[] = [
  ['bufferData','bufferData'], ['bufferSubData','bufferSubData'],
  ...textureCensusMethods
    .map(name=>[name,'textureUpload'] as const),
  ['compileShader','programCompile'], ['linkProgram','programLink'],
  ...['getProgramParameter','getShaderParameter','getProgramInfoLog','getShaderInfoLog',
    'getUniformLocation','getAttribLocation','getActiveUniform','getActiveAttrib',
    'getUniformBlockIndex','getActiveUniformBlockParameter','getUniformIndices','getActiveUniforms']
    .map(name=>[name,'programStatus'] as const),
  ['useProgram','programUse'],
  ...['drawArrays','drawElements','drawRangeElements','drawArraysInstanced','drawElementsInstanced']
    .map(name=>[name,'draw'] as const),
];
type Callable = (this:unknown,...args:unknown[])=>unknown;
type Token = {epoch:number; operation:RenderSubmissionOperationName; start:number|undefined; faults:number};
type InstalledHook = {target:object; method:string; own:PropertyDescriptor|undefined; wrapper:Callable; coverage:RenderSubmissionHookCoverage};
const isObject=(value:unknown):value is object=>value!==null&&(typeof value==='object'||typeof value==='function');
const operation=():RenderSubmissionOperation=>({calls:0,cpuMs:0,maxCpuMs:0,outsideDirectCalls:0,outsideDirectCpuMs:0});

export function createEmptyRenderSubmissionFrame():RenderSubmissionFrame {
  const operations={} as Record<RenderSubmissionOperationName,RenderSubmissionOperation>;
  for(const name of renderSubmissionOperationNames)operations[name]=operation();
  return {operations,invalidObservations:0,topDirectDraws:[]};
}

/** Reject malformed observations without retaining any source object references. */
export function copyRenderSubmissionFrame(value:unknown,includeCensus=true):RenderSubmissionFrame|null {
  try {
    if(!isObject(value))return null;
    const source=value as RenderSubmissionFrame;
    if(!Number.isSafeInteger(source.invalidObservations)||source.invalidObservations<0||
      !Array.isArray(source.topDirectDraws)||source.topDirectDraws.length>3)return null;
    const result=createEmptyRenderSubmissionFrame();result.invalidObservations=source.invalidObservations;
    for(const name of renderSubmissionOperationNames){
      const item=source.operations[name];
      if(!item||!Number.isSafeInteger(item.calls)||item.calls<0||
        !Number.isSafeInteger(item.outsideDirectCalls)||item.outsideDirectCalls<0||item.outsideDirectCalls>item.calls)return null;
      for(const key of ['cpuMs','maxCpuMs','outsideDirectCpuMs'] as const)
        if(!Number.isFinite(item[key])||item[key]<0)return null;
      result.operations[name]={calls:item.calls,cpuMs:item.cpuMs,maxCpuMs:item.maxCpuMs,
        outsideDirectCalls:item.outsideDirectCalls,outsideDirectCpuMs:item.outsideDirectCpuMs};
    }
    for(const row of source.topDirectDraws){
      if(!row||!Number.isFinite(row.cpuMs)||row.cpuMs<0)return null;
      for(const key of ['objectId','parentId','geometryId','materialId'] as const)
        if(row[key]!==null&&(!Number.isSafeInteger(row[key])||row[key]!<0))return null;
      for(const key of ['object','parent','material','materialType'] as const)
        if(typeof row[key]!=='string'||row[key].length>96)return null;
      result.topDirectDraws.push({cpuMs:row.cpuMs,objectId:row.objectId,object:row.object,
        parentId:row.parentId,parent:row.parent,geometryId:row.geometryId,
        materialId:row.materialId,material:row.material,materialType:row.materialType});
    }
    if(includeCensus&&source.programCensus!==undefined){
      const census=copyProgramCensusFrame(source.programCensus);if(!census)return null;
      result.programCensus=census;
    }
    return result;
  }catch{return null;}
}

/** Installation itself is opt-in: callers must not invoke this for ordinary
 * gameplay. Once installed, inactive wrappers forward with zero clock calls. */
export function installRenderSubmissionProbe(renderer:object,scene:object,clock:()=>number=()=>performance.now()):RenderSubmissionProbe {
  return new SubmissionProbe(renderer,scene,clock);
}

class SubmissionProbe implements RenderSubmissionProbe {
  private active=false; private disposed=false; private epoch=0; private faults=0;
  private frame=createEmptyRenderSubmissionFrame(); private lastClock:number|undefined;
  private depths=Object.fromEntries(renderSubmissionOperationNames.map(name=>[name,0])) as Record<RenderSubmissionOperationName,number>;
  private activeOperations=0;
  private hooks:InstalledHook[]=[]; private hookCoverage:RenderSubmissionHookCoverage[]=[];
  private context:RenderSubmissionCoverage['context']='missing';
  private clock:()=>number;
  private census:RenderProgramCensus|undefined;
  constructor(renderer:object,scene:object,clock:()=>number){
    this.clock=clock;
    this.install(renderer,'renderBufferDirect','directDraw','renderer.renderBufferDirect');
    this.install(scene,'updateMatrixWorld','matrix','scene.updateMatrixWorld');
    let gl:unknown;
    try{
      const getContext=Reflect.get(renderer,'getContext');
      if(typeof getContext==='function'){
        gl=Reflect.apply(getContext,renderer,[]);
        this.context=isObject(gl)?'available':'missing';
      }
    }catch{this.context='failed';}
    if(isObject(gl)){
      this.census=new RenderProgramCensus(renderer,gl);
      this.install(renderer,'render',undefined,'renderer.render','render');
      this.install(renderer,'setRenderTarget',undefined,'renderer.setRenderTarget','target');
      let shadow:unknown;try{shadow=Object.getOwnPropertyDescriptor(renderer,'shadowMap')?.value;}catch{/* Coverage remains missing. */}
      this.install(isObject(shadow)?shadow:undefined,'render',undefined,'renderer.shadowMap.render','shadow');
    }
    for(const [name,kind] of glHooks){
      const censusKind:CensusKind|undefined=kind==='programUse'?'program':kind==='draw'?'draw':kind==='textureUpload'?'texture':undefined;
      this.install(isObject(gl)?gl:undefined,name,kind,'gl.'+name,censusKind);
    }
    if(this.census)for(const name of uniformCensusMethods)this.install(isObject(gl)?gl:undefined,name,undefined,'gl.'+name,undefined,true);
  }
  private invalid(){this.frame.invalidObservations++;this.faults++;}
  private checkpoint(epoch:number):number|undefined {
    let now:unknown;
    try{now=this.clock();}catch{now=undefined;}
    if(!this.active||epoch!==this.epoch)return;
    if(typeof now!=='number'||!Number.isFinite(now)){
      this.invalid();this.lastClock=undefined;return;
    }
    if(this.lastClock!==undefined){
      const delta=now-this.lastClock;
      if(!Number.isFinite(delta)||delta<0)this.invalid();
      // Low bits preserve the original operation order; depth transitions keep
      // same-operation reentry active until its outermost call completes.
      else for(let remaining=this.activeOperations;remaining;remaining&=remaining-1){
        const name=renderSubmissionOperationNames[31-Math.clz32(remaining&-remaining)];
        const stats=this.frame.operations[name],total=stats.cpuMs+delta;
        if(Number.isFinite(total))stats.cpuMs=total;else this.invalid();
        if(name!=='directDraw'&&this.depths.directDraw===0){
          const outside=stats.outsideDirectCpuMs+delta;
          if(Number.isFinite(outside))stats.outsideDirectCpuMs=outside;else this.invalid();
        }
      }
    }
    this.lastClock=now;return now;
  }
  private enter(operation:RenderSubmissionOperationName):Token|undefined {
    const epoch=this.epoch,start=this.checkpoint(epoch);
    if(!this.active||epoch!==this.epoch)return;
    const stats=this.frame.operations[operation];stats.calls++;
    if(operation!=='directDraw'&&this.depths.directDraw===0)stats.outsideDirectCalls++;
    if(this.depths[operation]++===0)this.activeOperations|=operationBits[operation];
    return {epoch,operation,start,faults:this.faults};
  }
  private leave(token:Token,args:unknown[]){
    if(!this.active||token.epoch!==this.epoch)return;
    const end=this.checkpoint(token.epoch);
    if(!this.active||token.epoch!==this.epoch)return;
    if(--this.depths[token.operation]===0)this.activeOperations&=~operationBits[token.operation];
    if(token.start===undefined||end===undefined||token.faults!==this.faults)return;
    const duration=end-token.start;
    if(!Number.isFinite(duration)||duration<0){this.invalid();return;}
    const stats=this.frame.operations[token.operation];stats.maxCpuMs=Math.max(stats.maxCpuMs,duration);
    if(token.operation==='directDraw')this.recordDraw(duration,args);
  }
  private read(value:unknown,key:string):unknown {
    if(!isObject(value))return;
    try{
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor)return;
      if('value' in descriptor)return descriptor.value;
      // Labels are optional. Do not execute application accessors merely to
      // describe a slow draw, even when an accessor could return a valid label.
      this.invalid();return;
    }catch{this.invalid();return;}
  }
  private id(value:unknown):number|null{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}
  private label(value:unknown):string{return typeof value==='string'?value.slice(0,96):'';}
  private recordDraw(cpuMs:number,args:unknown[]){
    const top=this.frame.topDirectDraws;
    if(top.length===3&&cpuMs<=top[2].cpuMs)return;
    const object=args[4],material=args[3],geometry=args[2],parent=this.read(object,'parent');
    const row:RenderDirectDrawRow={cpuMs,
      objectId:this.id(this.read(object,'id')),object:this.label(this.read(object,'name')),
      parentId:this.id(this.read(parent,'id')),parent:this.label(this.read(parent,'name')),
      geometryId:this.id(this.read(geometry,'id')),materialId:this.id(this.read(material,'id')),
      material:this.label(this.read(material,'name')),materialType:this.label(this.read(material,'type'))};
    if(top.length<3)top.push(row);else top[2]=row;
    top.sort((a,b)=>b.cpuMs-a.cpuMs);
  }
  private install(target:object|undefined,method:string,kind:RenderSubmissionOperationName|undefined,name:string,censusKind?:CensusKind,uniform=false){
    const coverage:RenderSubmissionHookCoverage={name,status:'missing'};this.hookCoverage.push(coverage);
    if(!target){coverage.reason='context-unavailable';return;}
    let own:PropertyDescriptor|undefined,wrapper:Callable|undefined;
    try{
      own=Object.getOwnPropertyDescriptor(target,method);
      let descriptor=own,owner:object|null=target,levels=0;
      // Do not invoke accessors or override nonwritable inherited methods.
      while(!descriptor&&(owner=Object.getPrototypeOf(owner))){
        if(++levels>64){coverage.status='failed';coverage.reason='prototype-chain-too-deep';return;}
        descriptor=Object.getOwnPropertyDescriptor(owner,method);
      }
      if(descriptor&&(!('value' in descriptor)||descriptor.writable===false)){
        coverage.status='failed';coverage.reason='accessor-or-nonwritable';return;
      }
      const original=Reflect.get(target,method);
      if(typeof original!=='function')return;
      const probe=this;
      wrapper=function(this:unknown,...args:unknown[]){
        if(!probe.active||probe.disposed)return Reflect.apply(original,this,args);
        if(uniform){
          let owner:CensusOwner|undefined;
          try{owner=probe.census?.uniformEnter(method,this);}catch{probe.census?.fault();}
          let returned=false;
          try{const result=Reflect.apply(original,this,args);returned=true;return result;}
          finally{if(owner)try{probe.census?.uniformLeave(owner,method,returned);}catch{probe.census?.fault();}}
        }
        const token=kind?probe.enter(kind):undefined;
        let censusToken:CensusToken|undefined;
        const censusOperation=kind==='directDraw'?'direct':censusKind;
        if(censusOperation&&(!kind||token))try{censusToken=probe.census?.enter(censusOperation,method,args,this);}catch{probe.census?.fault();}
        let returned=false;
        try{const result=Reflect.apply(original,this,args);returned=true;return result;}
        finally{
          if(token)probe.leave(token,args);
          if(censusToken)try{probe.census?.leave(censusToken,args,returned);}catch{probe.census?.fault();}
        }
      };
      Object.defineProperty(target,method,own?{...own,value:wrapper}:{value:wrapper,writable:true,configurable:true,enumerable:false});
      if(Object.getOwnPropertyDescriptor(target,method)?.value!==wrapper)throw Error('Hook unavailable');
      coverage.status='installed';
      this.hooks.push({target,method,own,wrapper,coverage});
    }catch{
      coverage.status='failed';coverage.reason='hook-install-failed';
      if(wrapper)try{
        if(Object.getOwnPropertyDescriptor(target,method)?.value===wrapper){
          if(own)Object.defineProperty(target,method,own);else Reflect.deleteProperty(target,method);
        }
      }catch{/* A hostile/frozen target is reported as failed; original calls are never issued here. */}
    }
  }
  beginFrame(enabled:boolean){
    this.cancelFrame();
    if(!enabled||this.disposed)return;
    this.frame=createEmptyRenderSubmissionFrame();this.faults=0;this.active=true;
    try{this.census?.begin();}catch{this.census?.fault();}
  }
  finishFrame():RenderSubmissionFrame|undefined {
    if(!this.active)return;
    if(renderSubmissionOperationNames.some(name=>this.depths[name]>0))this.invalid();
    try{const census=this.census?.finish();if(census)this.frame.programCensus=census;}catch{this.census?.fault();}
    const result=copyRenderSubmissionFrame(this.frame)??undefined;
    this.cancelFrame();return result;
  }
  cancelFrame(){
    this.active=false;this.epoch++;this.lastClock=undefined;
    this.census?.cancel();
    this.activeOperations=0;
    for(const name of renderSubmissionOperationNames)this.depths[name]=0;
  }
  coverage():RenderSubmissionCoverage {
    const hooks=this.hookCoverage.map(value=>{
      const result={...value};
      if(result.status!=='installed')return result;
      if(this.disposed){result.status='missing';result.reason='probe-disposed';return result;}
      const hook=this.hooks.find(item=>item.coverage===value);
      try{
        if(!hook||Object.getOwnPropertyDescriptor(hook.target,hook.method)?.value!==hook.wrapper){
          result.status='failed';result.reason='hook-binding-changed';
        }
      }catch{result.status='failed';result.reason='hook-ownership-unavailable';}
      return result;
    });
    const installed=hooks.filter(h=>h.status==='installed').length;
    return {installed:!this.disposed&&installed>0,
      status:this.disposed?'disposed':installed===0?'unavailable':installed===this.hookCoverage.length?'complete':'partial',
      context:this.context,hooks,notes:[...notes]};
  }
  dispose(){
    if(this.disposed)return;
    this.cancelFrame();this.disposed=true;
    for(const hook of this.hooks)try{
      if(Object.getOwnPropertyDescriptor(hook.target,hook.method)?.value!==hook.wrapper)continue;
      if(hook.own)Object.defineProperty(hook.target,hook.method,hook.own);
      else if(!Reflect.deleteProperty(hook.target,hook.method))throw Error('Hook removal failed');
    }catch{hook.coverage.status='failed';hook.coverage.reason='hook-restore-failed';}
    this.hooks=[];
  }
}
