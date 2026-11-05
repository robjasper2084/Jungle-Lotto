import type {RoyaleSnapshot} from './rules.ts';
export type Killcam={round:string;serial:number;killer:string;victim:string;frames:RoyaleSnapshot[]};
/** Bounded host-only history. Nothing is sent to a living rider or spectator. */
export class KillcamHistory {
 private frames:RoyaleSnapshot[]=[];private deaths=new Map<string,Killcam>();
 reset(){this.frames=[];this.deaths.clear();}
 record(state:RoyaleSnapshot,line:(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>boolean){
  if(state.tick%6===0||state.events.some(e=>e.tick===state.tick&&e.kind==='eliminated')){
   this.frames.push(state);while(this.frames.length>61||this.frames.length&&state.tick-this.frames[0].tick>360)this.frames.shift();
  }
  for(const a of state.actors)if(a.alive)this.deaths.delete(a.id);
  for(const death of state.events){
   if(death.tick!==state.tick||death.kind!=='eliminated'||this.deaths.has(death.actor))continue;
   const hit=state.events.filter(e=>e.tick===death.tick&&e.target===death.actor&&['hit','melee-hit','dog-knockoff'].includes(e.kind)).at(-1);
   const victim=state.actors.find(a=>a.id===death.actor);if(!hit||!victim||hit.actor===victim.id)continue;
   const frames=this.frames.flatMap(frame=>{
    const killer=frame.actors.find(a=>a.id===hit.actor);if(!killer)return[];
    const eye={x:killer.pose.x,y:killer.pose.y+1.4,z:killer.pose.z};
    const visible=(p:{x:number;y:number;z:number})=>Math.hypot(p.x-eye.x,p.z-eye.z)<150&&line(eye,p);
    return[{...frame,self:undefined,actors:frame.actors.filter(a=>a.id===killer.id||visible({x:a.pose.x,y:a.pose.y+1.4,z:a.pose.z})),projectiles:frame.projectiles.filter(p=>visible(p.p)),events:frame.events.filter(e=>e.actor===killer.id||e.target===killer.id),loot:[],results:[]}];
   });
   if(frames.length>=2)this.deaths.set(victim.id,{round:state.round,serial:victim.spawnSerial,killer:hit.actor,victim:victim.id,frames});
  }
 }
 get(viewer:string,alive:boolean,serial:number){const replay=this.deaths.get(viewer);return !alive&&replay?.serial===serial?replay:undefined;}
}
