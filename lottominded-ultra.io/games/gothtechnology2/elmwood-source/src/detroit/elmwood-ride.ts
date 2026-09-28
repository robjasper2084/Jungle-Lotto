import * as T from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RIDECORE,SPECIAL_MOVES} from '@digital-static/ridecore';
import {RideAudio} from '@digital-static/ridecore/audio';
import {ThreeRiderView} from '@digital-static/ridecore/three';
import {createRideCoreRiders,SWOOP_RIDERS} from './ridecore-riders.ts';
import {createGroundSample} from '../simulation/world.ts';
import {loadCircuitRiders} from './circuit-rider.ts';
import {loadActors} from './actors.ts';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {RideMotion} from './ride-motion.ts';
import {chooseElmwoodSpawn} from './elmwood-details.ts';
import {ELMWOOD_CAMERAS,cameraMode,nextElmwoodCamera,cameraFrame,frameElmwoodCamera,clearElmwoodCamera} from './elmwood-camera.ts';
import {ElmwoodSessionInput,setupError,type Binding,type Action} from './elmwood-session-input.ts';
import {ElmwoodRun,laneGates,MODES,type RunMode} from './elmwood-gameplay.ts';
import {ElmwoodCompanion,type DogTarget} from './elmwood-companion.ts';
import {makeElmwoodMainMenu} from './elmwood-main-menu.ts';
import {makeElmwoodSpirits} from './elmwood-spirits.ts';
import {dogControls} from './elmwood-dog-controls.ts';
import {makeElmwoodWalkers} from './elmwood-walkers.ts';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {DogView} from './dog-view.ts';
import {Soundtrack} from './elmwood-soundtrack.ts';
import {makeDuoTouch} from './elmwood-duo-touch.ts';
import './elmwood-session.css';

