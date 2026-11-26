import * as T from 'three';
import {addStreetDetails} from '../src/belle/streetDetails.ts';
import {StaticPaletteBatch} from '../src/belle/staticPaletteBatch.ts';
import {preserveStreetBatchOrder} from '../src/belle/streetBatchOrder.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from '../src/belle/photoReferenceSurfaces.ts';
import {dressSunsetGround} from '../src/belle/sunsetGround.ts';

const width=960,height=600;
const canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(58,width/height,.1,3500);
scene.background=new T.Color(0x738ba0);scene.fog=new T.FogExp2(0x879394,.00012);
const ambient=new T.HemisphereLight(0xd8e4f1,0x465443,2.1);scene.add(ambient);
const sun=new T.DirectionalLight(0xffefdc,3);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-120;sun.shadow.camera.right=120;
sun.shadow.camera.top=120;sun.shadow.camera.bottom=-120;sun.shadow.camera.near=1;sun.shadow.camera.far=600;
sun.shadow.bias=-.0001;scene.add(sun,sun.target);
const lamp=new T.PointLight(0x8cbcff,500,80,2);scene.add(lamp);
// An ordinary opaque caster verifies the original street shadow receivers in
// addition to the authored factory geometry, texture projection and pigment.
const caster=new T.Mesh(new T.BoxGeometry(15,12,8),new T.MeshStandardMaterial({color:0x8f8070,roughness:.8}));
caster.castShadow=true;caster.receiveShadow=true;scene.add(caster);
const ground=new T.Mesh(new T.PlaneGeometry(12000,12000),new T.MeshStandardMaterial({color:0x676b67,roughness:.95}));
ground.rotation.x=-Math.PI/2;ground.position.y=1.95;ground.receiveShadow=true;scene.add(ground);
const gl=renderer.getContext() as WebGL2RenderingContext;
if(typeof gl.fenceSync!=='function')throw Error('WebGL2 is required for the rendering proof');
async function fence(){
 const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('GPU fence unavailable');gl.flush();
 const started=performance.now();
 try{while(true){const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return;
  if(state===gl.WAIT_FAILED||gl.isContextLost())throw Error('GPU fence failed');
  if(performance.now()-started>30000)throw Error('GPU fence exceeded 30 seconds');
  await new Promise(resolve=>setTimeout(resolve,8));}}
 finally{gl.deleteSync(sync);}
}
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
function changedPixels(a:Uint8Array,b:Uint8Array){let count=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])count++;return count;}
async function readRendered(){
 await fence();const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('GPU readback error '+error);
 return {pixels,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,png:canvas.toDataURL('image/png')};
}
const init=(async()=>{
 if(!renderer.extensions.has('WEBGL_multi_draw'))throw Error('This proof requires actual WEBGL_multi_draw');
 const response=await fetch('/belle/street-details.json');if(!response.ok)throw Error('Street plan unavailable');const plan=await response.json();
 const binaryResponse=await fetch('/belle/street-details.bin');if(!binaryResponse.ok)throw Error('Street geometry unavailable');
 const bytes=await binaryResponse.arrayBuffer(),data=new Float32Array(bytes);plan.boxes=[];
 for(let i=0;i<data.length;i+=plan.stride)plan.boxes.push({x:data[i],y:data[i+1],z:data[i+2],w:data[i+3],h:data[i+4],l:data[i+5],yaw:data[i+6],material:plan.materials[data[i+7]],grade:data[i+8]});
 const street=addStreetDetails(scene,plan);
 await loadRealisticMaterials(renderer);
 // These are the same surface decorators, in the same order, as createWorld.
 applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);dressSunsetGround(scene);
 const sources=street.batchSources(),palette=new StaticPaletteBatch(sources,new Set(sources),preserveStreetBatchOrder);
 palette.root.traverse(o=>{if(o instanceof T.BatchedMesh)o.raycast=()=>{};});scene.add(palette.root);
 const debug=gl.getExtension('WEBGL_debug_renderer_info');
 const gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
 return {street,sources,palette,gpu,sourceGeometrySha256:await hash(new Uint8Array(bytes))};
})();

