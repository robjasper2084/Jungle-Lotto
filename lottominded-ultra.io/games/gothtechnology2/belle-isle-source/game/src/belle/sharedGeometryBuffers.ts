import * as T from 'three';

/** Immutable display storage for the pinned Three r185 renderer. Each source
 * remains a separate object and native draw. Only its geometry storage is shared
 * during a render; original bounds, material, matrices, order and vertex values
 * stay authoritative. The object hooks select a prevalidated source range.
 *
 * Sources must remain immutable during a native render. Between renders, normal
 * attribute version/identity/layout changes invalidate an entry. Unannounced raw
 * array writes are outside Three's upload contract; restoration additionally
 * checks bytes before allowing a copied page to be uploaded to a new context.
 * Unknown callbacks and geometries/streams shared with callback-driven objects
 * are deliberately excluded. No GL calls or renderer-private caches are used.
 */
type Compile = T.Material['onBeforeCompile'];
const nativeCompile = T.Material.prototype.onBeforeCompile;
const nativeMaterialRender = T.Material.prototype.onBeforeRender;
const nativeBefore = T.Object3D.prototype.onBeforeRender;
const nativeAfter = T.Object3D.prototype.onAfterRender;
const nativeBeforeShadow = T.Object3D.prototype.onBeforeShadow;
const nativeAfterShadow = T.Object3D.prototype.onAfterShadow;
const nativeRaycast = T.Mesh.prototype.raycast;
const nativeUpload = T.BufferAttribute.prototype.onUploadCallback;
const nativeComputeSphere = T.BufferGeometry.prototype.computeBoundingSphere;
const knownShaders = new WeakSet<Compile>();

/** Register only a composition whose predecessor is already known. Call directly
 * after assigning the authored shader-only onBeforeCompile wrapper. */
export function registerSharedGeometryShader(material:T.Material, previousCompile:Compile):boolean {
  const current = method(material, 'onBeforeCompile');
  if (typeof current !== 'function' || !knownCompile(previousCompile)) return false;
  knownShaders.add(current as Compile);
  return true;
}

export type SharedGeometryBufferOptions = Readonly<{
  /** Explicit shader-only provenance for a fixture or another audited caller. */
  approvedMaterialCallbacks?:ReadonlyMap<T.Material, Compile>;
  maxPageVertices?:number;
  maxPageBytes?:number;
  maxTotalBytes?:number;
  maxEntries?:number;
  maxPages?:number;
  maxDiagnosticEntries?:number;
}>;
export type SharedGeometryBufferEntry = Readonly<{
  sourceId:number; sourceGeometryId:number; materialId:number; sharedGeometryId:number;
  vertexOffset:number; indexOffset:number; sourceVertexCount:number; sourceIndexCount:number;
  indexed:boolean; status:'ready'|'fallback'|'disposed'; fallbackReason:string|null;
  colorCalls:number; shadowCalls:number;
}>;
export type SharedGeometryBufferStats = Readonly<{
  version:1; supported:boolean; active:boolean; disabledReason:string|null;
  consideredEntries:number; rejectedEntries:number; preparedEntries:number; activeEntries:number; scopedEntries:number;
  pageCount:number; poolBytes:number; renderCalls:number; pooledRenders:number;
  pooledCalls:number; colorCalls:number; shadowCalls:number; fallbacks:number;
  nestedRenders:number; contextLosses:number; contextRestores:number; observerErrors:number;
  truncatedEntries:number; truncatedPages:number;
  entries:readonly SharedGeometryBufferEntry[];
  pages:readonly Readonly<{geometryId:number; vertices:number; indices:number; bytes:number; entries:number}>[];
  rejected:Readonly<Record<string,number>>;
  notes:readonly string[];
}>;
export type SharedGeometryBufferHandle = Readonly<{
  prepare:(root?:T.Object3D)=>SharedGeometryBufferStats;
  read:()=>SharedGeometryBufferStats;
  dispose:()=>void;
}>;

