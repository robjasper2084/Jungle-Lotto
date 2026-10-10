import {EngineContext,ENGINE_ID} from './runtime.ts';
import type {Actor,Command,Field,Loot,Projectile,Weapon} from '../royale/rules.ts';
const weapons:Weapon[]=['static','heart','bass'];
const kinds=['static','heart','bass','repair','shield','ammo'];
const phases=['lobby','deployment','active','results'] as const;
export function routeBattleInput(core:EngineContext,slot:number,c:Command){
 if(!Number.isSafeInteger(c.shot)||c.shot<0||c.shot>2147483647||!Number.isInteger(c.slot)||c.slot<0||c.slot>1)throw RangeError('Invalid engine command');
 core.frame(slot,[[0,c.steer],[3,c.throttle],[4,c.aimYaw/1.25],[5,c.aimPitch/.65],[8,+c.fire],[9,+c.hop],[14,+c.hopHeld],[10,+c.utility],[11,+c.repair],[12,+c.swap],[13,+c.burst],[15,+c.recover],[16,+c.reload],[17,+c.cycleMode],[18,c.aimMode/2],[19,c.lean],[20,+c.crouch]]);
 core.checked('command',slot,c.shot,c.slot);
 const get=(ch:number)=>core.get(slot,ch);
 return {...c,steer:get(0),throttle:get(3),aimYaw:get(4)*1.25,aimPitch:get(5)*.65,fire:!!get(8),hop:!!get(9),hopHeld:!!get(14),utility:!!get(10),repair:!!get(11),swap:!!get(12),burst:!!get(13),recover:!!get(15),reload:!!get(16),cycleMode:!!get(17),aimMode:Math.round(get(18)*2) as 0|1|2,lean:get(19),crouch:!!get(20)};
}
export class RoyaleKernel{
 readonly core=new EngineContext();
 readonly identity=ENGINE_ID;
 constructor(actors:Actor[],seed:number,loot:Loot[],zones?:{x:number;z:number}[],radii?:readonly number[]){
  actors.forEach((_,i)=>this.core.checked('add',i));this.core.checked('start',seed);
  if(zones){if(zones.length!==5)throw Error('Five field centers required');zones.forEach((p,i)=>this.core.checked('zone',i,p.x,p.z));}
  if(radii){if(radii.length!==6)throw Error('Six field radii required');this.core.checked('radii',...radii);}
  loot.forEach((l,i)=>this.core.checked('loot',i,kinds.indexOf(l.kind),l.p.x,l.p.y,l.p.z));
  actors.forEach((a,i)=>this.core.checked('connected',i,+a.connected));
 }
 begin(){this.core.checked('begin');}
 input(slot:number,c:Command){
  return routeBattleInput(this.core,slot,c);
 }
 pose(slot:number,a:Actor){const p=a.pose;this.core.checked('pose',slot,p.x,p.y,p.z,p.headingY,+a.controller.crashed,a.skin.startsWith('DS_Mascot_')?.48:1);this.core.checked('motion',slot,p.velocityX,p.velocityZ,Math.max(-2,Math.min(2,p.rollAngle)),Math.max(0,Math.min(1,p.airBlend)),Math.min(1,Math.abs(p.groundRoll)+Math.abs(p.groundPitch)));this.core.checked('connected',slot,+a.connected);}
 rules(){this.core.checked('rules');}
 projectiles(actors:Actor[]){
  const result:(Projectile&{index:number;serial:number})[]=[];
  for(let i=0;i<256;i++)if(this.core.call('projectile',i,0)){
   const get=(k:number)=>this.core.call('projectile',i,k),owner=actors[get(2)].id,serial=get(1);
   result.push({id:owner+'-'+get(3)+'-'+get(12),owner,shot:get(3),weapon:weapons[get(4)],p:{x:get(5),y:get(6),z:get(7)},v:{x:get(8),y:get(9),z:get(10)},expires:get(11),index:i,serial});
  }return result;
 }
 resolve(index:number,serial:number,target:number){this.core.checked('resolve',index,serial,target);}
 trajectory(index:number,seconds:number){return {x:this.core.call('trajectory',index,seconds,0),y:this.core.call('trajectory',index,seconds,1),z:this.core.call('trajectory',index,seconds,2)};}
 finish(){this.core.checked('end');}
 get tick(){return this.core.call('state',0);}
 get phase(){return phases[this.core.call('state',1)];}
 get winner(){return this.core.call('state',2);}
 get reason(){return ['','Last rider standing','Simultaneous elimination','Static Field deadline'][this.core.call('state',3)];}
 field():Field{const get=(k:number)=>this.core.call('field',k);return {x:get(0),z:get(1),radius:get(2),nextRadius:get(3),remaining:get(4),phase:get(5),damage:get(6)};}
 sync(actors:Actor[],loot:Loot[]){
  actors.forEach((a,i)=>{const v=(k:number)=>this.core.call('actor',i,k);
   Object.assign(a,{integrity:v(0),shield:v(1),alive:!!v(2),slot:v(3),loadout:[v(4),v(5)].filter(n=>n>=0).map(n=>weapons[n]),ammo:{static:v(6),heart:v(7),bass:v(8)},utility:v(9),repairs:v(10),shieldUntil:v(11),repairUntil:v(12),switchUntil:v(13),shotAt:v(14),lastShot:v(15),lastDamage:v(16),kills:v(17),damage:v(18),shots:v(19),hits:v(20),eliminatedAt:v(21)});
   const c=(key:number)=>this.core.call('combat',i,key);
   a.combat={magazine:{static:c(0),heart:c(1),bass:c(2)},reloadStart:c(3),reloadCommit:c(4),reloadEnd:c(5),committed:!!c(6),kickYaw:c(7),kickPitch:c(8),aimBlend:c(9),lean:c(10),fireMode:c(11),shotCounter:c(12)};
  });
  loot.forEach((l,i)=>l.available=!!this.core.call('available',i));
 }
 events(actors:Actor[]){const result:{tick:number;kind:string;actor:string;target?:string}[]=[];for(let i=0;i<this.core.call('state',5);i++){const get=(k:number)=>this.core.call('event',i,k),target=get(3);result.push({tick:get(0),kind:['','shot','shield','pickup','hit','eliminated','results','reload','reload-commit'][get(1)],actor:actors[get(2)]?.id??'',...(target>=0?{target:actors[target].id}:{})});}return result;}
 dispose(){this.core.dispose();}
}