(window as unknown as {__streetBatchProof:()=>Promise<unknown>}).__streetBatchProof=async()=>{
 const {street,sources,palette,gpu,sourceGeometrySha256}=await init;
 const rows:Record<string,unknown>[]=[],images:{name:string;png:string}[]=[];
 const poses=[{name:'west',x:800,z:500,yaw:.8},{name:'conservatory',x:1330,z:1175,yaw:2.1},{name:'northeast',x:3200,z:700,yaw:-2.5}];
 for(const pose of poses)for(const night of [false,true]){
  const name=pose.name+(night?'-night':'-day');
  street.update(pose.x,pose.z);camera.position.set(pose.x,7,pose.z);
  camera.lookAt(pose.x+Math.sin(pose.yaw)*150,2,pose.z+Math.cos(pose.yaw)*150);camera.updateMatrixWorld(true);
  const frontX=pose.x+Math.sin(pose.yaw)*38,frontZ=pose.z+Math.cos(pose.yaw)*38;
  sun.position.set(frontX-55,95,frontZ+45);sun.target.position.set(frontX,2,frontZ);
  sun.intensity=night?.07:3;ambient.intensity=night?.22:2.1;lamp.intensity=night?700:0;
  lamp.position.set(frontX-Math.cos(pose.yaw)*8,8,frontZ+Math.sin(pose.yaw)*8);
  caster.position.set(frontX+Math.cos(pose.yaw)*8,8,frontZ-Math.sin(pose.yaw)*8);
  scene.background=new T.Color(night?0x101b31:0x738ba0);scene.updateMatrixWorld(true);
  const visibility=sources.map(s=>s.visible);
  // Compile both exact alternatives before either measured render. No shader,
  // uniform, target, camera or lighting value changes between the paired reads.
  palette.endView();await renderer.compileAsync(scene,camera);
  palette.beginView(true,camera);await renderer.compileAsync(scene,camera);palette.endView();
  const captured:{pixels:Uint8Array;calls:number;triangles:number;png:string}[]=[];
  for(const batched of [false,true]){
   if(batched)palette.beginView(true,camera);else palette.endView();
   renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);captured.push(await readRendered());
   palette.endView();
  }
  const [baseline,candidate]=captured;let maxChannelDelta=0;
  for(let i=0;i<baseline.pixels.length;i++)maxChannelDelta=Math.max(maxChannelDelta,Math.abs(baseline.pixels[i]-candidate.pixels[i]));
  const differingPixels=changedPixels(baseline.pixels,candidate.pixels);
  // Positive controls prevent a vacuous pass with all optimized tiles hidden,
  // outside the camera, occluded or with a shadow setup that casts no pixels.
  for(const source of sources)source.visible=false;
  renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);const streetHidden=await readRendered();
  sources.forEach((source,i)=>{source.visible=visibility[i];});
  // Changing only shadowMap.enabled leaves existing cached shadow programs in
  // r185. Changing the light's shadow membership also updates the native light
  // state and selects the actual no-shadow material variant for this control.
  sun.castShadow=false;renderer.render(scene,camera);const shadowOff=await readRendered();
  sun.castShadow=true;renderer.shadowMap.needsUpdate=true;
  const visibleStreetPixels=changedPixels(baseline.pixels,streetHidden.pixels),visibleShadowPixels=changedPixels(baseline.pixels,shadowOff.pixels);
  const restored=sources.every((s,i)=>s.visible===visibility[i]);
  rows.push({name,width,height,changedPixels:differingPixels,maxChannelDelta,visibleStreetPixels,visibleShadowPixels,baselineCalls:baseline.calls,candidateCalls:candidate.calls,
   baselineTriangles:baseline.triangles,candidateTriangles:candidate.triangles,visibilityRestored:restored,
   baselineRgbaSha256:await hash(baseline.pixels),candidateRgbaSha256:await hash(candidate.pixels),
   passed:differingPixels===0&&visibleStreetPixels>0&&visibleShadowPixels>0&&baseline.triangles===candidate.triangles&&candidate.calls<baseline.calls&&restored});
  images.push({name:name+'-baseline',png:baseline.png},{name:name+'-candidate',png:candidate.png},
   {name:name+'-street-hidden-control',png:streetHidden.png},{name:name+'-shadow-off-control',png:shadowOff.png});
 }
 return {gpu,sourceGeometrySha256,threeRevision:T.REVISION,fullStreetTileSources:sources.length,batches:palette.stats.batches,rows,images,
  scope:'Targeted paired rendering of the shipped full street geometry and actual decorated materials; not a full-game native performance or controls acceptance.',
  passed:rows.length===6&&rows.every(row=>row.passed)};
};