type ArrayType = Float32Array|Uint32Array|Int32Array|Uint16Array|Int16Array|Uint8Array|Int8Array|Uint8ClampedArray;
type ArrayConstructor = {new(length:number):ArrayType; readonly BYTES_PER_ELEMENT:number; readonly prototype:object};
const arrayTypes:ArrayConstructor[] = [Float32Array,Uint32Array,Int32Array,Uint16Array,Int16Array,Uint8Array,Int8Array,Uint8ClampedArray];
const attributeTypes = new Set<object>([T.BufferAttribute.prototype,T.Float32BufferAttribute.prototype,T.Uint32BufferAttribute.prototype,T.Int32BufferAttribute.prototype,T.Uint16BufferAttribute.prototype,T.Int16BufferAttribute.prototype,T.Uint8BufferAttribute.prototype,T.Int8BufferAttribute.prototype,T.Uint8ClampedBufferAttribute.prototype]);
const materialTypes = new Set<object>([T.MeshStandardMaterial.prototype,T.MeshPhysicalMaterial.prototype,T.MeshBasicMaterial.prototype,T.MeshLambertMaterial.prototype,T.MeshPhongMaterial.prototype,T.MeshNormalMaterial.prototype]);
const ownedKeys = ['geometry','boundingSphere','onBeforeRender','onBeforeShadow','raycast'] as const;
type OwnedKey = typeof ownedKeys[number];
type Descriptors = Record<OwnedKey,PropertyDescriptor|undefined>;
type MeshBounds = T.Mesh & {boundingSphere?:T.Sphere};
type Attribute = {
  value:T.BufferAttribute; array:ArrayType; constructor:ArrayConstructor; buffer:ArrayBuffer;
  offset:number; bytes:number; itemSize:number; count:number; normalized:boolean; gpuType:number;
  version:number; name:string;
};
type Entry = {
  object:MeshBounds; source:T.BufferGeometry; material:T.Material; compile:Compile;
  materialVersion:number; attributesObject:Record<string,T.BufferAttribute|T.InterleavedBufferAttribute>;
  attributes:Attribute[]; index:Attribute|null; vertexCount:number; indexCount:number; key:string;
  bounds:T.Sphere; sourceSphere:T.Sphere|null; objectSphere:PropertyDescriptor|undefined;
  descriptors:Descriptors; page:Page; vertexOffset:number; indexOffset:number;
  status:'ready'|'fallback'|'disposed'; reason:string|null; colorCalls:number; shadowCalls:number;
  before:T.Object3D['onBeforeRender']; shadow:T.Object3D['onBeforeShadow']; raycast:T.Mesh['raycast'];
  onDispose:()=>void;
};
type Page = {geometry:T.BufferGeometry; entries:Entry[]; vertices:number; indices:number; bytes:number};
type Patch = {entry:Entry; descriptors:Descriptors};
type Scope = {root:T.Object3D; camera:T.Camera; patches:Patch[]; restored:boolean};
const owners = new WeakMap<T.Scene,{renderer:T.WebGLRenderer;handle:SharedGeometryBufferHandle}>();

