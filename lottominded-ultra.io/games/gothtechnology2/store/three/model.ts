import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Product } from '../commerce/types';
import { media } from '../utilities/paths';
export async function mountModel(host:HTMLElement,buttons:HTMLElement,path:string,product:Product,fallback:()=>void) {
  const url=new URL(media(path),location.origin);if(url.protocol!=='https:'&&url.origin!==location.origin)throw new Error('Unsafe model location');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  host.append(renderer.domElement);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.01,100);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=false;controls.minPolarAngle=.35;controls.maxPolarAngle=2.65;
  scene.add(new THREE.HemisphereLight(0xffffff,0x27202c,2));const light=new THREE.DirectionalLight(0xffedcf,3);light.position.set(3,5,6);scene.add(light);
  let object:THREE.Object3D|null=null,disposed=false;
  const render=()=>{if(!disposed&&!document.hidden)renderer.render(scene,camera);};
  const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(Math.max(1,width),Math.max(1,height),false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();render();};
  const observer=new ResizeObserver(resize);observer.observe(host);controls.addEventListener('change',render);
  const dispose=()=>{if(disposed)return;disposed=true;observer.disconnect();controls.dispose();object?.traverse(node=>{if(node instanceof THREE.Mesh){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];for(const mat of materials){for(const item of Object.values(mat))if(item instanceof THREE.Texture)item.dispose();mat.dispose();}}});renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  try {
    const gltf=await new GLTFLoader().loadAsync(url.href);object=gltf.scene;scene.add(object);
    const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());object.position.sub(center);
    const distance=Math.max(size.x,size.y,size.z)*2.25;camera.position.set(0,size.y*.05,distance);camera.far=Math.max(100,distance*10);camera.updateProjectionMatrix();controls.minDistance=distance*.55;controls.maxDistance=distance*1.8;controls.target.set(0,0,0);controls.update();
    const set=(view:string)=>{if(!object)return;if(view==='left')object.rotation.y-=Math.PI/8;if(view==='right')object.rotation.y+=Math.PI/8;if(view==='back')object.rotation.y=Math.PI;if(view==='front'||view==='reset')object.rotation.set(0,0,0);if(view==='detail')camera.position.set(0,0,distance*.6);else camera.position.set(0,size.y*.05,distance);controls.update();render();};
    buttons.addEventListener('click',event=>{const view=(event.target as Element).closest<HTMLElement>('[data-view]')?.dataset.view;if(view)set(view);});
    host.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','+','-'].includes(event.key)){event.preventDefault();if(event.key==='ArrowLeft')set('left');if(event.key==='ArrowRight')set('right');if(event.key==='Home')set('reset');if(event.key==='+'||event.key==='-'){camera.position.multiplyScalar(event.key==='+'?.9:1.1);camera.position.clampLength(controls.minDistance,controls.maxDistance);controls.update();render();}}});
    const hotspot=document.createElement('button');hotspot.className='text-button';hotspot.textContent='Material details';hotspot.addEventListener('click',()=>{const note=host.parentElement?.querySelector('[data-viewer-status]');if(note)note.textContent=product.materials+' '+product.finish;});buttons.append(hotspot);
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();dispose();},{once:true});
    document.addEventListener('visibilitychange',render);document.addEventListener('store:preferences',()=>{if(document.documentElement.dataset.reducedMotion==='true'){dispose();fallback();}});
    resize();return ()=>{document.removeEventListener('visibilitychange',render);dispose();};
  } catch(error){dispose();throw error;}
}
