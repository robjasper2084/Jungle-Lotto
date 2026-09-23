import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FootTraffic} from './footTraffic.ts';
import {MobilityRider} from './mobilityTraffic.ts';
import {HumanFallRig} from './humanFallRig.ts';
import {TrafficFall} from './trafficFall.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
const canvas=document.querySelector<HTMLCanvasElement>('#traffic')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
const scene=new T.Scene();scene.background=new T.Color('#53625e');
const camera=new T.PerspectiveCamera(36,innerWidth/innerHeight,.05,70);camera.position.set(0,1.7,6.3);
const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,1,0);orbit.enableDamping=true;orbit.minDistance=2.8;orbit.maxDistance=10;orbit.maxPolarAngle=Math.PI*.49;
scene.add(new T.HemisphereLight(0xe8f3ff,0x4a5540,2));
for(const [x,y,z,power] of [[3,5,4,3],[-3,3,-3,2]]){const light=new T.DirectionalLight(0xfff3de,power);light.position.set(x,y,z);light.castShadow=true;scene.add(light);}
const floor=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:'#78817a',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(60,60,0x91a498,0x687970);grid.position.y=.002;scene.add(grid);
const loader=new GLTFLoader(),data=await Promise.all(['DS_Hoodie_Man_01','DS_Hoodie_Woman_01'].map(id=>loader.loadAsync(`/exports/glb/${id}/${id}_LOD1.glb`)));
const scooterData=new Map(await Promise.all(['SW_Detroit_Tee_Rider','SW_Scooter_01'].map(async id=>[id,await loader.loadAsync(`/exports/scooter/${id}.glb`)] as const)));
let people:(FootTraffic|MobilityRider)[]=[],gait:'walk'|'jog'|'run'|'scooter'='walk',paused=false,last=performance.now();
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
let crashes:{motion:TrafficFall;rig:HumanFallRig}[]=[];const previewFollow=new T.Vector3();
const fallButton=document.createElement('button');fallButton.textContent='Impact / recover';
const impactSpeed=document.createElement('select');impactSpeed.setAttribute('aria-label','Impact speed');
for(const [value,label]of [['3','11 km/h'],['10','36 km/h'],['19','68 km/h']]){const option=document.createElement('option');option.value=value;option.textContent=label;impactSpeed.append(option);}impactSpeed.value='10';
document.querySelector('footer')!.prepend(fallButton,impactSpeed);
function impact(){for(const c of crashes)c.rig.restore();const speed=Number(impactSpeed.value);crashes=people.map(p=>({motion:new TrafficFall({x:0,y:0,z:0,heading:0,speed:1.1},{speed,vx:0,vz:speed*.5}),rig:new HumanFallRig(p.rider,p instanceof MobilityRider?p.root.children.filter(o=>o!==p.rider):[],flat)}));paused=false;}
fallButton.onclick=impact;
const phase=document.querySelector<HTMLInputElement>('#phase')!,pause=document.querySelector<HTMLButtonElement>('#pause')!;
function make(next:typeof gait){
  crashes=[];gait=next;for(const p of people){p.root.removeFromParent();if(p instanceof MobilityRider)p.dispose();}people=gait==='scooter'?[new MobilityRider('scooter',scooterData),new MobilityRider('scooter',scooterData)]:data.map(d=>new FootTraffic(d,gait!=='walk'));
  people.forEach((p,i)=>{p.root.position.x=(i-.5)*1.5;scene.add(p.root);});
  for(const id of ['walk','jog','run','scooter'])document.querySelector('#'+id)!.setAttribute('aria-pressed',String(gait===id));
  canvas.dataset.ready='true';canvas.dataset.gait=gait;
}
for(const id of ['walk','jog','run','scooter'] as const)document.querySelector<HTMLButtonElement>('#'+id)!.onclick=()=>make(id);
pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Resume':'Pause';};
phase.oninput=()=>{paused=true;pause.textContent='Resume';if(crashes.length){impact();paused=true;const age=Number(phase.value)*8;for(const c of crashes)for(let t=0;t<age;t+=1/120)c.motion.step(Math.min(1/120,age-t),flat);}else for(const p of people)p.phase=Number(phase.value);};
const views=document.querySelector<HTMLSelectElement>('#view')!;views.onchange=()=>{if(views.value==='orbit')return;const a=views.value==='rear'?Math.PI:views.value==='side'?Math.PI/2:0;camera.position.set(Math.sin(a)*6.3,1.7,Math.cos(a)*6.3).add(previewFollow);orbit.target.set(0,1,0).add(previewFollow);orbit.update();};orbit.addEventListener('start',()=>{views.value='orbit';});
make('walk');
function frame(now:number){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;
  if(crashes.length){for(const c of crashes){c.motion.step(paused?0:dt,flat);c.rig.apply(c.motion.pose,0);}phase.value=String(crashes[0].motion.age/8);canvas.dataset.fallPhase=crashes[0].motion.phase;
    if(crashes.every(c=>c.motion.done)&&!paused){for(const c of crashes)c.rig.restore();crashes=[];}
  }else{for(const p of people)p.apply(gait==='walk'?1.1:gait==='jog'?2.65:gait==='scooter'?4.2:3.8,paused?0:dt);phase.value=String(people[0].phase);canvas.dataset.fallPhase='none';}
  const focus=new T.Vector3();if(crashes.length){const p=crashes[0].motion.pose;focus.set(p.crashLateral,-.55*p.crashRelease*(1-p.crashRecovery),p.crashForward);}const shift=focus.clone().sub(previewFollow);camera.position.add(shift);orbit.target.add(shift);previewFollow.copy(focus);
  canvas.dataset.phase=String(people[0].phase);canvas.dataset.paused=String(paused);canvas.dataset.actors=JSON.stringify(people.map(p=>({asset:p.rider.children[0]?.name,footError:Math.max(...p.legs.map((l,i)=>l.end.getWorldPosition(new T.Vector3()).distanceTo(p.footTargets[i])))})));
  document.querySelector('#status')!.textContent=(crashes.length?'Impact · '+crashes[0].motion.phase:gait==='scooter'?'Detroit tee · electric scooter · 15.1 km/h':gait==='walk'?'Walk · 4.0 km/h':gait==='jog'?'Jog · 9.5 km/h':'Run · 13.7 km/h')+(paused?' · paused':'');orbit.update();renderer.render(scene,camera);
}
requestAnimationFrame(frame);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
