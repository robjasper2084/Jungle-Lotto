import * as T from 'three';
import {NEUTRAL_ACTIONS,lerpPose,copyPose,RIDER_EYE_PITCH,HUMAN_PROFILE,type RideActions} from '@digital-static/ridecore';
import type {GLTF} from './compressedGLTFLoader.ts';
import {ElmwoodOnlineRooms} from './onlineRooms.ts';
import type {RoomMatch,RoomFrame} from './onlineProtocol.ts';
import {ElmwoodSessionInput,type Action,type Binding} from './elmwood-session-input.ts';
import {ElmwoodRun,laneGates} from './elmwood-gameplay.ts';
import {ElmwoodRacePilot} from './elmwood-race.ts';
import {RideMotion} from './ride-motion.ts';
import {ThreeRiderView} from './riding/threeRiderView.ts';
import {SWOOP_RIDERS} from './riding/elmwoodRiders.ts';
import type {ElmwoodTerrain} from './elmwood-terrain.ts';
import {cameraFrame,frameElmwoodCamera,clearElmwoodCamera,cameraMode,nextElmwoodCamera} from './elmwood-camera.ts';
import {chooseElmwoodSpawn} from './elmwood-details.ts';
import {eucProfile} from './electricVehicles.ts';
import {elmwoodRaceRecovery} from './elmwood-race-recovery.ts';

