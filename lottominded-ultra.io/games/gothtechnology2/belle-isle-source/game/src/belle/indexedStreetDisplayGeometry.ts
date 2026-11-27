import * as T from 'three';

const getAttribute=T.BufferGeometry.prototype.getAttribute;
const hasAttribute=T.BufferGeometry.prototype.hasAttribute;
const getIndex=T.BufferGeometry.prototype.getIndex;
const addGeometry=T.BatchedMesh.prototype.addGeometry;
const setGeometryAt=T.BatchedMesh.prototype.setGeometryAt;

type Copy={
 attributes:Record<'position'|'normal',T.BufferAttribute>;index:T.BufferAttribute;
 sourceAttributes:T.BufferGeometry['attributes'];position:T.BufferAttribute;normal:T.BufferAttribute;
 positionArray:Float32Array;normalArray:Float32Array;positionVersion:number;normalVersion:number;
 box:T.Box3|null;sphere:T.Sphere;
};

/** A short-lived input plan for the factory-owned, identity-transform street
 * groups only. The original geometries remain the scene/raycast authority.
 * There is deliberately no returned geometry or attribute alias. */
export type IndexedStreetDisplayGroup=Readonly<{
 vertices:number;indices:number;
 addTo:(batch:T.BatchedMesh,source:T.BufferGeometry)=>number;
}>;

function ordinaryAttribute(attribute:T.BufferAttribute|T.InterleavedBufferAttribute):attribute is T.BufferAttribute&{array:Float32Array}{
 const prototype=Object.getPrototypeOf(attribute);
 return attribute instanceof T.BufferAttribute&&(prototype===T.BufferAttribute.prototype||prototype===T.Float32BufferAttribute.prototype)&&
  attribute.array instanceof Float32Array&&attribute.array.constructor===Float32Array&&
  attribute.array.buffer instanceof ArrayBuffer&&attribute.itemSize===3&&!attribute.normalized&&
  attribute.count===attribute.array.length/3&&attribute.usage===T.StaticDrawUsage&&attribute.gpuType===T.FloatType;
}

function supported(source:T.BufferGeometry){
 const p=source.attributes.position,n=source.attributes.normal;
 // A Proxy cannot substitute a nonconfigurable, nonwritable own value. Never
 // loosen a source descriptor, even for the duration of the native copy.
 const replaceable=(key:string)=>{
  const descriptor=Object.getOwnPropertyDescriptor(source,key);
  return !!descriptor&&'value'in descriptor&&(descriptor.configurable||descriptor.writable);
 };
 return T.REVISION==='185'&&Object.getPrototypeOf(source)===T.BufferGeometry.prototype&&
  source.getAttribute===getAttribute&&source.hasAttribute===hasAttribute&&source.getIndex===getIndex&&
  replaceable('attributes')&&replaceable('index')&&source.index===null&&
  Object.keys(source.attributes).length===2&&!!p&&!!n&&ordinaryAttribute(p)&&ordinaryAttribute(n)&&
  p.count>0&&p.count%3===0&&p.count===n.count&&p.count<=0x7fffffff&&
  source.groups.length===0&&Object.keys(source.morphAttributes).length===0&&
  source.drawRange.start===0&&source.drawRange.count===Infinity&&
  (source.boundingBox===null||(Object.getPrototypeOf(source.boundingBox)===T.Box3.prototype&&source.boundingBox.clone===T.Box3.prototype.clone))&&
  source.boundingSphere!==null&&Object.getPrototypeOf(source.boundingSphere)===T.Sphere.prototype&&
  source.boundingSphere.clone===T.Sphere.prototype.clone;
}

/** Entire-group fallback happens before any BatchedMesh allocation. Tuple keys
 * use the finalized Float32 bits, including -0 and distinct NaN payloads. No
 * tolerance welding, vertex arithmetic, cross-tile sharing or triangle reorder. */
