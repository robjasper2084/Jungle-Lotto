import type {RoyaleSnapshot} from '../../../../ride-core/src/royale/rules.ts';
export type ReplayFrame={at:number;state:RoyaleSnapshot;camera:{position:number[];quaternion:number[];fov:number}};
/** Last received local view only. Never records concealed opponents or expands
 * server visibility. The live authority continues while a replay is shown. */
export class DeathReplay{
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
 get playing(){return this.started>=0;}
 start(now:number){if(this.available)this.started=now;}
 stop(){this.started=-1;}
 sample(now:number){if(!this.playing)return undefined;const elapsed=now-this.started,first=this.frozen[0],last=this.frozen.at(-1)!;if(elapsed>last.at-first.at){this.stop();return undefined;}return this.frozen.find(f=>f.at>=first.at+elapsed)??last;}
 reset(){this.frames=[];this.frozen=[];this.started=-1;this.alive=false;this.settle=this.observed=0;}
}