type Rider={motion:RideMotion;view:ThreeRiderView;run:ElmwoodRun;camera:T.PerspectiveCamera;bot?:ElmwoodRacePilot};
export function multiplayerRects(w:number,h:number,count:number){
 if(count===1)return [{x:0,y:0,width:w,height:h}];
 const columns=count===2&&h>w?1:2,rows=Math.ceil(count/columns);
 return Array.from({length:count},(_,i)=>{const x=Math.floor(i%columns*w/columns),y=Math.floor(Math.floor(i/columns)*h/rows);return {x,y,width:Math.floor((i%columns+1)*w/columns)-x,height:Math.floor((Math.floor(i/columns)+1)*h/rows)-y};});
}
/** The host runs the actual Elmwood RideCore terrain; guests render validated host frames. */
export class ElmwoodOnlineRide {
 readonly input=new ElmwoodSessionInput();readonly board=document.createElement('section');
 private scene:T.Scene;private mainCamera:T.PerspectiveCamera;private canvas:HTMLCanvasElement;private rooms:ElmwoodOnlineRooms;
 private riders:Rider[]=[];private terrain?:ElmwoodTerrain;private match?:RoomMatch;private local=false;private own=0;private countdown=0;private elapsed=0;private frozen=false;
 private cameraView='chase';private framing=cameraFrame();private anchor=new T.Vector3();private direction=new T.Vector3();private head=new T.Vector3();private readyCamera=false;private boardAt=0;
 private modeSelect?:HTMLSelectElement;
 constructor(scene:T.Scene,camera:T.PerspectiveCamera,canvas:HTMLCanvasElement,rooms:ElmwoodOnlineRooms){
  this.scene=scene;this.mainCamera=camera;this.canvas=canvas;this.rooms=rooms;
  this.board.id='elmwood-online-scoreboard';this.board.setAttribute('aria-label','Multiplayer race and scores');this.board.hidden=true;document.body.append(this.board);
  addEventListener('keydown',e=>{if(!this.active||(e.target as HTMLElement)?.closest('input,select,textarea,button,a,summary,dialog'))return;
   if(e.code==='KeyP'&&!e.repeat){e.preventDefault();this.pause(!this.frozen);return;}
   if(e.code==='Escape'){e.preventDefault();if(this.local)this.stop();else void this.rooms.leave();this.canvas.dispatchEvent(new Event('elmwood-main-menu'));return;}
   if(this.input.key(e.code,true,e.repeat))e.preventDefault();
  });
  addEventListener('keyup',e=>{if(this.active)this.input.key(e.code,false);});
  addEventListener('blur',()=>this.input.clear());
  canvas.addEventListener('online-release-input',()=>this.input.clear());
  canvas.addEventListener('elmwood-stick',((e:CustomEvent<{x:number;y:number}>)=>{if(this.active)this.input.stick(0,e.detail.x,e.detail.y);}) as EventListener);
  canvas.addEventListener('elmwood-player-input',((e:CustomEvent<{seat:number;action?:Action;down?:boolean;x?:number;y?:number;source?:string}>)=>{if(!this.active)return;const d=e.detail;if(d.action)this.input.touch(d.seat,d.action,!!d.down,d.source);else this.input.stick(d.seat,d.x??0,d.y??0);}) as EventListener);
  let backgroundAt=performance.now();window.setInterval(()=>{const now=performance.now(),dt=Math.min(.1,(now-backgroundAt)/1000);backgroundAt=now;if(document.hidden&&this.active&&!this.local&&this.rooms.isHost)this.update(dt);},40);
 }
 get active(){return !!this.match;}
 get pose(){return this.riders[this.own]?.motion.pose;}
 get actors(){return this.riders.map(r=>({root:r.view.root,body:r.view.rider}));}
 get positions(){return this.riders.map(r=>({x:r.motion.pose.x,z:r.motion.pose.z}));}
 action(action:Action){if(!this.active)return;this.input.touch(0,action,true);this.input.touch(0,action,false);this.canvas.focus();}
 nextCamera(){this.cameraView=nextElmwoodCamera(this.modeSelect?.value??this.cameraView);if(this.modeSelect)this.modeSelect.value=this.cameraView;this.readyCamera=false;}
 pause(value:boolean){this.frozen=value;this.input.clear();this.canvas.dataset.paused=String(value);}
 start(match:RoomMatch,slot:number,terrain:ElmwoodTerrain,assets:Map<string,GLTF>,wheel='euc',local=false){
  this.stop();this.match=match;this.own=slot;this.local=local;this.terrain=terrain;this.frozen=false;this.readyCamera=false;
  this.input.configure(local?match.members.map((_,i)=>(document.querySelector<HTMLSelectElement>('#session-input-'+i)?.value??['wasd','arrows','ijkl','numpad'][i]) as Binding):[this.rooms.binding]);
  this.modeSelect=document.querySelector<HTMLSelectElement>('#elmwood-online-view')!;
  const lane=terrain.features.find(f=>f.id==='59197492')!,gates=laneGates(lane.points),line=lane.points.map(p=>({x:p[0],z:-p[1]}));
  const runMode=match.mode==='race'?'sprint':match.mode==='tricks'?'tricks':match.mode==='tour'?'tour':'free';
  const origin=match.spawn===1?gates[0]:match.spawn===2?line[Math.floor(line.length*.5)]:match.spawn===3?line[Math.floor(line.length*.75)]:{x:4.46,z:9.07};
  const spawn=chooseElmwoodSpawn(terrain.segments,origin.x,-origin.z,new T.Vector3(0,0,1));
  const heading=runMode==='sprint'||runMode==='tour'?Math.atan2(gates[1].x-gates[0].x,gates[1].z-gates[0].z):spawn.heading;
  const base=runMode==='sprint'||runMode==='tour'?gates[0]:{x:spawn.x,z:-spawn.north};
  match.members.forEach((member,i)=>{
   const profile=SWOOP_RIDERS.find(r=>r.id===member.rider)?.profile??HUMAN_PROFILE,motion=new RideMotion(terrain,profile);motion.selectVehicle(wheel);motion.follow.calm=document.documentElement.dataset.reducedMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;
   const euc=eucProfile(wheel),view=new ThreeRiderView(assets.get(member.rider)!,assets.get(euc?'Euc_'+euc.id:'DS_EUC_01')??assets.get('DS_EUC_01')!,motion.terrain,profile);
   const side=(i%2?1:-1)*.7,back=Math.floor(i/2)*2,x=base.x+Math.cos(heading)*side-Math.sin(heading)*back,z=base.z-Math.sin(heading)*side-Math.cos(heading)*back;
   motion.reset({x,y:terrain.height(x,-z),z},heading);const run=new ElmwoodRun(gates);run.reset(runMode,motion.pose);
   const bot=member.bot?new ElmwoodRacePilot(motion.terrain,line,gates,Math.max(0,i-1),false,match.difficulty??'expert',undefined,euc):undefined;
   if(bot)bot.sim.wheelScale=profile.wheelScale;
   this.scene.add(view.root);this.riders.push({motion,view,run,camera:i===slot?this.mainCamera:this.mainCamera.clone(),bot});view.apply(motion.pose);
  });
  this.countdown=local&&runMode!=='sprint'?0:Math.max(0,Math.min(3,(match.startAt-Date.now())/1000));this.elapsed=0;
  Object.assign(this.canvas.dataset,{riding:'true',players:local?String(match.members.length):'1',onlinePlayers:String(match.members.length),paused:'false',vehicle:wheel});document.body.classList.toggle('onlinePlaying',!local);
  document.body.classList.toggle('duo-riding',local);this.board.hidden=false;this.canvas.focus();
 }
 stop(){for(const r of this.riders)r.view.dispose();this.riders=[];this.match=undefined;this.terrain=undefined;this.board.hidden=true;this.input.clear();this.canvas.dataset.riding='false';delete this.canvas.dataset.online;delete this.canvas.dataset.onlinePlayers;document.body.classList.remove('onlinePlaying','duo-riding');}
 private recover(i:number){const r=this.riders[i];if(r.motion.sim.crashed){r.motion.update(1/120,{reset:true});return;}const recovery=elmwoodRaceRecovery(r.run,r.motion.terrain,0);if(recovery){r.motion.reset(recovery.position,recovery.heading);r.run.relocate(r.motion.pose);if(r.run.mode==='sprint')r.run.elapsed+=5;}this.input.clear(this.local?i:0);}
 private snapshot():Omit<RoomFrame,'match'|'seq'>{return {countdown:this.countdown,elapsed:this.elapsed,done:this.riders.every(r=>r.run.finished),riders:this.riders.map(r=>({pose:{...r.motion.pose},gate:r.run.gate,station:r.run.distance,finish:r.run.finished?r.run.finishTime:null,missed:r.run.failed,banked:r.run.score,message:r.run.label.slice(0,240),crashed:r.motion.sim.crashed,fallPhase:r.motion.sim.snapshot().fallPhase}))};}
 update(dt:number){
  if(!this.match||!this.terrain)return;
  const menu=!!document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.open,blocked=this.frozen||menu||document.hidden||this.rooms.inputBlocked||!this.local&&!this.rooms.healthy;
  const error=this.input.poll(Array.from(navigator.getGamepads?.()??[]));if(error)this.pause(true);
  const ownRider=this.riders[this.own],packet=this.input.consume(this.local?this.own:0,ownRider.motion.pose.speed,Number(document.querySelector<HTMLSelectElement>('#session-trick')?.value??1));
  let actions:RideActions=blocked?{...NEUTRAL_ACTIONS}:{...packet.actions,reset:packet.recover};
  if(packet.camera&&!blocked)this.nextCamera();
  const host=this.local||this.rooms.isHost;
  if(host){
   if(!this.local||!blocked){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown<=0)this.elapsed+=dt;}
   const controls=this.local?this.riders.map((r,i)=>i===this.own?actions:(()=>{const p=this.input.consume(i,r.motion.pose.speed,Number(document.querySelector<HTMLSelectElement>('#session-trick')?.value??1));return {...p.actions,reset:p.recover};})()):this.rooms.inputs(actions);
   const bots=this.riders.flatMap(r=>r.bot?[r.bot]:[]);
   this.riders.forEach((r,i)=>{
    if(r.bot){r.bot.update(dt,bots,this.countdown>0||this.local&&blocked);copyPose(r.bot.pose,r.motion.pose);Object.assign(r.run,{gate:r.bot.run.gate,elapsed:r.bot.run.elapsed,score:r.bot.run.score,finished:r.bot.run.finished,finishTime:r.bot.run.finishTime});return;}
    if(controls[i]?.reset){this.recover(i);controls[i]={...NEUTRAL_ACTIONS};}
    r.motion.update(dt,controls[i]??NEUTRAL_ACTIONS,this.countdown>0||this.local&&blocked);r.run.update(dt,r.motion.pose,r.motion.events,this.countdown>0||this.local&&blocked);
   });
  }else{
   const frame=this.rooms.frame;if(frame){this.countdown=frame.countdown;this.elapsed=frame.elapsed;frame.riders.forEach((remote,i)=>{const r=this.riders[i];lerpPose(r.motion.pose,remote.pose,1-Math.exp(-dt*16),r.motion.pose);r.motion.follow.step(dt,r.motion.pose);Object.assign(r.motion.view,{positionX:r.motion.follow.eye.x,positionY:r.motion.follow.eye.y,positionZ:r.motion.follow.eye.z,targetX:r.motion.follow.target.x,targetY:r.motion.follow.target.y,targetZ:r.motion.follow.target.z,roll:r.motion.follow.roll,fov:T.MathUtils.degToRad(r.motion.follow.fov)});Object.assign(r.run,{gate:remote.gate,score:remote.banked,elapsed:frame.elapsed,distance:remote.station,message:remote.message,finished:remote.finish!==null,finishTime:remote.finish??0,failed:remote.missed});});}
   if(actions.hop||actions.trick||actions.reset)this.rooms.command(actions);
  }
  this.riders.forEach(r=>{r.view.root.visible=true;r.view.apply(r.motion.pose);r.view.lights.setBeam(r===ownRider&&r.motion.pose.crashBlend<.1);});
  if(!this.local)this.rooms.update(dt,this.snapshot(),actions);
  const p=ownRider.motion.pose;Object.assign(this.canvas.dataset,{x:p.x.toFixed(2),z:p.z.toFixed(2),speed:p.speed.toFixed(3),heading:p.headingY.toFixed(4),crashed:String(p.crashBlend>.1),rider:this.match.members[this.own].rider,wheelLights:JSON.stringify(ownRider.view.lights.status),online:JSON.stringify({...this.rooms.state,local:this.local,players:this.riders.length,own:this.own,positions:this.positions})});
  const order=this.riders.map((r,i)=>({r,i})).sort((a,b)=>this.match!.mode==='tricks'?b.r.run.score-a.r.run.score:b.r.run.gate-a.r.run.gate||a.r.run.finishTime-b.r.run.finishTime);
  if(performance.now()-this.boardAt<100)return;this.boardAt=performance.now();
  this.board.replaceChildren();const heading=document.createElement('strong');heading.textContent=this.countdown>0?'Ready · '+Math.ceil(this.countdown):this.frozen?'Paused · P to resume':this.match.mode==='race'?'Creek Lane race':'Ride together · '+this.match.mode;this.board.append(heading);
  for(const {r,i} of order){const row=document.createElement('p');row.textContent=(i===this.own?'YOU':'P'+(i+1))+(this.match.members[i].bot?' · AI':'')+' · '+r.run.label;this.board.append(row);}
 }
 render(renderer:T.WebGLRenderer){
  if(!this.match||!this.terrain)return false;
  const selected=this.modeSelect?.value??'chase',split=this.local||selected==='split';const boxes=multiplayerRects(innerWidth,innerHeight,split?this.riders.length:1);
  const indices=split?this.riders.map((_,i)=>i):[this.own];renderer.setScissorTest(split);
  const reduced=document.documentElement.dataset.reducedMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  indices.forEach((i,k)=>{const r=this.riders[i],p=r.motion.pose,cam=r.camera,box=boxes[k],mode=cameraMode(selected==='split'?'chase':selected);
   if(mode==='chase'){const v=r.motion.view;cam.position.set(v.positionX,v.positionY,v.positionZ);cam.lookAt(v.targetX,v.targetY,v.targetZ);cam.fov=T.MathUtils.radToDeg(v.fov);}
   else{this.anchor.set(p.x,p.y+1,p.z);frameElmwoodCamera(mode,p,reduced,this.framing,{head:r.view.head?.getWorldPosition(this.head),yaw:0,pitch:RIDER_EYE_PITCH});clearElmwoodCamera(this.framing.eye,this.anchor,this.terrain!,this.direction);if(!this.readyCamera||mode==='first')cam.position.copy(this.framing.eye);else cam.position.lerp(this.framing.eye,1-Math.exp(-.1*10));cam.lookAt(this.framing.target);cam.rotateZ(this.framing.roll);cam.fov=this.framing.fov;}
   cam.aspect=box.width/box.height;cam.updateProjectionMatrix();r.view.rider.visible=mode!=='first'||p.crashBlend>0;
   renderer.setViewport(box.x,innerHeight-box.y-box.height,box.width,box.height);renderer.setScissor(box.x,innerHeight-box.y-box.height,box.width,box.height);renderer.render(this.scene,cam);r.view.rider.visible=true;
  });this.readyCamera=true;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);return true;
 }
}
