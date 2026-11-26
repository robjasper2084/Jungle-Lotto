import * as T from 'three';
import {addStreetDetails as baseline} from './src/belle/.street-matrix-baseline.ts';
import {addStreetDetails as candidate} from './src/belle/streetDetails.ts';
const must=(ok,m)=>{if(!ok)throw Error(m);};
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const median=values=>{const a=values.slice().sort((x,y)=>x-y),n=a.length;return n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2;};
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
globalThis.__streetProof=async()=>{
 const meta=await fetch('/street-details.json').then(r=>{must(r.ok,'street JSON');return r.json();});
 const data=new Float32Array(await fetch('/street-details.bin').then(r=>{must(r.ok,'street binary');return r.arrayBuffer();}));
 must(meta.stride===9&&data.length%9===0,'street format');
 const plan={...meta,boxes:[]};
 for(let i=0;i<data.length;i+=9)plan.boxes.push({x:data[i],y:data[i+1],z:data[i+2],w:data[i+3],h:data[i+4],l:data[i+5],yaw:data[i+6],material:meta.materials[data[i+7]],grade:data[i+8]});
 must(plan.boxes.length>1000&&plan.signs.length>0,'missing actual street inventory');
 const canvas=document.querySelector('canvas');
 const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance',outputBufferType:T.UnsignedByteType});
 renderer.setPixelRatio(1);renderer.setSize(1440,900,false);renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=true;
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
 const rendererName=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
 must(gl.getContextAttributes().antialias,'MSAA unavailable');
 function make(add){
  const scene=new T.Scene();scene.background=new T.Color(0x889eb5);
  const details=add(scene,plan),roots=scene.children.slice();
  scene.add(new T.HemisphereLight(0xd8e5ff,0x6b665e,2));
  const sun=new T.DirectionalLight(0xffedcf,3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:.1,far:150});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00015;
  scene.add(sun,sun.target);
  const ground=new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshStandardMaterial({color:0x5b5b5b,roughness:.9}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const caster=new T.Mesh(new T.BoxGeometry(2,4,2),new T.MeshStandardMaterial({color:0x777d86}));caster.castShadow=true;caster.receiveShadow=true;scene.add(caster);
  return {scene,details,roots,sun,ground,caster};
 }
 const a=make(baseline),b=make(candidate);
 must(a.roots.length===b.roots.length&&a.roots.length>100,'root inventory mismatch');
 must(a.roots.every(o=>o.matrixAutoUpdate&&o.matrixWorldAutoUpdate),'unexpected baseline flags');
 must(b.roots.every(o=>!o.matrixAutoUpdate&&o.matrixWorldAutoUpdate),'candidate world propagation changed');
 for(let i=0;i<a.roots.length;i++){
  const x=a.roots[i],y=b.roots[i];
  must(x.name===y.name&&x.type===y.type&&x.castShadow===y.castShadow&&x.receiveShadow===y.receiveShadow,'object/flag mismatch '+i);
  must(equal(Object.keys(x.geometry.attributes).sort(),Object.keys(y.geometry.attributes).sort()),'attribute keys mismatch '+i);
  for(const name of Object.keys(x.geometry.attributes)){
   const p=x.geometry.attributes[name],q=y.geometry.attributes[name];
   must(p.itemSize===q.itemSize&&p.normalized===q.normalized&&equal(p.array,q.array),'attribute mismatch '+i+' '+name);
  }
  must((x.geometry.index===null)===(y.geometry.index===null),'index type mismatch '+i);
  if(x.geometry.index)must(equal(x.geometry.index.array,y.geometry.index.array),'index mismatch '+i);
  if(x.isInstancedMesh)must(y.isInstancedMesh&&x.count===y.count&&equal(x.instanceMatrix.array,y.instanceMatrix.array),'instance mismatch '+i);
 }
 const cpu=[],modes={A:a,B:b};
 for(const v of Object.values(modes))for(let i=0;i<250;i++)v.scene.updateMatrixWorld(true);
 for(const label of ['A','B','B','A','B','A','A','B','A','B','B','A']){
  const s=modes[label].scene,t0=performance.now();for(let i=0;i<1200;i++)s.updateMatrixWorld(true);
  cpu.push({label,iterations:1200,elapsedMs:performance.now()-t0});
 }
 const timing={baselineMedianMs:median(cpu.filter(s=>s.label==='A').map(s=>s.elapsedMs/s.iterations)),candidateMedianMs:median(cpu.filter(s=>s.label==='B').map(s=>s.elapsedMs/s.iterations)),samples:cpu};
 const curb=plan.boxes.find(o=>o.material==='curb'&&o.h>.03),paint=plan.boxes.find(o=>o.material==='yellow');
 must(curb&&paint,'missing real curb/paint');
 const views=[{name:'curb',x:curb.x,y:curb.y,z:curb.z},{name:'markings',x:paint.x,y:paint.y,z:paint.z},{name:'sign',x:plan.signs[0].x,y:plan.signs[0].y-2.4,z:plan.signs[0].z}];
 const camera=new T.PerspectiveCamera(60,1440/900,.1,900),images=[],comparisons=[],shadowControls=[];
 const changedPixels=(a,b)=>{let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;return changed;};
 function place(v,point){
  v.details.update(point.x,point.z);v.ground.position.set(point.x,point.y-.18,point.z);v.caster.position.set(point.x+2,point.y+1.9,point.z+2);
  v.sun.position.set(point.x+24,point.y+40,point.z+18);v.sun.target.position.set(point.x,point.y,point.z);v.sun.shadow.needsUpdate=true;
  v.scene.updateMatrixWorld(true);
 }
 async function capture(v,shadows){
  // Keep renderer and light shadow configuration constant; remove only the
  // fixture caster from the shadow pass, not from the visible color pass.
  // This avoids relying on toggling the renderer's shader-program policy.
  v.caster.castShadow=shadows;v.sun.shadow.needsUpdate=true;
  renderer.render(v.scene,camera);renderer.render(v.scene,camera);
  must(v.sun.shadow.map?.texture,'native light shadow target missing');
  must(!gl.isContextLost(),'context lost');
  const pixels=new Uint8Array(1440*900*4);gl.readPixels(0,0,1440,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  must(gl.getError()===gl.NO_ERROR,'native readback failed');
  // Independent browser canvas readback checks that both captures contain
  // spatially varying color. Preserve both raw and PNG evidence even when
  // the positive shadow control fails.
  const copy=document.createElement('canvas');copy.width=1440;copy.height=900;
  const ctx=copy.getContext('2d',{willReadFrequently:true});must(ctx,'2D pixel readback unavailable');
  ctx.drawImage(canvas,0,0);const rgba=ctx.getImageData(0,0,1440,900).data;
  const varied=p=>{for(let i=4;i<p.length;i+=4)if(p[i]!==p[0]||p[i+1]!==p[1]||p[i+2]!==p[2])return true;return false;};
  return {pixels,hash:await digest(pixels),canvasHash:await digest(rgba),rawVaried:varied(pixels),canvasVaried:varied(rgba),png:canvas.toDataURL('image/png'),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 }
 for(const v of views){
  for(const item of [a,b])place(item,v);
  for(let i=0;i<a.roots.length;i++)must(a.roots[i].visible===b.roots[i].visible&&equal(a.roots[i].matrixWorld.elements,b.roots[i].matrixWorld.elements),'world/visibility mismatch '+v.name+' '+i);
  camera.position.set(v.x+10,v.y+6,v.z+13);camera.lookAt(v.x,v.y+.4,v.z);camera.updateMatrixWorld(true);
  const samples={};
  for(const shadows of [true,false])for(const [label,item] of [['A',a],['B',b]]){
   const key=label+(shadows?'Shadow':'NoShadow'),s=await capture(item,shadows);samples[key]=s;
   images.push({name:v.name+'-'+key+'.png',png:s.png,rgbaSha256:s.hash,canvasRgbaSha256:s.canvasHash});
  }
  for(const suffix of ['Shadow','NoShadow']){
   const x=samples['A'+suffix],y=samples['B'+suffix];
   comparisons.push({view:v.name,shadows:suffix==='Shadow',changedPixels:changedPixels(x.pixels,y.pixels),baselineHash:x.hash,candidateHash:y.hash,baselineCanvasHash:x.canvasHash,candidateCanvasHash:y.canvasHash,nonuniform:x.rawVaried&&y.rawVaried&&x.canvasVaried&&y.canvasVaried,baselineDraws:x.draws,candidateDraws:y.draws,baselineTriangles:x.triangles,candidateTriangles:y.triangles});
  }
  for(const label of ['A','B']){
   const x=samples[label+'Shadow'],y=samples[label+'NoShadow'];
   shadowControls.push({view:v.name,label,changedPixels:changedPixels(x.pixels,y.pixels),canvasChanged:x.canvasHash!==y.canvasHash,shadowHash:x.hash,noShadowHash:y.hash});
  }
 }
 const result={three:T.REVISION,renderer:rendererName,msaa:gl.getContextAttributes().antialias,viewport:{width:canvas.width,height:canvas.height},roots:a.roots.length,boxes:plan.boxes.length,signs:plan.signs.length,timing,comparisons,shadowControls,images};
 renderer.dispose();return result;
};
