import * as THREE from 'three';
import { PerformanceGovernor, qualitySettings, type Quality } from './governor';
export function mountScene(host:HTMLElement,quality:Quality,status:(text:string)=>void) {
  const governor=new PerformanceGovernor(quality);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:quality!=='low',powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio,qualitySettings[quality].dpr));host.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,60), group=new THREE.Group();
  camera.position.set(0,.2,8);scene.add(group);scene.fog=new THREE.FogExp2(0x020609,.055);
  const gold=new THREE.LineBasicMaterial({color:0xbaa05d,transparent:true,opacity:.23});
  // Architectural edge frames: no fake garment geometry.
  const box=new THREE.BoxGeometry(4.5,4.8,1.2),edges=new THREE.EdgesGeometry(box);box.dispose();
  for(let i=0;i<5;i++){const frame=new THREE.LineSegments(edges,gold);frame.position.set(2.7,.2,-i*2.5);group.add(frame);}
  const count=qualitySettings[quality].particles, points=new Float32Array(count*3);
  for(let i=0;i<count;i++){points[i*3]=Math.sin(i*43.7)*9;points[i*3+1]=Math.cos(i*9.41)*4;points[i*3+2]=-(i%14);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(points,3));
  const material=new THREE.PointsMaterial({color:0xc7b981,size:.022,transparent:true,opacity:.55,depthWrite:false});
  const particles=new THREE.Points(geometry,material);scene.add(particles);
  const markerGeometry=new THREE.PlaneGeometry(.02,2.4),markerMaterial=new THREE.MeshBasicMaterial({color:0x649d99,transparent:true,opacity:.18,side:THREE.DoubleSide});
  for(let i=0;i<8;i++){const line=new THREE.Mesh(markerGeometry,markerMaterial);line.position.set(1+i*.72,-1.1,-i*.45);group.add(line);}
  let disposed=false,visible=true,paused=false,lost=false,raf=0,last=0,time=0;
  let pointerX=0,pointerY=0,cameraX=0,cameraY=0;
  const hero=host.closest<HTMLElement>('.hero')??host;
  const aim=(event:PointerEvent)=>{
    if(event.pointerType!=='mouse')return;
    const bounds=hero.getBoundingClientRect();
    pointerX=(event.clientX-bounds.left)/Math.max(1,bounds.width)-.5;
    pointerY=(event.clientY-bounds.top)/Math.max(1,bounds.height)-.5;
  };
  const center=()=>{pointerX=0;pointerY=0;};
  hero.addEventListener('pointermove',aim);
  hero.addEventListener('pointerleave',center);
  const resize=()=>{if(disposed)return;const {width,height}=host.getBoundingClientRect();renderer.setSize(Math.max(1,width),Math.max(1,height),false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const visibleObserver=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;schedule();});visibleObserver.observe(host);
  const pauseButton=document.querySelector<HTMLButtonElement>('#scene-pause');
  const toggle=()=>{paused=!paused;pauseButton?.setAttribute('aria-pressed',String(paused));if(pauseButton)pauseButton.textContent=paused?'Resume motion':'Pause motion';schedule();};
  pauseButton?.addEventListener('click',toggle);
  const canRun=()=>!disposed&&!lost&&visible&&!document.hidden&&!paused&&!document.querySelector('dialog[open]')&&governor.quality!=='fallback';
  function schedule(){cancelAnimationFrame(raf);last=0;if(canRun())raf=requestAnimationFrame(frame);}
  function frame(now:number){
    if(!canRun())return;
    const delta=last?now-last:16;last=now;time+=Math.min(delta,60)/1000;
    if(governor.sample(delta)){quality=governor.quality;host.dataset.quality=quality;renderer.setPixelRatio(Math.min(devicePixelRatio,qualitySettings[quality].dpr));geometry.setDrawRange(0,qualitySettings[quality].particles);status(quality==='fallback'?'Static armory / performance safeguard':quality+' atmosphere');if(quality==='fallback'){host.style.opacity='0';return;}}
    const progress=Math.min(1,window.scrollY/Math.max(1,innerHeight));
    const easing=1-Math.exp(-Math.min(delta,60)/180);
    cameraX+=(pointerX-cameraX)*easing;cameraY+=(pointerY-cameraY)*easing;
    camera.position.set(progress*.3+cameraX*.6,.2-progress*.15-cameraY*.3,8-progress*.5);
    camera.lookAt(0,0,-3);
    group.rotation.y=Math.sin(time*.1)*.015;particles.rotation.z=Math.sin(time*.045)*.022;
    renderer.render(scene,camera);raf=requestAnimationFrame(frame);
  }
  const contextLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(raf);host.dataset.quality='fallback';host.style.opacity='0';status('Static armory / graphics paused');};
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  document.addEventListener('visibilitychange',schedule);document.addEventListener('store:dialog',schedule);
  status(quality+' atmosphere');renderer.render(scene,camera);schedule();
  return ()=>{hero.removeEventListener('pointermove',aim);hero.removeEventListener('pointerleave',center);disposed=true;cancelAnimationFrame(raf);observer.disconnect();visibleObserver.disconnect();document.removeEventListener('visibilitychange',schedule);document.removeEventListener('store:dialog',schedule);pauseButton?.removeEventListener('click',toggle);renderer.domElement.removeEventListener('webglcontextlost',contextLost);edges.dispose();gold.dispose();geometry.dispose();material.dispose();markerGeometry.dispose();markerMaterial.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();host.style.opacity='';};
}
