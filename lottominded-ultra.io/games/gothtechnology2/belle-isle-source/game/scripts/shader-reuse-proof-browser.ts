import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPavementGeometry,type PavementPart} from '../src/belle/pavement.ts';
import {limitGroundDrawRange} from '../src/belle/groundDrawRange.ts';
import {cullMacArthurSpans} from '../src/belle/macArthurSpanCulling.ts';
import {finishAsphalt} from '../src/belle/surfaceFinish.ts';
import {ASPHALT_PATCH_DETAIL} from '../src/belle/asphaltPolish.ts';
import {finishMacArthurConcrete} from '../src/belle/macArthurSurface.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from '../src/belle/photoReferenceSurfaces.ts';
import {dressSunsetGround} from '../src/belle/sunsetGround.ts';
import {WorldAtmosphere} from '../src/belle/worldAtmosphere.ts';
import {inheritAtmosphereProgram} from '../src/belle/atmosphereProgramIdentity.ts';
import {reuseMacArthurBumpCenters} from '../src/belle/bumpCenterReuse.ts';
import {SHADER_REUSE_BASELINE} from './shader-reuse-baseline.ts';
import {SHADER_PROOF_CASES,SHADER_PROOF_SIZE,ASPHALT_REPAIR_CONTROL,type ShaderProofCase} from './shader-reuse-cases.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type PixelRead={pixels:Uint8Array;calls:number;triangles:number;rgbaSha256:string;png:string;camera:unknown;geometry:unknown;
 profile:unknown;shader:Record<string,unknown>;targetSubmission:unknown};
