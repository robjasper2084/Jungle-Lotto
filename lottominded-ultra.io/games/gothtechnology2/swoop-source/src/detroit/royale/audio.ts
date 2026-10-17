import {createGroundSample,type TerrainSampler} from '../../../../ride-core/src/terrain.ts';
import {weaponSound,footstepSound} from './fpsSound.ts';
import {spatialCue,wheelCue} from './audioCues.ts';
import type {RidePose} from '../../../../ride-core/src/controller.ts';
/** Original low-cost synthesized score and effects. Nothing is started before a play gesture. */
export class RoyaleAudio {
 private context?:AudioContext;private master?:GainNode;private musicBus?:GainNode;private noise?:AudioBuffer;private nextBeat=0;private beat=0;private seen=new Set<string>();private round='';
 private steps=new Map<string,number>();private ground=createGroundSample();
 private motor?:OscillatorNode;private motorGain?:GainNode;private dogStep=-1;private cueTick=-1;private lastSpeed=0;private brakeAt=-999;private fieldCue='';private motorLevel=0;
 private previewUntil:number[]=[];
 effects=true;music=true;volume=.6;musicVolume=.2;
 constructor(){try{const v=JSON.parse(localStorage.getItem('royale-audio')??'null');if(v){this.effects=v.effects!==false;this.music=v.music!==false;this.volume=Math.max(0,Math.min(1,v.volume??.6));this.musicVolume=Math.max(0,Math.min(1,v.musicVolume??.2));}}catch{}}
 mount(root:HTMLElement){const f=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Sound & music';f.append(legend);
  for(const key of ['effects','music'] as const){const label=document.createElement('label'),box=document.createElement('input');label.className='check';box.type='checkbox';box.checked=this[key];box.onchange=()=>{this[key]=box.checked;this.save();void this.unlock();};label.append(box,key==='effects'?'Sound effects':'Original Royale music');f.append(label);}
  for(const key of ['volume','musicVolume'] as const){const label=document.createElement('label'),input=document.createElement('input');label.textContent=key==='volume'?'Effects volume':'Music volume';input.type='range';input.min='0';input.max='1';input.step='.05';input.value=String(this[key]);input.oninput=()=>{this[key]=Number(input.value);this.save();};label.append(input);f.append(label);}root.append(f);
 }
 private save(){try{localStorage.setItem('royale-audio',JSON.stringify({effects:this.effects,music:this.music,volume:this.volume,musicVolume:this.musicVolume}));}catch{}}
 async unlock(){if(!this.effects&&!this.music)return;const Constructor=window.AudioContext??(window as any).webkitAudioContext;if(!Constructor)return;
  if(!this.context){const c=this.context=new Constructor(),master=this.master=c.createGain(),music=this.musicBus=c.createGain();master.gain.value=0;music.gain.value=0;master.connect(c.destination);music.connect(c.destination);this.noise=c.createBuffer(1,c.sampleRate*.3,c.sampleRate);const data=this.noise.getChannelData(0);let seed=81;for(let i=0;i<data.length;i++){seed=Math.imul(seed,1664525)+1013904223|0;data[i]=(seed>>>0)/2147483648-1;}this.nextBeat=c.currentTime+.08;const motor=this.motor=c.createOscillator(),motorGain=this.motorGain=c.createGain();motor.type='sine';motorGain.gain.value=0;motor.connect(motorGain).connect(master);motor.start();}
  await this.context!.resume();
 }
 private tone(hz:number,time:number,length:number,gain:number,bus:GainNode,type:OscillatorType='sine',pan=0){const c=this.context!,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(hz,time);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),time+.012);g.gain.exponentialRampToValueAtTime(.0001,time+length);o.connect(g);if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=pan;g.connect(p).connect(bus);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};}else{g.connect(bus);o.onended=()=>{o.disconnect();g.disconnect();};}o.start(time);o.stop(time+length+.02);}
 private hiss(hz:number,length:number,gain:number,pan=0){const c=this.context!,source=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();source.buffer=this.noise!;f.type='bandpass';f.frequency.value=hz;g.gain.setValueAtTime(gain,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+length);source.connect(f).connect(g);let p:StereoPannerNode|undefined;if(c.createStereoPanner){p=c.createStereoPanner();p.pan.value=pan;g.connect(p).connect(this.master!);}else g.connect(this.master!);source.onended=()=>{source.disconnect();f.disconnect();g.disconnect();p?.disconnect();};source.start();source.stop(c.currentTime+length);}
 previewShot(weapon:string){const c=this.context;if(!c||c.state!=='running'||!this.effects)return;this.previewUntil.push(performance.now()+700);const sound=weaponSound(weapon,0);this.hiss(sound.noise,sound.tail,sound.gain);this.tone(sound.tone,c.currentTime,sound.tail,.15,this.master!,'triangle');}
 update(state:{round:string;tick:number;phase:string;events:{tick:number;kind:string;actor:string;target?:string}[];actors:{id:string;weapon?:string;pose:RidePose;alive:boolean;dog?:{x:number;z:number;speed:number;phase:number;jumpHeight?:number}}[];field?:{x:number;z:number;radius:number;remaining:number;phase:number}},me:string,active:boolean,voiceOpen=false,listenerHeading?:number,terrain?:TerrainSampler){const c=this.context;if(!c||c.state!=='running')return;const t=c.currentTime;this.master!.gain.setTargetAtTime(active&&this.effects?this.volume:0,t,.04);this.musicBus!.gain.setTargetAtTime(active&&this.music?this.musicVolume*(voiceOpen?.3:1):0,t,.15);
  if(this.round!==state.round){this.round=state.round;this.previewUntil=[];this.seen.clear();this.steps.clear();this.dogStep=-1;this.cueTick=-1;this.brakeAt=-999;this.lastSpeed=0;this.fieldCue='';}
  if(!active){this.nextBeat=t+.08;this.motorLevel=0;this.motorGain?.gain.setTargetAtTime(0,t,.06);this.cueTick=state.tick;return;}
  const self=state.actors.find(a=>a.id===me),p=self?.pose;
  if(this.effects)for(const e of state.events){const key=e.tick+':'+e.kind+':'+e.actor+':'+e.target;if(this.seen.has(key))continue;this.seen.add(key);if(state.tick-e.tick>20)continue;const a=state.actors.find(a=>a.id===e.actor);if(e.actor!==me&&!a)continue;const d=a&&p?Math.hypot(a.pose.x-p.x,a.pose.z-p.z):0;if(d>100)continue;const {gain,pan}=a&&p?spatialCue(a.pose.x-p.x,a.pose.z-p.z,listenerHeading??p.headingY):{gain:1,pan:0};
   if(e.kind==='shot'){this.previewUntil=this.previewUntil.filter(t=>t>performance.now());if(e.actor===me&&this.previewUntil.length){this.previewUntil.shift();continue;}const sound=weaponSound(a?.weapon??'static',d);this.hiss(sound.noise,sound.tail,sound.gain*gain,pan);this.tone(sound.tone,t,sound.tail,.15*gain,this.master!,'triangle',pan);}
   else if(e.kind==='hit'||e.kind==='melee-hit'){this.hiss(500,.12,.12*gain,pan);this.tone(e.target===me?90:640,t,.12,.09*gain,this.master!,'triangle',pan);}
   else if(e.kind==='reload'||e.kind==='reload-commit'){this.hiss(2600,.07,.055*gain,pan);}
   else if(e.kind==='pickup'||e.kind.startsWith('pickup-scope')){this.tone(660,t,.12,.07*gain,this.master!);this.tone(990,t+.08,.18,.05*gain,this.master!);}
   else if(e.kind==='shield'||e.kind==='respawn'){this.tone(440,t,.28,.08*gain,this.master!);this.tone(880,t+.08,.3,.05*gain,this.master!);}
   else if(e.kind==='dog-attack'||e.kind==='dog-radar'){this.tone(220,t,.14,.09*gain,this.master!,'sawtooth',pan);this.tone(180,t+.16,.14,.07*gain,this.master!,'sawtooth',pan);}
   else if(e.kind==='dog-knockoff'||e.kind==='eliminated'){this.hiss(160,.2,.18*gain,pan);}
   else if(e.kind==='melee'||e.kind==='evade'){this.hiss(700,.12,.06*gain,pan);}
  }
  while(this.seen.size>128)this.seen.delete(this.seen.values().next().value!);
  if(p&&self?.alive&&this.effects){for(const actor of state.actors){const q=actor.pose,cycle=Math.floor((q.footCycle||0)*2),previous=this.steps.get(actor.id);this.steps.set(actor.id,cycle);
   if(previous===undefined||previous===cycle||!actor.alive||q.footMode!==2||q.airHeight>.04||Math.abs(q.speed)<.2||Math.hypot(q.x-p.x,q.z-p.z)>28)continue;
   const surface=terrain?.sampleGround(q.x,q.z,this.ground,q.y).surface??'pavement',sound=footstepSound(surface,q.footCrouch,q.footProne),cue=actor.id===me?{gain:.5,pan:0}:spatialCue(q.x-p.x,q.z-p.z,listenerHeading??p.headingY);
   this.hiss(sound.hz,sound.length,sound.gain*cue.gain,cue.pan);
  }for(const id of this.steps.keys())if(!state.actors.some(a=>a.id===id))this.steps.delete(id);}
  const motor=p?wheelCue(p,!!self?.alive,active&&this.effects&&state.phase==='active'):{hz:55,gain:0};this.motorLevel=motor.gain;
  this.motor?.frequency.setTargetAtTime(motor.hz,t,.12);this.motorGain?.gain.setTargetAtTime(motor.gain,t,.09);
  if(this.effects&&p&&self?.alive&&state.phase==='active'&&state.tick!==this.cueTick){
   const dt=(state.tick-this.cueTick)/60,speed=Math.abs(p.speed);
   if(this.cueTick>=0&&dt>0&&dt<.5&&!p.footMode&&p.airHeight<.1&&(speed-this.lastSpeed)/dt< -3&&speed>2&&t-this.brakeAt>.4){this.hiss(850,.16,.025);this.brakeAt=t;}
   this.lastSpeed=speed;
   const dog=self.dog,step=dog?Math.floor(dog.phase*2):-1;
   if(dog&&dog.speed>.5&&(dog.jumpHeight??0)<.08&&step!==this.dogStep){const cue=spatialCue(dog.x-p.x,dog.z-p.z,listenerHeading??p.headingY);this.hiss(320,.055,.035*cue.gain,cue.pan);}
   this.dogStep=step;
   const f=state.field;if(f){const outside=Math.hypot(p.x-f.x,p.z-f.z)>f.radius,seconds=Math.ceil(f.remaining),key=outside?'outside-'+Math.floor(state.tick/90):seconds<=8?'closing-'+f.phase+'-'+seconds:'';
    if(key&&key!==this.fieldCue){this.tone(outside?125:440,t,.18,outside?.055:.03,this.master!,'sine');this.fieldCue=key;}}
  }
  this.cueTick=state.tick;
  if(this.music){if(this.nextBeat<t-.5)this.nextBeat=t+.04;while(this.nextBeat<t+.15){const chord=[[146.83,174.61,220],[130.81,164.81,196],[116.54,146.83,174.61],[130.81,164.81,196]][Math.floor(this.beat/16)%4],n=this.beat%8;if(n===0){for(const hz of chord)this.tone(hz,this.nextBeat,1.3,.045,this.musicBus!,'sine');}if(n%2===0)this.tone(chord[0]/2,this.nextBeat,.26,.07,this.musicBus!,'triangle');if(n===3||n===7)this.tone(chord[2]*2,this.nextBeat,.18,.025,this.musicBus!);this.nextBeat+=.3;this.beat++;}}
 }
 get status(){return{effects:this.effects,music:this.music,context:this.context?.state??'not-created',wheelLevel:this.motorLevel};}
 dispose(){this.motor?.stop();this.motor?.disconnect();this.motorGain?.disconnect();void this.context?.close();this.context=undefined;}
}
