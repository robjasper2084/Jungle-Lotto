import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CompanionView} from './companionView.ts';
import {dogSteering} from './dogSteering.ts';
import {gaitCadence} from './dogGait.ts';
const canvas=document.querySelector<HTMLCanvasElement>('#companion')!,scene=new T.Scene();
scene.background=new T.Color('#a8b6ae');scene.fog=new T.Fog('#a8b6ae',12,35);
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;
const camera=new T.PerspectiveCamera(42,innerWidth/innerHeight,.01,80);camera.position.set(2.8,1.2,.2);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,.45,0);controls.update();
scene.add(new T.HemisphereLight('#eef2e9','#53604c',2));const sun=new T.DirectionalLight('#ffe6c1',2.5);sun.position.set(2,5,2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0001;sun.shadow.camera.left=sun.shadow.camera.bottom=-4;sun.shadow.camera.right=sun.shadow.camera.top=4;scene.add(sun,sun.target);
const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#71817a',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(100,200,'#65776d','#85998d');grid.position.y=.002;scene.add(grid);
const requestedLOD=Number(new URLSearchParams(location.search).get('lod')??1),lod=[0,1,2].includes(requestedLOD)?requestedLOD:1;
const dog=new CompanionView(new Map([['DS_Boerboel_01',await new GLTFLoader().loadAsync(`/exports/glb/DS_Boerboel_01/DS_Boerboel_01_LOD${lod}.glb`)]]));scene.add(dog.root);
canvas.dataset.lod=String(lod);
const pose={x:0,y:.015,z:0,heading:0,pitch:0,roll:0,speed:1,phase:0,time:0,turnRate:0,gaitSpeed:1,lookYaw:0};
const speed=document.querySelector<HTMLInputElement>('#speed')!,phase=document.querySelector<HTMLInputElement>('#phase')!,play=document.querySelector<HTMLButtonElement>('#play')!;
const turn=document.querySelector<HTMLSelectElement>('#turn')!;
let running=true,last=performance.now();
const rate=document.querySelector<HTMLSelectElement>('#rate')!,contacts=document.querySelector<HTMLInputElement>('#contacts')!;
const markers=dog.paws.map(()=>{const m=new T.Mesh(new T.CircleGeometry(.055,24),new T.MeshBasicMaterial({color:'#d9ff53',depthWrite:false}));m.rotation.x=-Math.PI/2;scene.add(m);return m;});
document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button=>{button.onclick=()=>{speed.value=button.dataset.speed!;};});
play.onclick=()=>{running=!running;play.textContent=running?'Pause':'Play';};
phase.oninput=()=>{running=false;play.textContent='Play';camera.position.sub(dog.root.position);controls.target.sub(dog.root.position);pose.time=0;pose.x=pose.z=0;pose.heading=0;pose.turnRate=0;pose.phase=Number(phase.value);};
document.querySelector<HTMLSelectElement>('#view')!.onchange=e=>{const view=(e.target as HTMLSelectElement).value;camera.position.set(view==='side'?2.8:0,1.2,view==='front'?2.8:view==='rear'?-2.8:.2);camera.position.z+=pose.z;controls.target.set(0,.45,pose.z);controls.update();};
function frame(now:number){
  requestAnimationFrame(frame);const dt=Math.min(.04,(now-last)/1000)*Number(rate.value);last=now;const z=pose.z,x=pose.x;
  if(running){
    const requested=Number(turn.value),desired=pose.heading+requested*.4;
    const steering=dogSteering(pose.heading,pose.speed,pose.turnRate,desired,Number(speed.value),dt);
    Object.assign(pose,steering);pose.phase+=gaitCadence(pose.gaitSpeed)*dt;
    pose.x+=Math.sin(pose.heading)*pose.speed*dt;pose.z+=Math.cos(pose.heading)*pose.speed*dt;pose.time+=dt;phase.value=String(pose.phase%1);
  }
  dog.apply(pose);camera.position.x+=pose.x-x;controls.target.x+=pose.x-x;camera.position.z+=pose.z-z;controls.target.z+=pose.z-z;controls.update();
  markers.forEach((m,i)=>{m.visible=contacts.checked&&dog.paws[i].contact>.75;m.position.copy(dog.paws[i].foot.getWorldPosition(new T.Vector3()));m.position.y=.006;});
  floor.position.x=Math.floor(pose.x/10)*10;grid.position.x=floor.position.x;sun.position.x=pose.x+2;sun.target.position.x=pose.x;
  floor.position.z=Math.floor(pose.z/10)*10;grid.position.z=Math.floor(pose.z/10)*10;sun.position.z=pose.z+2;sun.target.position.z=pose.z;
  renderer.render(scene,camera);document.querySelector('#readout')!.textContent=`${dog.gait.toUpperCase()} · ${pose.speed.toFixed(1)} m/s · ${(gaitCadence(pose.gaitSpeed)).toFixed(2)} strides/s`;
  canvas.dataset.pose=JSON.stringify(pose);
}
requestAnimationFrame(frame);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
