import type {RoyaleSnapshot} from '../../../../ride-core/src/royale/rules.ts';
import {weaponSocket} from '../../../../ride-core/src/royale/rules.ts';
import type {Killcam} from '../../../../ride-core/src/royale/killcam.ts';
import {Vector3,Quaternion,Matrix4,Euler} from 'three';
import {combatEye} from './combatView.ts';
import {scopedFov} from '../../../../ride-core/src/royale/scopes.ts';
export type ReplayFrame={at:number;state:RoyaleSnapshot;focus?:string;camera:{position:number[];quaternion:number[];fov:number}};
/** Last received local view only. Never records concealed opponents or expands
 * server visibility. The live authority continues while a replay is shown. */
export class DeathReplay{
 private killerKey='';kind:'last-view'|'killer'='last-view';
 private frames:ReplayFrame[]=[];private frozen:ReplayFrame[]=[];private round='';private serial=-1;private alive=false;private started=-1;private settle=0;private observed=0;
 observe(state:RoyaleSnapshot,at:number,camera:ReplayFrame['camera']){
  if(state.round!==this.round||state.self?.spawnSerial!==this.serial){this.reset();this.round=state.round;this.serial=state.self?.spawnSerial??-1;}
  this.observed=at;const live=!!state.self?.alive;if(this.alive&&!live){const final=structuredClone(state);final.loot=[];final.results=[];this.frozen=[...this.frames,{at,state:final,camera:structuredClone(camera)}];this.frames=[];this.settle=at+600;}
  else if(!live&&this.frozen.length&&at<=this.settle+100&&at-this.frozen.at(-1)!.at>=100){const final=structuredClone(state);final.loot=[];final.results=[];this.frozen.push({at,state:final,camera:structuredClone(camera)});if(this.frozen.length>68)this.frozen.shift();}
  if(live&&(!this.frames.length||at-this.frames.at(-1)!.at>=100)){
   const view=structuredClone(state);view.loot=[];view.results=[];
   this.frames.push({at,state:view,camera:structuredClone(camera)});while(this.frames.length>60||this.frames.length&&at-this.frames[0].at>6000)this.frames.shift();
  }this.alive=live;
 }
 get available(){return this.frozen.length>=2&&this.observed>=this.settle;}
 installKillcam(replay:Killcam|undefined){
  if(!replay||this.alive||this.playing||replay.round!==this.round||replay.serial!==this.serial)return;
  const key=replay.round+':'+replay.serial+':'+replay.killer;if(key===this.killerKey)return;
  this.killerKey=key;this.kind='killer';
  this.frozen=replay.frames.flatMap(state=>{const actor=state.actors.find(a=>a.id===replay.killer);if(!actor)return[];
   const p=actor.pose,scale=actor.skin.startsWith('DS_Mascot_')?.48:1,ads=actor.combat.aimBlend>.8,yaw=p.headingY+actor.aimYaw+actor.combat.kickYaw,pitch=actor.aimPitch+actor.combat.kickPitch;
   const socket=weaponSocket(p,actor.skin,actor.aimYaw,actor.aimPitch,actor.combat.aimBlend,actor.combat.lean);
   const sight=new Vector3(0,.105,.08).multiplyScalar(scale).applyEuler(new Euler(-pitch,yaw,0,'YXZ')).add(new Vector3(socket.grip.x,socket.grip.y,socket.grip.z));
   const position=combatEye(sight,yaw,pitch,scale,ads),forward=new Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
   const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,position.clone().add(forward),new Vector3(0,1,0)));
   return[{at:state.tick*1000/60,state,focus:replay.killer,camera:{position:position.toArray(),quaternion:rotation.toArray(),fov:ads?scopedFov(72,actor.scope):72}}];
  });this.settle=0;
 }
 get playing(){return this.started>=0;}
 start(now:number){if(this.available)this.started=now;}
 stop(){this.started=-1;}
 sample(now:number){if(!this.playing)return undefined;const elapsed=now-this.started,first=this.frozen[0],last=this.frozen.at(-1)!;if(elapsed>last.at-first.at){this.stop();return undefined;}return this.frozen.find(f=>f.at>=first.at+elapsed)??last;}
 reset(){this.frames=[];this.frozen=[];this.started=-1;this.alive=false;this.settle=this.observed=0;this.killerKey='';this.kind='last-view';}
}
