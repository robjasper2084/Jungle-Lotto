import {cutCoords} from './world.ts';
import {toMap} from './geo-profile.ts';
import {MACK_FINISH} from './district.ts';
import * as T from 'three';
import {Hero,loadActors} from './actors.ts';
import {createPose,type RidePose} from './controller.ts';
import type {DistrictRun,Challenge} from './district.ts';
import {DistrictView,routePosition} from './districtView.ts';
import {FlowCombo,Recorder,readRecording,replayPose,medalStars,REWARDS,dailyChallenge,PRACTICE_LINES,type Recording} from './replayRules.ts';
import {riderChoice} from './riderChoices.ts';
import {Soundtrack} from './soundtrack.ts';
import type {TerrainSampler} from './terrain.ts';
import type {DogPose} from './companion.ts';
const $=(id:string)=>document.getElementById(id)!;
export class RideLoop {
 flow=new FlowCombo();readonly music:Soundtrack;readonly daily=dailyChallenge();recorder=new Recorder();replay=false;
 private previousBest?:Recording;private completed?:Recording;private ghost?:Hero;private ghostMaterials:T.Material[]=[];private replayTime=0;private replayEnd=0;private ghostPose=createPose();
 private active?:Challenge;private currentRider='';private ghostKey='';private ghostEnabled=true;private ghostText='';private elapsed=0;private recordSaved='';private lastFlowEvents=0;private clipAt=0;private clipScore=0;private screenshot='';private outcome='';private scoreUrl='';
 private kit='stock';private gear:T.Object3D[]=[];private gearOwner?:Hero;private gearDog?:T.Object3D;private appliedKit='';private bestFlow=0;private outings=0;private apparel:{mesh:T.Mesh;original:T.Material|T.Material[];clones:T.Material[]}[]=[];
 private outing=false;private outingIndex=0;private outingRest=0;private outingDistance=0;private lastPosition?:{x:number;z:number};private dogRest=0;
 private readonly rests=[{...routePosition(1800,2.4),name:'Gratiot rest stop'},{...routePosition(2020,2.4),name:'Freight Yard rest stop'}];private restMarkers:T.Group[]=[];
 private telemetry:{event:string;time:number;detail:string}[]=[];private sessionStarted=performance.now();private lastCrash=false;private uiAt=0;
 constructor(private scene:T.Scene,private district:DistrictView,private terrain:TerrainSampler,map:string,private start:(c:Challenge)=>void,private free:()=>void,private message:(text:string)=>void){
  try{const s=JSON.parse(localStorage.getItem('swoop-progression-v1')??'{}');this.kit=REWARDS.some(r=>r.id===s.kit)?s.kit:'stock';this.bestFlow=Number.isFinite(s.bestFlow)?Math.max(0,s.bestFlow):0;this.outings=Number.isInteger(s.outings)?Math.max(0,s.outings):0;this.ghostEnabled=s.ghostEnabled!==false;}catch{}
  const garage=document.createElement('details');garage.id='rideGarage';garage.innerHTML='<summary>Your garage & replay settings</summary><p id="rewardProgress"></p><label>Riding kit <select id="rideKit" aria-label="Riding kit"></select></label><label><input id="personalGhost" type="checkbox"> Race my personal ghost</label><p id="ghostHelp">Finish a time trial to record your ghost. Best ghosts are separate for each rider.</p><p id="flowBest"></p><div id="garageArt"></div><p id="loopStorage" role="status"></p>';document.querySelector('.menuInner')!.append(garage);
  this.music=new Soundtrack(document.querySelector('.menuInner')!);
  const ghostCheck=garage.querySelector<HTMLInputElement>('#personalGhost')!;ghostCheck.checked=this.ghostEnabled;ghostCheck.onchange=()=>{this.ghostEnabled=ghostCheck.checked;this.save();};
  garage.querySelector<HTMLSelectElement>('#rideKit')!.onchange=e=>{this.kit=(e.target as HTMLSelectElement).value;this.save();};
  const board=document.createElement('details');board.id='extraRides';board.innerHTML='<summary>Daily line, practice & companion rides</summary><p>End-to-end practice runs, a daily route and a slower ride with your dog.</p><div class="loopButtons" id="extraRideButtons"></div><small id="dailyRecord"></small>';$('districtBoard').append(board);
  for(const c of [this.daily,...PRACTICE_LINES]){const b=document.createElement('button');b.className='extraRideStart';b.disabled=true;b.textContent=c.title;b.onclick=()=>this.start(c.id.startsWith('daily-')?dailyChallenge():c);$('extraRideButtons').append(b);}
  const dogButton=document.createElement('button');dogButton.className='extraRideStart';dogButton.disabled=true;dogButton.textContent='Companion ramble';dogButton.onclick=()=>{this.start(PRACTICE_LINES[0]);this.free();this.outing=true;this.outingIndex=0;this.outingRest=0;this.outingDistance=0;this.restMarkers.forEach(m=>m.visible=true);if($('dogToggle').getAttribute('aria-pressed')!=='true')$('dogToggle').click();this.message('Companion ramble · ride together to Mack Avenue and rest at both teal markers.');};$('extraRideButtons').append(dogButton);
  const lab=document.createElement('details');lab.innerHTML='<summary>Playtest notes · local only</summary><p>Record where a new player gets confused. No data is uploaded.</p><textarea id="playtestNotes" aria-label="Playtest notes" placeholder="Player 1: controls, crashes, replay choice…" rows="3"></textarea><button id="savePlaytest">Download playtest session</button>';$('districtBoard').append(lab);$('savePlaytest').onclick=()=>this.download('swoop-playtest.json',new Blob([JSON.stringify({game:'Swoop . Detroit',events:this.telemetry,notes:($('playtestNotes') as HTMLTextAreaElement).value},null,2)],{type:'application/json'}));
  const hud=document.createElement('div');hud.id='flowHUD';hud.hidden=true;hud.setAttribute('aria-live','off');document.body.append(hud);
  const replayBar=document.createElement('div');replayBar.id='replayBar';replayBar.hidden=true;replayBar.innerHTML='<span>YOUR RUN · HIGHLIGHT REPLAY</span><button id="stopReplay">Back to result</button>';document.body.append(replayBar);$('stopReplay').onclick=()=>this.stopReplay();
  const result=document.createElement('div');result.className='resultExtras';result.innerHTML='<p id="runExtras"></p><button id="watchReplay">Watch highlight</button><button id="saveScore">Save score card</button>';$('resultCopy').after(result);$('watchReplay').onclick=()=>this.playReplay();$('saveScore').onclick=()=>this.scoreCard();
  for(const [i,r]of this.rests.entries()){
   const g=new T.Group();g.position.set(r.x,r.y+.04,r.z);const mat=new T.MeshBasicMaterial({color:0x50d6bc,transparent:true,opacity:.7});const ring=new T.Mesh(new T.RingGeometry(.7,1,32),mat);ring.rotation.x=-Math.PI/2;g.add(ring);const post=new T.Mesh(new T.CylinderGeometry(.035,.035,1.1,8),mat);post.position.set(0,.55,0);g.add(post);g.visible=false;g.name=r.name;scene.add(g);this.restMarkers[i]=g;
  }
  this.refresh();this.log('boot',map);
 }
 ready(){document.querySelectorAll<HTMLButtonElement>('.extraRideStart').forEach(b=>b.disabled=false);}
 private log(event:string,detail=''){this.telemetry.push({event,time:Math.round((performance.now()-this.sessionStarted)/100)/10,detail});if(this.telemetry.length>300)this.telemetry.shift();}
 private save(){try{localStorage.setItem('swoop-progression-v1',JSON.stringify({kit:this.kit,bestFlow:this.bestFlow,outings:this.outings,ghostEnabled:this.ghostEnabled}));}catch{$('loopStorage').textContent='Storage unavailable. Rewards work for this session.';}}
 refresh(){Object.assign(this.daily,dailyChallenge());const stars=medalStars(this.district.records);$('rewardProgress').textContent=`${stars}/15 district stars · ${this.outings} companion rambles completed`;
  const select=$('rideKit') as HTMLSelectElement;select.replaceChildren();for(const r of REWARDS){const o=document.createElement('option');o.value=r.id;o.textContent=r.label+(stars<r.stars?` · unlock at ${r.stars} stars`:'');o.disabled=stars<r.stars;select.append(o);}if(stars<(REWARDS.find(r=>r.id===this.kit)?.stars??0))this.kit='stock';select.value=this.kit;
  $('flowBest').textContent=`Best banked flow combo: ${this.bestFlow} points. Mix carves, clean hops, tricks and brief pedal kisses. Hold control for five seconds to bank.`;
  const d=this.district.records[this.daily.id];$('dailyRecord').textContent=d?`Today’s best: ${d.value.toFixed(2)} s · ${d.completions} finishes. Resets at 00:00 UTC.`:'Daily conditions rotate at 00:00 UTC. Personal records only; no online leaderboard.';
  $('garageArt').replaceChildren();const photos=$('districtAlbum').querySelectorAll('img');if(photos.length){const title=document.createElement('p');title.textContent='Your Detroit art wall';$('garageArt').append(title);for(const photo of photos){const image=photo.cloneNode(true) as HTMLImageElement;image.className='garagePhoto';$('garageArt').append(image);}}
 }
 startRun(c:Challenge|undefined,rider:string,data:Awaited<ReturnType<typeof loadActors>>,p:RidePose){
  this.stopReplay(false);this.outing=false;this.restMarkers.forEach(m=>m.visible=false);this.active=c;this.currentRider=rider;this.flow=new FlowCombo();this.recorder=new Recorder();this.recorder.push(0,p);this.elapsed=0;this.lastFlowEvents=0;this.clipScore=0;this.clipAt=0;this.completed=undefined;document.getElementById('scorePreview')?.remove();if(this.scoreUrl){URL.revokeObjectURL(this.scoreUrl);this.scoreUrl='';}this.screenshot='';this.previousBest=undefined;this.ghostText='';this.recordSaved='';this.lastPosition=undefined;this.lastCrash=false;
  this.ghostKey=`swoop-ghost-end-to-end-v3:${c?.id??'free'}:${rider}`;
  if(c?.kind==='trial')try{this.previousBest=readRecording(localStorage.getItem(this.ghostKey),rider,c.id);}catch{}
  // Build only once for a rider and use isolated materials. Original characters stay untouched.
  if(!this.ghost||this.ghost.riderId!==rider){this.ghost?.dispose();this.ghostMaterials.forEach(m=>m.dispose());this.ghostMaterials=[];this.ghost=new Hero(data,this.terrain,riderChoice(rider));this.ghost.root.traverse(o=>{if(o instanceof T.Mesh){const convert=(m:T.Material)=>{const ghost=m.clone();ghost.transparent=true;ghost.opacity=.24;ghost.depthWrite=false;if('color'in ghost)ghost.userData.swoopOriginalColor=(ghost as T.MeshStandardMaterial).color.getHex();if('color'in ghost)(ghost as T.MeshStandardMaterial).color.set(0x7ee9e1);this.ghostMaterials.push(ghost);return ghost;};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);o.castShadow=false;}});this.scene.add(this.ghost.root);}
  this.ghost.root.visible=false;this.log('start',c?.id??'free');
 }
 retry(){if(this.active){this.log('retry',this.active.id);this.start(this.active);}}
 step(dt:number,p:RidePose,grounded:boolean,landing:string|undefined,trick:string|undefined,dog:DogPose,dogEnabled:boolean,specialActive=false,trickPoints=150){
  this.elapsed+=dt;this.recorder.push(this.elapsed,p);this.flow.step(dt,p,grounded,landing,trick,specialActive,trickPoints);
  if(this.flow.events>this.lastFlowEvents){this.lastFlowEvents=this.flow.events;if(this.flow.pending>=this.clipScore){this.clipScore=this.flow.pending;this.clipAt=this.elapsed;this.recorder.highlight=this.elapsed;}}
  if(p.crashBlend>0&&!this.lastCrash){this.log('crash',this.active?.id??'free');this.lastCrash=true;}if(p.crashBlend===0)this.lastCrash=false;
  if(this.flow.best>this.bestFlow){this.bestFlow=this.flow.best;this.save();}
  const distance=Math.hypot(dog.x-p.x,dog.z-p.z);this.dogRest=dogEnabled&&Math.abs(p.speed)<.25&&dog.speed<.5&&distance<3?this.dogRest+dt:0;
  if(this.outing){if(dogEnabled&&distance<5&&p.speed>1&&p.speed<6.8&&this.lastPosition)this.outingDistance+=Math.min(.1,Math.hypot(p.x-this.lastPosition.x,p.z-this.lastPosition.z));const r=this.rests[this.outingIndex];if(r&&dogEnabled&&this.dogRest>0&&Math.hypot(r.x-p.x,r.z-p.z)<5){this.outingRest+=dt;if(this.outingRest>3){this.restMarkers[this.outingIndex].visible=false;this.outingIndex++;this.outingRest=0;this.message('Good company · rest stop complete');}}else this.outingRest=0;
   if(this.outingIndex===2&&this.outingDistance>=700&&cutCoords(toMap(p.x,p.y,p.z).x,toMap(p.x,p.y,p.z).z).d>=MACK_FINISH-1){this.outing=false;this.outings++;this.save();this.refresh();this.music.celebrate();this.message('COMPANION RAMBLE COMPLETE · Teal companion collar unlocked');this.log('companion-finish');}
  }
  this.lastPosition={x:p.x,z:p.z};
 }
 checkpoint(count:number,time:number){this.recorder.splits.push(time);const old=this.previousBest?.splits[count-1];this.ghostText=old===undefined?'First ghost recording':`${Math.abs(time-old).toFixed(2)} s ${time<old?'ahead':'behind'} personal best`;}
 finish(run:DistrictRun,p:RidePose){this.outcome=run.failed?'Attempt ended':['','Bronze','Silver','Gold'][run.medal];this.recorder.push(this.elapsed,p,true);this.recorder.highlight=this.clipAt||Math.max(0,this.elapsed-3);this.completed=this.recorder.finish(this.currentRider,run.challenge.id,this.elapsed);if(run.done){this.flow.bank();this.bestFlow=Math.max(this.bestFlow,this.flow.best);this.save();this.music.celebrate();this.log('finish',`${run.challenge.id} ${run.elapsed.toFixed(2)}s medal=${run.medal}`);
   if(run.challenge.kind==='trial'&&this.elapsed<=900&&(!this.previousBest||run.elapsed<this.previousBest.elapsed)){try{localStorage.setItem(this.ghostKey,JSON.stringify({...this.completed,elapsed:run.elapsed}));this.recordSaved='New personal ghost saved.';}catch{this.recordSaved='Ghost storage is full; replay is available for this session.';}}
  }else this.log('failure',run.reason);
  $('runExtras').textContent=`Flow banked: ${this.flow.banked} · Best combo: ${this.flow.best}. ${this.ghostText} ${this.recordSaved}`;
  ($('watchReplay') as HTMLButtonElement).disabled=this.completed.frames.length<2;this.refresh();
 }
 private playReplay(){if(!this.completed||!this.ghost)return;this.replay=true;this.replayTime=Math.max(0,Math.min(this.completed.highlight,this.completed.frames.at(-1)![0])-4);this.replayEnd=Math.min(this.completed.frames.at(-1)![0],this.completed.highlight+3);if(this.replayEnd<=this.replayTime)this.replayEnd=this.completed.frames.at(-1)![0];$('challengeResults').hidden=true;$('challengeHUD').hidden=true;$('replayBar').hidden=false;this.log('replay');}
 stopReplay(showResults=true){if(this.replay&&showResults)$('challengeResults').hidden=false;this.replay=false;$('replayBar').hidden=true;if(this.ghost)this.ghost.root.visible=false;}
 render(dt:number,active:boolean,hero:Hero,dog:T.Object3D,camera:T.PerspectiveCamera,vr:boolean,trick?:{name:string;phase:string;pending:number;settleProgress:number}){
  this.applyKit(hero,dog);
  if(vr&&this.replay)this.stopReplay();($('watchReplay') as HTMLButtonElement).disabled=vr||!this.completed||this.completed.frames.length<2;
  if(this.ghost){this.ghost.root.visible=this.replay||(active&&this.ghostEnabled&&!!this.previousBest&&this.elapsed<=this.previousBest.elapsed);
   const recording=this.replay?this.completed:this.previousBest;if(recording&&this.ghost.root.visible){if(this.replay){this.replayTime+=dt*.8;if(this.replayTime>this.replayEnd)this.replayTime=Math.max(0,Math.min(recording.highlight,recording.frames.at(-1)![0])-4);}
    replayPose(recording,this.replay?this.replayTime:this.elapsed,this.ghostPose);this.ghost.apply(this.ghostPose);
    for(const m of this.ghostMaterials){m.opacity=this.replay?1:.24;m.depthWrite=this.replay;if('color'in m)(m as T.MeshStandardMaterial).color.set(this.replay?(m.userData.swoopOriginalColor??0xffffff):0x7ee9e1);}
    if(this.replay){hero.root.visible=false;dog.visible=false;const p=this.ghostPose;camera.position.set(p.x-Math.sin(p.headingY+1)*4,p.y+2.1,p.z-Math.cos(p.headingY+1)*4);camera.lookAt(p.x,p.y+1,p.z);camera.fov=55;camera.updateProjectionMatrix();}
   }
  }
  if(performance.now()-this.uiAt>100){const hud=$('flowHUD');hud.hidden=vr||!active||this.replay;const detail=trick&&trick.phase!=='idle'?`${trick.name} · ${trick.phase==='settle'?`settling ${Math.round(trick.settleProgress*100)}%`:trick.phase} · ${trick.pending} potential`:this.flow.settleProgress?`Landing · settling ${Math.round(this.flow.settleProgress*100)}%`:this.flow.lost?'Combo lost · banked points kept':this.ghostText;
   hud.textContent=`RUN SCORE · ${this.flow.banked}`+(this.flow.pending?` | +${this.flow.pending} pending · ${Math.round(this.flow.bankProgress*100)}% to bank`:'')+(detail?` | ${detail}`:'')+(this.outing?` | RAMBLE ${Math.floor(this.outingDistance)} m · finish at Mack · ${this.outingIndex}/2 rests`:'');this.uiAt=performance.now();}
 }
 capture(canvas:HTMLCanvasElement){if(!this.completed||this.screenshot)return;const c=document.createElement('canvas');c.width=640;c.height=360;c.getContext('2d')!.drawImage(canvas,0,0,640,360);this.screenshot=c.toDataURL('image/jpeg',.8);}
 private scoreCard(){if(!this.completed)return;const c=document.createElement('canvas');c.width=1080;c.height=720;const ctx=c.getContext('2d')!;const draw=()=>{ctx.fillStyle='#103d35';ctx.fillRect(0,400,1080,320);ctx.fillStyle='#e7d593';ctx.font='bold 48px Arial';ctx.fillText('Swoop . Detroit',48,466);ctx.fillStyle='#fff';ctx.font='30px Arial';ctx.fillText(this.active?.title??'Your ride',48,521);ctx.font='24px Arial';ctx.fillText(`${this.completed!.elapsed.toFixed(2)} s · ${this.flow.banked} flow points`,48,570);ctx.fillText(`${this.outcome} · ${medalStars(this.district.records)} district stars`,48,612);ctx.font='18px Arial';ctx.fillText('Dequindre Cut, Detroit',48,666);c.toBlob(blob=>{if(!blob)return;if(this.scoreUrl)URL.revokeObjectURL(this.scoreUrl);this.scoreUrl=URL.createObjectURL(blob);let preview=document.getElementById('scorePreview');if(!preview){preview=document.createElement('div');preview.id='scorePreview';$('runExtras').after(preview);}preview.replaceChildren();const image=new Image();image.src=this.scoreUrl;image.alt='Your Swoop Detroit score card';image.style.cssText='display:block;width:100%;max-width:360px;border-radius:8px;margin:12px 0';const link=document.createElement('a');link.href=this.scoreUrl;link.download='Swoop-Detroit-score.png';link.textContent='Download your score card (PNG)';preview.append(image,link);this.download('Swoop-Detroit-score.png',blob);},'image/png');};ctx.fillStyle='#102d29';ctx.fillRect(0,0,1080,720);if(this.screenshot){const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,1080,400);draw();};img.src=this.screenshot;}else draw();this.log('score-card');}
 private download(name:string,blob:Blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 private applyKit(hero:Hero,dog:T.Object3D){const key=this.kit+':'+(this.outings>0);if(this.gearOwner===hero&&this.gearDog===dog&&key===this.appliedKit)return;for(const a of this.apparel){a.mesh.material=a.original;a.clones.forEach(m=>m.dispose());}this.apparel=[];for(const g of this.gear){g.removeFromParent();g.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});}this.gear=[];this.gearOwner=hero;this.gearDog=dog;this.appliedKit=key;
  const reward=REWARDS.find(r=>r.id===this.kit)??REWARDS[0],stars=medalStars(this.district.records);if(reward.stars>stars)return;
  const add=(parent:T.Object3D,geometry:T.BufferGeometry,color:number,position:T.Vector3,rotation?:T.Euler,glow=false)=>{const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,emissive:glow?color:0,emissiveIntensity:.7,roughness:.55}));m.position.copy(position);if(rotation)m.rotation.copy(rotation);parent.add(m);this.gear.push(m);return m;};
  if(this.kit!=='stock'){
   this.tintHoodie(hero,reward.color);
   for(const side of [-1,1])add(hero.vehicle,new T.TorusGeometry(.18,.009,6,28),reward.color,new T.Vector3(side*.085,.26,0),new T.Euler(0,Math.PI/2,0),true);
   for(const hand of hero.arms)add(hand.foot,new T.TorusGeometry(.043*hero.motionScale,.014*hero.motionScale,6,14),reward.color,new T.Vector3(0,.025*hero.motionScale,0),new T.Euler(Math.PI/2,0,0));
  }
  if(stars>=10&&this.kit==='gold'&&hero.head&&!hero.riderId.startsWith('DS_Mascot_')){add(hero.head,new T.TorusGeometry(.105,.012,6,24),reward.color,new T.Vector3(0,.13,0),new T.Euler(Math.PI/2,0,0));}
  if(this.kit!=='stock'||this.outings>0){const collar=dog.getObjectByName('socket_collar')??dog.getObjectByName('neck');if(collar)add(collar,new T.TorusGeometry(.12,.012,8,24),this.outings&&this.kit==='stock'?0x28dac6:reward.color,new T.Vector3(),new T.Euler(Math.PI/2,0,0));}
 }
 private tintHoodie(hero:Hero,color:number){
  if(!hero.riderId.includes('Hoodie'))return;
  hero.rider.traverse(object=>{if(!(object instanceof T.SkinnedMesh))return;const indices=object.skeleton.bones.map((b,i)=>/^(Spine|Chest|LeftArm|RightArm|LeftForeArm|RightForeArm|LeftShoulder|RightShoulder)/i.test(b.name)?i:-1).filter(i=>i>=0);if(!indices.length)return;
   const original=object.material,clones:T.Material[]=[];
   const tint=(source:T.Material)=>{const m=source.clone() as T.MeshStandardMaterial;const prior=m.onBeforeCompile;m.onBeforeCompile=(shader,renderer)=>{prior.call(m,shader,renderer);shader.uniforms.swoopTint={value:new T.Color(color)};shader.vertexShader='varying float swoopCloth;\n'+shader.vertexShader;const terms=indices.flatMap(i=>['x','y','z','w'].map(a=>`(abs(skinIndex.${a}-${i}.0)<0.1?skinWeight.${a}:0.0)`)).join('+');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n swoopCloth=0.0;\n #ifdef USE_SKINNING\n swoopCloth=clamp(${terms},0.0,1.0);\n #endif`);shader.fragmentShader='uniform vec3 swoopTint; varying float swoopCloth;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float ink=1.0-smoothstep(0.08,0.28,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))); diffuseColor.rgb+=swoopTint*0.13*ink*swoopCloth;');};m.customProgramCacheKey=()=>`swoop-hoodie-${indices.join('-')}`;clones.push(m);return m;};object.material=Array.isArray(original)?original.map(tint):tint(original);this.apparel.push({mesh:object,original,clones});
  });
 }
 get state(){return{flow:{pending:this.flow.pending,banked:this.flow.banked,multiplier:this.flow.multiplier,settleProgress:this.flow.settleProgress,bankProgress:this.flow.bankProgress},ghost:!!this.previousBest,ghostFrames:this.previousBest?.frames.length??0,recordedFrames:this.recorder.frames.length,replay:this.replay,stars:medalStars(this.district.records),kit:this.kit,outing:this.outing,outingDistance:this.outingDistance,daily:this.daily.id,music:this.music.state};}
}

