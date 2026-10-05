import {ElmwoodOnlineRooms} from './onlineRooms.ts';
import {ElmwoodOnlineRide,multiplayerRects} from './elmwood-online-ride.ts';
import type {RoomMatch} from './onlineProtocol.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {loadingCinema} from './loadingCinema.ts';
import {elmwoodRaceRecovery} from './elmwood-race-recovery.ts';
import {isCycle,ebikeProfile,eucProfile,vehicleOptions,vehicleSummary} from './electricVehicles.ts';
import {EbikeView,loadElectricAssets} from './electricVehicleView.ts';
import {installDogCommandHud} from './dogCommandHud.ts';
import {installLoveTagMainMenu} from './loveTagMainMenu.ts';
import {LoveTagClient} from '@digital-static/ridecore/tag-client';
import * as T from 'three';
import {BicycleView,BIKE_STYLES} from './riding/bicycleView.ts';
import {CyclingSession} from './riding/communitySession.ts';
import {elmwoodCommunityRoute} from './elmwood-community-route.ts';
import {TacticalMap} from './tacticalMap.ts';
import {elmwoodRaceCourse} from './elmwoodRaceMap.ts';
import {ElmwoodRacePilot,ElmwoodRacePack,elmwoodRaceOrder} from './elmwood-race.ts';
import {settingsPanel,controlNodes} from './settingsPanel.ts';
import {GameFilm} from './gameFilm.ts';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createGroundSample as coreGroundSample,RIDECORE,SPECIAL_MOVES,NEUTRAL_ACTIONS,RidePractice,RIDER_EYE_PITCH} from '@digital-static/ridecore';
import {RideAudio} from './riding/rideAudio.ts';
import {ThreeRiderView} from './riding/threeRiderView.ts';
import {createRideCoreRiders,SWOOP_RIDERS,CIRCUIT_PROFILE} from './riding/elmwoodRiders.ts';
import {createGroundSample} from '../simulation/world.ts';
import {loadCircuitRiders} from './circuit-rider.ts';
import {loadActors} from './actors.ts';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {RideMotion} from './ride-motion.ts';
import {chooseElmwoodSpawn} from './elmwood-details.ts';
import {ELMWOOD_CAMERAS,cameraMode,nextElmwoodCamera,cameraFrame,frameElmwoodCamera,clearElmwoodCamera} from './elmwood-camera.ts';
import type {VRPacket} from './elmwood-vr.ts';
import {ElmwoodSessionInput,setupError,type Binding,type Action} from './elmwood-session-input.ts';
import {ElmwoodRun,laneGates,MODES,type RunMode} from './elmwood-gameplay.ts';
import {ElmwoodCompanion,type DogTarget} from './elmwood-companion.ts';
import {makeElmwoodMainMenu} from './elmwood-main-menu.ts';
import {makeElmwoodSpirits} from './elmwood-spirits.ts';
import {dogControls} from './elmwood-dog-controls.ts';
import {makeElmwoodWalkers} from './elmwood-walkers.ts';
import {GLTFLoader,type GLTF} from './compressedGLTFLoader.ts';
import {DogView} from './dog-view.ts';
import {Soundtrack} from './elmwood-soundtrack.ts';
import {makeDuoTouch} from './elmwood-duo-touch.ts';
import './elmwood-session.css';
import './elmwood-mobile-hud.css';