const scope='Targeted shipped-asset shader equivalence; not full-scene performance or controls acceptance.';
const {width,height}=SHADER_PROOF_SIZE,canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const gl=renderer.getContext() as WebGL2RenderingContext,errors:string[]=[];
let lastColor:{object:T.Object3D;material:T.Material;calls:number;triangles:number;program:WebGLProgram|null}|undefined;
const nativeDirect=renderer.renderBufferDirect;
renderer.renderBufferDirect=function(...args){
 const onscreen=this.getRenderTarget()===null,before={calls:this.info.render.calls,triangles:this.info.render.triangles};
 const result=Reflect.apply(nativeDirect,this,args);
 if(onscreen&&this.info.render.calls>before.calls)lastColor={object:args[4],material:args[3],calls:this.info.render.calls-before.calls,
  triangles:this.info.render.triangles-before.triangles,program:gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram|null};
 return result;
};
renderer.debug.onShaderError=(g,program,vertex,fragment)=>{errors.push('Native shader compile/link: '+g.getProgramInfoLog(program)+' '+g.getShaderInfoLog(vertex)+' '+g.getShaderInfoLog(fragment));};
const scene=new T.Scene(),camera=new T.PerspectiveCamera(58,width/height,.08,22000);
scene.background=new T.Color(0x71899d);scene.fog=new T.FogExp2(0xa9b7bd,.00012);
const ambient=new T.HemisphereLight(0xd8e4f1,0x465443,2.1),sun=new T.DirectionalLight(0xffefdc,3);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0001;
sun.shadow.camera.left=-100;sun.shadow.camera.right=100;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;sun.shadow.camera.near=1;sun.shadow.camera.far=500;
scene.add(ambient,sun,sun.target);
// Ground/caster IDs precede both paired material IDs, preserving their native
// opaque ordering relative to the target in both alternatives.
const floorMaterial=new T.MeshStandardMaterial({color:0x697769,roughness:.94});
const floor:T.Mesh=new T.Mesh(new T.PlaneGeometry(10000,10000),floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.set(1800,-.6,900);floor.receiveShadow=true;
const casterMaterial=new T.MeshStandardMaterial({color:0x867a69,roughness:.84});
const caster:T.Mesh=new T.Mesh(new T.BoxGeometry(8,12,7),casterMaterial);caster.castShadow=caster.receiveShadow=true;scene.add(floor,caster);
const maskBlack=new T.MeshBasicMaterial({color:0,side:T.DoubleSide}),maskWhite=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});
const compiled=new WeakMap<T.Material,Shader>(),nativeTextureIds=new WeakMap<WebGLTexture,number>();let textureId=0;
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
const check:(condition:unknown,message:string)=>asserts condition=(condition,message)=>{if(!condition)throw Error(message);};
const nativeAssets:{file:string;sha256:string;bytes:number}[]=[];
async function bytes(file:string){const response=await fetch('/'+file);check(response.ok,'Missing source asset '+file);const value=await response.arrayBuffer();nativeAssets.push({file,bytes:value.byteLength,sha256:await hash(new Uint8Array(value))});return value;}
async function fence(){
 const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);check(sync,'Missing WebGL2 GPU fence');gl.flush();const start=performance.now();
 try{for(;;){const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return;
  check(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU fence failed');check(performance.now()-start<45000,'GPU fence exceeded 45 seconds');await new Promise(ok=>setTimeout(ok,8));}}
 finally{gl.deleteSync(sync);}
}
function diff(a:Uint8Array,b:Uint8Array,mask?:Uint8Array){let count=0,max=0;for(let i=0;i<a.length;i+=4){if(mask&&mask[i]<250)continue;let changed=false;for(let j=0;j<4;j++){const d=Math.abs(a[i+j]-b[i+j]);max=Math.max(max,d);changed ||= d!==0;}if(changed)count++;}return{count,max};}
function cameraReceipt(){return{matrixWorld:camera.matrixWorld.toArray(),view:camera.matrixWorldInverse.toArray(),projection:camera.projectionMatrix.toArray(),position:camera.position.toArray()};}
const geometryReceipts=new WeakMap<T.BufferGeometry,unknown>();
async function geometryReceipt(g:T.BufferGeometry){let result=geometryReceipts.get(g);if(result)return result;
 const rows:Record<string,unknown>={};for(const name of ['position','normal','uv','uv1','uv2']){const a=g.getAttribute(name);if(a){const array=(a as T.BufferAttribute).array;rows[name]={count:a.count,itemSize:a.itemSize,sha256:await hash(new Uint8Array(array.buffer,array.byteOffset,array.byteLength))};}}
 if(g.index){const a=g.index.array;rows.index={count:g.index.count,sha256:await hash(new Uint8Array(a.buffer,a.byteOffset,a.byteLength))};}
 geometryReceipts.set(g,rows);return rows;
}
function sampler(program:WebGLProgram,name:string){
 const location=gl.getUniformLocation(program,name);if(location===null)return null;const unit=Number(gl.getUniform(program,location)),old=gl.getParameter(gl.ACTIVE_TEXTURE);
 try{gl.activeTexture(gl.TEXTURE0+unit);const texture=gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture|null;
  if(!texture)return{unit,id:null,minFilter:null};if(!nativeTextureIds.has(texture))nativeTextureIds.set(texture,++textureId);
  return{unit,id:nativeTextureIds.get(texture),minFilter:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER)};
 }finally{gl.activeTexture(old);}
}
async function shaderReceipt(material:T.Material){
 const program=gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram|null;check(program,'No native linked program after target draw');
 const attached=gl.getAttachedShaders(program)||[],vertex=attached.find(shader=>gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.VERTEX_SHADER),fragment=attached.find(shader=>gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);
 check(vertex&&fragment,'Native linked shader sources unavailable');const vs=gl.getShaderSource(vertex)!,fs=gl.getShaderSource(fragment)!;
 const map=sampler(program,'map'),bump=sampler(program,'bumpMap'),location=gl.getUniformLocation(program,'belleReuseAlbedoBumpCenter');
 const result={fragmentSha256:await hash(new TextEncoder().encode(fs)),vertexSha256:await hash(new TextEncoder().encode(vs)),
  hasReuseGuard:fs.includes('belleReuseAlbedoBumpCenter'),programSafe:/#define BELLE_BUMP_CENTER_PROGRAM_SAFE 1\b/.test(fs),
  guardUniform:location===null?null:!!gl.getUniform(program,location),tableGuard:compiled.get(material)?.uniforms.belleReuseAlbedoBumpCenter?.value===true,
  mapUv:vs.match(/^#define MAP_UV (uv[123]?)$/m)?.[1]??null,bumpMapUv:vs.match(/^#define BUMPMAP_UV (uv[123]?)$/m)?.[1]??null,
  decodeVideo:/^#define DECODE_VIDEO_TEXTURE$/m.test(fs),nativeSamplerAlias:!!map?.id&&map.id===bump?.id,mapMinFilter:map?.minFilter??null,
  originalRepairs:fs.includes(SHADER_REUSE_BASELINE.asphaltBlock),gatedRepairs:fs.includes(ASPHALT_PATCH_DETAIL),map,bump};
 await (window as unknown as {__saveShaderSource:(x:unknown)=>Promise<void>}).__saveShaderSource({vertex:vs,fragment:fs,...result});return result;
}
async function renderRead(mesh:T.Mesh,inspect=true):Promise<PixelRead>{
 check(document.visibilityState==='visible'&&document.hasFocus(),'Fixture lost foreground focus');
 lastColor=undefined;renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);await fence();
 const submitted=lastColor as {object:T.Object3D;material:T.Material;calls:number;triangles:number;program:WebGLProgram|null}|undefined;
 if(inspect)check(submitted?.object===mesh&&submitted.material===mesh.material&&submitted.calls>0&&submitted.triangles>0&&submitted.program===gl.getParameter(gl.CURRENT_PROGRAM),'Current native program is not the last successful target color submission');
 const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);check(gl.getError()===gl.NO_ERROR,'Native RGBA readback failed');
 return{pixels,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,rgbaSha256:await hash(pixels),png:canvas.toDataURL('image/png'),
  camera:cameraReceipt(),geometry:await geometryReceipt(mesh.geometry),profile:(mesh.material as T.Material).userData.realisticProfile,
  shader:inspect?await shaderReceipt(mesh.material as T.Material):{},targetSubmission:inspect&&submitted?{objectId:submitted.object.id,objectUuid:submitted.object.uuid,objectName:submitted.object.name,
   materialUuid:submitted.material.uuid,materialName:submitted.material.name,calls:submitted.calls,triangles:submitted.triangles,currentProgramMatches:true}:null};
}
// Exact private cloud generator used by islandSky.ts. The proof driver pins
// that source file; this creates the same authored sampler without a second sky.
function cloudTexture(){
 const size=512,pixels=new Uint8Array(size*size*4);
 const hash=(x:number,y:number)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 const noise=(x:number,y:number,n:number)=>{let ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);const h=(a:number,b:number)=>hash((a+n)%n,(b+n)%n);return T.MathUtils.lerp(T.MathUtils.lerp(h(ix,iy),h(ix+1,iy),u),T.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),u),v);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let f=0,amp=.55;for(let o=0;o<5;o++){const n=8<<o;f+=noise(x/size*n,y/size*n,n)*amp;amp*=.5;}const i=(y*size+x)*4;pixels[i]=Math.round(f*255);pixels[i+1]=Math.round(noise(x/size*64,y/size*64,64)*255);pixels[i+2]=Math.round(noise(x/size*128,y/size*128,128)*255);pixels[i+3]=255;}
 const texture=new T.DataTexture(pixels,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
function surfaceFocus(mesh:T.Mesh,kind:'asphalt'|'limestone'){
 const g=mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),index=g.index!;g.computeBoundingBox();const midpoint=g.boundingBox!.getCenter(new T.Vector3());
 const desired=kind==='asphalt'?new T.Vector3(1330,2,1175):midpoint;let best=Infinity,point:T.Vector3|undefined,normal:T.Vector3|undefined;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),face=new T.Vector3(),sum=new T.Vector3();
 for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
  face.crossVectors(b.clone().sub(a),c.clone().sub(a));if(face.lengthSq()<.01)continue;
  const center=a.clone().add(b).add(c).multiplyScalar(1/3);sum.set(0,0,0);for(const id of ids)sum.add(new T.Vector3().fromBufferAttribute(n,id));sum.normalize();
  if(kind==='asphalt'&&sum.y<.8)continue;if(kind==='limestone'&&(Math.abs(sum.y)>.35||center.y<2||center.y>8))continue;
  const score=(center.x-desired.x)**2+(center.z-desired.z)**2+25*(center.y-(kind==='asphalt'?2:5))**2;
  if(score<best){best=score;point=center;normal=sum.clone();}
 }
 check(point&&normal,'No genuine source triangle supports '+kind+' fixture focus');return{point,normal};
}
function asphaltRepairFocus(mesh:T.Mesh){
 const receipt=ASPHALT_REPAIR_CONTROL,index=mesh.geometry.index!,position=mesh.geometry.getAttribute('position');
 check(nativeAssets.find(asset=>asset.file==='belle/pavement.bin')?.sha256===receipt.pavementSha256,'Repair control pavement bytes changed');
 const vertices=receipt.vertexIndices.map((id,i)=>{
  check(index.getX(receipt.faceIndex*3+i)===id,'Repair control actual source triangle changed');
  const p=new T.Vector3().fromBufferAttribute(position,id);check(p.toArray().every((value,j)=>value===receipt.triangle[i][j]),'Repair control source vertex changed');return p;
 });
 const triangle=new T.Triangle(...vertices as [T.Vector3,T.Vector3,T.Vector3]),point=new T.Vector3(...receipt.point);
 check(triangle.closestPointToPoint(point,new T.Vector3()).distanceTo(point)<1e-8,'Repair control is not on its actual source triangle');
 check(Math.floor(point.x/14)===receipt.repairCell[0]&&Math.floor(point.z/19)===receipt.repairCell[1],'Repair control world cell changed');
 return{point,normal:triangle.getNormal(new T.Vector3())};
}
function uvFootprint(mesh:T.Mesh,texture:T.Texture|null){
 const summary={kind:'projected-source-triangle estimate; not a hardware LOD query',samples:0,minimum:0,median:0,maximum:0};if(!texture)return summary;
 const uv=mesh.geometry.getAttribute(texture.channel?'uv'+texture.channel:'uv'),p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
 if(!uv||!index)return summary;const image=texture.image as {width?:number;height?:number},tw=image?.width??0,th=image?.height??0;if(!tw||!th)return summary;
 const matrix=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld),uvMatrix=texture.matrix;
 const values:number[]=[];
 for(let i=0;i<index.count;i+=3){const points:{x:number;y:number;z:number;w:number;qx:number;qy:number;s:number}[]=[];
  for(let j=0;j<3;j++){const k=index.getX(i+j),v=new T.Vector4(p.getX(k),p.getY(k),p.getZ(k),1).applyMatrix4(matrix),u=new T.Vector3(uv.getX(k),uv.getY(k),1).applyMatrix3(uvMatrix);
   points.push({x:(v.x/v.w+1)*width/2,y:(v.y/v.w+1)*height/2,z:v.z/v.w,w:v.w,qx:u.x/v.w,qy:u.y/v.w,s:1/v.w});}
  if(points.some(v=>v.w<=0)||points.every(v=>v.z>1)||points.every(v=>v.z< -1)||points.every(v=>v.x<0)||points.every(v=>v.x>width)||points.every(v=>v.y<0)||points.every(v=>v.y>height))continue;
  const [a,b,c]=points,area=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(area)<.5)continue;
  const dx=[(b.y-c.y)/area,(c.y-a.y)/area,(a.y-b.y)/area],dy=[(c.x-b.x)/area,(a.x-c.x)/area,(b.x-a.x)/area];
  const s=(a.s+b.s+c.s)/3,qx=(a.qx+b.qx+c.qx)/3,qy=(a.qy+b.qy+c.qy)/3;
  const derivative=(weights:number[])=>{let ds=0,du=0,dv=0;points.forEach((v,j)=>{ds+=weights[j]*v.s;du+=weights[j]*v.qx;dv+=weights[j]*v.qy;});return[(du*s-qx*ds)/(s*s)*tw,(dv*s-qy*ds)/(s*s)*th];};
  const x=derivative(dx),y=derivative(dy),lod=.5*Math.log2(Math.max(x[0]**2+x[1]**2,y[0]**2+y[1]**2));if(Number.isFinite(lod))values.push(lod);
 }
 values.sort((a,b)=>a-b);if(values.length)Object.assign(summary,{samples:values.length,minimum:values[0],median:values[Math.floor(values.length/2)],maximum:values.at(-1)});return summary;
}
async function sourceMask(mesh:T.Mesh){
 const saved={target:mesh.material,caster:caster.material,floor:floor.material,background:scene.background,fog:scene.fog,tone:renderer.toneMapping,shadows:renderer.shadowMap.enabled,cast:sun.castShadow};
 try{mesh.material=maskWhite;caster.material=floor.material=maskBlack;scene.background=new T.Color(0);scene.fog=null;renderer.toneMapping=T.NoToneMapping;renderer.shadowMap.enabled=false;sun.castShadow=false;
  return(await renderRead(mesh,false)).pixels;
 }finally{mesh.material=saved.target;caster.material=saved.caster;floor.material=saved.floor;scene.background=saved.background;scene.fog=saved.fog;renderer.toneMapping=saved.tone;renderer.shadowMap.enabled=saved.shadows;sun.castShadow=saved.cast;renderer.shadowMap.needsUpdate=true;}
}
async function bootstrapVideo(){
 const source=document.createElement('canvas');source.width=source.height=32;const context=source.getContext('2d')!;
 context.fillStyle='#b58b5d';context.fillRect(0,0,32,32);context.fillStyle='#537c93';context.fillRect(0,0,16,16);context.fillRect(16,16,16,16);
 const stream=source.captureStream(2),video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();
 const start=performance.now();while(video.readyState<2){check(performance.now()-start<15000,'Video-decode negative control did not receive a real frame');await new Promise(ok=>setTimeout(ok,25));}
 const texture=new T.VideoTexture(video);texture.colorSpace=T.SRGBColorSpace;return{texture,dispose(){texture.dispose();video.pause();for(const track of stream.getTracks())track.stop();video.srcObject=null;}};
}
const init=(async()=>{
 const receipt=await fetch('/fixture-receipt.json').then(r=>r.json());
 check(await hash(new TextEncoder().encode(SHADER_REUSE_BASELINE.asphaltBlock))===SHADER_REUSE_BASELINE.asphaltBlockSha256,'Original asphalt block digest mismatch');
 const [landmarkBytes,metaBytes,pavementBytes]=await Promise.all([bytes('belle/landmarks.glb'),bytes('belle/pavement.json'),bytes('belle/pavement.bin')]);
 const model=await new GLTFLoader().parseAsync(landmarkBytes,'/belle/'),root=new T.Group();
 const stone=model.scene.getObjectByName('MacArthur_Higgsfield_•_warm_limestone');check(stone instanceof T.Mesh,'Actual MacArthur limestone mesh missing');root.add(stone);
 finishMacArthurConcrete(root);const stoneMaterial=stone.material as T.MeshStandardMaterial;stoneMaterial.bumpMap=stoneMaterial.map;stoneMaterial.bumpScale=.018;stoneMaterial.roughness=.88;
 stone.castShadow=stone.receiveShadow=true;stone.geometry.computeBoundingSphere();
 const meta=JSON.parse(new TextDecoder().decode(metaBytes)),part=meta.groups.find((p:PavementPart)=>p.kind==='asphalt') as PavementPart;
 check(part?.vertices>0,'Actual asphalt group missing');const pavementMaterial=new T.MeshStandardMaterial({color:0x979b99,roughness:.92});pavementMaterial.name='Island asphalt';finishAsphalt(pavementMaterial);
 const asphalt=new T.Mesh(createPavementGeometry(pavementBytes,part,meta.stride),pavementMaterial);asphalt.name='Joined island pavement · asphalt';asphalt.receiveShadow=true;limitGroundDrawRange(asphalt,part.ranges);
 const atmosphere=new WorldAtmosphere(scene,cloudTexture());scene.add(root,asphalt);atmosphere.flush();await loadRealisticMaterials(renderer);
 applyRealisticMaterials(root);applyRealisticMaterials(asphalt);applyPhotoReferenceSurfaces(root);applyPhotoReferenceSurfaces(asphalt);dressSunsetGround(scene);await Promise.resolve();atmosphere.flush();
 cullMacArthurSpans(root);
 // Additional native UV-channel cases use copies of the supplied UV bits, with
 // a documented offset on uv1 to make an unequal-channel bug visibly detectable.
 const uv=stone.geometry.getAttribute('uv') as T.BufferAttribute,uv1=uv.clone(),uv2=uv.clone();
 for(let i=0;i<uv1.count;i++)uv1.setXY(i,uv1.getX(i)+.37,uv1.getY(i)+.19);
 stone.geometry.setAttribute('uv1',uv1);stone.geometry.setAttribute('uv2',uv2);
 scene.updateMatrixWorld(true);const focus={asphalt:surfaceFocus(asphalt,'asphalt'),limestone:surfaceFocus(stone,'limestone')},repairFocus=asphaltRepairFocus(asphalt);
 const templates={asphalt:asphalt.material as T.MeshStandardMaterial,limestone:stone.material as T.MeshStandardMaterial};
 const detail=await new T.TextureLoader().loadAsync('/belle/skins/brick-detail.webp');detail.wrapS=detail.wrapT=T.RepeatWrapping;
 const debug=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
 return{receipt,root,stone,asphalt,templates,atmosphere,focus,repairFocus,detail,gpu};
})();