export function prepareIndexedStreetDisplayGroup(geometries:readonly T.BufferGeometry[]):IndexedStreetDisplayGroup|null{
 if(!geometries.length||geometries.some(source=>!supported(source)))return null;
 const copies=new Map<T.BufferGeometry,Copy>();let vertices=0,indices=0;
 for(const source of geometries){
  if(copies.has(source))continue;
  const position=source.attributes.position as T.BufferAttribute&{array:Float32Array};
  const normal=source.attributes.normal as T.BufferAttribute&{array:Float32Array};
  const p=new Uint32Array(position.array.buffer,position.array.byteOffset,position.array.length);
  const n=new Uint32Array(normal.array.buffer,normal.array.byteOffset,normal.array.length);
  const first:number[]=[],byTuple=new Map<string,number>(),corners=new Uint32Array(position.count);
  for(let corner=0;corner<position.count;corner++){
   const offset=corner*3,key=p[offset]+','+p[offset+1]+','+p[offset+2]+','+n[offset]+','+n[offset+1]+','+n[offset+2];
   let vertex=byTuple.get(key);
   if(vertex===undefined){vertex=first.length;byTuple.set(key,vertex);first.push(offset);}
   corners[corner]=vertex;
  }
  const compactPosition=new Float32Array(first.length*3),compactNormal=new Float32Array(first.length*3);
  const compactP=new Uint32Array(compactPosition.buffer),compactN=new Uint32Array(compactNormal.buffer);
  for(let vertex=0;vertex<first.length;vertex++)for(let axis=0;axis<3;axis++){
   compactP[vertex*3+axis]=p[first[vertex]+axis];compactN[vertex*3+axis]=n[first[vertex]+axis];
  }
  // r185 reserves the last u16 value for primitive restart. Native BatchedMesh
  // independently chooses its aggregate index width from the total capacity.
  const index=new T.BufferAttribute(first.length<=65535?new Uint16Array(corners):corners,1);
  copies.set(source,{
   attributes:Object.freeze({position:new T.BufferAttribute(compactPosition,3),normal:new T.BufferAttribute(compactNormal,3)}),index,
   sourceAttributes:source.attributes,position,normal,positionArray:position.array,normalArray:normal.array,
   positionVersion:position.version,normalVersion:normal.version,box:source.boundingBox,sphere:source.boundingSphere!,
  });
  vertices+=first.length;indices+=position.count;
 }
 if(vertices>0xffffffff||indices>0x7fffffff)return null;
 return Object.freeze({vertices,indices,addTo(batch:T.BatchedMesh,source:T.BufferGeometry){
  // StaticPaletteBatch consumes this plan synchronously. Its street preparation
  // callback only installs material/sort hooks. Identity/version checks do not
  // claim to detect arbitrary in-place array edits without needsUpdate.
  const copy=copies.get(source);
  if(!copy||!supported(source)||source.attributes!==copy.sourceAttributes||
   source.attributes.position!==copy.position||source.attributes.normal!==copy.normal||
   copy.position.array!==copy.positionArray||copy.normal.array!==copy.normalArray||
   copy.position.version!==copy.positionVersion||copy.normal.version!==copy.normalVersion||
   source.boundingBox!==copy.box||source.boundingSphere!==copy.sphere||
   Object.getPrototypeOf(batch)!==T.BatchedMesh.prototype||batch.addGeometry!==addGeometry||batch.setGeometryAt!==setGeometryAt)
   throw Error('Street display copy changed after group preparation');
  // The pinned native addGeometry path only reads this interface, copies every
  // attribute/index value synchronously and clones bounds. It neither registers
  // nor retains its input. No BufferGeometry constructor/UUID/randomness is used.
  const readonly=()=>{throw Error('Street display input is read-only');};
  const view=Proxy.revocable(source,{
   get(target,key){
    if(key==='attributes')return copy.attributes;
    if(key==='index')return copy.index;
    if(key==='getAttribute')return getAttribute;
    if(key==='hasAttribute')return hasAttribute;
    if(key==='getIndex')return getIndex;
    if(key==='boundingBox')return copy.box;
    if(key==='boundingSphere')return copy.sphere;
    if(key==='id'||key==='uuid'||key==='isBufferGeometry')return Reflect.get(target,key);
    throw Error('Unexpected street display input read: '+String(key));
   },
   set:readonly,defineProperty:readonly,deleteProperty:readonly,setPrototypeOf:readonly,preventExtensions:readonly,
  });
  try{return batch.addGeometry(view.proxy);}finally{view.revoke();}
 }});
}
