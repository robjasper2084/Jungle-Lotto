import * as T from 'three';

/** One small renderer for both cards. Geometry/textures are borrowed, never disposed. */
export function createRidePreview(host:HTMLElement,wheel:T.Object3D,loadBike:()=>Promise<T.Object3D>){
 const row=host.querySelector<HTMLElement>('.ride-options')!;
 const canvas=document.createElement('canvas');canvas.className='ride-preview-canvas';canvas.setAttribute('aria-hidden','true');
 let alive=true,active=false,frame=0,last=0,angle=0,wake:(()=>void)|undefined;
 let ownedContext:WebGL2RenderingContext|null=null;
 let ownedRenderer:T.WebGLRenderer|undefined,ownedGeometry:T.CylinderGeometry|undefined,ownedMaterial:T.MeshStandardMaterial|undefined;
 const dispose=()=>{
  if(!alive)return;alive=false;active=false;
  // Initialization can fail before a disposer is returned. Release each owned
  // resource independently so context loss cannot leave the canvas or another
  // resource behind. The vehicle clones share their source geometry/textures.
  for(const release of[
   ()=>{cancelAnimationFrame(frame);frame=0;},
   ()=>{if(wake)document.removeEventListener('visibilitychange',wake);},
   ()=>ownedRenderer?.dispose(),
   ()=>{const context=ownedContext;ownedContext=null;context?.getExtension('WEBGL_lose_context')?.loseContext();},
   ()=>ownedGeometry?.dispose(),()=>ownedMaterial?.dispose(),
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
 const scenes=[new T.Scene(),new T.Scene()],models:T.Group[]=[];
 const camera=new T.PerspectiveCamera(34,1,.01,30);camera.position.set(3.6,2.0,4.8);camera.lookAt(0,.85,0);
 const stageGeometry=ownedGeometry=new T.CylinderGeometry(1.45,1.5,.035,48),stageMaterial=ownedMaterial=new T.MeshStandardMaterial({color:0x24434b,roughness:.85});
 scenes.forEach(scene=>{scene.add(new T.HemisphereLight(0xe5f6ff,0x50646b,3));const key=new T.DirectionalLight(0xffe3b8,4);key.position.set(2,5,4);scene.add(key);const rim=new T.DirectionalLight(0x88dcff,3);rim.position.set(-3,2,-2);scene.add(rim);const stage=new T.Mesh(stageGeometry,stageMaterial);stage.position.y=-.04;scene.add(stage);});
 function add(source:T.Object3D,index:number){
  const copy=source.clone(true);copy.visible=true;
  const remove:T.Object3D[]=[];copy.traverse(o=>{if((o as T.Light).isLight||/LCD|Headlight|ground glow|^Hero/i.test(o.name))remove.push(o);if((o as T.Mesh).isMesh){o.castShadow=false;o.receiveShadow=false;}});remove.forEach(o=>o.removeFromParent());
  // Preserve the asset's local scale/orientation, normalize its world-sized bounds once.
  copy.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(copy),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=2.15/Math.max(size.x,size.y,size.z,.001),mount=new T.Group();copy.position.sub(center);copy.position.y+=size.y/2;mount.add(copy);mount.scale.setScalar(scale);
  const turntable=new T.Group();turntable.add(mount);turntable.rotation.y=index===0?-.55:.7;scenes[index].add(turntable);models[index]=turntable;
  row.querySelectorAll('label')[index].classList.add('preview-ready');
 }
 add(wheel,0);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const draw=(time:number)=>{
  frame=0;if(!active||!alive||document.hidden)return;
  if(time-last<50){frame=requestAnimationFrame(draw);return;}
  const dt=Math.min(.1,(time-last)/1000);last=time;if(!reduced.matches)angle+=dt*.12;
  const rect=row.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);
  if(w&&h){if(canvas.width!==w||canvas.height!==h)renderer.setSize(w,h,false);renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.clear();renderer.setScissorTest(true);
   row.querySelectorAll<HTMLElement>('.ride-preview-slot').forEach((slot,i)=>{const r=slot.getBoundingClientRect(),x=Math.round(r.left-rect.left),y=Math.round(h-(r.bottom-rect.top)),sw=Math.round(r.width),sh=Math.round(r.height);if(sw<1||sh<1)return;camera.aspect=sw/sh;camera.updateProjectionMatrix();if(models[i])models[i].rotation.y=(i===0?-.55:.7)+Math.sin(angle)*.45;renderer.setViewport(x,y,sw,sh);renderer.setScissor(x,y,sw,sh);renderer.render(scenes[i],camera);});
  }
  frame=requestAnimationFrame(draw);
 };
 wake=()=>{if(active&&!frame&&!document.hidden&&alive){last=performance.now()-50;frame=requestAnimationFrame(draw);}};
 document.addEventListener('visibilitychange',wake);
 void loadBike().then(bike=>{if(alive)add(bike,1);}).catch(()=>{if(alive){const label=row.querySelectorAll('label')[1];label.classList.add('preview-unavailable');label.querySelector('.ride-preview-slot')?.setAttribute('data-status','Preview unavailable');}});
 return {setActive(value:boolean){if(!alive)return;active=value;if(!value){cancelAnimationFrame(frame);frame=0;}else wake?.();},dispose};
 }catch(error){dispose();throw error;}
}