type Spawn={x:number;north:number;heading:number};
type Seat={raceRecovery?:ReturnType<typeof elmwoodRaceRecovery>;bike?:BicycleView;motion:RideMotion;riders:Map<string,ThreeRiderView>;hero:ThreeRiderView;camera:T.PerspectiveCamera;lastCamera:string;framing:ReturnType<typeof cameraFrame>;droneTarget:T.Vector3;firstYaw:number;firstPitch:number;run:ElmwoodRun;spawn:Spawn;dog?:ElmwoodCompanion;dogView?:DogView;bestRecorded:boolean};
export function splitRects(w:number,h:number,count:number,layout:string){
  if(count===1)return [{x:0,y:0,width:w,height:h}];
  const vertical=layout==='stacked'||layout==='auto'&&h>w;
  return vertical?[{x:0,y:0,width:w,height:Math.floor(h/2)},{x:0,y:Math.floor(h/2),width:w,height:h-Math.floor(h/2)}]:[{x:0,y:0,width:Math.floor(w/2),height:h},{x:Math.floor(w/2),y:0,width:w-Math.floor(w/2),height:h}];
}
export function makeElmwoodRide(scene:T.Scene,camera:T.PerspectiveCamera,controls:OrbitControls,canvas:HTMLCanvasElement,status:(s:string)=>void,showSite:()=>void,birdTargets:()=>DogTarget[]=()=>[],mountDisplay?:(parent:HTMLElement)=>void) {
  const el=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
  const button=el<HTMLButtonElement>('ride-start'),outfit=el<HTMLSelectElement>('ride-outfit'),cameraSelect=el<HTMLSelectElement>('ride-camera'),cameraButton=el<HTMLButtonElement>('ride-camera-next');
  const bikeRecover=document.createElement('button');bikeRecover.id='bike-recover';bikeRecover.type='button';bikeRecover.textContent='Recover bike · R';bikeRecover.style.minHeight='44px';bikeRecover.hidden=true;document.querySelector('header')!.append(bikeRecover);bikeRecover.onclick=()=>{if(active){resetSeat(0,true);canvas.focus();}};
  const settings=document.createElement('section');settings.id='elmwood-session-settings';settings.innerHTML=`<h2 style="font-size:16px">Ride together</h2>
    <label for="session-vehicle">Vehicle</label><select id="session-vehicle"><option value="euc">Electric unicycle · all modes</option><option value="bicycle">Bicycle · free ride, race and tour</option></select><label for="session-bike-style">Bicycle color and style</label><select id="session-bike-style"></select><p>Bicycles and electric motos use the original rider. Push forward to pedal or accelerate, and release to coast. Pull back to brake; keep holding after stopping to back up slowly. Hops, tricks, split and VR use the EUC.</p><button id="session-community">Group ride · Explore Elmwood</button><label for="session-players">Players</label><select id="session-players"><option value="1">Solo ride</option><option value="2">2 players · local split screen</option><option value="3">3 players · local split screen</option><option value="4">4 players · local split screen</option></select>
    <label for="session-layout">Split layout</label><select id="session-layout"><option value="auto">Automatic</option><option value="side">Side by side</option><option value="stacked">Top and bottom</option></select>
    <label for="session-input-0">Player 1 controls</label><select id="session-input-0"></select>
    <div id="session-player-two"><label for="session-input-1">Player 2 controls</label><select id="session-input-1"></select><label for="session-outfit-1">Player 2 rider</label><select id="session-outfit-1"></select><label for="session-camera-1">Player 2 camera</label><select id="session-camera-1"></select><button id="session-recover-1">Recover player 2</button></div>
    <button id="session-touch-edit">Arrange split-screen touch controls</button>
    <label for="session-dog">Boerboel companion</label><select id="session-dog"><option value="off">Off</option><option value="p1">Run with player 1</option><option value="p2">Run with player 2</option><option value="both">One dog per rider</option></select>
    <label for="session-race-difficulty">Race difficulty</label><select id="session-race-difficulty"><option value="expert">Expert · fast AI rivals</option><option value="club">Club · competitive</option></select><label for="session-mode">Game mode</label><select id="session-mode"></select><button id="session-retry">Start / retry selected mode</button>
    <label for="session-trick">Trick</label><select id="session-trick"></select><div class="row"><button id="session-trick-go">Perform trick · T</button><button id="session-cruise">Cruise · V</button></div>
    <button id="session-map">Route map · M</button><label><input id="session-audio" type="checkbox" checked> Ride, dog, birds &amp; water sounds</label><label for="session-camera-motion">Camera motion</label><select id="session-camera-motion"><option value="dynamic">Dynamic · turn and speed feedback</option><option value="calm">Calm · steady horizon</option></select>
    <label><input id="session-spirits" type="checkbox" checked> Rare ghost encounters · 1–2 per ride</label><label><input id="session-spirit-sound" type="checkbox"> Ghost sound</label>
    <p id="session-message" role="status"></p><p id="session-best"></p>
    <details id="session-help"><summary>Keyboard, gamepad &amp; touch help</summary><p>P1: WASD, Space hop, left Shift crouch, R recover, C camera, T trick, V cruise.<br>P2: arrows, Enter hop, right Shift crouch, Backspace recover, / camera, . trick, ' cruise.<br>P pauses both players. Escape stops the ride. M opens the route map.</p><p>Gamepad: left stick steer/ride, RT accelerate, LT brake, A hop, B crouch, X trick, Y camera, LB recover, RB cruise, Start pause. Assign a different controller to each player. Release the sticks and buttons before resuming.</p><p>Touch: each player has their own floating joystick and buttons. Arrange controls to move, resize or assign them. Split layouts save separately for each player and orientation.</p><p>Free ride and challenges use the existing mapped lanes. The sprint starts at the south end of Creek Lane. Racers pass through one another. Swoop's shops and freestyle park remain available through Return to Swoop Detroit.</p></details>`;
  outfit.closest('aside')!.prepend(settings);
  const vehicle=el<HTMLSelectElement>('session-vehicle'),bikeStyle=el<HTMLSelectElement>('session-bike-style');bikeStyle.replaceChildren(...BIKE_STYLES.map((s,i)=>new Option(s.name,String(i))));vehicleOptions(vehicle);const performanceCard=document.createElement('p');performanceCard.id='vehicle-performance';performanceCard.setAttribute('role','status');vehicle.after(performanceCard);performanceCard.textContent=vehicleSummary(vehicle.value);
  let community:CyclingSession|undefined,cycleAssets:Map<string,GLTF>|undefined;
  const communityVisible=()=>active&&!practice&&count===1&&!vrMode&&seats[0]?.run.mode==='free';
  const players=el<HTMLSelectElement>('session-players'),layout=el<HTMLSelectElement>('session-layout'),mode=el<HTMLSelectElement>('session-mode'),trick=el<HTMLSelectElement>('session-trick'),dogSelect=el<HTMLSelectElement>('session-dog'),soundToggle=el<HTMLInputElement>('session-audio');
  const inputs=[el<HTMLSelectElement>('session-input-0'),el<HTMLSelectElement>('session-input-1')],outfits=[outfit,el<HTMLSelectElement>('session-outfit-1')],cameras=[cameraSelect,el<HTMLSelectElement>('session-camera-1')];
  for(let i=2;i<4;i++){const label=document.createElement('label');label.textContent='Player '+(i+1)+' controls';label.htmlFor='session-input-'+i;const select=document.createElement('select');select.id='session-input-'+i;for(const [id,text] of [['wasd','Keyboard · WASD'],['arrows','Keyboard · arrows'],['ijkl','Keyboard · IJKL'],['numpad','Keyboard · number pad'],['touch','Touch'],...Array.from({length:4},(_,j)=>['pad:'+j,'Controller '+(j+1)])])select.add(new Option(text,id));select.value=i===2?'ijkl':'numpad';label.append(select);settings.append(label);}
  for(let i=0;i<2;i++){
    inputs[i].replaceChildren(...[['wasd','Keyboard · WASD'],['arrows','Keyboard · arrows'],['touch','Touch controls'],...Array.from({length:4},(_,j)=>['pad:'+j,'Gamepad '+(j+1)])].map(([v,l])=>new Option(l,v)));inputs[i].value=i?'arrows':'wasd';
    cameras[i].replaceChildren(...ELMWOOD_CAMERAS.map(([v,l])=>new Option(l,v)));
  }
  for(const r of SWOOP_RIDERS)outfit.add(new Option(r.label,r.id));
  outfit.value='DS_Armored_Rider_01';try{const saved=localStorage.getItem('elmwood-rider-choice');if(saved&&[...outfit.options].some(o=>o.value===saved))outfit.value=saved;}catch{}
  let wheelRider=outfit.value;outfit.addEventListener('change',()=>{if(isCycle(vehicle.value))return;wheelRider=outfit.value;try{localStorage.setItem('elmwood-rider-choice',outfit.value);}catch{}});
  outfits[1].replaceChildren(...[...outfit.options].map(o=>new Option(o.text,o.value)));outfits[1].value='original';
  for(let i=2;i<4;i++){
    inputs.push(el<HTMLSelectElement>('session-input-'+i));
    const label=document.createElement('label'),select=document.createElement('select');label.htmlFor=select.id='session-outfit-'+i;label.textContent='Player '+(i+1)+' rider';select.replaceChildren(...RIDER_CHOICES.map(r=>new Option(r.label,r.id)));select.value=RIDER_CHOICES[i].id;label.append(select);settings.append(label);outfits.push(select);
  }
  mode.replaceChildren(...MODES.map(([v,l])=>new Option(l,v)));trick.replaceChildren(...SPECIAL_MOVES.map(t=>new Option(t.name+' · below '+Math.round(t.maxSpeed*3.6)+' km/h',String(t.id))));
  try{cameraSelect.value=cameraMode(localStorage.getItem('elmwood-riding-camera'));dogSelect.value=localStorage.getItem('elmwood-companion')||'off';}catch{}
  const message=el('session-message'),best=el('session-best'),input=new ElmwoodSessionInput(),audio=new RideAudio(),music=new Soundtrack(settings);
  let onlineRide:ElmwoodOnlineRide|undefined,onlineRooms:ElmwoodOnlineRooms|undefined;
  const hud=[0,1].map(i=>{const h=document.createElement('div');h.className='session-hud';h.dataset.seat=String(i);h.hidden=true;document.body.append(h);return h;});
  let practice:RidePractice|undefined;
  const practicePanel=document.createElement('section');practicePanel.className='elmwood-lesson';practicePanel.hidden=true;
  practicePanel.setAttribute('aria-label','Riding lesson');practicePanel.innerHTML='<strong>Learn to ride</strong><p role="status"></p><button type="button">Finish lesson · free ride</button>';
  practicePanel.querySelector('button')!.onclick=()=>{practice=undefined;practicePanel.hidden=true;canvas.focus();};document.body.append(practicePanel);
  const resultPanel=document.createElement('section');resultPanel.className='elmwood-result';resultPanel.hidden=true;
  resultPanel.innerHTML='<strong>Ride result</strong><p role="status"></p><button type="button">Retry this mode</button><button type="button">Main menu</button>';document.body.append(resultPanel);
  resultPanel.querySelectorAll('button')[0].onclick=()=>{startMode();canvas.focus();};
  resultPanel.querySelectorAll('button')[1].onclick=()=>canvas.dispatchEvent(new Event('elmwood-main-menu'));
  const divider=document.createElement('div');divider.id='split-divider';divider.hidden=true;document.body.append(divider);
  const map=document.createElement('section');map.id='elmwood-route-map';map.hidden=true;map.innerHTML='<strong>Elmwood route map</strong><p>Gold: player 1 · Blue: player 2 · Green: Creek Lane</p><svg aria-label="Mapped lanes and rider positions" role="img"></svg><button>Close map</button>';document.body.append(map);map.querySelector('button')!.onclick=()=>{map.hidden=true;canvas.focus();};
  const seats:Seat[]=[],sample=createGroundSample(),audioSample=coreGroundSample(),direction=new T.Vector3(),anchor=new T.Vector3(),previousOrbitTarget=new T.Vector3(),orbitDelta=new T.Vector3();
  const miniMap=new TacticalMap('Elmwood',()=>pause(true),()=>canvas.focus());
  const film=new GameFilm('Elmwood Explorer',canvas,()=>onlineRide?.active?onlineRide.actors:seats.slice(0,count).flatMap(s=>[{root:s.motion.cycling?s.bike!.root:s.hero.root,body:s.motion.cycling?s.bike!.rider:s.hero.rider},...(s.dogView?.root.visible?[{root:s.dogView.root}]:[])]),()=>{pause(true);if(seats[0])audio.update(seats[0].motion.pose,false);music.update(0,'ride',false,0,0,0);document.body.classList.remove('controls-open');document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.close();});
  let filmDelta=0;
  const orbitDefaults={enablePan:controls.enablePan,minDistance:controls.minDistance,maxDistance:controls.maxDistance,minPolarAngle:controls.minPolarAngle,maxPolarAngle:controls.maxPolarAngle};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const cameraMotion=el<HTMLSelectElement>('session-camera-motion');let savedCameraMotion:string|null=null;
  try{savedCameraMotion=localStorage.getItem('elmwood-camera-motion');}catch{}
  cameraMotion.value=savedCameraMotion==='calm'||!savedCameraMotion&&reducedMotion.matches?'calm':'dynamic';
  cameraMotion.onchange=()=>{try{savedCameraMotion=cameraMotion.value;localStorage.setItem('elmwood-camera-motion',cameraMotion.value);}catch{}for(const s of seats)s.motion.follow.calm=cameraMotion.value==='calm';};
  reducedMotion.addEventListener('change',()=>{if(!savedCameraMotion){cameraMotion.value=reducedMotion.matches?'calm':'dynamic';for(const s of seats)s.motion.follow.calm=cameraMotion.value==='calm';}});
  const spirits=makeElmwoodSpirits(scene),spiritToggle=el<HTMLInputElement>('session-spirits'),spiritSound=el<HTMLInputElement>('session-spirit-sound');
  try{spiritToggle.checked=localStorage.getItem('elmwood-spirits')!=='off';}catch{}
  spiritToggle.onchange=()=>{try{localStorage.setItem('elmwood-spirits',spiritToggle.checked?'on':'off');}catch{}if(!spiritToggle.checked)spirits.hide();};
  spiritSound.onchange=()=>{if(spiritSound.checked)void spirits.unlockSound().catch(()=>{spiritSound.checked=false;message.textContent='Ghost sound is unavailable in this browser.';});};
  const gates=new T.Group();gates.name='Elmwood challenge checkpoint';scene.add(gates);
  const markers=[0xedcf85,0x83d9ff].map(color=>{const marker=new T.Group(),mat=new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});
    for(const side of [-1,1]){const post=new T.Mesh(new T.CylinderGeometry(.07,.07,2,6),mat);post.position.set(side*2,1,0);marker.add(post);}const bar=new T.Mesh(new T.BoxGeometry(4.1,.08,.08),mat);bar.position.y=2;marker.add(bar);marker.visible=false;gates.add(marker);return marker;});
  let active=false,paused=false,count=1,orbitFov=camera.fov,terrain:ElmwoodTerrain|undefined,countdown=0,hudClock=0,initializing:Promise<void>|undefined,dogAsset:GLTF|undefined,dogLoading:Promise<void>|undefined;
  let vrMode=false,vrPacket:VRPacket|undefined;
  let raceCourse:ReturnType<typeof elmwoodRaceCourse>|undefined;
  const racePack=new ElmwoodRacePack();let racePilots:ElmwoodRacePilot[]=[];let raceViews:(BicycleView|ThreeRiderView)[]=[];let raceLine:{x:number;z:number}[]=[];
  function clearRace(){racePack.reset();for(const view of raceViews)view.dispose();raceViews=[];racePilots=[];delete canvas.dataset.raceOpponents;delete canvas.dataset.racePlace;}
  let route:ReturnType<typeof laneGates>=[],walkers:ReturnType<typeof makeElmwoodWalkers>|undefined;
  const targets=()=>[...birdTargets(),...(walkers?.targets??[])];
  const dogThreats=()=>active?seats.slice(0,count).filter((s,i)=>wantsDog(i)&&s.dog&&s.dogView?.root.visible).map(s=>({x:s.dog!.x,z:s.dog!.z,chasing:s.dog!.command==='chase'||s.dog!.barking>0})):[];
  installDogCommandHud(settings,'elmwood-dog-pads',command=>{const dog=seats[0]?.dog;if(!dog)return 'Enable your dog first';const target=settings.querySelector<HTMLSelectElement>('#dog-target')?.value==='people'?'people':'birds';dog.order(command as import('./elmwood-companion.ts').DogCommand,targets(),target);return dog.note;},()=>active&&!paused&&!!seats[0]?.dog&&wantsDog(0));
  const commands=dogControls(settings,(command,recipient,target)=>{const selected=seats.slice(0,count).filter((s,i)=>s.dog&&wantsDog(i)&&(recipient==='both'||recipient===(i?'p2':'p1')));if(!selected.length)return 'Enable a Boerboel for the selected player first.';for(const s of selected)s.dog!.order(command,targets(),target);return selected.map(s=>s.dog!.note).join(' · ');},()=>active&&!paused);
  const pads=()=>Array.from(navigator.getGamepads?.()??[]);
  const rects=()=>Number(canvas.dataset.players)>2?multiplayerRects(innerWidth,innerHeight,Number(canvas.dataset.players)):splitRects(innerWidth,innerHeight,active?count:Number(players.value),layout.value);
  const touch=makeDuoTouch(canvas,rects,()=>pause(true));el<HTMLButtonElement>('session-touch-edit').onclick=()=>{if(Number(players.value)<2){players.value='2';settingsChanged();}touch.edit();};
  function clearInput(seat?:number){input.clear(seat);for(const s of seat===undefined?seats:[seats[seat]])s?.motion.clearPendingInput();canvas.dispatchEvent(new CustomEvent('elmwood-clear-input',{detail:{seat}}));}
  function configure(){input.configure(inputs.slice(0,count).map(e=>e.value as Binding));}
  function settingsChanged(){if(active)stop();el('session-player-two').hidden=Number(players.value)<2;layout.disabled=players.value!=='2';canvas.dataset.players=players.value;canvas.dataset.splitLayout=layout.value;touch.update();message.textContent='Press Ride Elmwood to use these controls.';}
  players.onchange=settingsChanged;inputs.forEach(e=>e.onchange=settingsChanged);layout.onchange=()=>{canvas.dataset.splitLayout=layout.value;clearInput();touch.update();};settingsChanged();
  function refreshPads(){const list=pads();for(const select of inputs)for(let j=0;j<4;j++){const p=list.find(p=>p?.index===j&&p.connected);select.querySelector<HTMLOptionElement>(`option[value="pad:${j}"]`)!.textContent='Gamepad '+(j+1)+(p?' · '+p.id.slice(0,35):' · press a button to connect');}}
  addEventListener('gamepadconnected',refreshPads);addEventListener('gamepaddisconnected',()=>{refreshPads();if(active&&inputs.slice(0,count).some(e=>e.value.startsWith('pad:'))){pause(true);message.textContent='Controller disconnected. Reconnect or choose a different input.';}});refreshPads();
  async function initialize(){
    if(terrain)return;if(initializing)return initializing;
    initializing=(async()=>{
      status('Loading your riders…');const [data,grid,site,placements,original]=await Promise.all([loadCircuitRiders(),fetch('/elmwood/terrain.json').then(r=>r.json()),fetch('/elmwood/site.json').then(r=>r.json()),fetch('/elmwood/placements.json').then(r=>r.json()),loadActors(['DS_Man_01','DS_EUC_01','DS_Pedestrian_01','DS_Cyclist_01','DS_Bicycle_01',...SWOOP_RIDERS.map(r=>r.id)])]);
      for(const id of ["hoodie","suit"]){const source=data.get(id)!;original.set(id,{...source,animations:source.animations.filter(a=>a.name==="Idle")});}cycleAssets=original;const mapTerrain=new ElmwoodTerrain(grid,site.features,placements);await mapTerrain.init();terrain=mapTerrain;
      walkers=makeElmwoodWalkers(scene,terrain,original);walkers.root.visible=false;
      const creekLane=terrain.features.find(f=>f.id==='59197492')!;route=laneGates(creekLane.points);raceCourse=elmwoodRaceCourse(creekLane.points);raceLine=creekLane.points.map(p=>({x:p[0],z:-p[1]}));
      miniMap.setMap(terrain.features.filter(f=>['path','building'].includes(f.kind)||f.tags.water==='pond'||f.tags.waterway).map(f=>({points:f.points.map(p=>({x:p[0],y:-p[1]})),color:f.tags.water==='pond'||f.tags.waterway?'#2c6975':f.kind==='building'?'#8a8a75':f.id==='59197492'?'#b6be93':'#909e88',width:f.kind==='path'?4:2,fill:f.kind==='building'||f.tags.water==='pond'})),terrain.placements.filter(p=>p.layer==='mapped'&&['elmwood-chapel','elmwood-gatehouse','firemen-memorial'].includes(p.asset)).map(p=>({point:{x:p.position[0],y:-p.position[1]},text:p.asset.replace('elmwood-','').replaceAll('-',' ').toUpperCase()})));
      miniMap.setRoute([],[],'Elmwood · lanes & pond');
      for(let i=0;i<2;i++){
        const motion=new RideMotion(terrain);motion.follow.calm=cameraMotion.value==='calm';const riders=createRideCoreRiders(original,data,motion.terrain),hero=riders.get(outfits[i].value)!;
        for(const view of riders.values()){view.root.visible=false;scene.add(view.root);}
        seats.push({motion,riders,hero,camera:i?camera.clone():camera,lastCamera:'',framing:cameraFrame(),droneTarget:new T.Vector3(),firstYaw:0,firstPitch:RIDER_EYE_PITCH,run:new ElmwoodRun(route),spawn:{x:0,north:0,heading:0},bestRecorded:false});
      }
      community=new CyclingSession('Elmwood',scene,original,seats[0].motion.terrain,elmwoodCommunityRoute(terrain.features),()=>seats[0].motion.pose,()=>travelCommunity(),()=>canvas.focus());community.ride.autoStart=true;
      community.ui.panel.querySelector('summary')!.textContent='Group ride';
      for(const s of seats)s.motion.terrain.navigationObstacles=()=>[...(walkers?.targets??[]).map(t=>({id:t.id,x:t.x,z:t.z,y:terrain!.height(t.x,-t.z),radius:t.radius,height:1.8,kind:t.kind,vx:0,vz:0})),...seats.filter(a=>a.dog&&a.dogView?.root.visible).map(a=>({id:'companion',x:a.dog!.x,y:terrain!.height(a.dog!.x,-a.dog!.z),z:a.dog!.z,radius:.4,height:.9,kind:'dog',vx:0,vz:0}))];
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
    if(!recover)s.raceRecovery=undefined;
    if(recover&&s.raceRecovery)return;
    const recovery=recover?elmwoodRaceRecovery(s.run,s.motion.terrain,count===2?(i?-.65:.65):0):undefined;
    if(recover&&s.run.mode==='sprint'&&!s.run.finished&&!recovery){message.textContent='The earned checkpoint is blocked. Move the obstruction and try Recover again.';return;}
    if(recover&&!s.motion.cycling&&s.motion.sim.crashed){
      if(recovery){s.raceRecovery=recovery;s.run.elapsed+=5;}
      community?.ride.recover();s.motion.update(1/120,{reset:true});clearInput(i);if(!i)practice?.action('recover');return;
    }
    let spawn=s.spawn;
    if(recover){community?.ride.recover();const p=s.motion.pose,near=terrain.nearest(p.x,-p.z);spawn=recovery?{x:recovery.position.x,north:-recovery.position.z,heading:recovery.heading}:{x:near.x,north:near.north,heading:p.headingY};if(s.run.mode==='sprint')s.run.elapsed+=5;}
    const side=recovery?0:count===2?(i?-.65:.65):0;
    const x=spawn.x+Math.cos(spawn.heading)*side,z=-spawn.north-Math.sin(spawn.heading)*side;
    s.motion.setProfile(s.hero.profile);s.motion.reset({x,y:terrain.sampleGround(x,z,sample).height,z},spawn.heading);s.lastCamera='';
    clearInput(i);s.dog?.reset(s.motion.pose);s.run.relocate(s.motion.pose);
    if(recover&&!i)practice?.action('recover');
  }
  function startMode(){
    clearRace();practice=undefined;practicePanel.hidden=true;resultPanel.hidden=true;
    if(!active)return;clearInput();const selected=mode.value as RunMode;
    spirits.reset();
    const cycling=isCycle(vehicle.value)&&['free','sprint','tour'].includes(selected)&&count===1&&!vrMode;
    for(const s of seats){s.motion.selectVehicle(cycling?vehicle.value:(!isCycle(vehicle.value)?vehicle.value:'euc'));if(cycling){outfit.value='original';s.hero=s.riders.get('original')!;s.bike?.dispose();const p=ebikeProfile(vehicle.value);s.bike=p?new EbikeView(cycleAssets!.get('Ebike_'+p.id)!,cycleAssets!.get('DS_Man_01')!,p):new BicycleView(cycleAssets!.get('DS_Bicycle_01')!,cycleAssets!.get('DS_Man_01')!,Number(bikeStyle.value));scene.add(s.bike.root);}else{const e=eucProfile(vehicle.value);if(e&&cycleAssets!.has('Euc_'+e.id)){const key='electric-'+e.id+'-'+outfits[seats.indexOf(s)].value;let view=s.riders.get(key);if(!view){view=new ThreeRiderView(cycleAssets!.get(outfits[seats.indexOf(s)].value==='original'?'DS_Man_01':outfits[seats.indexOf(s)].value)??cycleAssets!.get('DS_Man_01')!,cycleAssets!.get('Euc_'+e.id)!,s.motion.terrain,SWOOP_RIDERS.find(p=>p.id===outfits[seats.indexOf(s)].value)?.profile??(["hoodie","suit"].includes(outfits[seats.indexOf(s)].value)?CIRCUIT_PROFILE:undefined));s.riders.set(key,view);scene.add(view.root);}s.hero.root.visible=false;s.hero=view;}}if(s.bike)s.bike.root.visible=false;}

    if(selected==='sprint'||selected==='tour'){
      const a=route[0],b=route[1],heading=Math.atan2(b.x-a.x,b.z-a.z);
      seats.forEach(s=>s.spawn={x:a.x,north:-a.z,heading});
    }
    for(let i=0;i<count;i++){resetSeat(i);const s=seats[i];s.run.reset(selected,s.motion.pose);s.bestRecorded=false;s.run.referenceSplits=[];
      try{const splits=JSON.parse(localStorage.getItem('elmwood-splits-'+selected+(s.motion.vehicleId!=='euc'?'-'+s.motion.vehicleId:''))||'[]');if(Array.isArray(splits)&&splits.length===s.run.gates.length-1&&splits.every((n,j)=>Number.isFinite(n)&&n>0&&(!j||n>splits[j-1])))s.run.referenceSplits=splits;}catch{}
    }
    if(selected==='sprint'&&count===1&&!vrMode){
      racePilots=Array.from({length:3},(_,i)=>new ElmwoodRacePilot(seats[0].motion.terrain,raceLine,route,i,cycling,el<HTMLSelectElement>('session-race-difficulty').value as 'club'|'expert',ebikeProfile(vehicle.value),eucProfile(vehicle.value)));
      const rivals=SWOOP_RIDERS.filter(r=>r.id!==outfit.value).slice(0,3);raceViews=racePilots.map((p,i)=>{const rival=rivals[i],moto=p.electric,view=moto?new EbikeView(cycleAssets!.get('Ebike_'+moto.id)!,cycleAssets!.get('DS_Cyclist_01')!,moto,true):cycling?new BicycleView(cycleAssets!.get('DS_Bicycle_01')!,cycleAssets!.get('DS_Cyclist_01')!,i+1,true):new ThreeRiderView(cycleAssets!.get(rival.id)!,cycleAssets!.get('Euc_'+p.wheel?.id)??cycleAssets!.get('DS_EUC_01')!,p.terrain,rival.profile);if(!cycling)p.sim.wheelScale=rival.profile.wheelScale;view.apply(p.pose);scene.add(view.root);return view;});
    }
    countdown=selected==='sprint'?3:0;paused=false;canvas.dataset.paused='false';best.textContent='';message.textContent=selected==='free'?'Free ride: explore, cruise or practice tricks.':selected==='tricks'?'Land completed tricks to score. Both players have two minutes.':'Follow the colored gates along Creek Lane.';canvas.focus();
  }
  function stop(stopOnline=true){
    if(stopOnline){onlineRide?.stop();if(onlineRooms?.active)void onlineRooms.leave(false);}
    clearRace();practice=undefined;practicePanel.hidden=true;resultPanel.hidden=true;
    film.stopReplay();film.capture(0,false,false);community?.ride.cancel();community?.view.update(false);community?.ui.update(false);
    miniMap.setRaceCourse(null);miniMap.update([],false);if(miniMap.dialog.open)miniMap.dialog.close();
    if(!active)return;active=false;commands.stop();spirits.hide();if(walkers)walkers.root.visible=false;clearInput();Object.assign(controls,orbitDefaults);controls.enabled=true;controls.enableDamping=true;
    camera.fov=orbitFov;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();button.textContent='Ride Elmwood';canvas.dataset.riding='false';
    for(const s of seats){if(s.bike)s.bike.root.visible=false;s.hero.root.visible=false;if(s.dogView)s.dogView.root.visible=false;}hud.forEach(h=>h.hidden=true);markers.forEach(m=>m.visible=false);divider.hidden=true;document.body.classList.remove('duo-riding');music.update(0,'ride',false,0,0,0);if(seats[0])audio.update(seats[0].motion.pose,false);touch.update();
  }
  function pause(value=!paused){
    if(onlineRide?.active){onlineRide.pause(value);return;}
    if(!active)return;
    if(!value){const error=setupError(inputs.slice(0,count).map(e=>e.value as Binding),pads());if(error){message.textContent=error;return;}}
    paused=value;if(paused)commands.stop();clearInput();canvas.dataset.paused=String(paused);canvas.focus();
  }
  async function toggleRide(){
    if(onlineRide?.active){stop();return;}
    if(active){stop();status('Orbit review · choose a landmark or start another ride.');return;}
    count=Number(players.value);const error=setupError(inputs.slice(0,count).map(e=>e.value as Binding),pads());if(error){message.textContent=error;status(error);return;}
    if(count>2){try{await startLocalMany(mode.value as RunMode,count);}catch(e){stop();message.textContent='Your ride could not load. Please try again.';console.error(e);}return;}
    const menu=document.querySelector<HTMLDialogElement>('#elmwood-main-menu'),wasOpen=!!menu?.open;menu?.close();const cinema=loadingCinema();cinema.status('Loading your rider and wheels…');button.disabled=true;music.unlock();void audio.enable(soundToggle.checked).catch(()=>{soundToggle.checked=false;message.textContent='Sound is unavailable in this browser.';});
    try{
      await initialize();await loadElectricAssets(cycleAssets!,vehicle.value,mode.value==='sprint');camera.getWorldDirection(direction);const spawn=chooseElmwoodSpawn(terrain!.segments,controls.target.x,-controls.target.z,direction);showSite();
      configure();orbitFov=camera.fov;controls.enableDamping=false;controls.update();controls.enabled=false;
      for(let i=0;i<count;i++){const s=seats[i];s.hero=s.riders.get(outfits[i].value)!;s.hero.root.visible=true;s.spawn={...spawn};}
      active=true;paused=false;if(walkers)walkers.root.visible=true;Object.assign(canvas.dataset,{riding:'true',players:String(count),paused:'false'});button.textContent='Stop riding';document.body.classList.toggle('duo-riding',count===2);startMode();void updateDogs();touch.update();canvas.focus();
    }catch(e){stop();status('Could not start the ride: '+String(e));console.error(e);}finally{cinema.finish();button.disabled=false;if(active)canvas.focus();else if(wasOpen&&!menu?.open)menu?.showModal();}
  };
  button.onclick=()=>void toggleRide();
  async function startLocalMany(selected:RunMode,n:number){
    await initialize();await loadElectricAssets(cycleAssets!,vehicle.value,false);showSite();controls.enabled=false;
    const match:RoomMatch={id:crypto.randomUUID(),owner:'local',members:Array.from({length:n},(_,i)=>({id:'local-'+i,rider:(outfits[i].value==='original'?'DS_Man_01':outfits[i].value==='hoodie'?'DS_Mascot_Hoodie_01':outfits[i].value==='suit'?'DS_Mascot_Suit_01':outfits[i].value) as typeof RIDER_CHOICES[number]['id'],joined:0,host:i===0})),mode:selected==='sprint'?'race':selected,spawn:0,seed:0,startAt:Date.now()+3000,map:'elmwood'};
    onlineRide!.start(match,0,terrain!,cycleAssets!,vehicle.value,true);document.querySelector<HTMLDialogElement>('#elmwood-main-menu')!.close();touch.update();music.unlock();void audio.enable(soundToggle.checked);
  }
  async function travelCommunity(){practice=undefined;practicePanel.hidden=true;if(!active||count!==1||vrMode||seats[0].run.mode!=='free'||seats[0].motion.cycling!==(isCycle(vehicle.value))||seats[0].bike?.style!==Number(bikeStyle.value)){if(active)stop();players.value='1';mode.value='free';await toggleRide();}if(!active||!community)return;const at=community.ride.route.at(0,-.5);const s=seats[0];s.spawn={x:at.x,north:-at.z,heading:at.headingY};community.ride.recover();resetSeat(0);pause(false);community.ui.panel.open=true;document.body.classList.remove('controls-open');document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.close();canvas.focus();}
  el<HTMLButtonElement>('session-community').onclick=async()=>{await travelCommunity();community?.ride.restart();};
  vehicle.onchange=bikeStyle.onchange=()=>{if(!isCycle(vehicle.value))outfit.value=wheelRider;performanceCard.textContent=vehicleSummary(vehicle.value);bikeStyle.closest('label')?.toggleAttribute('hidden',vehicle.value!=='bicycle');if(active)pause(true);message.textContent='Vehicle and bike style apply when starting a solo free ride, race or tour.';};
  const mainMenu=makeElmwoodMainMenu(canvas,()=>pause(true),()=>pause(false),async(selected,n)=>{document.body.classList.remove('controls-open');document.getElementById('elmwood-menu')?.setAttribute('aria-expanded','false');if(active||onlineRide?.active)stop();players.value=String(n);mode.value=selected;settingsChanged();await toggleRide();},()=>{document.body.classList.add('controls-open');document.getElementById('elmwood-menu')?.setAttribute('aria-expanded','true');});const communityMenu=document.createElement('button');communityMenu.textContent='Meet the Elmwood riders';communityMenu.onclick=()=>el<HTMLButtonElement>('session-community').click();document.querySelector('#menu-more-activities')!.append(communityMenu);mainMenu.open();
  const onlineMenu=document.querySelector<HTMLDialogElement>('#elmwood-main-menu')!;
  onlineMenu.addEventListener('elmwood-prepare-online',()=>{stop(false);void initialize().then(()=>status('Online riders ready · host or join a room.')).catch(e=>{message.textContent='Could not prepare online riders: '+String(e);});});
  onlineRooms=new ElmwoodOnlineRooms(()=>!!terrain,(match,slot)=>{void (async()=>{stop(false);await initialize();await loadElectricAssets(cycleAssets!,match.wheel??'euc',false);showSite();controls.enabled=false;onlineRide!.start(match,slot,terrain!,cycleAssets!,match.wheel??'euc');onlineMenu.close();document.body.classList.remove('controls-open');music.unlock();void audio.enable(soundToggle.checked);canvas.focus();})().catch(e=>{void onlineRooms!.leave();message.textContent='Could not start online ride: '+String(e);});},()=>{onlineRide?.stop();stop(false);canvas.dataset.riding='false';mainMenu.open();onlineMenu.dispatchEvent(new Event('elmwood-show-online'));});
  onlineRide=new ElmwoodOnlineRide(scene,camera,canvas,onlineRooms);
  canvas.addEventListener('elmwood-main-menu',()=>onlineRide?.pause(true));
  const practiceButton=document.createElement('button');practiceButton.type='button';
  const practiceKey=()=>`elmwood-practice-v1-${vehicle.value}`;
  function practiceLabel(){try{practiceButton.textContent=localStorage.getItem(practiceKey())==='complete'?'Replay riding practice':'Practice · recommended first';}catch{practiceButton.textContent='Practice · optional';}}
  practiceLabel();practiceButton.className='menu-practice';vehicle.addEventListener('change',practiceLabel);
  practiceButton.onclick=async()=>{practiceButton.disabled=true;try{if(active)stop();players.value='1';mode.value='free';settingsChanged();await toggleRide();if(!active)return;practice=new RidePractice(seats[0].motion.cycling);community?.ride.cancel();document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.close();canvas.focus();}finally{practiceButton.disabled=false;}};
  document.querySelector('#elmwood-main-menu .menu-actions')!.append(practiceButton);
  canvas.addEventListener('elmwood-stop-ride',()=>stop());
  outfits.forEach((select,i)=>select.onchange=()=>{const s=seats[i];if(!s)return;if(s.motion.cycling){select.value='original';message.textContent='Bicycle fit uses the original rider. Select EUC for other riders.';return;}s.hero.root.visible=false;s.hero=s.riders.get(select.value)!;s.motion.setProfile(s.hero.profile);s.hero.root.visible=active&&i<count;s.hero.apply(s.motion.pose);});
  function cycleCamera(i=0){cameras[i].value=nextElmwoodCamera(cameras[i].value);if(!i)practice?.action('camera');if(i===0)try{localStorage.setItem('elmwood-riding-camera',cameras[0].value);}catch{}canvas.focus();}
  cameras.forEach((select,i)=>select.onchange=()=>{select.value=cameraMode(select.value);if(!i)practice?.action('camera');if(!i)try{localStorage.setItem('elmwood-riding-camera',select.value);}catch{}canvas.focus();});
  cameraButton.onclick=()=>onlineRide?.active?onlineRide.nextCamera():cycleCamera();el<HTMLButtonElement>('ride-reset').onclick=()=>{if(onlineRide?.active){onlineRide.action('recover');return;}if(active){resetSeat(0,true);canvas.focus();}};el<HTMLButtonElement>('session-recover-1').onclick=()=>{if(active&&count===2){resetSeat(1,true);canvas.focus();}};
  el<HTMLButtonElement>('session-retry').onclick=()=>active?startMode():button.click();mode.onchange=()=>{message.textContent='Press Start / retry selected mode to begin.';};
  el<HTMLButtonElement>('session-trick-go').onclick=()=>{if(onlineRide?.active){onlineRide.action('trick');return;}if(active&&!paused){input.touch(0,'trick',true);input.touch(0,'trick',false);canvas.focus();}};
  el<HTMLButtonElement>('session-cruise').onclick=()=>{if(onlineRide?.active){onlineRide.action('cruise');return;}if(active&&!paused){input.touch(0,'cruise',true);input.touch(0,'cruise',false);canvas.focus();}};
  el<HTMLButtonElement>('session-map').onclick=()=>miniMap.open();soundToggle.onchange=()=>{void audio.enable(soundToggle.checked).catch(()=>{soundToggle.checked=false;message.textContent='Sound is unavailable in this browser.';});};
  canvas.addEventListener('elmwood-stick',((e:CustomEvent<{x:number;y:number}>)=>{if(active&&!paused)input.stick(0,e.detail.x,e.detail.y);}) as EventListener);
  canvas.addEventListener('elmwood-player-input',((e:CustomEvent<{seat:number;action?:Action;down?:boolean;x?:number;y?:number;source?:string}>)=>{
    const d=e.detail;if(!active||paused||d.seat<0||d.seat>=count)return;if(d.action)input.touch(d.seat,d.action,!!d.down,d.source);else input.stick(d.seat,d.x??0,d.y??0);
  }) as EventListener);
  addEventListener('keydown',e=>{
    if(film.playing){if(e.code==='Escape')film.stopReplay();return;}
    if(!active||(e.target as HTMLElement)?.closest('input,select,textarea,button,a,summary,dialog'))return;
    if(e.code==='KeyP'&&!e.repeat){e.preventDefault();pause();return;}if(e.code==='Escape'){stop();return;}
    if(e.code==='KeyM'&&!e.repeat){el<HTMLButtonElement>('session-map').click();return;}
    if(paused)return;if(input.key(e.code,true,e.repeat))e.preventDefault();
  });addEventListener('keyup',e=>{const ui=(e.target as HTMLElement)?.closest('input,select,textarea,button,a,summary,dialog');if(input.key(e.code,false)&&active&&!ui)e.preventDefault();});
  addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});canvas.addEventListener('webglcontextlost',()=>pause(true));
  const lookPointers=new Map<number,{seat:number;x:number;y:number}>();
  canvas.addEventListener('pointerdown',e=>{if(!active||paused||document.body.classList.contains('controls-open'))return;const i=rects().findIndex(r=>e.clientX>=r.x&&e.clientX<r.x+r.width&&e.clientY>=r.y&&e.clientY<r.y+r.height);if(i<0||cameras[i].value!=='first')return;lookPointers.set(e.pointerId,{seat:i,x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{const p=lookPointers.get(e.pointerId);if(!p||paused)return;const s=seats[p.seat];s.firstYaw=T.MathUtils.clamp(s.firstYaw-(e.clientX-p.x)*.0032,-1.45,1.45);s.firstPitch=T.MathUtils.clamp(s.firstPitch-(e.clientY-p.y)*.0032,-1.25,.7);p.x=e.clientX;p.y=e.clientY;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>lookPointers.delete((e as PointerEvent).pointerId));canvas.addEventListener('elmwood-clear-input',()=>lookPointers.clear());
  function frameSeat(s:Seat,i:number,dt:number){
    const p=s.motion.pose,view=s.motion.view,cam=s.camera,framing=s.framing,mode=cameraMode(cameras[i].value);s.hero.apply(p);s.hero.lights.setBeam(!s.motion.cycling);if(i===0)canvas.dataset.wheelLights=JSON.stringify(s.hero.lights.status);s.hero.root.visible=!s.motion.cycling;if(s.bike){s.bike.root.visible=s.motion.cycling;s.bike.apply(p,s.motion.bicycle.steeringAngle,s.motion.bicycle.pedalPhase);}anchor.set(p.x,p.y+1.05,p.z);
    if(i===0)controls.target.copy(anchor);
    if(vrMode){controls.enabled=false;return;}
    if(mode==='orbit'&&count===1){
      if(s.lastCamera!==mode){frameElmwoodCamera(mode,p,reducedMotion.matches,framing);cam.position.copy(framing.eye);previousOrbitTarget.copy(controls.target);controls.enablePan=false;controls.minDistance=3;controls.maxDistance=40;controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI*.49;controls.enableDamping=!reducedMotion.matches;}
      controls.enabled=true;orbitDelta.copy(controls.target).sub(previousOrbitTarget);cam.position.add(orbitDelta);previousOrbitTarget.copy(controls.target);controls.update();clearElmwoodCamera(cam.position,controls.target,terrain!,direction);cam.lookAt(controls.target);cam.fov=60;
    }else{
      if(i===0){if(s.lastCamera==='orbit'){controls.enableDamping=false;controls.update();Object.assign(controls,orbitDefaults);}controls.enabled=false;}
      if(mode==='chase'||mode==='first'&&s.motion.sim.crashed){cam.position.set(view.positionX,view.positionY,view.positionZ);cam.lookAt(view.targetX,view.targetY,view.targetZ);cam.rotateZ(view.roll);cam.fov=T.MathUtils.radToDeg(view.fov);}
      else{
        if(mode==='first'){if(s.lastCamera!==mode){s.firstYaw=0;s.firstPitch=RIDER_EYE_PITCH;}if(!paused){s.firstYaw=T.MathUtils.clamp(s.firstYaw-input.seats[i].lookX*dt*1.7,-1.45,1.45);s.firstPitch=T.MathUtils.clamp(s.firstPitch-input.seats[i].lookY*dt*1.3,-1.25,.7);}s.hero.root.updateMatrixWorld(true);}
        frameElmwoodCamera(mode,p,reducedMotion.matches||cameraMotion.value==='calm',framing,{head:(s.motion.cycling?s.bike?.head:s.hero.head)?.getWorldPosition(new T.Vector3()),yaw:s.firstYaw,pitch:s.firstPitch});clearElmwoodCamera(framing.eye,anchor,terrain!,direction);
        if(s.lastCamera!==mode||mode==='first')cam.position.copy(framing.eye);else if(!paused)cam.position.lerp(framing.eye,1-Math.exp(-dt*(mode==='drone'&&!reducedMotion.matches?2.4:10)));
        clearElmwoodCamera(cam.position,anchor,terrain!,direction);
        if(mode==='drone'){if(s.lastCamera!==mode)s.droneTarget.copy(framing.target);else if(!paused)s.droneTarget.lerp(framing.target,1-Math.exp(-dt*(reducedMotion.matches?10:3)));cam.lookAt(s.droneTarget);}else cam.lookAt(framing.target);
        cam.rotateZ(framing.roll);cam.fov=framing.fov;
      }
    }
    s.lastCamera=mode;cam.updateProjectionMatrix();
  }
  function saveBest(s:Seat){
    if(s.bestRecorded||!s.run.finished)return;s.bestRecorded=true;const r=s.run,key='elmwood-best-'+r.mode+(s.motion.cycling?'-bicycle-v1':'');
    try{const old=Number(localStorage.getItem(key)),value=r.mode==='tricks'?r.score:r.finishTime;if(!old||(r.mode==='tricks'?value>old:value<old)){localStorage.setItem(key,String(value));if(r.mode==='sprint'||r.mode==='tour')localStorage.setItem('elmwood-splits-'+r.mode+(s.motion.cycling?'-bicycle-v1':''),JSON.stringify(r.splits));}best.textContent='Personal best: '+localStorage.getItem(key)+(r.mode==='tricks'?' points':' seconds');}catch{best.textContent='Result saved for this session.';}
  }
  const settingsRoot=document.querySelector<HTMLElement>('aside')!;
  const closeSettings=document.createElement('button');closeSettings.textContent='Close settings';closeSettings.onclick=()=>{document.body.classList.remove('controls-open');document.getElementById('elmwood-menu')?.setAttribute('aria-expanded','false');canvas.focus();};
  const touchPreferences=document.getElementById('elmwood-touch-mode')?.parentElement;
  const mapLayoutButton=document.createElement('button');mapLayoutButton.textContent='Customize mini-map';mapLayoutButton.onclick=()=>miniMap.layout.edit();
  el<HTMLDetailsElement>('musicPanel').open=true;
  settingsPanel(settingsRoot,closeSettings,[
    {name:'Controls',nodes:[mapLayoutButton,...(touchPreferences?[touchPreferences]:[]),...controlNodes(settingsRoot,['#session-input-0','#session-input-1','#session-touch-edit','#session-help'])]},
    {name:'Graphics',nodes:[...settingsRoot.querySelectorAll('.graphicsSettings'),...controlNodes(settingsRoot,['#season','#weather','#time','#date','label:has(#dressing)'])]},
    {name:'Audio',nodes:controlNodes(settingsRoot,['#session-audio','#session-spirit-sound','#musicPanel'])},
    {name:'Gameplay',nodes:[settings,...controlNodes(settingsRoot,['#ride-outfit','#ride-camera','#ride-camera-next','#ride-start','#ride-reset'])]},
    {name:'Replay',nodes:[film.panel]}
  ],'Landmarks');
  document.body.classList.add('elmwood-tactical-ui');
  const loveTag=new LoveTagClient({product:'elmwood-explorer',scene,camera,canvas,mountDisplay,menu:document.querySelector<HTMLElement>('#elmwood-main-menu .menu-actions')!,
    fixtureUrl:new URL('./love-tag/elmwood-explorer.json',location.href).href,configUrl:new URL('./love-tag/config.json',location.href).href,
    prepare:initialize,async createView(tagTerrain){return new ThreeRiderView(cycleAssets!.get('DS_Man_01')!,cycleAssets!.get('DS_EUC_01')!,tagTerrain);},
    suspend(){const wasPaused=paused,orbitEnabled=controls.enabled;pause(true);controls.enabled=false;const roots=[...seats.flatMap(s=>[s.hero.root,s.bike?.root,s.dogView?.root]),walkers?.root,community?.view.root,gates].filter((o):o is T.Group=>!!o);const saved=roots.map(o=>({o,visible:o.visible}));for(const {o}of saved)o.visible=false;
      music.update(0,'ride',false,0,0,0);return ()=>{for(const {o,visible}of saved)o.visible=visible;controls.enabled=orbitEnabled;pause(wasPaused);clearInput();mainMenu.open();};}});
  installLoveTagMainMenu(loveTag,()=>mainMenu.open());
  return {stop,pause,dogThreats,tagFocus:()=>loveTag.sceneFocus,tagUpdate(dt:number){const tagging=loveTag.update(dt);if(tagging){miniMap.setRaceCourse(null);miniMap.update([],false);}return tagging;},async startVR(){
    if(active&&(count!==1||seats[0].motion.cycling))stop();vehicle.value='euc';players.value='1';inputs[0].value='wasd';
    if(!active)await toggleRide();if(!active)throw new Error('The rider could not load.');
    count=1;configure();clearInput();vrMode=true;vrPacket=undefined;pause(false);
    document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.close();
  },endVR(){vrMode=false;vrPacket=undefined;clearInput();pause(true);},pauseVR(){pause(true);},
  vrInput(packet:VRPacket){vrPacket=packet;if(packet.pause)pause();},vrPose(){return active?seats[0]?.motion.pose:undefined;},update(dt:number){
    bikeRecover.hidden=!(active&&seats[0]?.motion.cycling&&!vrMode&&!film.playing&&!document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.open);
    filmDelta=dt;
    if(onlineRide?.active){onlineRide.update(dt);const p=onlineRide.pose!;miniMap.update(onlineRide.positions.map(v=>({x:v.x,y:v.z,heading:Math.PI-p.headingY})),!onlineMenu.open);film.capture(dt,!onlineMenu.open&&!film.playing,!onlineMenu.open);audio.update(p,!onlineMenu.open);music.update(dt,'ride',!onlineMenu.open,p.speed,0,p.warningLevel);touch.update();return;}
    if(film.playing)return;
    if(!active||!terrain){community?.ui.update(false);if(community)community.view.root.visible=false;film.capture(0,false,false);miniMap.update([],false);return;}

    community?.update(dt,communityVisible()&&!film.playing,paused,seats[0].motion.terrain.navigationObstacles?.(seats[0].motion.pose.x,seats[0].motion.pose.z,1000)??[],seats[0].motion.cycling?'bicycle':'euc');if(community){community.ui.update(communityVisible()&&!document.body.classList.contains('controls-open')&&!document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.open);canvas.dataset.community=JSON.stringify({stage:community.ride.stage,joined:community.ride.joined,gate:community.ride.nextGate,completed:community.ride.completed,laps:community.ride.laps,continuous:community.ride.continuous,riders:community.ride.riders});}canvas.dataset.vehicle=seats[0].motion.vehicleId;
    const guided=seats[0].run.mode==='tour'||seats[0].run.mode==='sprint';
    racePack.update(dt,racePilots,paused||countdown>0||seats[0].run.finished);for(const [i,pilot]of racePilots.entries()){const view=raceViews[i];view.root.visible=true;if(view instanceof BicycleView)view.apply(pilot.pose,(pilot.sim as import('@digital-static/ridecore/cycling').BicycleController).steeringAngle,(pilot.sim as import('@digital-static/ridecore/cycling').BicycleController).pedalPhase);else view.apply(pilot.pose);}
    if(racePilots.length){const order=elmwoodRaceOrder(seats[0].run,seats[0].motion.pose,racePilots[0].route,racePilots);canvas.dataset.racePlace=String(order.findIndex(r=>r.name==='YOU')+1);canvas.dataset.raceOpponents=JSON.stringify(racePilots.map(p=>({gate:p.run.gate,station:p.station,speed:p.pose.speed,finished:p.run.finished,recoveries:p.recoveries})));}miniMap.setRoute([],[],guided?'Creek Lane · follow the gates':'Elmwood · lanes & pond');if(communityVisible()&&community?.ride.joined)miniMap.setRoute(community.ride.route.points.map(p=>({x:p.x,y:p.z})),[],'Elmwood community tour');
    if(!paused&&!vrMode){const error=input.poll(pads());if(error){pause(true);message.textContent=error;}}
    if(!paused&&countdown>0){countdown=Math.max(0,countdown-dt);clearInput();}
    if(!paused)walkers?.update(dt,dogThreats(),seats.slice(0,count).map(s=>s.motion.pose).concat(racePilots.map(p=>p.pose),communityVisible()?community!.ride.riders.map(r=>({...seats[0].motion.pose,...r})):[]));Object.assign(canvas.dataset,{fleeingWalkers:String(walkers?.fleeing??0),photographingVisitors:String(walkers?.photographing??0),cyclists:String(walkers?.cyclists??0)});const contacts=targets();
    for(let i=0;i<count;i++){
      const s=seats[i],packet=vrMode&&vrPacket?{actions:vrPacket.actions,recover:!paused&&vrPacket.recover,camera:false}:input.consume(i,s.motion.pose.speed,Number(trick.value));if(packet.recover){resetSeat(i,true);packet.actions={...NEUTRAL_ACTIONS};}if(packet.camera&&!vrMode)cycleCamera(i);
      const lastGate=s.run.gate,lastFinished=s.run.finished;
      s.motion.update(dt,{...packet.actions,eyeControl:!vrMode&&cameras[i].value==='first'},paused||countdown>0);
      if(s.raceRecovery&&!s.motion.sim.crashed){const r=s.raceRecovery;s.raceRecovery=undefined;s.motion.reset(r.position,r.heading);s.run.relocate(s.motion.pose);s.lastCamera='';s.dog?.reset(s.motion.pose);clearInput(i);}
      s.run.update(dt,s.motion.pose,s.motion.events,paused||countdown>0);
      if(!i&&!paused&&countdown<=0){for(const event of s.motion.events){if(event.type==='landing')audio.landing(event.impact,s.motion.terrain.sampleGround(s.motion.pose.x,s.motion.pose.z,audioSample).surface);if(event.type==='trick'&&event.points>0)audio.confirm('trick');}if(s.run.gate>lastGate)audio.confirm(s.run.finished&&!lastFinished?'finish':'checkpoint');}
      saveBest(s);frameSeat(s,i,dt);
      if(s.dog&&s.dogView&&wantsDog(i)){if(!paused)s.dog.update(s.motion.pose,dt,contacts);s.dogView.update(s.dog,paused?0:dt);}
      const p=s.motion.pose,ss=s.motion.sim.snapshot();
      if(!i&&practice&&!paused){
        practice.observe(p,ss.grounded,s.motion.events.some(e=>e.type==='landing'&&(e.quality==='clean'||e.quality==='charged')),Math.abs(packet.actions.throttle)<.05);
        if(practice.complete){try{localStorage.setItem(practiceKey(),'complete');}catch{}practiceLabel();}
        const text=`${Math.min(6,practice.stepIndex+1)}/6 · ${practice.instruction}`;
        if(practicePanel.querySelector('p')!.textContent!==text)practicePanel.querySelector('p')!.textContent=text;
        canvas.dataset.practice=String(practice.stepIndex);
      }
      if(!i)Object.assign(canvas.dataset,{rider:outfits[i].value,speed:p.speed.toFixed(3),x:p.x.toFixed(2),z:p.z.toFixed(2),heading:p.headingY.toFixed(4),paused:String(paused),rest:p.stopFoot.toFixed(3),crashed:String(ss.crashed),lean:p.riderPitch.toFixed(3),roll:p.rollAngle.toFixed(3),crouch:p.crouch.toFixed(3),hops:String(ss.hops),landings:String(ss.landings),cameraMode:cameras[i].value,eyeControl:String(!vrMode&&cameras[i].value==='first'),eyeYaw:s.firstYaw.toFixed(4),eyePitch:s.firstPitch.toFixed(4),eyeRoll:s.framing.roll.toFixed(4),cameraMotion:cameraMotion.value,cameraX:camera.position.x.toFixed(2),cameraY:camera.position.y.toFixed(2),cameraZ:camera.position.z.toFixed(2)});
      Object.assign(canvas.dataset,i?{p2X:p.x.toFixed(2),p2Z:p.z.toFixed(2),p2Speed:p.speed.toFixed(3),p2Hops:String(ss.hops),p2Camera:cameras[i].value}:{});
      canvas.dataset[i?'p2Score':'score']=String(s.run.score);canvas.dataset[i?'p2Gate':'gate']=String(s.run.gate);canvas.dataset[i?'p2Dog':'dog']=String(!!s.dogView?.root.visible);canvas.dataset[i?'p2DogDistance':'dogDistance']=s.dog?Math.hypot(s.dog.x-p.x,s.dog.z-p.z).toFixed(2):'0';
      canvas.dataset[i?'p2DogCommand':'dogCommand']=s.dog?.command??'off';canvas.dataset[i?'p2DogPose':'dogPose']=s.dogView?.gait??'none';canvas.dataset[i?'p2DogExcitement':'dogExcitement']=s.dog?.excitement.toFixed(2)??'0';
      const target=s.run.gates[s.run.gate];markers[i].visible=!!target&&!s.run.finished&&!s.run.failed&&(s.run.mode==='sprint'||s.run.mode==='tour');
      if(markers[i].visible){markers[i].position.set(target.x,terrain.height(target.x,-target.z)+.08,target.z);const prev=s.run.gates[s.run.gate-1];markers[i].rotation.y=Math.atan2(target.x-prev.x,target.z-prev.z);}
      if(!map.hidden){const dot=map.querySelector('#route-p'+(i+1));dot?.setAttribute('cx',String(p.x));dot?.setAttribute('cy',String(p.z));}map.querySelector('#route-p2')?.setAttribute('visibility',count===2?'visible':'hidden');
    }
    miniMap.setRaceCourse(guided&&raceCourse?{...raceCourse,next:seats[0].run.gate-1,finished:seats[0].run.finished}:null);
    miniMap.update([...seats.slice(0,count).map(s=>({x:s.motion.pose.x,y:s.motion.pose.z,heading:Math.PI-s.motion.pose.headingY})),...racePilots.map(p=>({x:p.pose.x,y:p.pose.z,heading:Math.PI-p.pose.headingY}))],!vrMode&&!document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.open);
    const appeared=spirits.update(dt,seats.slice(0,count).map(s=>s.motion.pose),terrain,paused||countdown>0,spiritToggle.checked,spiritSound.checked,reducedMotion.matches);
    if(appeared){const s=seats[spirits.events.active!.seat];s.run.message='A spirit passes…';s.run.messageTime=3.8;}
    Object.assign(canvas.dataset,{spiritEncounters:String(spirits.events.seen),spiritVisible:String(spirits.root.visible)});
    film.capture(dt,!paused&&countdown<=0,active&&!vrMode&&!document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.open);
    audio.update(seats[0].motion.pose,!paused&&countdown<=0,seats[0].motion.cycling,seats[0].motion.terrain.sampleGround(seats[0].motion.pose.x,seats[0].motion.pose.z,audioSample).surface);music.update(dt,seats[0].run.mode==='tricks'?'style':'ride',!paused,seats[0].motion.pose.speed,seats[0].run.score,seats[0].motion.pose.warningLevel);
    const overlayHidden=vrMode||document.body.classList.contains('controls-open')||!!document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.open;
    practicePanel.hidden=!practice||overlayHidden||paused;
    resultPanel.hidden=overlayHidden||!seats.slice(0,count).every(s=>s.run.finished||s.run.failed);
    if(!resultPanel.hidden){const text=seats.slice(0,count).map((s,i)=>(count===2?'Player '+(i+1)+': ':'')+s.run.label+(!i&&racePilots.length?' · '+canvas.dataset.racePlace+'/4 place':'')).join(' · ')+(best.textContent?' · '+best.textContent:'');if(resultPanel.querySelector('p')!.textContent!==text)resultPanel.querySelector('p')!.textContent=text;}
    hudClock+=dt;if(hudClock>.12){hudClock=0;const boxes=rects();for(let i=0;i<count;i++){
      const s=seats[i],r=boxes[i],p=s.motion.pose;hud[i].hidden=false;hud[i].style.left=(r.x+12)+'px';hud[i].style.top=(r.y+(count===2&&i?12:count===2&&(innerWidth<750||innerHeight<500)?68:innerWidth<750?204:222))+'px';
      const heading=paused?'PAUSED':countdown>0?'Ready · '+Math.ceil(countdown):p.crashRecovery>0?'Getting back up…':s.motion.sim.crashed?'Fallen · recover':`${Math.abs(p.speed*3.6).toFixed(0)} km/h${input.seats[i].cruise?' · CRUISE':''}`;
      hud[i].replaceChildren();const strong=document.createElement('strong');strong.textContent=(count===2?'P'+(i+1)+' · ':'')+heading;hud[i].append(strong,document.createTextNode('\n'+s.run.label+(!i&&racePilots.length?' · '+canvas.dataset.racePlace+'/4 place':'')+(wantsDog(i)&&s.dog?'\nDog · '+s.dog.note:'')+(s.run.messageTime>0&&!s.run.finished?'\n'+s.run.message:'')));
    }
    status(paused?'Paused · P / Resume ride':seats[0].motion.cycling?'Bicycle · forward pedals · pull back to brake, then back up · C camera · R recover':count===2?'P1 WASD · P2 arrows · P pause · Settings for gamepads, touch and challenges':'WASD / arrows · Space hop · T trick · R recover · C camera · Settings for more');touch.update();}
  },render(renderer:T.WebGLRenderer){
    if(film.render(filmDelta,renderer,scene,camera,(focus,wanted)=>{controls.target.copy(focus);if(terrain)wanted.y=Math.max(wanted.y,terrain.height(wanted.x,-wanted.z)+.5);})){divider.hidden=true;return true;}
    if(onlineRide?.active)return onlineRide.render(renderer);
    if(!active)return false;
    if(vrMode&&renderer.xr.isPresenting){renderer.setScissorTest(false);seats[0].hero.rider.visible=false;renderer.render(scene,camera);seats[0].hero.rider.visible=true;return true;}
    const boxes=rects();const size=renderer.getSize(new T.Vector2());if(size.x!==innerWidth||size.y!==innerHeight)renderer.setSize(innerWidth,innerHeight);renderer.setScissorTest(true);const shadows=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    for(let i=0;i<count;i++){
      const r=boxes[i],s=seats[i],aspect=r.width/r.height;if(s.camera.aspect!==aspect){s.camera.aspect=aspect;s.camera.updateProjectionMatrix();}
      renderer.setViewport(r.x,innerHeight-r.y-r.height,r.width,r.height);renderer.setScissor(r.x,innerHeight-r.y-r.height,r.width,r.height);
      s.hero.rider.visible=cameras[i].value!=='first'||s.motion.sim.crashed;if(s.bike)s.bike.rider.visible=cameras[i].value!=='first';renderer.render(scene,s.camera);s.hero.rider.visible=true;if(s.bike)s.bike.rider.visible=true;
    }
    renderer.shadowMap.autoUpdate=shadows;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
    divider.hidden=count!==2;if(count===2){const stacked=boxes[1].y>0;Object.assign(divider.style,{left:(stacked?0:boxes[1].x-1)+'px',top:(stacked?boxes[1].y-1:0)+'px',width:stacked?'100vw':'2px',height:stacked?'2px':'100vh'});}
    return true;
  },streamPoints(){if(onlineRide?.active)return onlineRide.positions;return film.playing?[{x:film.position.x,z:film.position.z}]:seats.slice(0,count).map(s=>({x:s.motion.pose.x,z:s.motion.pose.z}));},nearPlayers(center:T.Vector3,radius:number){if(onlineRide?.active)return onlineRide.positions.some(p=>Math.hypot(center.x-p.x,center.z-p.z)<radius);return film.playing?Math.hypot(center.x-film.position.x,center.z-film.position.z)<radius:!active||seats.slice(0,count).some(s=>Math.hypot(center.x-s.motion.pose.x,center.z-s.motion.pose.z)<radius);}};
}