function own(object:object,key:PropertyKey):unknown {
  const d = Object.getOwnPropertyDescriptor(object,key);
  return d && 'value' in d ? d.value : undefined;
}
function method(object:object,key:PropertyKey):unknown {
  for (let p:object|null=object;p;p=Object.getPrototypeOf(p)) {
    const d=Object.getOwnPropertyDescriptor(p,key);
    if (d) return 'value' in d ? d.value : undefined;
  }
  return undefined;
}
function knownCompile(fn:unknown):boolean {
  return fn===nativeCompile || (typeof fn==='function' && knownShaders.has(fn as Compile));
}
function descriptors(object:T.Mesh):Descriptors {
  return Object.fromEntries(ownedKeys.map(k=>[k,Object.getOwnPropertyDescriptor(object,k)])) as Descriptors;
}
function sameDescriptor(a:PropertyDescriptor|undefined,b:PropertyDescriptor|undefined):boolean {
  if (!a || !b) return a===b;
  return a.value===b.value && a.get===b.get && a.set===b.set && a.writable===b.writable && a.enumerable===b.enumerable && a.configurable===b.configurable;
}
function put(object:object,key:PropertyKey,descriptor:PropertyDescriptor|undefined) {
  if (descriptor) Object.defineProperty(object,key,descriptor);
  else Reflect.deleteProperty(object,key);
}
function dataDescriptor(value:unknown,previous?:PropertyDescriptor):PropertyDescriptor {
  return {value,writable:true,configurable:true,enumerable:previous?.enumerable??false};
}
function bounded(value:number|undefined,fallback:number,max:number):number {
  return Number.isSafeInteger(value) && value!>0 && value!<=max ? value! : fallback;
}
function sphereEqual(a:unknown,b:T.Sphere):a is T.Sphere {
  return a instanceof T.Sphere && Object.getPrototypeOf(a)===T.Sphere.prototype &&
    a.radius===b.radius && a.center.x===b.center.x && a.center.y===b.center.y && a.center.z===b.center.z;
}
function callbacksNative(mesh:T.Mesh):boolean {
  return method(mesh,'onBeforeRender')===nativeBefore && method(mesh,'onAfterRender')===nativeAfter &&
    method(mesh,'onBeforeShadow')===nativeBeforeShadow && method(mesh,'onAfterShadow')===nativeAfterShadow &&
    method(mesh,'raycast')===nativeRaycast;
}
function attribute(value:unknown,name:string):Attribute|null {
  if (!(value instanceof T.BufferAttribute) || !attributeTypes.has(Object.getPrototypeOf(value)) ||
      method(value,'onUploadCallback')!==nativeUpload ||
      own(value,'usage')!==T.StaticDrawUsage) return null;
  const array=own(value,'array') as ArrayType;
  const constructor=arrayTypes.find(c=>array && Object.getPrototypeOf(array)===c.prototype);
  if (!constructor || Object.getPrototypeOf(array.buffer)!==ArrayBuffer.prototype ||
      (array.buffer as ArrayBuffer&{resizable?:boolean}).resizable) return null;
  const itemSize=own(value,'itemSize'),count=own(value,'count'),normalized=own(value,'normalized'),gpuType=own(value,'gpuType'),version=own(value,'version');
  if (!Number.isSafeInteger(itemSize) || Number(itemSize)<1 || Number(itemSize)>4 || !Number.isSafeInteger(count) || Number(count)<1 ||
      array.length!==Number(itemSize)*Number(count) || typeof normalized!=='boolean' ||
      (gpuType!==T.FloatType && gpuType!==T.IntType) || !Number.isSafeInteger(version) || Number(version)<0) return null;
  return {value,array,constructor,buffer:array.buffer as ArrayBuffer,offset:array.byteOffset,bytes:array.byteLength,itemSize:Number(itemSize),count:Number(count),normalized,gpuType:Number(gpuType),version:Number(version),name};
}
function attributeMatches(a:Attribute):boolean {
  return own(a.value,'array')===a.array && own(a.value,'itemSize')===a.itemSize && own(a.value,'count')===a.count &&
    own(a.value,'normalized')===a.normalized && own(a.value,'gpuType')===a.gpuType && own(a.value,'version')===a.version &&
    own(a.value,'usage')===T.StaticDrawUsage && method(a.value,'onUploadCallback')===nativeUpload &&
    a.array.buffer===a.buffer && a.array.byteOffset===a.offset && a.array.byteLength===a.bytes;
}
function sourceRange(entry:Entry):{start:number;count:number}|null {
  const range=own(entry.source,'drawRange');
  if (!range || typeof range!=='object') return null;
  const start=own(range,'start'),count=own(range,'count');
  if (!Number.isSafeInteger(start) || !(count===Infinity || (Number.isSafeInteger(count) && Number(count)>=0))) return null;
  const total=entry.index ? entry.indexCount : entry.vertexCount;
  const first=Math.max(0,Number(start)),last=Math.min(total,Number(start)+Number(count));
  if (!Number.isSafeInteger(last) || first>last) return null;
  return {start:first+(entry.index?entry.indexOffset:entry.vertexOffset),count:last-first};
}