type Spawn={x:number;north:number;heading:number};
type Seat={motion:RideMotion;riders:Map<string,ThreeRiderView>;hero:ThreeRiderView;camera:T.PerspectiveCamera;lastCamera:string;framing:ReturnType<typeof cameraFrame>;droneTarget:T.Vector3;firstYaw:number;firstPitch:number;run:ElmwoodRun;spawn:Spawn;dog?:ElmwoodCompanion;dogView?:DogView;bestRecorded:boolean};
export function splitRects(w:number,h:number,count:number,layout:string){
  if(count===1)return [{x:0,y:0,width:w,height:h}];
  const vertical=layout==='stacked'||layout==='auto'&&h>w;
  return vertical?[{x:0,y:0,width:w,height:Math.floor(h/2)},{x:0,y:Math.floor(h/2),width:w,height:h-Math.floor(h/2)}]:[{x:0,y:0,width:Math.floor(w/2),height:h},{x:Math.floor(w/2),y:0,width:w-Math.floor(w/2),height:h}];
}
export function makeElmwoodRide(scene:T.Scene,camera:T.PerspectiveCamera,controls:OrbitControls,canvas:HTMLCanvasElement,status:(s:string)=>void,showSite:()=>void,birdTargets:()=>DogTarget[]=()=>[]) {
  const el=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
  const button=el<HTMLButtonElement>('ride-start'),outfit=el<HTMLSelectElement>('ride-outfit'),cameraSelect=el<HTMLSelectElement>('ride-camera'),cameraButton=el<HTMLButtonElement>('ride-camera-next');
  const settings=document.createElement('section');settings.id='elmwood-session-settings';settings.innerHTML=`<h2 style="font-size:16px">Ride together</h2>
    <label for="session-players">Players</label><select id="session-players"><option value="1">Solo ride</option><option value="2">2 players · local split screen</option></select>
    <label for="session-layout">Split layout</label><select id="session-layout"><option value="auto">Automatic</option><option value="side">Side by side</option><option value="stacked">Top and bottom</option></select>
    <label for="session-input-0">Player 1 controls</label><select id="session-input-0"></select>
    <div id="session-player-two"><label for="session-input-1">Player 2 controls</label><select id="session-input-1"></select><label for="session-outfit-1">Player 2 rider</label><select id="session-outfit-1"></select><label for="session-camera-1">Player 2 camera</label><select id="session-camera-1"></select><button id="session-recover-1">Recover player 2</button></div>
    <button id="session-touch-edit">Arrange split-screen touch controls</button>
    <label for="session-dog">Boerboel companion</label><select id="session-dog"><option value="off">Off</option><option value="p1">Run with player 1</option><option value="p2">Run with player 2</option><option value="both">One dog per rider</option></select>
    <label for="session-mode">Game mode</label><select id="session-mode"></select><button id="session-retry">Start / retry selected mode</button>
    <label for="session-trick">Trick</label><select id="session-trick"></select><div class="row"><button id="session-trick-go">Perform trick · T</button><button id="session-cruise">Cruise · V</button></div>
    <button id="session-map">Route map · M</button><label><input id="session-audio" type="checkbox"> Motor and warning sounds</label>
    <label><input id="session-spirits" type="checkbox" checked> Rare ghost encounters · 1–2 per ride</label><label><input id="session-spirit-sound" type="checkbox"> Ghost sound</label>
    <p id="session-message" role="status"></p><p id="session-best"></p>
    <details id="session-help"><summary>Keyboard, gamepad &amp; touch help</summary><p>P1: WASD, Space hop, left Shift crouch, R recover, C camera, T trick, V cruise.<br>P2: arrows, Enter hop, right Shift crouch, Backspace recover, / camera, . trick, ' cruise.<br>P pauses both players. Escape stops the ride. M opens the route map.</p><p>Gamepad: left stick steer/ride, RT accelerate, LT brake, A hop, B crouch, X trick, Y camera, LB recover, RB cruise, Start pause. Assign a different controller to each player. Release the sticks and buttons before resuming.</p><p>Touch: each player has their own floating joystick and buttons. Arrange controls to move, resize or assign them. Split layouts save separately for each player and orientation.</p><p>Free ride and challenges use the existing mapped lanes. The sprint starts at the south end of Creek Lane. Racers pass through one another. Swoop's shops and freestyle park remain available through Return to Swoop Detroit.</p></details>`;
  outfit.closest('aside')!.prepend(settings);
  const players=el<HTMLSelectElement>('session-players'),layout=el<HTMLSelectElement>('session-layout'),mode=el<HTMLSelectElement>('session-mode'),trick=el<HTMLSelectElement>('session-trick'),dogSelect=el<HTMLSelectElement>('session-dog'),soundToggle=el<HTMLInputElement>('session-audio');
  const inputs=[el<HTMLSelectElement>('session-input-0'),el<HTMLSelectElement>('session-input-1')],outfits=[outfit,el<HTMLSelectElement>('session-outfit-1')],cameras=[cameraSelect,el<HTMLSelectElement>('session-camera-1')];
  for(let i=0;i<2;i++){
    inputs[i].replaceChildren(...[['wasd','Keyboard · WASD'],['arrows','Keyboard · arrows'],['touch','Touch controls'],...Array.from({length:4},(_,j)=>['pad:'+j,'Gamepad '+(j+1)])].map(([v,l])=>new Option(l,v)));inputs[i].value=i?'arrows':'wasd';
    cameras[i].replaceChildren(...ELMWOOD_CAMERAS.map(([v,l])=>new Option(l,v)));
  }
  for(const r of SWOOP_RIDERS)outfit.add(new Option(r.label,r.id));
  outfits[1].replaceChildren(...[...outfit.options].map(o=>new Option(o.text,o.value)));outfits[1].value='original';
  mode.replaceChildren(...MODES.map(([v,l])=>new Option(l,v)));trick.replaceChildren(...SPECIAL_MOVES.map(t=>new Option(t.name+' · below '+Math.round(t.maxSpeed*3.6)+' km/h',String(t.id))));
  try{cameraSelect.value=cameraMode(localStorage.getItem('elmwood-riding-camera'));dogSelect.value=localStorage.getItem('elmwood-companion')||'off';}catch{}
  const message=el('session-message'),best=el('session-best'),input=new ElmwoodSessionInput(),audio=new RideAudio(),music=new Soundtrack(settings);
  const hud=[0,1].map(i=>{const h=document.createElement('div');h.className='session-hud';h.dataset.seat=String(i);h.hidden=true;document.body.append(h);return h;});
  const divider=document.createElement('div');divider.id='split-divider';divider.hidden=true;document.body.append(divider);
  const map=document.createElement('section');map.id='elmwood-route-map';map.hidden=true;map.innerHTML='<strong>Elmwood route map</strong><p>Gold: player 1 · Blue: player 2 · Green: Creek Lane</p><svg aria-label="Mapped lanes and rider positions" role="img"></svg><button>Close map</button>';document.body.append(map);map.querySelector('button')!.onclick=()=>{map.hidden=true;canvas.focus();};
  const seats:Seat[]=[],sample=createGroundSample(),direction=new T.Vector3(),anchor=new T.Vector3(),previousOrbitTarget=new T.Vector3(),orbitDelta=new T.Vector3();
  const orbitDefaults={enablePan:controls.enablePan,minDistance:controls.minDistance,maxDistance:controls.maxDistance,minPolarAngle:controls.minPolarAngle,maxPolarAngle:controls.maxPolarAngle};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const spirits=makeElmwoodSpirits(scene),spiritToggle=el<HTMLInputElement>('session-spirits'),spiritSound=el<HTMLInputElement>('session-spirit-sound');
  try{spiritToggle.checked=localStorage.getItem('elmwood-spirits')!=='off';}catch{}
  spiritToggle.onchange=()=>{try{localStorage.setItem('elmwood-spirits',spiritToggle.checked?'on':'off');}catch{}if(!spiritToggle.checked)spirits.hide();};
  spiritSound.onchange=()=>{if(spiritSound.checked)void spirits.unlockSound().catch(()=>{spiritSound.checked=false;message.textContent='Ghost sound is unavailable in this browser.';});};
  const gates=new T.Group();gates.name='Elmwood challenge checkpoint';scene.add(gates);
  const markers=[0xedcf85,0x83d9ff].map(color=>{const marker=new T.Group(),mat=new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});
    for(const side of [-1,1]){const post=new T.Mesh(new T.CylinderGeometry(.07,.07,2,6),mat);post.position.set(side*2,1,0);marker.add(post);}const bar=new T.Mesh(new T.BoxGeometry(4.1,.08,.08),mat);bar.position.y=2;marker.add(bar);marker.visible=false;gates.add(marker);return marker;});
  let active=false,paused=false,count=1,orbitFov=camera.fov,terrain:ElmwoodTerrain|undefined,countdown=0,hudClock=0,initializing:Promise<void>|undefined,dogAsset:GLTF|undefined,dogLoading:Promise<void>|undefined;
  let route:ReturnType<typeof laneGates>=[],walkers:ReturnType<typeof makeElmwoodWalkers>|undefined;
  const targets=()=>[...birdTargets(),...(walkers?.targets??[])];
  const dogThreats=()=>active?seats.slice(0,count).filter((s,i)=>wantsDog(i)&&s.dog&&s.dogView?.root.visible).map(s=>({x:s.dog!.x,z:s.dog!.z,chasing:s.dog!.command==='chase'||s.dog!.barking>0})):[];
  const commands=dogControls(settings,(command,recipient,target)=>{const selected=seats.slice(0,count).filter((s,i)=>s.dog&&wantsDog(i)&&(recipient==='both'||recipient===(i?'p2':'p1')));if(!selected.length)return 'Enable a Boerboel for the selected player first.';for(const s of selected)s.dog!.order(command,targets(),target);return selected.map(s=>s.dog!.note).join(' · ');},()=>active&&!paused);
  const pads=()=>Array.from(navigator.getGamepads?.()??[]);
  const rects=()=>splitRects(innerWidth,innerHeight,active?count:Number(players.value),layout.value);
  const touch=makeDuoTouch(canvas,rects,()=>pause(true));el<HTMLButtonElement>('session-touch-edit').onclick=()=>{if(players.value!=='2'){players.value='2';settingsChanged();}touch.edit();};
  function clearInput(){input.clear();for(const s of seats)s.motion.clearPendingInput();canvas.dispatchEvent(new Event('elmwood-clear-input'));}
  function configure(){input.configure(inputs.slice(0,count).map(e=>e.value as Binding));}
  function settingsChanged(){if(active)stop();el('session-player-two').hidden=players.value!=='2';layout.disabled=players.value!=='2';canvas.dataset.players=players.value;canvas.dataset.splitLayout=layout.value;touch.update();message.textContent='Press Ride Elmwood to use these controls.';}
  players.onchange=settingsChanged;inputs.forEach(e=>e.onchange=settingsChanged);layout.onchange=()=>{canvas.dataset.splitLayout=layout.value;clearInput();touch.update();};settingsChanged();
  function refreshPads(){const list=pads();for(const select of inputs)for(let j=0;j<4;j++){const p=list.find(p=>p?.index===j&&p.connected);select.querySelector<HTMLOptionElement>(`option[value="pad:${j}"]`)!.textContent='Gamepad '+(j+1)+(p?' · '+p.id.slice(0,35):' · press a button to connect');}}
  addEventListener('gamepadconnected',refreshPads);addEventListener('gamepaddisconnected',()=>{refreshPads();if(active&&inputs.slice(0,count).some(e=>e.value.startsWith('pad:'))){pause(true);message.textContent='Controller disconnected. Reconnect or choose a different input.';}});refreshPads();
  async function initialize(){
    if(terrain)return;if(initializing)return initializing;
    initializing=(async()=>{
      status('Loading your riders…');const [data,grid,site,placements,original]=await Promise.all([loadCircuitRiders(),fetch('/elmwood/terrain.json').then(r=>r.json()),fetch('/elmwood/site.json').then(r=>r.json()),fetch('/elmwood/placements.json').then(r=>r.json()),loadActors(['DS_Man_01','DS_EUC_01','DS_Pedestrian_01','DS_Cyclist_01','DS_Bicycle_01',...SWOOP_RIDERS.map(r=>r.id)])]);
      const mapTerrain=new ElmwoodTerrain(grid,site.features,placements);await mapTerrain.init();terrain=mapTerrain;
      walkers=makeElmwoodWalkers(scene,terrain,original);walkers.root.visible=false;
      route=laneGates(terrain.features.find(f=>f.id==='59197492')!.points);
      for(let i=0;i<2;i++){
        const motion=new RideMotion(terrain),riders=createRideCoreRiders(original,data,motion.terrain),hero=riders.get(outfits[i].value)!;
        for(const view of riders.values()){view.root.visible=false;scene.add(view.root);}
        seats.push({motion,riders,hero,camera:i?camera.clone():camera,lastCamera:'',framing:cameraFrame(),droneTarget:new T.Vector3(),firstYaw:0,firstPitch:-.10,run:new ElmwoodRun(route),spawn:{x:0,north:0,heading:0},bestRecorded:false});
      }
      Object.assign(canvas.dataset,{motionBrand:RIDECORE.name,rideCoreVersion:RIDECORE.version,controller:RIDECORE.name+' '+RIDECORE.version,engine:RIDECORE.sourceMotion});
      const svg=map.querySelector('svg')!;svg.setAttribute('viewBox',`${grid.x0-20} ${-grid.y0-20} ${(grid.width-1)*grid.spacing+40} ${(grid.height-1)*grid.spacing+40}`);
      svg.innerHTML=terrain.features.filter(f=>f.kind==='path').map(f=>`<polyline points="${f.points.map(p=>p[0]+','+-p[1]).join(' ')}" fill="none" stroke="${f.id==='59197492'?'#72d3a8':'#829f94'}" stroke-width="${f.id==='59197492'?4:2}"/>`).join('')+'<circle id="route-p1" r="8" fill="#edcf85"/><circle id="route-p2" r="8" fill="#83d9ff"/>';
    })();try{await initializing;}finally{initializing=undefined;}
  }
  function wantsDog(i:number){return dogSelect.value==='both'||dogSelect.value===(i?'p2':'p1');}
  async function updateDogs(){
    try{
      if(dogSelect.value!=='off'&&terrain&&!dogAsset){
        if(!dogLoading)dogLoading=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb`).then(a=>{dogAsset=a;}).finally(()=>{dogLoading=undefined;});
        await dogLoading;
      }
      if(!terrain)return;
      for(let i=0;i<seats.length;i++){const s=seats[i];if(wantsDog(i)&&dogAsset&&!s.dog){s.dog=new ElmwoodCompanion(terrain);s.dog.side=i===1?-1:1;s.dogView=new DogView(dogAsset,i===1?'chestnut':'fawn');scene.add(s.dogView.root);s.dog.reset(s.motion.pose);s.dogView.update(s.dog,0);}if(s.dogView)s.dogView.root.visible=active&&i<count&&wantsDog(i);}
    }catch(e){message.textContent='The companion could not load. Choose the option again to retry.';console.error(e);}
  }
  dogSelect.onchange=()=>{try{localStorage.setItem('elmwood-companion',dogSelect.value);}catch{}void updateDogs();};
  function resetSeat(i:number,recover=false){
    const s=seats[i];if(!s||!terrain)return;
    let spawn=s.spawn;
    if(recover){const p=s.motion.pose,near=terrain.nearest(p.x,-p.z);spawn={x:near.x,north:near.north,heading:p.headingY};if(s.run.mode==='sprint')s.run.elapsed+=5;}
    const side=count===2?(i?-.65:.65):0;
    const x=spawn.x+Math.cos(spawn.heading)*side,z=-spawn.north-Math.sin(spawn.heading)*side;
    s.motion.setProfile(s.hero.profile);s.motion.reset({x,y:terrain.sampleGround(x,z,sample).height,z},spawn.heading);s.lastCamera='';
    input.seats[i].clear();s.dog?.reset(s.motion.pose);s.run.relocate(s.motion.pose);
  }
  function startMode(){
    if(!active)return;clearInput();const selected=mode.value as RunMode;
    spirits.reset();
    if(selected==='sprint'||selected==='tour'){
      const a=route[0],b=route[1],heading=Math.atan2(b.x-a.x,b.z-a.z);
      seats.forEach(s=>s.spawn={x:a.x,north:-a.z,heading});
    }
    for(let i=0;i<count;i++){resetSeat(i);seats[i].run.reset(selected,seats[i].motion.pose);seats[i].bestRecorded=false;}
    countdown=selected==='sprint'?3:0;paused=false;canvas.dataset.paused='false';best.textContent='';message.textContent=selected==='free'?'Free ride: explore, cruise or practice tricks.':selected==='tricks'?'Land completed tricks to score. Both players have two minutes.':'Follow the colored gates along Creek Lane.';canvas.focus();
  }
  function stop(){
    if(!active)return;active=false;commands.stop();spirits.hide();if(walkers)walkers.root.visible=false;clearInput();Object.assign(controls,orbitDefaults);controls.enabled=true;controls.enableDamping=true;
    camera.fov=orbitFov;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();button.textContent='Ride Elmwood';canvas.dataset.riding='false';
    for(const s of seats){s.hero.root.visible=false;if(s.dogView)s.dogView.root.visible=false;}hud.forEach(h=>h.hidden=true);markers.forEach(m=>m.visible=false);divider.hidden=true;document.body.classList.remove('duo-riding');music.update(0,'ride',false,0,0,0);if(seats[0])audio.update(seats[0].motion.pose,false);touch.update();
  }
  function pause(value=!paused){
    if(!active)return;
    if(!value){const error=setupError(inputs.slice(0,count).map(e=>e.value as Binding),pads());if(error){message.textContent=error;return;}}
    paused=value;if(paused)commands.stop();clearInput();canvas.dataset.paused=String(paused);canvas.focus();
  }
  async function toggleRide(){
    if(active){stop();status('Orbit review · choose a landmark or start another ride.');return;}
    count=Number(players.value);const error=setupError(inputs.slice(0,count).map(e=>e.value as Binding),pads());if(error){message.textContent=error;status(error);return;}
    button.disabled=true;music.unlock();
    try{
      await initialize();camera.getWorldDirection(direction);const spawn=chooseElmwoodSpawn(terrain!.segments,controls.target.x,-controls.target.z,direction);showSite();
      configure();orbitFov=camera.fov;controls.enableDamping=false;controls.update();controls.enabled=false;
      for(let i=0;i<count;i++){const s=seats[i];s.hero=s.riders.get(outfits[i].value)!;s.hero.root.visible=true;s.spawn={...spawn};}
      active=true;paused=false;if(walkers)walkers.root.visible=true;Object.assign(canvas.dataset,{riding:'true',players:String(count),paused:'false'});button.textContent='Stop riding';document.body.classList.toggle('duo-riding',count===2);startMode();void updateDogs();touch.update();canvas.focus();
    }catch(e){stop();status('Could not start the ride: '+String(e));console.error(e);}finally{button.disabled=false;}
  };
  button.onclick=()=>void toggleRide();
  const mainMenu=makeElmwoodMainMenu(canvas,()=>pause(true),()=>pause(false),async(selected,n)=>{document.body.classList.remove('controls-open');document.getElementById('elmwood-menu')?.setAttribute('aria-expanded','false');if(active)stop();players.value=String(n);mode.value=selected;settingsChanged();await toggleRide();},()=>{document.body.classList.add('controls-open');document.getElementById('elmwood-menu')?.setAttribute('aria-expanded','true');});mainMenu.open();
  canvas.addEventListener('elmwood-stop-ride',stop);
  outfits.forEach((select,i)=>select.onchange=()=>{const s=seats[i];if(!s)return;s.hero.root.visible=false;s.hero=s.riders.get(select.value)!;s.motion.setProfile(s.hero.profile);s.hero.root.visible=active&&i<count;s.hero.apply(s.motion.pose);});
  function cycleCamera(i=0){cameras[i].value=nextElmwoodCamera(cameras[i].value);if(i===0)try{localStorage.setItem('elmwood-riding-camera',cameras[0].value);}catch{}canvas.focus();}
  cameras.forEach((select,i)=>select.onchange=()=>{select.value=cameraMode(select.value);if(!i)try{localStorage.setItem('elmwood-riding-camera',select.value);}catch{}canvas.focus();});
  cameraButton.onclick=()=>cycleCamera();el<HTMLButtonElement>('ride-reset').onclick=()=>{if(active){resetSeat(0,true);canvas.focus();}};el<HTMLButtonElement>('session-recover-1').onclick=()=>{if(active&&count===2){resetSeat(1,true);canvas.focus();}};
  el<HTMLButtonElement>('session-retry').onclick=()=>active?startMode():button.click();mode.onchange=()=>{message.textContent='Press Start / retry selected mode to begin.';};
  el<HTMLButtonElement>('session-trick-go').onclick=()=>{if(active&&!paused){input.touch(0,'trick',true);input.touch(0,'trick',false);canvas.focus();}};
  el<HTMLButtonElement>('session-cruise').onclick=()=>{if(active&&!paused){input.touch(0,'cruise',true);input.touch(0,'cruise',false);canvas.focus();}};
  el<HTMLButtonElement>('session-map').onclick=()=>{map.hidden=!map.hidden;if(!map.hidden)pause(true);};soundToggle.onchange=()=>{void audio.enable(soundToggle.checked).catch(()=>{soundToggle.checked=false;message.textContent='Sound is unavailable in this browser.';});};
  canvas.addEventListener('elmwood-stick',((e:CustomEvent<{x:number;y:number}>)=>{if(active&&!paused)input.stick(0,e.detail.x,e.detail.y);}) as EventListener);
  canvas.addEventListener('elmwood-player-input',((e:CustomEvent<{seat:number;action?:Action;down?:boolean;x?:number;y?:number;source?:string}>)=>{
    const d=e.detail;if(!active||paused||d.seat<0||d.seat>=count)return;if(d.action)input.touch(d.seat,d.action,!!d.down,d.source);else input.stick(d.seat,d.x??0,d.y??0);
  }) as EventListener);
  addEventListener('keydown',e=>{
    if(!active||(e.target as HTMLElement)?.closest('input,select,textarea,button,a,summary,dialog'))return;
    if(e.code==='KeyP'&&!e.repeat){e.preventDefault();pause();return;}if(e.code==='Escape'){stop();return;}
    if(e.code==='KeyM'&&!e.repeat){el<HTMLButtonElement>('session-map').click();return;}
    if(paused)return;if(input.key(e.code,true))e.preventDefault();
  });addEventListener('keyup',e=>{const ui=(e.target as HTMLElement)?.closest('input,select,textarea,button,a,summary,dialog');if(input.key(e.code,false)&&active&&!ui)e.preventDefault();});
  addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});canvas.addEventListener('webglcontextlost',()=>pause(true));
  const lookPointers=new Map<number,{seat:number;x:number;y:number}>();
  canvas.addEventListener('pointerdown',e=>{if(!active||paused||document.body.classList.contains('controls-open'))return;const i=rects().findIndex(r=>e.clientX>=r.x&&e.clientX<r.x+r.width&&e.clientY>=r.y&&e.clientY<r.y+r.height);if(i<0||cameras[i].value!=='first')return;lookPointers.set(e.pointerId,{seat:i,x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{const p=lookPointers.get(e.pointerId);if(!p||paused)return;const s=seats[p.seat];s.firstYaw=T.MathUtils.clamp(s.firstYaw-(e.clientX-p.x)*.005,-1.45,1.45);s.firstPitch=T.MathUtils.clamp(s.firstPitch-(e.clientY-p.y)*.005,-1.25,.7);p.x=e.clientX;p.y=e.clientY;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>lookPointers.delete((e as PointerEvent).pointerId));canvas.addEventListener('elmwood-clear-input',()=>lookPointers.clear());
  function frameSeat(s:Seat,i:number,dt:number){
    const p=s.motion.pose,view=s.motion.view,cam=s.camera,framing=s.framing,mode=cameraMode(cameras[i].value);s.hero.apply(p);anchor.set(p.x,p.y+1.05,p.z);
    if(i===0)controls.target.copy(anchor);
    if(mode==='orbit'&&count===1){
      if(s.lastCamera!==mode){frameElmwoodCamera(mode,p,reducedMotion.matches,framing);cam.position.copy(framing.eye);previousOrbitTarget.copy(controls.target);controls.enablePan=false;controls.minDistance=3;controls.maxDistance=40;controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI*.49;controls.enableDamping=!reducedMotion.matches;}
      controls.enabled=true;orbitDelta.copy(controls.target).sub(previousOrbitTarget);cam.position.add(orbitDelta);previousOrbitTarget.copy(controls.target);controls.update();clearElmwoodCamera(cam.position,controls.target,terrain!,direction);cam.lookAt(controls.target);cam.fov=60;
    }else{
      if(i===0){if(s.lastCamera==='orbit'){controls.enableDamping=false;controls.update();Object.assign(controls,orbitDefaults);}controls.enabled=false;}
      if(mode==='chase'||mode==='first'&&s.motion.sim.crashed){cam.position.set(view.positionX,view.positionY,view.positionZ);cam.lookAt(view.targetX,view.targetY,view.targetZ);cam.rotateZ(view.roll);cam.fov=T.MathUtils.radToDeg(view.fov);}
      else{
        if(mode==='first'){if(s.lastCamera!==mode){s.firstYaw=0;s.firstPitch=-.10;}if(!paused){s.firstYaw=T.MathUtils.clamp(s.firstYaw-input.seats[i].lookX*dt*1.7,-1.45,1.45);s.firstPitch=T.MathUtils.clamp(s.firstPitch-input.seats[i].lookY*dt*1.3,-1.25,.7);}s.hero.root.updateMatrixWorld(true);}
        frameElmwoodCamera(mode,p,reducedMotion.matches,framing,{head:s.hero.head?.getWorldPosition(new T.Vector3()),yaw:s.firstYaw,pitch:s.firstPitch});clearElmwoodCamera(framing.eye,anchor,terrain!,direction);
        if(s.lastCamera!==mode||mode==='first')cam.position.copy(framing.eye);else if(!paused)cam.position.lerp(framing.eye,1-Math.exp(-dt*(mode==='drone'&&!reducedMotion.matches?2.4:10)));
        clearElmwoodCamera(cam.position,anchor,terrain!,direction);
        if(mode==='drone'){if(s.lastCamera!==mode)s.droneTarget.copy(framing.target);else if(!paused)s.droneTarget.lerp(framing.target,1-Math.exp(-dt*(reducedMotion.matches?10:3)));cam.lookAt(s.droneTarget);}else cam.lookAt(framing.target);
        cam.rotateZ(framing.roll);cam.fov=framing.fov;
      }
    }
    s.lastCamera=mode;cam.updateProjectionMatrix();
  }
  function saveBest(s:Seat){
    if(s.bestRecorded||!s.run.finished)return;s.bestRecorded=true;const r=s.run,key='elmwood-best-'+r.mode;
    try{const old=Number(localStorage.getItem(key)),value=r.mode==='tricks'?r.score:r.finishTime;if(!old||(r.mode==='tricks'?value>old:value<old))localStorage.setItem(key,String(value));best.textContent='Personal best: '+localStorage.getItem(key)+(r.mode==='tricks'?' points':' seconds');}catch{best.textContent='Result saved for this session.';}
  }
  return {stop,pause,dogThreats,update(dt:number){
    if(!active||!terrain)return;
    if(!paused){const error=input.poll(pads());if(error){pause(true);message.textContent=error;}}
    if(!paused&&countdown>0){countdown=Math.max(0,countdown-dt);clearInput();}
    if(!paused)walkers?.update(dt,dogThreats(),seats.slice(0,count).map(s=>s.motion.pose));Object.assign(canvas.dataset,{fleeingWalkers:String(walkers?.fleeing??0),photographingVisitors:String(walkers?.photographing??0),cyclists:String(walkers?.cyclists??0)});const contacts=targets();
    for(let i=0;i<count;i++){
      const s=seats[i],packet=input.consume(i,s.motion.pose.speed,Number(trick.value));if(packet.recover)resetSeat(i,true);if(packet.camera)cycleCamera(i);
      s.motion.update(dt,packet.actions,paused||countdown>0);s.run.update(dt,s.motion.pose,s.motion.events,paused||countdown>0);saveBest(s);frameSeat(s,i,dt);
      if(s.dog&&s.dogView&&wantsDog(i)){if(!paused)s.dog.update(s.motion.pose,dt,contacts);s.dogView.update(s.dog,paused?0:dt);}
      const p=s.motion.pose,ss=s.motion.sim.snapshot();
      if(!i)Object.assign(canvas.dataset,{rider:outfits[i].value,speed:p.speed.toFixed(3),x:p.x.toFixed(2),z:p.z.toFixed(2),heading:p.headingY.toFixed(4),paused:String(paused),rest:p.stopFoot.toFixed(3),crashed:String(ss.crashed),lean:p.riderPitch.toFixed(3),roll:p.rollAngle.toFixed(3),crouch:p.crouch.toFixed(3),hops:String(ss.hops),landings:String(ss.landings),cameraMode:cameras[i].value,cameraX:camera.position.x.toFixed(2),cameraY:camera.position.y.toFixed(2),cameraZ:camera.position.z.toFixed(2)});
      Object.assign(canvas.dataset,i?{p2X:p.x.toFixed(2),p2Z:p.z.toFixed(2),p2Speed:p.speed.toFixed(3),p2Hops:String(ss.hops),p2Camera:cameras[i].value}:{});
      canvas.dataset[i?'p2Score':'score']=String(s.run.score);canvas.dataset[i?'p2Gate':'gate']=String(s.run.gate);canvas.dataset[i?'p2Dog':'dog']=String(!!s.dogView?.root.visible);canvas.dataset[i?'p2DogDistance':'dogDistance']=s.dog?Math.hypot(s.dog.x-p.x,s.dog.z-p.z).toFixed(2):'0';
      canvas.dataset[i?'p2DogCommand':'dogCommand']=s.dog?.command??'off';canvas.dataset[i?'p2DogPose':'dogPose']=s.dogView?.gait??'none';canvas.dataset[i?'p2DogExcitement':'dogExcitement']=s.dog?.excitement.toFixed(2)??'0';
      const target=s.run.gates[s.run.gate];markers[i].visible=!!target&&!s.run.finished&&!s.run.failed&&(s.run.mode==='sprint'||s.run.mode==='tour');
      if(markers[i].visible){markers[i].position.set(target.x,terrain.height(target.x,-target.z)+.08,target.z);const prev=s.run.gates[s.run.gate-1];markers[i].rotation.y=Math.atan2(target.x-prev.x,target.z-prev.z);}
      if(!map.hidden){const dot=map.querySelector('#route-p'+(i+1));dot?.setAttribute('cx',String(p.x));dot?.setAttribute('cy',String(p.z));}map.querySelector('#route-p2')?.setAttribute('visibility',count===2?'visible':'hidden');
    }
    const appeared=spirits.update(dt,seats.slice(0,count).map(s=>s.motion.pose),terrain,paused||countdown>0,spiritToggle.checked,spiritSound.checked,reducedMotion.matches);
    if(appeared){const s=seats[spirits.events.active!.seat];s.run.message='A spirit passes…';s.run.messageTime=3.8;}
    Object.assign(canvas.dataset,{spiritEncounters:String(spirits.events.seen),spiritVisible:String(spirits.root.visible)});
    audio.update(seats[0].motion.pose,!paused);music.update(dt,seats[0].run.mode==='tricks'?'style':'ride',!paused,seats[0].motion.pose.speed,seats[0].run.score,seats[0].motion.pose.warningLevel);
    hudClock+=dt;if(hudClock>.12){hudClock=0;const boxes=rects();for(let i=0;i<count;i++){
      const s=seats[i],r=boxes[i],p=s.motion.pose;hud[i].hidden=false;hud[i].style.left=(r.x+12)+'px';hud[i].style.top=(r.y+(count===2&&i?12:count===2&&(innerWidth<750||innerHeight<500)?68:innerWidth<750?204:222))+'px';
      const heading=paused?'PAUSED':countdown>0?'Ready · '+Math.ceil(countdown):s.motion.sim.crashed?'Fallen · recover':`${Math.abs(p.speed*3.6).toFixed(0)} km/h${input.seats[i].cruise?' · CRUISE':''}`;
      hud[i].replaceChildren();const strong=document.createElement('strong');strong.textContent=(count===2?'P'+(i+1)+' · ':'')+heading;hud[i].append(strong,document.createTextNode('\n'+s.run.label+(wantsDog(i)&&s.dog?'\nDog · '+s.dog.note:'')+(s.run.messageTime>0&&!s.run.finished?'\n'+s.run.message:'')));
    }
    status(paused?'Paused · P / Resume ride':count===2?'P1 WASD · P2 arrows · P pause · Settings for gamepads, touch and challenges':'WASD / arrows · Space hop · T trick · R recover · C camera · Settings for more');touch.update();}
  },render(renderer:T.WebGLRenderer){
    if(!active)return false;
    const boxes=rects();const size=renderer.getSize(new T.Vector2());if(size.x!==innerWidth||size.y!==innerHeight)renderer.setSize(innerWidth,innerHeight);renderer.setScissorTest(true);const shadows=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    for(let i=0;i<count;i++){
      const r=boxes[i],s=seats[i],aspect=r.width/r.height;if(s.camera.aspect!==aspect){s.camera.aspect=aspect;s.camera.updateProjectionMatrix();}
      renderer.setViewport(r.x,innerHeight-r.y-r.height,r.width,r.height);renderer.setScissor(r.x,innerHeight-r.y-r.height,r.width,r.height);
      s.hero.rider.visible=cameras[i].value!=='first'||s.motion.sim.crashed;renderer.render(scene,s.camera);s.hero.rider.visible=true;
    }
    renderer.shadowMap.autoUpdate=shadows;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
    divider.hidden=count!==2;if(count===2){const stacked=boxes[1].y>0;Object.assign(divider.style,{left:(stacked?0:boxes[1].x-1)+'px',top:(stacked?boxes[1].y-1:0)+'px',width:stacked?'100vw':'2px',height:stacked?'2px':'100vh'});}
    return true;
  },nearPlayers(center:T.Vector3,radius:number){return !active||seats.slice(0,count).some(s=>Math.hypot(center.x-s.motion.pose.x,center.z-s.motion.pose.z)<radius);}};
}
