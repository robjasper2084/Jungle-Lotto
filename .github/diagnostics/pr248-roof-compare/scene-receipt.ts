/** Read-only receipts for every constructed world object; never selects or hides geometry. */
import * as T from 'three';

export function check(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
export const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
export const hashJson=(value:unknown)=>sha(new TextEncoder().encode(JSON.stringify(value)));
export function objectPath(object:T.Object3D):string{
 const label=encodeURIComponent(object.name||object.type),peers=object.parent?.children.filter(o=>(o.name||o.type)===(object.name||object.type))??[object];
 return (object.parent?objectPath(object.parent)+'/':'')+label+'#'+peers.indexOf(object);
}
export const roofPath=(path:string)=>/107227742_STAGED_LOD[012](?:%|\/|#)/.test(path)&&path.includes('PatinatedCopperPanels');
export function f32(values:number[]){const a=new Float32Array(values);return {values:Array.from(a),bits:Array.from(new Uint32Array(a.buffer))};}
export function cameraReceipt(camera:T.PerspectiveCamera){return {
 matrixWorld:camera.matrixWorld.toArray(),matrixWorldInverse:camera.matrixWorldInverse.toArray(),projectionMatrix:camera.projectionMatrix.toArray(),
 projectionMatrixInverse:camera.projectionMatrixInverse.toArray(),position:camera.position.toArray(),
 projection:{fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,zoom:camera.zoom},
 gpu:{view:f32(camera.matrixWorldInverse.toArray()),projection:f32(camera.projectionMatrix.toArray()),position:f32(camera.position.toArray())},
};}
export function restoreSignedZeros(values:number[],bits:number[]){return values.map((v,i)=>v===0&&bits[i]===0x80000000?-0:v);}
export function setRecordedCamera(camera:T.PerspectiveCamera,record:any){
 // A separate controlled diagnostic camera. The game/public-input driver is never imported.
 camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;
 Object.assign(camera,record.projection);camera.position.fromArray(record.position);
 camera.matrixWorld.fromArray(record.matrixWorld);camera.matrix.copy(camera.matrixWorld);
 camera.matrixWorld.decompose(new T.Vector3(),camera.quaternion,camera.scale);
 camera.matrixWorldInverse.fromArray(restoreSignedZeros(record.matrixWorldInverse,record.gpu.viewMatrixBits));
 camera.projectionMatrix.fromArray(restoreSignedZeros(record.projectionMatrix,record.gpu.projectionMatrixBits));
 camera.projectionMatrixInverse.fromArray(record.projectionMatrixInverse);
}
const bytes=(a:ArrayBufferView)=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
async function attribute(a:any,prefixCount?:number){
 if(!a)return null;
 const interleaved=!!a.isInterleavedBufferAttribute,array=interleaved?a.data.array:a.array;
 check(ArrayBuffer.isView(array),'Unknown geometry attribute storage');
 const raw=bytes(array),prefix=prefixCount===undefined?undefined:(check(!interleaved,'Roof attribute unexpectedly interleaved'),await sha(raw.subarray(0,prefixCount*a.itemSize*(array as any).BYTES_PER_ELEMENT)));
 return {type:array.constructor.name,bytes:raw.byteLength,count:a.count,itemSize:a.itemSize,normalized:a.normalized,
  interleaved,offset:interleaved?a.offset:0,stride:interleaved?a.data.stride:a.itemSize,
  gpuType:a.gpuType??null,usage:(interleaved?a.data:a).usage,meshPerAttribute:a.meshPerAttribute??null,sha256:await sha(raw),...(prefix?{prefixSha256:prefix}:{} )};
}
async function imageReceipt(image:any):Promise<any>{
 if(!image)return null;
 if(Array.isArray(image))return Promise.all(image.map(imageReceipt));
 if(ArrayBuffer.isView(image.data))return {kind:'typed-image',width:image.width,height:image.height,depth:image.depth??1,type:image.data.constructor.name,sha256:await sha(bytes(image.data))};
 if(typeof image.currentSrc==='string'||typeof image.src==='string'){
  const url=String(image.currentSrc||image.src);return {kind:'served-image',width:image.width,height:image.height,url:url.startsWith('data:')?'data:'+await hashJson(url):new URL(url,location.href).pathname};
 }
 if(image instanceof HTMLCanvasElement||image instanceof ImageBitmap||image instanceof OffscreenCanvas){
  const copy=new OffscreenCanvas(image.width,image.height),ctx=copy.getContext('2d');check(ctx,'Image fingerprint context unavailable');ctx.drawImage(image,0,0);
  return {kind:'generated-image',width:image.width,height:image.height,sha256:await sha(bytes(ctx.getImageData(0,0,image.width,image.height).data))};
 }
 // Native render-target images expose dimensions, not CPU pixels. Their output
 // may legitimately differ when the new end faces alter reflection/shadow rays.
 check(Number.isFinite(image.width)&&Number.isFinite(image.height),'Unknown texture image representation');
 return {kind:'render-storage',width:image.width,height:image.height,depth:image.depth??1};
}
export async function sceneReceipt(scene:T.Scene){
 const materialCache=new WeakMap<object,Promise<any>>(),textureCache=new WeakMap<object,Promise<any>>(),geometryCache=new WeakMap<object,Promise<any>>();
 async function texture(t:T.Texture):Promise<any>{
  let p=textureCache.get(t);if(p)return p;
  p=(async()=>{
   const fields=['name','mapping','channel','wrapS','wrapT','magFilter','minFilter','anisotropy','format','internalFormat','type','rotation','generateMipmaps','premultiplyAlpha','flipY','unpackAlignment','colorSpace','compareFunction'];
   const value:any={};for(const key of fields)value[key]=(t as any)[key]??null;
   value.offset=t.offset.toArray();value.repeat=t.repeat.toArray();value.center=t.center.toArray();value.matrix=t.matrix.toArray();value.matrixAutoUpdate=t.matrixAutoUpdate;
   value.isRenderTargetTexture=t.isRenderTargetTexture;value.image=await imageReceipt(t.image);
   value.mipmaps=await Promise.all(t.mipmaps.map(imageReceipt));return value;
  })();textureCache.set(t,p);return p;
 }
 async function value(v:any,seen=new WeakSet<object>()):Promise<any>{
  if(v===undefined)return {undefined:true};if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number')return Number.isFinite(v)?v:String(v);
  if(typeof v==='function')return {functionSha256:await hashJson(Function.prototype.toString.call(v))};
  if(ArrayBuffer.isView(v))return {type:v.constructor.name,bytes:v.byteLength,sha256:await sha(bytes(v))};
  if(v.isTexture)return texture(v);if(v.isObject3D)return {object:objectPath(v)};
  if(v.toArray&&(v.isColor||v.isMatrix3||v.isMatrix4||v.isVector2||v.isVector3||v.isVector4||v.isQuaternion||v.isEuler))return {type:v.constructor.name,values:v.toArray()};
  if(seen.has(v))return {cycle:true};seen.add(v);
  let result:any;
  if(Array.isArray(v))result=await Promise.all(v.map(x=>value(x,seen)));
  else{result={};const identity=v.isMaterial||v.isRenderTarget||v.isWebGLRenderTarget||v.isSource;
   for(const key of Object.keys(v).sort())if(key!=='_listeners'&&!(identity&&['id','uuid','version'].includes(key)))result[key]=await value(v[key],seen);}
  seen.delete(v);return result;
 }
 async function material(m:T.Material):Promise<any>{
  let p=materialCache.get(m);if(p)return p;
  p=(async()=>({name:m.name,type:m.type,sha256:await hashJson({fields:await value(m),
   onBeforeCompile:await value(m.onBeforeCompile),onBeforeRender:await value(m.onBeforeRender),programKey:m.customProgramCacheKey()})}))();
  materialCache.set(m,p);return p;
 }
 async function geometry(g:T.BufferGeometry,isRoof:boolean):Promise<any>{
  let p=geometryCache.get(g);if(p)return p;
  p=(async()=>{
   const attributes:any={},morphAttributes:any={};
   for(const [name,a] of Object.entries(g.attributes).sort())attributes[name]=await attribute(a,isRoof?96:undefined);
   for(const [name,items] of Object.entries(g.morphAttributes).sort())morphAttributes[name]=await Promise.all((items as any[]).map(a=>attribute(a)));
   return {type:g.type,attributes,index:await attribute(g.index,isRoof?144:undefined),groups:g.groups.map(x=>({...x})),
    drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:'Infinity'},morphTargetsRelative:g.morphTargetsRelative,morphAttributes,
    boundingBox:g.boundingBox?{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}:null,
    boundingSphere:g.boundingSphere?{center:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius}:null};
  })();geometryCache.set(g,p);return p;
 }
 const objects:T.Object3D[]=[];scene.traverse(o=>objects.push(o));check(objects.length>100&&objects.length<30000,'Unexpected full-world object inventory');
 const rows=[];
 for(const o of objects){
  const m=o as T.Mesh,path=objectPath(o),isRoof=roofPath(path),row:any={path,name:o.name,type:o.type,visible:o.visible,layers:o.layers.mask,
   matrix:o.matrix.toArray(),matrixWorld:o.matrixWorld.toArray(),matrixAutoUpdate:o.matrixAutoUpdate,matrixWorldAutoUpdate:o.matrixWorldAutoUpdate,
   castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,frustumCulled:o.frustumCulled,isRoof,
   callbacks:await value([o.onBeforeRender,o.onAfterRender,o.onBeforeShadow,o.onAfterShadow])};
  if(m.geometry){row.geometry=await geometry(m.geometry,isRoof);row.materials=await Promise.all((Array.isArray(m.material)?m.material:[m.material]).map(material));
   row.customDepthMaterial=m.customDepthMaterial?await material(m.customDepthMaterial):null;row.customDistanceMaterial=m.customDistanceMaterial?await material(m.customDistanceMaterial):null;
   row.instanceMatrix=await attribute((m as any).instanceMatrix);row.instanceColor=await attribute((m as any).instanceColor);row.count=(m as any).count??null;
   row.morphTargetInfluences=m.morphTargetInfluences??null;
  }
  if((o as T.Light).isLight){const l=o as T.Light;row.light=await value({color:l.color,intensity:l.intensity,shadow:(l as T.DirectionalLight).shadow});}
  rows.push(row);
 }
 return {objects:rows,scene:await value({background:scene.background,environment:scene.environment,fog:scene.fog,backgroundIntensity:scene.backgroundIntensity,
  environmentIntensity:scene.environmentIntensity,backgroundRotation:scene.backgroundRotation,environmentRotation:scene.environmentRotation})};
}
