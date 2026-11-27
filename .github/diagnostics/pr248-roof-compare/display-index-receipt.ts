/** Read-only evidence for LandmarkDetail's original, asset-pinned display indices.
 * The preparation observer returns the exact original Promise. It never selects
 * a geometry, invokes a render callback, or changes the original render order. */
type Hash=(bytes:Uint8Array)=>Promise<string>;
const callbackNames=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'] as const;
const whole=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
function check(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
function equal(a:any,b:any):boolean{
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();return ak.length===bk.length&&ak.every((key,i)=>key===bk[i]&&equal(a[key],b[key]));
}
const clone=(value:any):any=>value===null||typeof value!=='object'?value:Array.isArray(value)?value.map(clone):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v)]));
function array(value:any,n:number,label:string):number[]{
 const out=Array.from(value?.elements??value??[]) as number[];
 check(out.length===n&&out.every(Number.isFinite),'Invalid display-index '+label);return out;
}
function vector(value:any){return array(value?.toArray?.()??[value?.x,value?.y,value?.z],3,'vector');}
function sphere(value:any){check(value&&Number.isFinite(value.radius)&&value.radius>=0,'Invalid display-index sphere');return {center:vector(value.center),radius:value.radius};}
function box(value:any){return value?{min:vector(value.min),max:vector(value.max)}:null;}
function range(value:any){check(value&&whole(value.start)&&(whole(value.count)||value.count===Infinity),'Invalid display-index range');return {start:value.start,count:value.count===Infinity?'Infinity':value.count};}
function path(object:any):string{
 const label=encodeURIComponent(object.name||object.type),peers=object.parent?.children.filter((o:any)=>(o.name||o.type)===(object.name||object.type))??[object];
 return (object.parent?path(object.parent)+'/':'')+label+'#'+peers.indexOf(object);
}
const roof=(value:string)=>/107227742_STAGED_LOD[012](?:%|\/|#)/.test(value)&&value.includes('PatinatedCopperPanels');
function hierarchy(object:any,scene:any){
 const links:{object:any;parent:any}[]=[],seen=new Set();let current=object;
 for(;;){
  check(current&&!seen.has(current),'Invalid display-index scene ancestry');seen.add(current);
  const parent=current.parent;links.push({object:current,parent});
  if(current===scene)break;
  check(parent&&Array.isArray(parent.children)&&parent.children.filter((child:any)=>child===current).length===1,'Display-index source is not an actual scene child');current=parent;
 }
 return links;
}
function callbackRefs(object:any){return callbackNames.map(name=>{check(typeof object?.[name]==='function','Missing display-index '+name);return object[name];});}
function sameCallbacks(object:any,refs:any[]){check(callbackNames.every((name,i)=>object[name]===refs[i]),'Original display-index callback reference changed');}
function callbackBytes(refs:any[]){return refs.map(fn=>new TextEncoder().encode(JSON.stringify(Function.prototype.toString.call(fn))));}
function cameraState(camera:any){return {matrixWorld:array(camera.matrixWorld,16,'camera world matrix'),matrixWorldInverse:array(camera.matrixWorldInverse,16,'camera inverse'),projectionMatrix:array(camera.projectionMatrix,16,'camera projection')};}
function bufferSize(renderer:any){
 const size={x:0,y:0,set(x:number,y:number){this.x=x;this.y=y;return this;},floor(){this.x=Math.floor(this.x);this.y=Math.floor(this.y);return this;}};
 renderer.getDrawingBufferSize(size);check(Number.isSafeInteger(size.x)&&size.x>0&&Number.isSafeInteger(size.y)&&size.y>0,'Invalid display-index drawing buffer');return {width:size.x,height:size.y};
}
/** The exact matrix norm and sphere transform used by the pinned original. */
export function displayIndexBounds(matrixWorld:number[],sourceSphere:{center:number[];radius:number},entryError:number|undefined){
 const a=matrixWorld,[x,y,z]=sourceSphere.center;
 const columns=Math.max(...[0,4,8].map(i=>Math.abs(a[i])+Math.abs(a[i+1])+Math.abs(a[i+2])));
 const rows=Math.max(...[0,1,2].map(i=>Math.abs(a[i])+Math.abs(a[i+4])+Math.abs(a[i+8])));
 const scale=Math.sqrt(rows*columns),w=1/(a[3]*x+a[7]*y+a[11]*z+a[15]);
 const bounds={center:[(a[0]*x+a[4]*y+a[8]*z+a[12])*w,(a[1]*x+a[5]*y+a[9]*z+a[13])*w,(a[2]*x+a[6]*y+a[10]*z+a[14])*w],radius:sourceSphere.radius*scale};
 return {bounds,scale,error:scale*(entryError??Infinity)};
}
/** Mirrors the original half-pixel predicate, including its exact boundaries. */
export function displayIndexSelection(value:any){
 const p=value.camera.projectionMatrix,eye=value.camera.matrixWorldInverse,c=value.bounds.center,error=value.error;
 const near=-(eye[2]*c[0]+eye[6]*c[1]+eye[10]*c[2]+eye[14])-value.bounds.radius;
 const pixelScale=Math.hypot(value.width*(Math.abs(p[0])+1+Math.abs(p[8])),value.height*(Math.abs(p[5])+1+Math.abs(p[9])))*.5;
 const subpixel=Number.isFinite(error)&&error>=0&&Number.isFinite(near)&&near>64+error&&Number.isFinite(pixelScale)&&pixelScale>0&&error*pixelScale<=(near-error)*.5;
 const selected=!value.splitActive&&value.perspective&&!value.arrayCamera&&!value.xrPresenting&&value.target===null&&value.visible&&!value.castShadow&&subpixel?'reduced':'full';
 return {near,pixelScale,selected};
}
function attribute(attribute:any,label:string){
 check(attribute&&typeof attribute==='object','Missing display-index '+label);
 const interleaved=attribute.isInterleavedBufferAttribute===true,data=interleaved?attribute.data:attribute,typed=data?.array;
 check(!attribute.isInstancedBufferAttribute&&!data?.isInstancedInterleavedBuffer&&attribute.meshPerAttribute==null&&data?.meshPerAttribute==null,'Instanced display-index attribute');
 check(ArrayBuffer.isView(typed)&&!(typed instanceof DataView)&&!(typed instanceof BigInt64Array)&&!(typed instanceof BigUint64Array),'Unsupported display-index attribute storage');
 const itemSize=attribute.itemSize,offset=interleaved?attribute.offset:0,stride=interleaved?data.stride:itemSize,a=typed as any;
 check(whole(attribute.count)&&Number.isSafeInteger(itemSize)&&itemSize>0&&whole(offset)&&Number.isSafeInteger(stride)&&stride>0&&offset+itemSize<=stride&&attribute.count===a.length/stride,'Invalid display-index attribute layout');
 check(typeof attribute.normalized==='boolean'&&Number.isSafeInteger(data.usage),'Invalid display-index attribute flags');
 return {reference:attribute,storage:a,field:{type:a.constructor.name,bytes:a.byteLength,count:attribute.count,itemSize,normalized:attribute.normalized,interleaved,offset,stride,gpuType:attribute.gpuType??null,usage:data.usage,meshPerAttribute:attribute.meshPerAttribute??null,sha256:null as string|null}};
}
function index(attributeValue:any,label:string){
 const a=attribute(attributeValue,label);check(!a.field.interleaved&&a.field.itemSize===1&&!a.field.normalized&&['Uint16Array','Uint32Array'].includes(a.field.type),'Unsupported display-index index representation');return a;
}
function geometryState(g:any){
 check(g&&g.type==='BufferGeometry'&&!g.isInstancedBufferGeometry,'Unsupported display-index geometry');
 check(Array.isArray(g.groups)&&g.groups.length===0&&g.morphAttributes&&Object.keys(g.morphAttributes).length===0&&g.morphTargetsRelative===false,'Unsupported display-index group/morph state');
 return {type:g.type,groups:[],drawRange:range(g.drawRange),morphTargetsRelative:false,morphAttributes:{},boundingSphere:g.boundingSphere?sphere(g.boundingSphere):null,boundingBox:box(g.boundingBox)};
}
function ordinary(mesh:any){
 check(mesh?.isMesh===true&&mesh.type==='Mesh'&&!mesh.isSkinnedMesh&&!mesh.isInstancedMesh&&!mesh.isBatchedMesh,'Display-index owner is not an ordinary Mesh');
 check(mesh.count===1&&mesh.instanceMatrix==null&&mesh.instanceColor==null&&mesh.morphTargetInfluences==null,'Unsupported display-index instance/morph state');
 check(!roof(path(mesh)),'Display-index proof cannot cover a roof exception');
}
function pinnedIndex(field:any,pin:any,label:string,withHash=false){
 for(const key of ['type','bytes','count'])check(Object.is(field[key],pin?.[key]),'Pinned display-index '+label+' '+key+' differs');
 if(withHash)check(field.sha256===pin.sha256,'Pinned display-index '+label+' bytes differ');
}

export function installDisplayIndexObserver(LandmarkDetailClass:any,pins:any){
 check(pins?.schema===1&&pins.metadata?.version===1&&Array.isArray(pins.entries)&&pins.entries.length>0,'Missing immutable display-index pins');
 const byKey=new Map<string,any>();for(const pin of pins.entries){check(typeof pin.key==='string'&&!byKey.has(pin.key)&&pin.key===pin.entry?.mesh+':'+pin.entry?.primitive,'Invalid display-index association pin');byKey.set(pin.key,pin);}
 const proto=LandmarkDetailClass?.prototype,descriptor=Object.getOwnPropertyDescriptor(proto,'prepareDistant'),original=descriptor?.value;
 check(descriptor&&typeof original==='function'&&descriptor.writable===true,'Original prepareDistant method unavailable');
 let failure:any=null,registered:any=null,calls=0,activeContext:any=null,sealedSceneRefs:any[]|null=null;
 const registry=new Map<any,any>(),byPath=new Map<string,any>();
 function register(instance:any,scene:any){
  check(!registered&&calls===1,'Multiple original display-index registrations');
  check(instance&&Array.isArray(instance.items)&&instance.items.length>0&&instance.asset?.parser?.associations?.get&&instance.splitActive===false,'Original display-index runtime items unavailable');
  const entries:any[]=[];
  for(const item of instance.items){
   const {mesh,full,reduced}=item;ordinary(mesh);check(mesh.geometry===full&&full!==reduced&&!registry.has(mesh),'Invalid original display-index geometry identities');
   const assoc=instance.asset.parser.associations.get(mesh),association={meshes:assoc?.meshes,primitives:assoc?.primitives??0},key=association.meshes+':'+association.primitives,pin=byKey.get(key);
   check(pin&&whole(association.meshes)&&whole(association.primitives),'Original display-index association is not pinned');
   const names=Object.keys(full.attributes).sort();check(names.includes('position')&&equal(names,Object.keys(reduced.attributes).sort()),'Original display-index attributes differ');
   const attributes=names.map(name=>{check(full.attributes[name]===reduced.attributes[name],'Original display-index attribute object differs');return {name,...attribute(full.attributes[name],name)};});
   const fullIndex=index(full.index,'full index'),reducedIndex=index(reduced.index,'reduced index');pinnedIndex(fullIndex.field,pin.sourceIndex,'source');pinnedIndex(reducedIndex.field,pin.decodedIndex,'reduced');
   check(fullIndex.reference!==reducedIndex.reference&&fullIndex.storage!==reducedIndex.storage,'Original display-index buffers are not distinct');
   check(attributes.find(a=>a.name==='position')!.field.count===pin.entry.vertices&&fullIndex.field.count===pin.entry.originalCount&&reducedIndex.field.count===pin.entry.count,'Original display-index asset counts differ');
   const fullState=geometryState(full),reducedState=geometryState(reduced);check(equal(fullState.drawRange,{start:0,count:'Infinity'})&&equal(reducedState.drawRange,{start:0,count:'Infinity'}),'Original display-index active range differs');
   check(fullState.boundingSphere,'Original display-index source sphere missing');
   const matrixWorld=array(mesh.matrixWorld,16,'registration matrix'),computed=displayIndexBounds(matrixWorld,fullState.boundingSphere,pin.entry.error),nativeBounds=sphere(item.bounds);
   check(equal(computed.bounds,nativeBounds)&&Object.is(computed.error,item.error),'Original display-index registration bounds/error differ');
   const sourcePath=path(mesh),ancestry=hierarchy(mesh,scene);check(!byPath.has(sourcePath),'Ambiguous original display-index source path');
   const record={item,mesh,full,reduced,pin,key,association,sourcePath,ancestry,attributes,fullIndex,reducedIndex,fullState,reducedState,matrixWorld,computed,sealedRefs:null as any[]|null};
   registry.set(mesh,record);byPath.set(sourcePath,record);entries.push(record);
  }
  registered={instance,scene,entries,items:instance.items,sceneRefs:callbackRefs(scene)};
 }
 const wrapper=function(this:any,...args:any[]){
  const result=Reflect.apply(original,this,args);calls++;
  try{
   check(result instanceof Promise,'Original prepareDistant did not return its native Promise');
   // This synchronous registration sidechain is enqueued before the caller can
   // await the unchanged original Promise. Errors are sticky observer failures.
   void result.then(()=>{try{register(this,args[0]);}catch(error){failure=error;}},error=>{failure=error;});
  }catch(error){failure=error;}
  return result;
 };
 Object.defineProperty(proto,'prepareDistant',{...descriptor,value:wrapper});
 function ready(){if(failure)throw failure;check(registered,'Original display-index preparation is incomplete');check(proto.prepareDistant===wrapper,'Display-index preparation observer was replaced');}
 function sourceStable(r:any){
  ordinary(r.mesh);check(r.item.mesh===r.mesh&&r.item.full===r.full&&r.item.reduced===r.reduced,'Registered display-index geometry identity changed');
  const currentHierarchy=hierarchy(r.mesh,registered.scene);
  check(currentHierarchy.length===r.ancestry.length&&currentHierarchy.every((link:any,i:number)=>link.object===r.ancestry[i].object&&link.parent===r.ancestry[i].parent),'Original display-index scene ancestry identity changed');
  check(path(r.mesh)===r.sourcePath,'Original display-index source path changed');
  check(equal(geometryState(r.full),r.fullState)&&equal(geometryState(r.reduced),r.reducedState),'Registered display-index geometry state changed');
  check(equal(array(r.mesh.matrixWorld,16,'current source matrix'),r.matrixWorld),'Display-index source transform changed after original registration');
  check(equal(sphere(r.item.bounds),r.computed.bounds)&&Object.is(r.item.error,r.computed.error),'Original display-index cached bounds/error changed');
  const assoc=registered.instance.asset.parser.associations.get(r.mesh);check(assoc?.meshes===r.association.meshes&&(assoc?.primitives??0)===r.association.primitives,'Original display-index parser association changed');
  check(equal(Object.keys(r.full.attributes).sort(),r.attributes.map((a:any)=>a.name))&&equal(Object.keys(r.reduced.attributes).sort(),r.attributes.map((a:any)=>a.name)),'Display-index attribute membership changed');
  for(const a of r.attributes){check(r.full.attributes[a.name]===a.reference&&r.reduced.attributes[a.name]===a.reference,'Original display-index attribute identity changed');const now=attribute(a.reference,a.name);check(now.storage===a.storage&&equal(now.field,a.field),'Original display-index attribute storage/layout changed');}
  for(const [g,a]of [[r.full,r.fullIndex],[r.reduced,r.reducedIndex]]){check(g.index===a.reference,'Original display-index index identity changed');const now=index(g.index,'current index');check(now.storage===a.storage&&equal(now.field,a.field),'Original display-index index storage/layout changed');}
 }
 function viewStable(context:any){
  check(equal(cameraState(context.camera),context.view.camera),'Original display-index camera changed during render');
  check((context.camera.isPerspectiveCamera===true)===context.view.perspective&&(context.camera.isArrayCamera===true)===context.view.arrayCamera&&(context.renderer.xr?.isPresenting===true)===context.view.xrPresenting,'Original display-index camera/XR flags changed');
  check(equal(bufferSize(context.renderer),{width:context.view.width,height:context.view.height}),'Original display-index drawing buffer changed');
 }
 function contextStable(context:any){
  ready();check(context&&context===activeContext&&context.scene===registered.scene,'Unknown display-index render context');
  check(registered.instance.items===registered.items&&registered.items.length===registered.entries.length&&registered.entries.every((r:any,i:number)=>registered.items[i]===r.item),'Original display-index item inventory changed');
  check(registered.instance.splitActive===false,'Original split-detail mode is active');
  sameCallbacks(context.scene,context.sceneRefs);viewStable(context);
  check(context.renderer.getRenderTarget()===context.target,'Original display-index render target changed');
 }
 function assertRestored(context:any){
  contextStable(context);context.restored=false;
  for(const [mesh,quiet]of context.quiet){const r=registry.get(mesh);sourceStable(r);sameCallbacks(mesh,quiet.callbacks);check(mesh.geometry===r.full,'Original full display-index geometry was not restored');check(mesh.visible===quiet.visible&&mesh.castShadow===quiet.castShadow,'Original display-index visibility/shadow flags changed');}
  context.restored=true;
  for(const snapshot of context.snapshots){snapshot.receipt.identities.restoredIsFull=true;snapshot.receipt.restored={geometryIsFull:true,sourceDrawRange:clone(snapshot.record.fullState.drawRange),matrixWorld:snapshot.record.matrixWorld.slice()};}
 }
 return {
  beforeRender(scene:any,camera:any,renderer:any){
   ready();check(scene===registered.scene&&(!activeContext||activeContext.restored),'Previous display-index render did not restore');
   check(registered.instance.splitActive===false,'Original split-detail mode is active');
   if(!sealedSceneRefs)sealedSceneRefs=callbackRefs(scene);sameCallbacks(scene,sealedSceneRefs);
   const target=renderer.getRenderTarget(),view={camera:cameraState(camera),...bufferSize(renderer),perspective:camera.isPerspectiveCamera===true,arrayCamera:camera.isArrayCamera===true,xrPresenting:renderer.xr?.isPresenting===true,target:target===null?null:'non-default',splitActive:false};
   const context:any={scene,camera,renderer,target,view,sceneRefs:sealedSceneRefs,quiet:new Map(),snapshots:[],restored:false};
   for(const r of registered.entries){sourceStable(r);check(r.mesh.geometry===r.full,'Original display-index geometry is not quiet/full');if(!r.sealedRefs)r.sealedRefs=callbackRefs(r.mesh);sameCallbacks(r.mesh,r.sealedRefs);check(typeof r.mesh.visible==='boolean'&&typeof r.mesh.castShadow==='boolean','Invalid display-index source flags');context.quiet.set(r.mesh,{callbacks:r.sealedRefs,visible:r.mesh.visible,castShadow:r.mesh.castShadow});}
   activeContext=context;contextStable(context);return context;
  },
  snapshotSubmitted(context:any,submitted:any,object:any,group:unknown,pass:string){
   const r=registry.get(object),boundPath=byPath.get(path(object));
   check(!boundPath||boundPath.mesh===object,'Unregistered native object replaced an original display-index source path');
   if(!r)return null;
   // A shadow render temporarily binds its own target. Selection still belongs
   // to the outer original scene camera; direct target equality is color-only.
   ready();check(context&&context===activeContext&&!context.restored,'Display-index submission has no active original render');
   sourceStable(r);const quiet=context.quiet.get(object);check(quiet,'Missing display-index quiet owner');sameCallbacks(context.scene,context.sceneRefs);sameCallbacks(object,quiet.callbacks);
   check(object.visible===quiet.visible&&object.castShadow===quiet.castShadow,'Display-index selection flags changed inside render');
   viewStable(context);
   check(registered.instance.splitActive===false,'Original split-detail mode changed inside render');
   const selection={...clone(context.view),bounds:clone(r.computed.bounds),error:r.computed.error,visible:quiet.visible,castShadow:quiet.castShadow};Object.assign(selection,displayIndexSelection(selection));
   check(object.geometry===(selection.selected==='reduced'?r.reduced:r.full),'Actual display-index geometry disagrees with original projection selection');
   if(selection.selected==='full')return null;
   contextStable(context);check(pass==='color'&&context.target===null,'Reduced display-index submission is not the original color view');
   check(submitted===object.geometry&&submitted===r.reduced,'Reduced display-index native geometry identity differs');check(group===null,'Reduced display-index requires observed null group');
   const copies:{field:any;raw:Uint8Array}[]=[],attributes:any={};
   function copied(a:any){const field={...a.field},raw=new Uint8Array(a.storage.buffer,a.storage.byteOffset,a.storage.byteLength).slice();copies.push({field,raw});return field;}
   for(const a of r.attributes)attributes[a.name]=copied(a);
   const sourceGeometry={...clone(r.fullState),attributes,index:copied(r.fullIndex)},submittedGeometry={...clone(r.reducedState),attributes:clone(attributes),index:copied(r.reducedIndex)};
   // The same native attribute objects serve both geometries; their byte copies
   // are hashed once and copied into both complete layout receipts on settlement.
   const callbackSets={object:callbackBytes(quiet.callbacks),scene:callbackBytes(context.sceneRefs),registeredScene:callbackBytes(registered.sceneRefs),selector:callbackBytes([original])};
   const callbacks:any=Object.fromEntries(Object.entries(callbackSets).map(([k,v])=>[k,v.map(()=>({functionSha256:null}))]));
   const receipt:any={kind:'exact-original-display-index',assetKey:r.key,assetBinding:{source:clone(pins.source),assets:clone(pins.assets),metadata:clone(pins.metadata)},entry:clone(r.pin.entry),
    objectType:'Mesh',objectCount:1,objectFlags:{skinned:false,instanced:false,batched:false},instanceMatrix:null,instanceColor:null,
    registration:{path:r.sourcePath,association:clone(r.association),matrixWorld:r.matrixWorld.slice(),sourceSphere:clone(r.fullState.boundingSphere),bounds:clone(r.computed.bounds),scale:r.computed.scale,error:r.computed.error},
    identities:{quietIsFull:true,submittedIsReduced:true,submittedIsObjectGeometry:true,attributeObjectsShared:true,sourceAndDisplayIndexDistinct:true,restoredIsFull:false},
    sourceGeometry,submittedGeometry,actualGroupRecorded:true,actualGroup:null,selection,callbacks,restored:null,settled:false};
   let settlement:Promise<any>|null=null;const snapshot={record:r,receipt};context.snapshots.push(snapshot);
   return {receipt,assertRestored:()=>assertRestored(context),settle(hash:Hash){
    if(settlement)return settlement;
    settlement=(async()=>{
     try{
      check(context.restored&&receipt.identities.restoredIsFull,'Display-index original restoration was not proven');assertRestored(context);
      const callbackCopies=Object.entries(callbackSets).flatMap(([key,values])=>values.map((raw,i)=>({key,i,raw})));
      const outcomes=await Promise.allSettled([...copies.map(item=>Promise.resolve().then(()=>hash(item.raw))),...callbackCopies.map(item=>Promise.resolve().then(()=>hash(item.raw)))]);
      const failed=outcomes.find(item=>item.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
      const values=outcomes.map(item=>{check(item.status==='fulfilled','Missing display-index hash settlement');check(/^[a-f0-9]{64}$/.test(item.value),'Invalid display-index hash');return item.value;});
      for(let i=0;i<copies.length;i++)copies[i].field.sha256=values[i];
      for(const name of Object.keys(attributes))submittedGeometry.attributes[name].sha256=attributes[name].sha256;
      for(let i=0;i<callbackCopies.length;i++){const item=callbackCopies[i];callbacks[item.key][item.i].functionSha256=values[copies.length+i];}
      pinnedIndex(sourceGeometry.index,r.pin.sourceIndex,'source',true);pinnedIndex(submittedGeometry.index,r.pin.decodedIndex,'reduced',true);
      assertRestored(context);receipt.settled=true;return receipt;
     }finally{copies.length=0;for(const values of Object.values(callbackSets))values.length=0;}
    })();return settlement;
   }};
  },
  assertRestored,
 };
}