(window as unknown as {__shaderReuseProof:()=>Promise<unknown>}).__shaderReuseProof=async()=>{
 const rows:Record<string,unknown>[]=[];let initialized:Awaited<typeof init>|undefined;
 try{
  const state=initialized=await init;const {receipt,root,stone,asphalt,templates,atmosphere,focus,repairFocus,detail,gpu}=state;
  for(const spec of SHADER_PROOF_CASES){
   console.log('shader proof '+spec.id);const mesh=spec.kind==='asphalt'?asphalt:stone,template=templates[spec.kind];asphalt.visible=spec.kind==='asphalt';stone.visible=spec.kind==='limestone';
   const controlFocus=spec.kind==='asphalt'&&spec.effectRequired?ASPHALT_REPAIR_CONTROL:null;
   const chosenFocus=controlFocus?repairFocus:focus[spec.kind],origin=chosenFocus.point,direction=chosenFocus.normal.clone();if(spec.kind==='limestone')direction.setY(0).normalize();
   if(spec.kind==='asphalt')camera.position.copy(origin).add(new T.Vector3(spec.distance*.23,spec.mode==='grazing'?6:spec.distance,spec.mode==='grazing'?-spec.distance:-spec.distance*.55));
   else camera.position.copy(origin).addScaledVector(direction,spec.mode==='grazing'?12:spec.distance).add(new T.Vector3(spec.mode==='grazing'?direction.z*spec.distance:0,Math.max(1.5,spec.distance*.15),spec.mode==='grazing'?-direction.x*spec.distance:0));
   camera.lookAt(origin);camera.updateMatrixWorld(true);sun.target.position.copy(origin);sun.position.copy(origin).add(new T.Vector3(-45,80,35));
   caster.position.copy(origin).add(new T.Vector3(-5.5,9.8,4.3));ambient.intensity=spec.light==='dusk'?.55:2.1;sun.intensity=spec.light==='dusk'?.85:3;
   sun.color.set(spec.light==='dusk'?0xffb579:0xffefdc);scene.background=new T.Color(spec.light==='dusk'?0x344560:0x71899d);
   atmosphere.update(120,new T.Vector3().subVectors(sun.position,sun.target.position).normalize(),.35,spec.light==='dusk'?.6:1,0,'high',true,false);
   scene.updateMatrixWorld(true);
   const originalMap=template.map,transform=originalMap?{channel:originalMap.channel,offset:originalMap.offset.clone(),repeat:originalMap.repeat.clone(),center:originalMap.center.clone(),rotation:originalMap.rotation,matrix:originalMap.matrix.clone(),auto:originalMap.matrixAutoUpdate}:null;
   const base=template.clone(),candidate=template.clone();let effectOff=false,mipCalibration:unknown=null;const releases:(()=>void)[]=[];
   for(const [material,isCandidate] of [[base,false],[candidate,true]] as const){
    const old=template.onBeforeCompile,oldKey=template.customProgramCacheKey;
    material.onBeforeCompile=function(...args){const result=Reflect.apply(old,this,args),shader=args[0];
     if(spec.kind==='asphalt'){
      check(shader.fragmentShader.includes(ASPHALT_PATCH_DETAIL),'Actual asphalt factory did not emit the expected block');
      if(!isCandidate||effectOff)shader.fragmentShader=shader.fragmentShader.replace(ASPHALT_PATCH_DETAIL,effectOff?'':SHADER_REUSE_BASELINE.asphaltBlock);
     }
     if(spec.mode==='discard')shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif(mod(gl_FragCoord.x,19.)<4.)discard;');
     compiled.set(this,shader);return result;
    };
    inheritAtmosphereProgram(material,old);material.customProgramCacheKey=function(){return Reflect.apply(oldKey,this,[])+'|shader-proof-'+spec.id+(isCandidate?'-candidate':'-original')+(effectOff?'-effect-off':'');};
   }
   const nativeRender=base.onBeforeRender;
   try{
    if(originalMap&&transform){originalMap.channel=spec.mode==='uv1'?1:spec.mode?.startsWith('uv2')?2:0;
     if(spec.mode==='uv1'){originalMap.offset.set(.13,.71);originalMap.repeat.set(1.03,.97);originalMap.center.set(.5,.5);originalMap.rotation=.19;}
     originalMap.updateMatrix();
     if(spec.mode?.startsWith('uv2')){
      originalMap.offset.set(.21,.47);originalMap.updateMatrix();const estimate=uvFootprint(mesh,originalMap);check(estimate.samples>0,'No projected UV footprint for mip calibration');
      const boundary=Math.round(estimate.median),desired=boundary+(spec.mode==='uv2-low'?-.002:.002),scale=2**(desired-estimate.median);
      originalMap.repeat.multiplyScalar(scale);originalMap.updateMatrix();mipCalibration={kind:'projected-triangle isotropic estimate; not hardware-selected anisotropic LOD',boundary,desired,originalMedian:estimate.median,repeatScale:scale};
     }
    }
    if(spec.kind==='limestone'){mesh.material=candidate;check(reuseMacArthurBumpCenters(root)===1,'Final authored MacArthur owner was not installed');}
    const warm=async()=>{for(const material of [base,candidate]){mesh.material=material;renderer.render(scene,camera);await fence();}};
    const change=(callback:(m:T.MeshStandardMaterial)=>void,recompile=false)=>{for(const material of [base,candidate]){callback(material);if(recompile)material.needsUpdate=true;}};
    if(spec.mode==='unequal-uv-alias'||spec.mode==='cached-unsafe-return'){
     const other=originalMap!.clone();other.channel=1;other.needsUpdate=true;releases.push(()=>other.dispose());change(m=>{m.bumpMap=other;},true);await warm();
     if(spec.mode==='cached-unsafe-return'){change(m=>{m.bumpMap=originalMap;},true);await warm();change(m=>{m.bumpMap=other;},true);await warm();}
     change(m=>{m.bumpMap=originalMap;});
    }else if(spec.mode==='video-alias'){
     const video=await bootstrapVideo();releases.push(video.dispose);change(m=>{m.map=m.bumpMap=video.texture;},true);await warm();change(m=>{m.map=m.bumpMap=originalMap;});
    }else{
     if(spec.mode==='no-map')change(m=>{m.map=null;},true);await warm();
     if(spec.mode==='map-replaced')change(m=>{m.bumpMap=detail;});
     if(spec.mode==='render-replaced')change(m=>{m.onBeforeRender=function(...args){Reflect.apply(nativeRender,this,args);this.bumpMap=detail;};});
     if(spec.mode==='owner-rewrapped'){const old=candidate.onBeforeCompile,key=candidate.customProgramCacheKey();candidate.onBeforeCompile=function(...args){return Reflect.apply(old,this,args);};candidate.customProgramCacheKey=()=>key;}
     if(spec.mode==='frozen-defines'){change(m=>{m.defines=Object.freeze({...m.defines,USER_OWNED_FIXTURE:7});m.bumpMap=detail;});}
    }
    const captured:PixelRead[]=[];for(const material of [base,candidate]){mesh.material=material;captured.push(await renderRead(mesh));}
    const [baseline,optimized]=captured;mesh.material=base;
    mesh.visible=false;const hidden=await renderRead(mesh,false);mesh.visible=true;
    // Native light shadow membership, not only shadowMap.enabled, invalidates
    // the cached r185 shadow variant for this positive control.
    sun.castShadow=false;const shadowOff=await renderRead(mesh,false);sun.castShadow=true;
    if(spec.kind==='asphalt'){effectOff=true;base.needsUpdate=true;}else base.bumpScale=0;
    const effect=await renderRead(mesh,false);effectOff=false;base.bumpScale=template.bumpScale;base.needsUpdate=true;
    const mask=await sourceMask(mesh),different=diff(baseline.pixels,optimized.pixels);
    const captures=[];
    for(const [role,read] of [['baseline',baseline],['candidate',optimized],['target-hidden',hidden],['shadow-off',shadowOff],['effect-off',effect]] as const){
     const row={role,width,height,rgbaSha256:read.rgbaSha256};await(window as unknown as {__saveShaderCapture:(x:unknown)=>Promise<void>}).__saveShaderCapture({id:spec.id,...row,png:read.png});captures.push(row);
    }
    const summarize=(read:PixelRead)=>{const{pixels,png,...rest}=read;return rest;};
    rows.push({id:spec.id,kind:spec.kind,case:spec,controlFocus,changedPixels:different.count,maxChannelDelta:different.max,
     baseline:summarize(baseline),candidate:summarize(optimized),targetMaskPixels:mask.filter((v,i)=>i%4===0&&v>=250).length,
     visibleTargetPixels:diff(baseline.pixels,hidden.pixels,mask).count,targetShadowPixels:diff(baseline.pixels,shadowOff.pixels,mask).count,
     effectPixels:diff(baseline.pixels,effect.pixels,mask).count,uvFootprint:uvFootprint(mesh,base.map),mipCalibration,captures,restored:mesh.visible&&sun.castShadow&&renderer.shadowMap.enabled});
   }finally{
    mesh.material=template;mesh.visible=true;sun.castShadow=true;renderer.shadowMap.enabled=true;
    if(originalMap&&transform){originalMap.channel=transform.channel;originalMap.offset.copy(transform.offset);originalMap.repeat.copy(transform.repeat);originalMap.center.copy(transform.center);originalMap.rotation=transform.rotation;originalMap.matrix.copy(transform.matrix);originalMap.matrixAutoUpdate=transform.auto;}
    base.dispose();candidate.dispose();for(const release of releases)release();
   }
  }
  return{scope,sourceSha:receipt.sourceSha,sourceTree:receipt.sourceTree,size:SHADER_PROOF_SIZE,devicePixelRatio:devicePixelRatio,threeRevision:T.REVISION,gpu,
   assets:nativeAssets,rows,errors,contextLost:gl.isContextLost(),finished:true,
   notes:['Each pair retains the supplied position/normal/index/UV0 bytes, native span/range selection, sampler precision, callbacks and original decorated profiles. Additional uv1/uv2 attributes are fixture-only channel controls.','Mipmapped native samplers and near/far/small-scale views are exercised; geometric derivative estimates are not hardware LOD measurements.','The original asphalt block is independently pinned to759; limestone baseline was captured before installing the production helper. No full-game performance or control threshold is changed.']};
 }catch(error){errors.push(String(error));return{scope,sourceSha:initialized?.receipt.sourceSha,sourceTree:initialized?.receipt.sourceTree,size:SHADER_PROOF_SIZE,devicePixelRatio,threeRevision:T.REVISION,gpu:initialized?.gpu,assets:nativeAssets,rows,errors,contextLost:gl.isContextLost(),finished:false};}
};
