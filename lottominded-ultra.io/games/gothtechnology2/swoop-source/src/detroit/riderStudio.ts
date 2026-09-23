import {SPECIAL_MOVES} from './specialMoves.ts';
import {RideAudio} from './rideAudio.ts';
import {PedalSparks} from './pedalSparks.ts';
import {fallCameraOffset} from './fallMotion.ts';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Hero,loadActors} from './actors.ts';
import {RideController,NEUTRAL_ACTIONS,createPose,copyPose,lerpPose} from './controller.ts';
import {RIDE_TUNING} from './rideDynamics.ts';
import type {RideActions} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
import {RIDER_CHOICES,riderChoice} from './riderChoices.ts';
const canvas=document.querySelector<HTMLCanvasElement>('#studio')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.6;
const scene=new T.Scene();scene.background=new T.Color('#52615e');scene.fog=new T.Fog('#52615e',12,45);
const camera=new T.PerspectiveCamera(42,innerWidth/innerHeight,.05,100);camera.position.set(4.7,2.5,2.2);
const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,1.05,0);orbit.enableDamping=true;orbit.minDistance=2.5;orbit.maxDistance=9;orbit.maxPolarAngle=Math.PI*.48;
scene.add(new T.HemisphereLight(0xe8f3ff,0x586444,2));const key=new T.DirectionalLight(0xfff1d0,4);key.position.set(4,6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);scene.add(key,key.target);const fill=new T.DirectionalLight(0xaeddd9,2);fill.position.set(-3,3,-4);scene.add(fill,fill.target);
const floor=new T.Mesh(new T.PlaneGeometry(2000,2000),new T.MeshStandardMaterial({color:'#73817a',roughness:.85}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(2000,1000,0x839e92,0x687971);grid.position.y=.002;scene.add(grid);
const actorData=await loadActors();let selectedRider=riderChoice(null);
try{selectedRider=riderChoice(localStorage.getItem('digital-static-rider'));}catch{}
let hero=new Hero(actorData,undefined,selectedRider);scene.add(hero.root);document.querySelector<HTMLElement>('#loading')!.hidden=true;canvas.dataset.ready='true';
const riderSelect=document.querySelector<HTMLSelectElement>('#rider')!;
for(const r of RIDER_CHOICES){const o=document.createElement('option');o.value=r.id;o.textContent=r.label;riderSelect.append(o);}riderSelect.value=selectedRider;
riderSelect.onchange=()=>{selectedRider=riderChoice(riderSelect.value);hero.dispose();hero=new Hero(actorData,undefined,selectedRider);scene.add(hero.root);sim.wheelScale=hero.wheelScale;updateRiderActions();try{localStorage.setItem('digital-static-rider',selectedRider);}catch{}};
let crashTest=false;
const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.surface='pavement';out.offCourse=false;Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>crashTest?.2:null};
const sim=new RideController(flat),current=createPose(),previous=createPose(),renderPose=createPose();
const names:Record<string,string>={reverse:'Reverse • brake, release, ride back',pivot:'Slow turn • body pivot and forward knees',neutral:'Balance • relaxed knees',drive:'Accelerate • lean and drive',brake:'Brake • sit back and absorb',carve:'Carve • lean, counterbalance and look ahead',tuck:'Crouch • preload, then stand',air:'Hop / land • compress, extend, float, absorb'};
for(const m of SPECIAL_MOVES){const name='trick'+m.id;names[name]=m.name+' · preload, balance, settle';const b=document.createElement('button');b.dataset.pose=name;b.textContent=m.name;document.querySelector('#play')!.before(b);}
names.fall='Fall / recover • brace, separate, impact, slide';
const entries=['neutral','drive','carve','brake','tuck','air','reverse','pivot'],step=1/120,duration=6;
for(const [id,label] of [['seat','Seated ride'],['stop','One-foot stop'],['scrape','Pedal scrape'],['beeps','Warning beeps']]){names[id]=label;const b=document.createElement('button');b.dataset.pose=id;b.textContent=label;document.querySelector('#play')!.before(b);}
const rideAudio=new RideAudio(),sparks=new PedalSparks(scene),sound=document.createElement('button');sound.textContent='Sound off';sound.onclick=()=>{void rideAudio.enable(!rideAudio.enabled);sound.textContent=rideAudio.enabled?'Sound on':'Sound off';};document.querySelector('#play')!.before(sound);
let selected='carve',playing=true,paused=false,elapsed=0,acc=0,last=performance.now(),cameraLast=new T.Vector3(),studioView='side',playbackRate=1;
orbit.addEventListener('start',()=>{studioView='orbit';document.querySelector<HTMLSelectElement>('#view')!.value='orbit';});
const timeline=document.querySelector<HTMLInputElement>('#timeline')!,pauseButton=document.querySelector<HTMLButtonElement>('#freeze')!;
function inputs(t:number):RideActions{
  if(selected==='seat')return {...NEUTRAL_ACTIONS,throttle:Math.max(-.3,Math.min(.7,(5-current.speed)*.55)),seated:t>.5&&t<4.8,steer:Math.sin(t)*.13};
  if(selected==='scrape')return {...NEUTRAL_ACTIONS,throttle:.7,steer:t<2.5?1:0};
  if(selected==='beeps')return {...NEUTRAL_ACTIONS,throttle:t<4?1:-1};
  if(selected.startsWith('trick'))return {...NEUTRAL_ACTIONS,trick:t>=.25&&t<.25+step?Number(selected.slice(-1)):0};
  const cruise=Math.max(-.3,Math.min(.7,(7-current.speed)*.55));
  return {...NEUTRAL_ACTIONS,throttle:selected==='reverse'?(t<1.8?-1:t<2.1?0:-.65):selected==='pivot'?Math.max(-.3,Math.min(.55,(1.4-current.speed)*.8)):selected==='drive'?(t<4?.85:0):selected==='brake'?-1:['carve','tuck','air'].includes(selected)?cruise:0,
    steer:selected==='pivot'?.8:selected==='carve'?Math.sin(t*1.4)*.85:0,
    crouch:selected==='tuck'?t<2.8:selected==='air'?t<.9:false,
    hop:selected==='air'&&t>=.9&&t<.94,hopHeld:selected==='air'&&t>=.9&&t<.94,reset:selected==='fall'&&t>=4&&t<4+step};
}
function resetSimulation(){
  sim.wheelScale=hero.wheelScale;
  crashTest=false;
  sim.reset({position:{x:0,y:0,z:0},headingY:0});
  if(['reverse','brake','carve','tuck','air','fall'].includes(selected))for(let i=0;i<200;i++)sim.step(step,{...NEUTRAL_ACTIONS,throttle:.65});
  if(selected.startsWith('trick')&&!['trick5','trick6'].includes(selected))for(let i=0;i<85;i++)sim.step(step,{...NEUTRAL_ACTIONS,throttle:.55});
  if(['scrape','beeps'].includes(selected))for(let i=0;i<1100;i++)sim.step(step,{...NEUTRAL_ACTIONS,throttle:.9});
  sparks.reset();
  sim.writePose(current);copyPose(current,previous);copyPose(current,renderPose);elapsed=0;acc=0;
  camera.position.sub(cameraLast);cameraLast.set(current.x,current.y,current.z);camera.position.add(cameraLast);orbit.target.copy(cameraLast).add(new T.Vector3(0,hero.motionScale<1?.7:1.05,0));orbit.update();
}
function choose(name:string){
  selected=name;resetSimulation();document.querySelector('#status')!.textContent=names[name];
  document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pose===name)));
}
function updateRiderActions(){const mascot=selectedRider.startsWith('DS_Mascot_'),button=document.querySelector<HTMLButtonElement>('[data-pose="stop"]')!;button.disabled=mascot;button.title=mascot?'Mascots keep both feet on the pedals':'Plant one boot at a stop';if(mascot&&selected==='stop')choose('neutral');}
// A short synthetic contact starts the preview; no invisible wall persists through the slide.
function tick(){crashTest=selected==='fall'&&elapsed>=1&&elapsed<1.05;copyPose(current,previous);sim.step(step,inputs(elapsed));sim.writePose(current);elapsed+=step;}
document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(b=>b.onclick=()=>{playing=false;paused=false;pauseButton.textContent='Pause motion';document.querySelector('#play')!.textContent='Play sequence';choose(b.dataset.pose!);});
document.querySelector<HTMLButtonElement>('#play')!.onclick=()=>{playing=!playing;paused=false;pauseButton.textContent='Pause motion';document.querySelector('#play')!.textContent=playing?'Stop sequence':'Play sequence';};
pauseButton.onclick=()=>{paused=!paused;pauseButton.textContent=paused?'Resume motion':'Pause motion';rideAudio.update(renderPose,!paused);};
document.addEventListener('visibilitychange',()=>{if(document.hidden)rideAudio.update(renderPose,false);});
timeline.oninput=()=>{const seek=Number(timeline.value);paused=true;pauseButton.textContent='Resume motion';resetSimulation();while(elapsed<seek-step*.5)tick();copyPose(current,renderPose);};
document.querySelector<HTMLSelectElement>('#rate')!.onchange=e=>{playbackRate=Number((e.target as HTMLSelectElement).value);};
document.querySelector<HTMLSelectElement>('#view')!.onchange=e=>{
  const value=(e.target as HTMLSelectElement).value,angle=current.headingY+(value==='side'?Math.PI/2:value==='rear'?Math.PI:0);
  studioView=value;
  camera.position.set(current.x+Math.sin(angle)*5.3,current.y+2.3,current.z+Math.cos(angle)*5.3);orbit.target.set(current.x,current.y+(hero.motionScale<1?.7:1.05),current.z);orbit.update();
};
choose('carve');updateRiderActions();document.querySelector('#play')!.textContent='Stop sequence';
function frame(now:number){requestAnimationFrame(frame);const dt=Math.min(.06,(now-last)/1000);last=now;
  if(!paused){acc+=dt*playbackRate;while(acc>=step){tick();acc-=step;if(elapsed>=duration){if(playing)choose(entries[(entries.indexOf(selected)+1)%entries.length]);else resetSimulation();}}
    lerpPose(previous,current,acc/step,renderPose);
  }else copyPose(current,renderPose);
  hero.apply(renderPose);
  rideAudio.update(renderPose,!paused&&!document.hidden);sparks.update(dt*playbackRate,renderPose,!paused);
  canvas.dataset.rideFeedback=JSON.stringify({seated:renderPose.seated,stopFoot:renderPose.stopFoot,scrape:renderPose.scrape,warningLevel:renderPose.warningLevel,beepPulse:renderPose.beepPulse,audio:rideAudio.state});
  canvas.dataset.hero=selectedRider;canvas.dataset.trick=JSON.stringify(sim.tricks.snapshot());
  const fall=fallCameraOffset(renderPose);
  const position=new T.Vector3(renderPose.x+fall.x,renderPose.y+fall.y,renderPose.z+fall.z),delta=position.clone().sub(cameraLast);camera.position.add(delta);orbit.target.add(delta);cameraLast.copy(position);
  if(studioView!=='orbit'){
    const a=renderPose.headingY+(studioView==='side'?Math.PI/2:studioView==='rear'?Math.PI:0);
    camera.position.set(position.x+Math.sin(a)*5.3,position.y+2.3,position.z+Math.cos(a)*5.3);orbit.target.copy(position).add(new T.Vector3(0,hero.motionScale<1?.7:1.05,0));
  }
  key.position.copy(position).add(new T.Vector3(4,6,5));key.target.position.copy(position);fill.position.copy(position).add(new T.Vector3(-3,3,-4));fill.target.position.copy(position);
  orbit.update();renderer.render(scene,camera);
  timeline.value=String(elapsed);
  const state=sim.snapshot(),feet=Math.max(...hero.legs.map((l,i)=>l.foot.getWorldPosition(new T.Vector3()).distanceTo(hero.footTarget(i,renderPose))));
  document.querySelector('#readout')!.textContent=Math.round(Math.abs(current.speed)*3.6)+' km/h · '+state.state+' · '+elapsed.toFixed(2)+' s';
  Object.assign(canvas.dataset,{controller:RIDE_TUNING.version,pose:selected,footError:String(feet),speed:String(current.speed),fallPhase:state.fallPhase,phase:state.state,airHeight:String(current.airHeight),compression:String(current.landingCompression),roll:String(current.rollAngle),lean:String(current.riderPitch),hops:String(state.hops),landings:String(state.landings),paused:String(paused),weightShift:String(current.weightShift),traction:String(current.tractionUsage),yawRate:String(current.yawRate)});
  Object.assign(canvas.dataset,{bodyDrop:String(current.bodyDrop),bodyPitch:String(current.bodyPitch),bodyTwist:String(current.bodyTwist),bodyLook:String(current.bodyLook),handL:String([current.handLX,current.handLY,current.handLZ]),handR:String([current.handRX,current.handRY,current.handRZ]),spineJoints:String(hero.spine.length),playbackRate:String(playbackRate),neckJoint:hero.neck?.name,shoulderJoints:String(hero.shoulders.length),hipYaw:String(current.bodyHipYaw),armBank:String(current.armBank),rigRevision:'anatomical-road-posture-v3'});
}
requestAnimationFrame(frame);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});




