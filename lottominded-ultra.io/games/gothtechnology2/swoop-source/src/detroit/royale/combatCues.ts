export type CombatCueKind='hit'|'shield'|'shield-break'|'eliminated'|'range';
export type CombatCue={kind:CombatCueKind;target?:string};
type SeenActor={id:string;alive:boolean;shield?:number;spawnSerial?:number;elimination?:{tick:number;killer?:{id:string}}};
export type CombatCueFrame={round:string;tick:number;actors:readonly SeenActor[];self?:{kills?:number};events:readonly {tick:number;kind:string;actor:string;target?:string}[]};
export const combatCuePriority=(kind:CombatCueKind)=>kind==='eliminated'?4:kind==='shield-break'?3:kind==='shield'?2:1;
export const combatCueDuration=(kind:CombatCueKind)=>kind==='eliminated'?2000:kind==='shield-break'?1300:kind==='shield'?850:650;
export const combatCueLabel=(kind:CombatCueKind)=>kind==='eliminated'?'ELIMINATED':kind==='shield-break'?'SHIELD BROKEN':kind==='shield'?'SHIELD HIT':kind==='range'?'TARGET HIT':'HIT';

/** Uses confirmed damage and visible actor snapshots, never the shot input or shield VFX. */
export class CombatCueTracker{
 private round='';private tick=-1;private kills:number|undefined;private seen=new Map<string,number>();private actors=new Map<string,SeenActor>();
 reset(){this.round='';this.tick=-1;this.kills=undefined;this.seen.clear();this.actors.clear();}
 update(frame:CombatCueFrame,me:string):CombatCue|undefined{
  if(frame.round!==this.round||frame.tick<this.tick){this.reset();this.round=frame.round;}
  this.tick=frame.tick;let cue:CombatCue|undefined;
  const offer=(next:CombatCue)=>{if(!cue||combatCuePriority(next.kind)>=combatCuePriority(cue.kind))cue=next;};
  const current=new Map(frame.actors.map(actor=>[actor.id,actor]));
  for(const event of frame.events){
   if(event.actor!==me||!event.target||event.target===me||!['hit','melee-hit','dog-knockoff'].includes(event.kind))continue;
   if(event.tick>frame.tick||frame.tick-event.tick>30)continue;
   // Melee/dog contact and their resulting damage events may share one tick.
   const key=`hit:${event.tick}:${event.target}`;if(this.seen.has(key))continue;this.seen.set(key,event.tick);
   const target=current.get(event.target),previous=this.actors.get(event.target);
   const sameLife=!!target&&!!previous&&target.spawnSerial===previous.spawnSerial;
   const before=sameLife?previous.shield:undefined,after=target?.shield;
   const kind:CombatCueKind=before!==undefined&&before>0&&after===0?'shield-break':after!==undefined&&after>0?'shield':'hit';
   offer({kind,target:event.target});
  }
  // Personal score also confirms a kill after its victim goes out of sight. It reveals no position.
  if(frame.self?.kills!==undefined){
   if(this.kills!==undefined&&frame.self.kills>this.kills)offer({kind:'eliminated'});
   this.kills=frame.self.kills;
  }else for(const target of frame.actors){
   // Legacy snapshots use attribution, never a dead pose alone.
   const death=target.elimination;if(target.alive||death?.killer?.id!==me||death.tick>frame.tick||frame.tick-death.tick>30)continue;
   const key=`kill:${death.tick}:${target.id}:${target.spawnSerial??0}`;if(this.seen.has(key))continue;this.seen.set(key,death.tick);offer({kind:'eliminated',target:target.id});
  }
  this.actors=new Map(frame.actors.map(actor=>[actor.id,{...actor}]));
  for(const [key,tick]of this.seen)if(frame.tick-tick>60)this.seen.delete(key);
  return cue;
 }
}
