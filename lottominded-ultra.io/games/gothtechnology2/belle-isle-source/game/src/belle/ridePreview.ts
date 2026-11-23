import * as T from 'three';
import {cadillacModel} from './cadillacRide.ts';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createVehicleModel,type VehicleModel} from './vehicles/models.ts';

/** One renderer for the visible cards. Geometry/textures are borrowed, never disposed. */
export function createRidePreview(host:HTMLElement,wheel:T.Object3D,loadBike:()=>Promise<T.Object3D>){
 const row=host.querySelector<HTMLElement>('.ride-options')!;
 const canvas=document.createElement('canvas');canvas.className='ride-preview-canvas';canvas.setAttribute('aria-hidden','true');
 let alive=true,active=false,frame=0,last=0,angle=0,dirty=true;
 let work:ReturnType<typeof setTimeout>|undefined,pending=false,preparation:AbortController|undefined;
 let ownedContext:WebGL2RenderingContext|null=null;
 let ownedRenderer:T.WebGLRenderer|undefined,ownedGeometry:T.CylinderGeometry|undefined,ownedMaterial:T.MeshStandardMaterial|undefined;
 const ownedVehicles:VehicleModel[]=[],ownedSkeletons=new Set<T.Skeleton>(),listeners:(()=>void)[]=[];
 const cancelScheduled=()=>{cancelAnimationFrame(frame);frame=0;clearTimeout(work);work=undefined;preparation?.abort();};
 const dispose=()=>{
  if(!alive)return;alive=false;active=false;
  // Initialization can fail before a disposer is returned. Release each owned
  // resource independently so context loss cannot leave the canvas or another
  // resource behind. The vehicle clones share their source geometry/textures.
  for(const release of[
   cancelScheduled,...listeners,
   ()=>ownedRenderer?.dispose(),
   ()=>{const context=ownedContext;ownedContext=null;context?.getExtension('WEBGL_lose_context')?.loseContext();},
   ()=>ownedGeometry?.dispose(),()=>ownedMaterial?.dispose(),
   ()=>ownedVehicles.forEach(v=>v.dispose()),
   ()=>ownedSkeletons.forEach(s=>s.dispose()),
   ()=>row.querySelectorAll('label').forEach(label=>label.classList.remove('preview-ready')),
   ()=>canvas.remove(),
  ])try{release();}catch{/* Best effort after context loss; preserve the initialization error. */}
 };
 try{
 row.append(canvas);
 // These are the attributes Three used for this optional preview. A missing
 // second context uses the existing static-card fallback before constructing
 // a renderer; the main island renderer and its errors remain independent.
 const attributes:WebGLContextAttributes={alpha:true,depth:true,stencil:false,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power',failIfMajorPerformanceCaveat:false};
 const context=ownedContext=canvas.getContext('webgl2',attributes);
 if(!context)throw new Error('Ride preview unavailable: a WebGL2 context could not be created.');
 const renderer=ownedRenderer=new T.WebGLRenderer({canvas,context,...attributes});
 renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 const labels=Array.from(row.querySelectorAll<HTMLLabelElement>('label'));
 const slots=labels.map(label=>label.querySelector<HTMLElement>('.ride-preview-slot')!);
 const scenes=labels.map(()=>new T.Scene()),models:T.Group[]=[];
 const readySources=new Map<number,T.Object3D>(),requested=new Set<number>([0]);
 const camera=new T.PerspectiveCamera(34,1,.01,30);camera.position.set(3.6,2.0,4.8);camera.lookAt(0,.85,0);
 const stageGeometry=ownedGeometry=new T.CylinderGeometry(1.45,1.5,.035,48),stageMaterial=ownedMaterial=new T.MeshStandardMaterial({color:0x24434b,roughness:.85});
 scenes.forEach(scene=>{scene.add(new T.HemisphereLight(0xe5f6ff,0x50646b,3));const key=new T.DirectionalLight(0xffe3b8,4);key.position.set(2,5,4);scene.add(key);const rim=new T.DirectionalLight(0x88dcff,3);rim.position.set(-3,2,-2);scene.add(rim);const stage=new T.Mesh(stageGeometry,stageMaterial);stage.position.y=-.04;scene.add(stage);});
 function add(source:T.Object3D,index:number){
  const copy=clone(source);copy.visible=true;
  copy.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)ownedSkeletons.add((o as T.SkinnedMesh).skeleton);});
  const remove:T.Object3D[]=[];copy.traverse(o=>{if((o as T.Light).isLight||/LCD|Headlight|ground glow|^Hero/i.test(o.name))remove.push(o);if((o as T.Mesh).isMesh){o.castShadow=false;o.receiveShadow=false;}});remove.forEach(o=>o.removeFromParent());
  // Preserve the asset's local scale/orientation, normalize its world-sized bounds once.
  copy.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(copy),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=2.15/Math.max(size.x,size.y,size.z,.001),mount=new T.Group();copy.position.sub(center);copy.position.y+=size.y/2;mount.add(copy);mount.scale.setScalar(scale);
  const turntable=new T.Group();turntable.add(mount);turntable.rotation.y=index===0?-.55:.7;scenes[index].add(turntable);models[index]=turntable;
  labels[index].classList.add('preview-ready');
 }
 add(wheel,0);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const failed=(index:number)=>{labels[index].classList.add('preview-unavailable');slots[index].setAttribute('data-status','Preview unavailable');};
 function layout(){
  const rect=row.getBoundingClientRect();
  let left=0,top=0,right=window.innerWidth,bottom=window.innerHeight;
  // Include the chooser and the compact title scroller. Positive card dimensions
  // alone do not mean its preview can be seen through these clipping ancestors.
  for(let parent=host.parentElement;parent;parent=parent.parentElement){
   const style=getComputedStyle(parent),bounds=parent.getBoundingClientRect();
   if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,bounds.left+parent.clientLeft);right=Math.min(right,bounds.left+parent.clientLeft+parent.clientWidth);}
   if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,bounds.top+parent.clientTop);bottom=Math.min(bottom,bounds.top+parent.clientTop+parent.clientHeight);}
  }
  const visible=slots.flatMap((slot,index)=>{
   const bounds=slot.getBoundingClientRect(),clip={left:Math.max(left,bounds.left),right:Math.min(right,bounds.right),top:Math.max(top,bounds.top),bottom:Math.min(bottom,bounds.bottom)};
   return bounds.width>0&&bounds.height>0&&clip.right>clip.left&&clip.bottom>clip.top?[{index,bounds,clip}]:[];
  });
  visible.sort((a,b)=>Number(labels[b.index].querySelector<HTMLInputElement>('input')?.checked)-Number(labels[a.index].querySelector<HTMLInputElement>('input')?.checked));
  return {rect,visible};
 }
 const wake=()=>{dirty=true;if(active&&!frame&&!document.hidden&&alive){last=performance.now()-50;frame=requestAnimationFrame(draw);}};
 const prepareVisible=(visible:readonly {index:number}[])=>{
  if(work!==undefined||pending||!active||!alive||document.hidden)return;
  if(!visible.some(({index})=>!requested.has(index)))return;
  // A separate task after the first draw lets the chooser paint before cached
  // model factories clone their scene graphs. Recheck visibility at dispatch.
  work=setTimeout(()=>{
   work=undefined;if(!active||!alive||document.hidden)return;
   const next=layout().visible.find(({index})=>!requested.has(index));if(!next)return;
   const index=next.index;requested.add(index);pending=true;slots[index].setAttribute('data-status','Loading 3D preview');
   const controller=index===2||index===3?new AbortController():undefined;preparation=controller;
   const load=async()=>{
    if(index===1)return loadBike();
    if(index===4)return cadillacModel();
    const model=await createVehicleModel({vehicle:index===2?'jetson':'corleo',pilot:'professional',livery:'industrial'},{preview:true,signal:controller?.signal});
    if(!alive||controller?.signal.aborted){model.dispose();return;}
    ownedVehicles.push(model);return model.root;
   };
   void load().then(source=>{
    // Downloads may finish after closing. Keep their result without cloning or
    // uploading another preview until that card is visible on an active frame.
    if(alive&&source)readySources.set(index,source);
   }).catch(()=>{if(alive&&!controller?.signal.aborted)failed(index);}).finally(()=>{
    if(controller?.signal.aborted){requested.delete(index);if(alive)slots[index].setAttribute('data-status','');}
    preparation=undefined;pending=false;wake();
   });
  },0);
 };
 function draw(time:number){
  frame=0;if(!active||!alive||document.hidden)return;
  if(!dirty&&time-last<50){frame=requestAnimationFrame(draw);return;}
  const dt=Math.min(.1,(time-last)/1000);last=time;dirty=false;if(!reduced.matches)angle+=dt*.12;
  const {rect,visible}=layout(),w=Math.round(rect.width),h=Math.round(rect.height);
  if(w&&h){if(canvas.width!==w||canvas.height!==h)renderer.setSize(w,h,false);renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.clear();renderer.setScissorTest(true);
   for(const {index,bounds,clip} of visible){
    const source=readySources.get(index);if(source){readySources.delete(index);try{add(source,index);}catch{failed(index);}}
    const x=Math.round(bounds.left-rect.left),y=Math.round(h-(bounds.bottom-rect.top)),sw=Math.round(bounds.width),sh=Math.round(bounds.height);
    if(sw<1||sh<1)continue;camera.aspect=sw/sh;camera.updateProjectionMatrix();if(models[index])models[index].rotation.y=(index===0?-.55:.7)+Math.sin(angle)*.45;
    renderer.setViewport(x,y,sw,sh);
    renderer.setScissor(Math.round(clip.left-rect.left),Math.round(h-(clip.bottom-rect.top)),Math.round(clip.right-clip.left),Math.round(clip.bottom-clip.top));
    renderer.render(scenes[index],camera);
   }
  }
  prepareVisible(visible);
  if(!reduced.matches&&visible.length)frame=requestAnimationFrame(draw);
 }
 const listen=(target:EventTarget,type:string,callback:()=>void,capture=false)=>{target.addEventListener(type,callback,capture);listeners.push(()=>target.removeEventListener(type,callback,capture));};
 listen(document,'visibilitychange',()=>{if(document.hidden)cancelScheduled();else wake();});
 listen(document,'scroll',wake,true);listen(window,'resize',wake);listen(row,'change',wake);listen(reduced,'change',wake);
 const resize=new ResizeObserver(wake);resize.observe(row);resize.observe(host);listeners.push(()=>resize.disconnect());
 return {setActive(value:boolean){if(!alive)return;active=value;if(!value)cancelScheduled();else wake();},dispose};
 }catch(error){dispose();throw error;}
}