export function installSharedGeometryBuffers(renderer:T.WebGLRenderer,scene:T.Scene,options:SharedGeometryBufferOptions={}):SharedGeometryBufferHandle {
  const existing=owners.get(scene);
  if (existing?.renderer===renderer) return existing.handle;
  const entries:Entry[]=[],pages:Page[]=[],seen=new WeakSet<T.Object3D>(),scopes:Scope[]=[];
  const rejected:Record<string,number>={};
  const limits={vertices:bounded(options.maxPageVertices,65534,0xfffffffe),pageBytes:bounded(options.maxPageBytes,8*1024*1024,64*1024*1024),totalBytes:bounded(options.maxTotalBytes,64*1024*1024,256*1024*1024),entries:bounded(options.maxEntries,4096,16384),pages:bounded(options.maxPages,128,512),rows:bounded(options.maxDiagnosticEntries,256,4096)};
  const counts={consideredEntries:0,rejectedEntries:0,renderCalls:0,pooledRenders:0,pooledCalls:0,colorCalls:0,shadowCalls:0,fallbacks:0,nestedRenders:0,contextLosses:0,contextRestores:0,observerErrors:0};
  const renderDescriptor=Object.getOwnPropertyDescriptor(renderer,'render'),beforeDescriptor=Object.getOwnPropertyDescriptor(scene,'onBeforeRender'),afterDescriptor=Object.getOwnPropertyDescriptor(scene,'onAfterRender');
  const originalRender=method(renderer,'render') as T.WebGLRenderer['render'],originalBefore=method(scene,'onBeforeRender') as T.Scene['onBeforeRender'],originalAfter=method(scene,'onAfterRender') as T.Scene['onAfterRender'];
  let disposed=false,disposeRequested=false,lost=false,poolBytes=0;
  let disabledReason:string|null=existing?'scene-already-owned':T.REVISION!=='185'?'unsupported-three-revision':
    typeof originalRender!=='function'||typeof originalBefore!=='function'||typeof originalAfter!=='function'||!Object.isExtensible(scene)||!Object.isExtensible(renderer)?'unsupported-render-hooks':
    (renderDescriptor&&!renderDescriptor.configurable)||(beforeDescriptor&&!beforeDescriptor.configurable)||(afterDescriptor&&!afterDescriptor.configurable)?'nonconfigurable-render-hooks':
    !renderer.domElement?.addEventListener?'context-events-unavailable':null;
  const supported=disabledReason===null;

  function reject(reason:string) { counts.rejectedEntries++;rejected[reason]=(rejected[reason]??0)+1; }
  function invalidate(entry:Entry,reason:string) {
    if (entry.status!=='ready') return;
    entry.status='fallback';entry.reason=reason;counts.fallbacks++;
  }
  function materialAllowed(material:T.Material):boolean {
    const compile=method(material,'onBeforeCompile');
    return knownCompile(compile) || (typeof compile==='function' && options.approvedMaterialCallbacks?.get(material)===compile);
  }
  function validate(entry:Entry):string|null {
    const {object,source,material}=entry;
    if (Object.getPrototypeOf(object)!==T.Mesh.prototype || !callbacksNative(object)) return 'object-callback-changed';
    if (object.geometry!==source || object.material!==material) return 'source-identity-changed';
    if (object.customDepthMaterial || object.customDistanceMaterial) return 'custom-depth-material';
    if (!materialAllowed(material) || method(material,'onBeforeCompile')!==entry.compile || method(material,'onBeforeRender')!==nativeMaterialRender || material.version!==entry.materialVersion || material.transparent || (material as T.MeshStandardMaterial).wireframe || (material as T.MeshPhysicalMaterial).transmission>0) return 'material-changed';
    if (source.attributes!==entry.attributesObject || source.index!==(entry.index?.value??null) || Object.keys(source.morphAttributes).length) return 'geometry-layout-changed';
    const keys=Object.keys(source.attributes);
    if (keys.length!==entry.attributes.length || entry.attributes.some(a=>source.attributes[a.name]!==a.value || !attributeMatches(a)) || (entry.index&&!attributeMatches(entry.index))) return 'attribute-changed';
    if (!sameDescriptor(Object.getOwnPropertyDescriptor(object,'boundingSphere'),entry.objectSphere)) return 'object-bounds-changed';
    if (!entry.objectSphere && 'boundingSphere' in object) return 'inherited-object-bounds';
    if (entry.objectSphere && !sphereEqual(entry.objectSphere.value,entry.bounds)) return 'object-bounds-changed';
    if (!entry.objectSphere && source.boundingSphere!==null && !sphereEqual(source.boundingSphere,entry.bounds)) return 'source-bounds-changed';
    if (!entry.objectSphere && source.boundingSphere===null && method(source,'computeBoundingSphere')!==nativeComputeSphere) return 'custom-source-bounds';
    for (const key of ['geometry','onBeforeRender','onBeforeShadow','raycast'] as const) if (!sameDescriptor(Object.getOwnPropertyDescriptor(object,key),entry.descriptors[key])) return 'object-descriptor-changed';
    return sourceRange(entry)?null:'unsupported-draw-range';
  }
  function inspect(object:T.Object3D,hazardGeometry:WeakSet<object>,hazardAttributes:WeakSet<object>):Entry|null {
    if (Object.getPrototypeOf(object)!==T.Mesh.prototype) {reject('not-plain-mesh');return null;}
    const mesh=object as MeshBounds,source=mesh.geometry,material=mesh.material;
    if (!callbacksNative(mesh) || !Object.isExtensible(mesh) || mesh.customDepthMaterial || mesh.customDistanceMaterial) {reject('object-callback');return null;}
    if (!(source instanceof T.BufferGeometry) || (source as T.InstancedBufferGeometry).isInstancedBufferGeometry || Object.keys(source.morphAttributes).length || hazardGeometry.has(source)) {reject('geometry-not-immutable');return null;}
    if (Array.isArray(material) || !materialTypes.has(Object.getPrototypeOf(material)) || material.transparent || (material as T.MeshStandardMaterial).wireframe || (material as T.MeshPhysicalMaterial).transmission>0 || method(material,'onBeforeRender')!==nativeMaterialRender || !materialAllowed(material)) {reject('material-not-approved');return null;}
    const attrs=Object.keys(source.attributes).sort().map(name=>attribute(source.attributes[name],name));
    if (attrs.some(a=>!a) || !source.attributes.position) {reject('unsupported-attributes');return null;}
    const attributes=attrs as Attribute[],position=attributes.find(a=>a.name==='position')!;
    if (position.itemSize!==3 || attributes.some(a=>a.count!==position.count || hazardAttributes.has(a.value))) {reject('attribute-layout');return null;}
    const index=source.index?attribute(source.index,'index'):null;
    if (source.index && (!index || index.itemSize!==1 || index.normalized || ![Uint8Array,Uint16Array,Uint32Array].includes(index.constructor as typeof Uint8Array) || hazardAttributes.has(index.value))) {reject('unsupported-index');return null;}
    if (index) {
      const sentinel=index.constructor===Uint8Array?0xff:index.constructor===Uint16Array?0xffff:0xffffffff;
      for (const value of index.array) if (value===sentinel || value>=position.count) {reject('index-outside-source-or-restart');return null;}
    }
    const saved=descriptors(mesh);
    if (ownedKeys.some(k=>saved[k] && (!('value' in saved[k]!) || !saved[k]!.configurable))) {reject('object-descriptor');return null;}
    const objectSphere=saved.boundingSphere;
    let bounds:T.Sphere;
    if (!objectSphere && 'boundingSphere' in mesh) {reject('inherited-object-bounds');return null;}
    if (objectSphere) {
      if (!(objectSphere.value instanceof T.Sphere) || Object.getPrototypeOf(objectSphere.value)!==T.Sphere.prototype) {reject('custom-object-bounds');return null;}
      bounds=objectSphere.value.clone();
    } else if (source.boundingSphere) {
      if (!(source.boundingSphere instanceof T.Sphere) || Object.getPrototypeOf(source.boundingSphere)!==T.Sphere.prototype) {reject('custom-source-bounds');return null;}
      bounds=source.boundingSphere.clone();
    }
    else {
      if (method(source,'computeBoundingSphere')!==nativeComputeSphere) {reject('custom-source-bounds');return null;}
      const temporary=new T.BufferGeometry();temporary.setAttribute('position',position.value);temporary.computeBoundingSphere();bounds=temporary.boundingSphere!;
    }
    if (!bounds || ![bounds.center.x,bounds.center.y,bounds.center.z,bounds.radius].every(Number.isFinite) || bounds.radius<0) {reject('invalid-bounds');return null;}
    const key=JSON.stringify([attributes.map(a=>[a.name,a.constructor.name,a.itemSize,a.normalized,a.gpuType]),index?.constructor.name??null]);
    const entry:Entry={object:mesh,source,material,compile:method(material,'onBeforeCompile') as Compile,materialVersion:material.version,attributesObject:source.attributes,attributes,index,vertexCount:position.count,indexCount:index?.count??0,key,bounds,sourceSphere:source.boundingSphere,objectSphere,descriptors:saved,page:null as unknown as Page,vertexOffset:0,indexOffset:0,status:'ready',reason:null,colorCalls:0,shadowCalls:0,before:null as unknown as T.Object3D['onBeforeRender'],shadow:null as unknown as T.Object3D['onBeforeShadow'],raycast:null as unknown as T.Mesh['raycast'],onDispose:()=>{}};
    if (!sourceRange(entry)) {reject('unsupported-draw-range');return null;}
    entry.before=function(this:T.Object3D,...args) { if (this===mesh && args[3]===entry.page.geometry) selectRange(entry,false); };
    entry.shadow=function(this:T.Object3D,...args) { if (this===mesh && args[4]===entry.page.geometry) selectRange(entry,true); };
    entry.raycast=function(this:T.Mesh,...args) {
      if (this!==mesh) return Reflect.apply(nativeRaycast,this,args);
      const current=Object.getOwnPropertyDescriptor(mesh,'geometry');
      Object.defineProperty(mesh,'geometry',dataDescriptor(source,current));
      try { return Reflect.apply(nativeRaycast,this,args); }
      finally { put(mesh,'geometry',current); }
    };
    return entry;
  }
  function selectRange(entry:Entry,shadow:boolean) {
    const range=sourceRange(entry);
    // Source ranges were validated after the scene's preparation callbacks. A
    // source mutation during a native render is outside this immutable contract.
    if (!range) return;
    entry.page.geometry.setDrawRange(range.start,range.count);
    counts.pooledCalls++;
    if (shadow) {counts.shadowCalls++;entry.shadowCalls++;}
    else {counts.colorCalls++;entry.colorCalls++;}
  }
  function buildPage(group:Entry[]) {
    const unique=[...new Map(group.map(e=>[e.source,e])).values()];
    if (group.length<2 || unique.length<2) {for (const _ of group) reject('no-compatible-peer');return;}
    const vertices=unique.reduce((n,e)=>n+e.vertexCount,0),indices=unique.reduce((n,e)=>n+e.indexCount,0);
    const bytes=unique.reduce((n,e)=>n+e.attributes.reduce((s,a)=>s+a.bytes,0)+(e.index?.bytes??0),0);
    if (pages.length>=limits.pages || poolBytes+bytes>limits.totalBytes) {for (const _ of group) reject('pool-budget');return;}
    const geometry=new T.BufferGeometry(),offsets=new Map<T.BufferGeometry,{vertex:number;index:number}>();
    let vertexOffset=0,indexOffset=0;
    for (const entry of unique) {offsets.set(entry.source,{vertex:vertexOffset,index:indexOffset});vertexOffset+=entry.vertexCount;indexOffset+=entry.indexCount;}
    for (const layout of unique[0].attributes) {
      const data=new layout.constructor(vertices*layout.itemSize);
      for (const entry of unique) data.set(entry.attributes.find(a=>a.name===layout.name)!.array,offsets.get(entry.source)!.vertex*layout.itemSize);
      const buffer=new T.BufferAttribute(data,layout.itemSize,layout.normalized);buffer.gpuType=layout.gpuType as T.AttributeGPUType;geometry.setAttribute(layout.name,buffer);
    }
    if (unique[0].index) {
      const data=new unique[0].index.constructor(indices);
      for (const entry of unique) {const offset=offsets.get(entry.source)!;for (let i=0;i<entry.indexCount;i++)data[offset.index+i]=entry.index!.array[i]+offset.vertex;}
      geometry.setIndex(new T.BufferAttribute(data,1));
    }
    geometry.setDrawRange(0,0);
    const page={geometry,entries:group,vertices,indices,bytes};
    for (const entry of group) {
      const offset=offsets.get(entry.source)!;entry.page=page;entry.vertexOffset=offset.vertex;entry.indexOffset=offset.index;
      entry.onDispose=()=>invalidate(entry,'source-disposed');entry.source.addEventListener('dispose',entry.onDispose);
      entries.push(entry);
    }
    pages.push(page);poolBytes+=bytes;
  }
  function prepare(root:T.Object3D=scene) {
    if (disposed || disposeRequested || disabledReason || scopes.length) return read();
    const inventory=new Set<T.Object3D>();scene.traverse(o=>inventory.add(o));if(root!==scene)root.traverse(o=>inventory.add(o));
    const hazardGeometry=new WeakSet<object>(),hazardAttributes=new WeakSet<object>();
    for (const object of inventory) {
      const mesh=object as T.Mesh;if(!mesh.isMesh || !(mesh.geometry instanceof T.BufferGeometry))continue;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const risky=Object.getPrototypeOf(mesh)!==T.Mesh.prototype || !callbacksNative(mesh) || materials.some(m=>method(m,'onBeforeRender')!==nativeMaterialRender || !materialAllowed(m));
      if (risky) {hazardGeometry.add(mesh.geometry);if(mesh.geometry.index)hazardAttributes.add(mesh.geometry.index);for(const a of Object.values(mesh.geometry.attributes))hazardAttributes.add(a);}
    }
    const groups=new Map<string,Entry[]>();
    root.traverse(object=>{
      if (!(object as T.Mesh).isMesh || seen.has(object))return;seen.add(object);counts.consideredEntries++;
      if (entries.length+[...groups.values()].reduce((n,g)=>n+g.length,0)>=limits.entries) {reject('entry-budget');return;}
      try {
        const entry=inspect(object,hazardGeometry,hazardAttributes);if(!entry)return;
        const group=groups.get(entry.key);if(group)group.push(entry);else groups.set(entry.key,[entry]);
      } catch {counts.observerErrors++;reject('inspection-error');}
    });
    for (const group of groups.values()) {
      let page:Entry[]=[],vertices=0,bytes=0;const geometries=new Set<T.BufferGeometry>();
      for (const entry of group) {
        const limit=Math.min(limits.vertices,entry.index?.constructor===Uint8Array?254:entry.index?.constructor===Uint16Array?65534:limits.vertices);
        const added=geometries.has(entry.source)?0:entry.vertexCount,amount=geometries.has(entry.source)?0:entry.attributes.reduce((n,a)=>n+a.bytes,0)+(entry.index?.bytes??0);
        if(entry.vertexCount>limit || amount>limits.pageBytes) {reject('page-budget');continue;}
        if(page.length && (vertices+added>limit || bytes+amount>limits.pageBytes)) {buildPage(page);page=[];vertices=0;bytes=0;geometries.clear();}
        if(!geometries.has(entry.source)) {vertices+=entry.vertexCount;bytes+=entry.attributes.reduce((n,a)=>n+a.bytes,0)+(entry.index?.bytes??0);geometries.add(entry.source);}
        page.push(entry);
      }
      buildPage(page);
    }
    return read();
  }
  function restore(scope:Scope) {
    if(scope.restored)return;scope.restored=true;
    for (let i=scope.patches.length-1;i>=0;i--) {
      const patch=scope.patches[i];
      for (const key of ownedKeys) {
        try {put(patch.entry.object,key,patch.descriptors[key]);}
        catch {counts.observerErrors++;disabledReason='restoration-failed';}
      }
    }
  }
  function activate(scope:Scope,resume=false) {
    if(disposed||disabledReason||lost||(!resume&&disposeRequested))return;
    const selected=resume?scope.patches.map(p=>p.entry):entries;
    if(!resume)scope.patches=[];
    scope.restored=false;
    for (const entry of selected) {
      if(!resume && entry.status!=='ready')continue;
      if(!resume) {const reason=validate(entry);if(reason){invalidate(entry,reason);continue;}}
      const saved=descriptors(entry.object);
      if(!resume)scope.patches.push({entry,descriptors:saved});
      Object.defineProperty(entry.object,'geometry',dataDescriptor(entry.page.geometry,saved.geometry));
      Object.defineProperty(entry.object,'boundingSphere',dataDescriptor(entry.bounds,saved.boundingSphere));
      Object.defineProperty(entry.object,'onBeforeRender',dataDescriptor(entry.before,saved.onBeforeRender));
      Object.defineProperty(entry.object,'onBeforeShadow',dataDescriptor(entry.shadow,saved.onBeforeShadow));
      Object.defineProperty(entry.object,'raycast',dataDescriptor(entry.raycast,saved.raycast));
    }
    if(!resume && scope.patches.length)counts.pooledRenders++;
  }
  const before=function(this:T.Scene,...args:Parameters<T.Scene['onBeforeRender']>) {
    const result=Reflect.apply(originalBefore,this,args);
    const scope=scopes.at(-1),camera=args[2];
    if (this===scene && args[0]===renderer && scope?.root===scene && scopes.length===1 && scene.overrideMaterial===null &&
        !(camera as T.ArrayCamera).isArrayCamera && ((camera as T.PerspectiveCamera).isPerspectiveCamera||(camera as T.OrthographicCamera).isOrthographicCamera) &&
        !renderer.xr?.isPresenting && renderer.getRenderTarget()===null) {
      try {activate(scope);} catch {counts.observerErrors++;restore(scope);disabledReason='activation-failed';}
    }
    return result;
  };
  const after=function(this:T.Scene,...args:Parameters<T.Scene['onAfterRender']>) {
    const scope=scopes.at(-1);if(this===scene && args[0]===renderer && scope?.root===scene)restore(scope);
    return Reflect.apply(originalAfter,this,args);
  };
  const render=function(this:T.WebGLRenderer,...args:Parameters<T.WebGLRenderer['render']>) {
    if(this!==renderer || disposed || disabledReason)return Reflect.apply(originalRender,this,args);
    counts.renderCalls++;
    const outer=scopes.at(-1),resumeOuter=!!outer&&!outer.restored&&outer.patches.length>0;
    const ranges=resumeOuter?pages.map(page=>({page,start:page.geometry.drawRange.start,count:page.geometry.drawRange.count})):[];
    if(outer){counts.nestedRenders++;restore(outer);}
    const scope:Scope={root:args[0],camera:args[1],patches:[],restored:false};scopes.push(scope);
    try {return Reflect.apply(originalRender,this,args);}
    finally {
      restore(scope);scopes.pop();
      if(outer && resumeOuter && !disposed && !disabledReason) {
        try {activate(outer,true);for(const {page,start,count} of ranges)page.geometry.setDrawRange(start,count);}
        catch {counts.observerErrors++;restore(outer);disabledReason='resume-failed';}
      }
      if(!scopes.length&&disposeRequested)finishDispose();
    }
  };
  const onLost=()=>{
    lost=true;counts.contextLosses++;
    // Three recreates its WebGL caches on restoration but leaves geometry
    // disposal listeners attached. Retire this generation while GL is lost,
    // retaining the CPU pages for normal reupload into the restored context.
    for(const page of pages)page.geometry.dispose();
  };
  const onRestored=()=>{
    lost=false;counts.contextRestores++;
    for(const entry of entries) {
      if(entry.status!=='ready')continue;
      try {
        const reason=validate(entry);if(reason){invalidate(entry,reason);continue;}
        const changed=entry.attributes.some(a=>{
          const target=entry.page.geometry.getAttribute(a.name).array as ArrayType;
          const sourceBytes=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);
          const pooledBytes=new Uint8Array(target.buffer,target.byteOffset+entry.vertexOffset*a.itemSize*a.constructor.BYTES_PER_ELEMENT,a.bytes);
          return sourceBytes.some((v,i)=>v!==pooledBytes[i]);
        }) || (entry.index?.array.some((v,i)=>v+entry.vertexOffset!==(entry.page.geometry.index!.array as ArrayType)[entry.indexOffset+i])??false);
        if(changed)invalidate(entry,'source-bytes-changed-on-restore');
      } catch {invalidate(entry,'source-unavailable-on-restore');}
    }
  };
  function read():SharedGeometryBufferStats {
    const rows=entries.slice(0,limits.rows).map(e=>({sourceId:e.object.id,sourceGeometryId:e.source.id,materialId:(e.material as T.Material&{id:number}).id,sharedGeometryId:e.page.geometry.id,vertexOffset:e.vertexOffset,indexOffset:e.indexOffset,sourceVertexCount:e.vertexCount,sourceIndexCount:e.indexCount,indexed:!!e.index,status:e.status,fallbackReason:e.reason,colorCalls:e.colorCalls,shadowCalls:e.shadowCalls}));
    return {version:1,supported,active:supported&&!disposed&&!disposeRequested&&!disabledReason,disabledReason:disposed||disposeRequested?'disposed':disabledReason,...counts,preparedEntries:entries.length,activeEntries:disposed||disposeRequested||disabledReason?0:entries.filter(e=>e.status==='ready').length,scopedEntries:scopes.reduce((n,s)=>n+(s.restored?0:s.patches.length),0),pageCount:pages.length,poolBytes,truncatedEntries:Math.max(0,entries.length-rows.length),truncatedPages:0,entries:rows,pages:pages.map(p=>({geometryId:p.geometry.id,vertices:p.vertices,indices:p.indices,bytes:p.bytes,entries:p.entries.length})),rejected:{...rejected},notes:['Calls count range-setting object callbacks, not independently observed GL draws, uploads, GPU work or completions.','Prepared pages are immutable copies. Between-render source identity/version/layout changes fall back; unsupported late assets remain native until an explicit prepare boundary.','Original object bounds/order/material/matrices remain native. Offscreen, ArrayCamera, XR and nested render scopes use original geometry.','Geometry and hooks are restored before the prior scene after-render callback and on renderer exceptions. Shared ranges are restored after nested rendering.']};
  }
  function dispose() {
    if(disposed||disposeRequested)return;disposeRequested=true;
    if(!scopes.length)finishDispose();
  }
  function finishDispose() {
    if(disposed)return;disposed=true;
    for(const scope of scopes)restore(scope);
    if(method(renderer,'render')===render)put(renderer,'render',renderDescriptor);
    if(method(scene,'onBeforeRender')===before)put(scene,'onBeforeRender',beforeDescriptor);
    if(method(scene,'onAfterRender')===after)put(scene,'onAfterRender',afterDescriptor);
    renderer.domElement?.removeEventListener('webglcontextlost',onLost);renderer.domElement?.removeEventListener('webglcontextrestored',onRestored);
    for(const e of entries){e.status='disposed';e.source.removeEventListener('dispose',e.onDispose);}for(const page of pages)page.geometry.dispose();
    if(owners.get(scene)?.handle===handle)owners.delete(scene);
  }
  const handle:SharedGeometryBufferHandle={prepare,read,dispose};
  if(supported) {
    Object.defineProperty(renderer,'render',dataDescriptor(render,renderDescriptor));
    Object.defineProperty(scene,'onBeforeRender',dataDescriptor(before,beforeDescriptor));
    Object.defineProperty(scene,'onAfterRender',dataDescriptor(after,afterDescriptor));
    renderer.domElement.addEventListener('webglcontextlost',onLost);renderer.domElement.addEventListener('webglcontextrestored',onRestored);
    owners.set(scene,{renderer,handle});
  }
  return handle;
}
