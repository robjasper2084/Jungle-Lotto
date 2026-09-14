import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RideSimulation,CONFIG} from './ride-physics.mjs';
const $=id=>document.getElementById(id),canvas=$('world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const scene=new THREE.Scene();scene.background=new THREE.Color('#111a20');scene.fog=new THREE.FogExp2('#111a20',.025);const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.05,320);camera.position.set(-2.8,1.9,-4.8);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.06).texture;scene.environmentIntensity=.35;pmrem.dispose();scene.add(new THREE.HemisphereLight(0xa7c4d8,0x3d382b,1.2));
const moon=new THREE.DirectionalLight(0xb5cee8,2.1);moon.position.set(5,9,7);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-8;moon.shadow.camera.right=8;moon.shadow.camera.top=8;moon.shadow.camera.bottom=-8;moon.shadow.camera.far=35;moon.shadow.bias=-.0002;scene.add(moon,moon.target);
const amber=new THREE.DirectionalLight(0xffc881,1.7);amber.position.set(-4,3,-6);scene.add(amber,amber.target);
const loader=new GLTFLoader(),assets=new Map(),mixers=[];const sim=new RideSimulation();let runId=crypto.randomUUID(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;let ready=false,front=true,pausedByBlur=false,accumulator=0,prev=performance.now();const keys=new Set();let touchSteer=0,touchBrake=false;
const material=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});const asphalt=material('#171f1f',.7,0),concrete=material('#50534d'),steel=material('#293635',.48,.6),lineMat=material('#b09c65',.75);
const grain=document.createElement('canvas');grain.width=grain.height=256;const gc=grain.getContext('2d'),pixels=gc.createImageData(256,256);let seed=313;
for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=90+(seed%100);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}gc.putImageData(pixels,0,0);const grit=new THREE.CanvasTexture(grain);grit.wrapS=grit.wrapT=THREE.RepeatWrapping;grit.repeat.set(8,180);asphalt.map=grit;
function box(name,pos,size,mat){const o=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
box('Paved path',[0,-.12,-120],[6.1,.24,280],asphalt);
for(const side of [-1,1]){
 box('Retaining wall',[side*3.75,1.6,-120],[.32,3.2,280],concrete);box('Grass verge',[side*3.3,-.02,-120],[.5,.08,280],material('#343d2a'));
 for(let z=8;z>-260;z-=3){box('Railing post',[side*3.75,3.7,z],[.04,1,.04],steel);}
 for(let y of [3.35,4.15])box('Railing rail',[side*3.75,y,-120],[.045,.045,280],steel);
}
for(let z=5;z>-255;z-=3)box('Path center marking',[0,.009,z],[.045,.005,1.3],lineMat);
for(let z of [-58,-136,-212]){box('Bridge deck',[0,4.2,z],[10,.65,4],concrete);for(const side of [-1,1])box('Bridge support',[side*3.6,2,z],[.8,4,3.8],concrete);}
// Industrial silhouettes above the cut.
for(let i=0;i<35;i++){const z=12-i*8,side=i%2?1:-1,h=4+(i*7%9);box('Brick warehouse',[side*(9+(i%4)),h/2+3,z],[7,h,6],material(i%2?'#302c2a':'#252d30'));}
async function asset(id,lod=1){const data=await loader.loadAsync(`./exports/glb/${id}/${id}_LOD${lod}.glb`);assets.set(id,data);return data;}
function instance(id,animated=false){const data=assets.get(id);const o=animated?clone(data.scene):data.scene.clone(true);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;}});let mixer=null;if(animated&&data.animations.length){mixer=new THREE.AnimationMixer(o);mixer.clipAction(data.animations[0]).play();mixer.update(0);mixers.push(mixer);}return {object:o,mixer};}
const player=new THREE.Group();player.name='Digital_Static_Player';scene.add(player);let rider,euc,wheel,balance,riderMixer;const traffic=[];
function buildActors(){
 const e=instance('DS_EUC_01');euc=e.object;euc.rotation.y=Math.PI;player.add(euc);wheel=euc.getObjectByName('Wheel_Pivot');balance=euc.getObjectByName('Balance_Pivot');
 const h=instance('DS_Man_01',true);rider=h.object;riderMixer=h.mixer;rider.rotation.y=Math.PI;rider.position.y=.296;player.add(rider);
 const lamp=new THREE.SpotLight(0xd6edff,12,16,.42,.55,1.3);lamp.position.set(0,.7,-.25);lamp.target.position.set(0,0,-9);player.add(lamp,lamp.target);
 for(const o of sim.obstacles){const group=new THREE.Group();scene.add(group);let actor,bike=null;
  if(o.kind==='pedestrian'){actor=instance('DS_Pedestrian_01',true);group.add(actor.object);group.rotation.y=Math.atan2(o.vx,o.vz);}
  else if(o.kind==='cyclist'){actor=instance('DS_Cyclist_01',true);group.add(actor.object);bike=instance('DS_Bicycle_01',true);group.add(bike.object);}
  else {const id={cone:'DS_Hazard_Cone_01',barrier:'DS_Hazard_Barrier_01',rubble:'DS_Hazard_Rubble_01'}[o.kind];group.add(instance(id).object);}
  traffic.push({group,obstacle:o,bike});
 }
 for(let z=0;z>-250;z-=18){for(const side of [-1,1]){
  const light=instance('DS_Environment_Streetlight_01').object;light.position.set(side*3.35,0,z);light.scale.setScalar(.82);scene.add(light);
  const point=new THREE.PointLight(side<0?0xffc37c:0xd7e8eb,9,10,1.5);point.position.set(side*3.15,3.2,z);scene.add(point);
  const paint=instance('DS_Environment_Graffiti_01').object;paint.rotation.y=side>0?Math.PI/2:-Math.PI/2;paint.position.set(side*3.58,.4,z-7);paint.scale.setScalar(.9);scene.add(paint);
 }}
}
const wanted=['DS_Man_01','DS_EUC_01','DS_Pedestrian_01','DS_Cyclist_01','DS_Bicycle_01','DS_Hazard_Cone_01','DS_Hazard_Barrier_01','DS_Hazard_Rubble_01','DS_Environment_Streetlight_01','DS_Environment_Graffiti_01'];
try{await Promise.all(wanted.map(id=>asset(id,id==='DS_Man_01'?0:1)));buildActors();ready=true;$('loading').hidden=true;canvas.dataset.ready='true';canvas.dataset.hero='DS_Man_01';}catch(e){$('loading').textContent='Asset load failed: '+e.message;console.error(e);}
function start(){if(!ready)return;if(sim.finished||sim.health<=0)reset();sim.start();$('pause').textContent='Pause';front=false;$('view').textContent='Front view';$('intro').hidden=true;}
function reset(){void window.GothGameRewardFlush?.(rideStats());runId=crypto.randomUUID();sim.reset();for(let i=0;i<traffic.length;i++)traffic[i].obstacle=sim.obstacles[i];mixers.forEach(m=>m.setTime(0));$('intro').querySelector('h1').innerHTML='Keep your<br>own line.';$('intro').querySelector('p').textContent='A quiet ride below the city. Steer around pedestrians, passing bikes, and the rough edges of the path.';$('start').textContent='Start ride →';$('intro').hidden=false;front=true;$('pause').textContent='Pause';}
function togglePause(){if(!sim.started||sim.finished)return;sim.paused=!sim.paused;$('pause').textContent=sim.paused?'Resume':'Pause';}
$('start').onclick=start;$('pause').onclick=togglePause;$('view').onclick=()=>{front=!front;$('view').textContent=front?'Chase view':'Front view';};
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight',' ','Shift'].includes(e.key))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='Enter'&&!e.target.closest('button,a,input'))start();if(e.code==='KeyP')togglePause();if(e.code==='KeyR')reset();if(e.code==='ShiftLeft'||e.code==='ShiftRight')sim.dodge(keys.has('KeyA')||keys.has('ArrowLeft')?-1:1);});window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();touchSteer=0;touchBrake=false;if(sim.started&&!sim.paused){sim.paused=true;pausedByBlur=true;$('pause').textContent='Resume';}});
for(const [id,down,up] of [['left',()=>touchSteer=-1,()=>touchSteer=0],['right',()=>touchSteer=1,()=>touchSteer=0],['brake',()=>touchBrake=true,()=>touchBrake=false]]){const b=$(id);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);down();};b.onpointerup=b.onpointercancel=up;}
$('dodge').onclick=()=>sim.dodge(touchSteer||1);
function hud(){const d=Math.max(0,Math.min(250,-sim.z));$('distance').textContent=Math.floor(d)+' m';$('speed').textContent=Math.round(sim.speed*3.6)+' km/h';$('health').textContent='● '.repeat(Math.max(0,sim.health)).trim()||'—';$('progress').style.width=d/250*100+'%';$('status').textContent=sim.paused?'PAUSED':sim.eventTimer>0?sim.lastEvent:`${sim.passes} CLEAR PASSES / ${sim.cooldown>0?'DODGE RECHARGING':'DODGE READY'}`;
 const warn=sim.warning();$('warning').style.display=warn&&sim.started&&!sim.paused?'block':'none';if(warn)$('warning').textContent=`${warn.kind.toUpperCase()} AHEAD · ROOM TO THE ${warn.side.toUpperCase()}`;
 if(sim.finished||sim.health<=0){$('intro').hidden=false;$('intro').querySelector('h1').textContent=sim.finished?'The Cut is clear.':'Take a breath.';$('intro').querySelector('p').textContent=sim.finished?`You completed the 250 m passage with ${sim.passes} clear passes.`:'Brake early and give other path users room. Restart for another ride.';$('start').textContent='Ride again →';}
 canvas.dataset.distance=d.toFixed(2);canvas.dataset.health=sim.health;canvas.dataset.paused=String(sim.paused);canvas.dataset.finished=String(sim.finished);canvas.dataset.speed=sim.speed.toFixed(2);canvas.dataset.lateral=sim.x.toFixed(3);canvas.dataset.dodgeCooldown=sim.cooldown.toFixed(2);
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-prev)/1000,.1);prev=now;if(!ready){renderer.render(scene,camera);return;}const steer=touchSteer+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);const brake=touchBrake||keys.has('Space')||keys.has('KeyS')||keys.has('ArrowDown');accumulator+=dt;while(accumulator>=CONFIG.step){sim.step(CONFIG.step,{steer,brake});accumulator-=CONFIG.step;}
 const active=sim.started&&!sim.paused&&!sim.finished&&sim.health>0;for(const m of mixers)m.update(active?dt:(!sim.started&&!reducedMotion?dt:0));player.position.set(sim.x,0,sim.z);rider.rotation.z=THREE.MathUtils.lerp(rider.rotation.z,-sim.steering*.055,1-Math.exp(-dt*8));rider.position.x=sim.steering*.014;if(wheel)wheel.rotation.x=-sim.travel/.255;
 for(const t of traffic){t.group.position.set(t.obstacle.x,0,t.obstacle.z);if(t.obstacle.kind==='pedestrian')t.group.rotation.y=Math.atan2(t.obstacle.vx,t.obstacle.vz||.001);if(t.bike)for(const name of ['Bicycle_Front_Wheel_Pivot','Bicycle_Rear_Wheel_Pivot']){const w=t.bike.object.getObjectByName(name);if(w)w.rotation.x=-Math.abs(t.obstacle.z-t.obstacle.startZ)/.34;}}
 const desired=front?new THREE.Vector3(sim.x-1.0,1.62,sim.z-4.0):new THREE.Vector3(sim.x*.6,2.45,sim.z+4.8);camera.position.lerp(desired,reducedMotion?1:1-Math.exp(-dt*5));camera.lookAt(sim.x,front?1.25:1.0,sim.z+(front?0:-3));moon.position.set(sim.x+5,9,sim.z+7);moon.target.position.copy(player.position);amber.position.set(sim.x-4,3,sim.z-6);amber.target.position.copy(player.position);hud();renderer.render(scene,camera);}
requestAnimationFrame(frame);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

function rideStats(){return {runId,mode:!sim.started?'title':sim.finished?'won':sim.health<=0?'dead':sim.paused?'paused':'playing',seconds:sim.time,score:Math.floor(Math.max(0,Math.min(250,-sim.z)))*10+(sim.finished?1000:0)};}
window.RahbeArcadeGame={get ready(){return ready;},getStats:rideStats,pause(){if(sim.started&&!sim.finished){sim.paused=true;$('pause').textContent='Resume';}keys.clear();touchSteer=0;touchBrake=false;},applySettings(settings){reducedMotion=settings.reducedMotion===true;}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.RahbeArcadeGame.pause();});
