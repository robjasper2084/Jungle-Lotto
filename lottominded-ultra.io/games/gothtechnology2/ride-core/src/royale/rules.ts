import {engineReady,ENGINE_ID} from '../engine/runtime.ts';
import {RoyaleKernel} from '../engine/royaleKernel.ts';
import {RideController,NEUTRAL_ACTIONS,type RidePose} from '../controller.ts';
import {angle,clamp} from '../rideDynamics.ts';
import {DEFAULT_FIELD_RADII} from './downtownField.ts';
import {ZONE_CANDIDATES} from './arena.ts';
import type {BattleTerrain} from './battleTerrain.ts';
import type {Vec3} from '../terrain.ts';
export const DT=1/60,PROTECTION=240,DEADLINE=21600,SLOTS=10;
export const BATTLE_HANDLING=wheelProfile('euc').tuning;
export {WEAPONS} from './combatProfiles.ts';
export type {Weapon} from './combatProfiles.ts';
import {WEAPONS,type Weapon} from './combatProfiles.ts';
import {wheelProfile} from './wheelProfiles.ts';
import {tacticalDestination,leadTarget} from './botTactics.ts';
import {traceBallistic} from './ballisticSweep.ts';
import {stanceBounds} from './stanceVolume.ts';
import {createBattleDog,advanceBattleDog,type DogPower,type BattleDog} from './dogPower.ts';
import {isScope,canReachScope,bestScope,type Scope} from './scopes.ts';
export type CombatState={magazine:Record<Weapon,number>;reloadStart:number;reloadCommit:number;reloadEnd:number;committed:boolean;kickYaw:number;kickPitch:number;aimBlend:number;lean:number;fireMode:number;shotCounter:number};
export const initialCombat=():CombatState=>({magazine:{static:20,heart:0,bass:0},reloadStart:-1,reloadCommit:0,reloadEnd:0,committed:false,kickYaw:0,kickPitch:0,aimBlend:0,lean:0,fireMode:0,shotCounter:0});
export type Command={round:string;seq:number;tick:number;throttle:number;steer:number;aimYaw:number;aimPitch:number;fire:boolean;shot:number;hop:boolean;hopHeld:boolean;burst:boolean;utility:boolean;repair:boolean;recover:boolean;swap:boolean;slot:number;reload:boolean;cycleMode:boolean;aimMode:number;lean:number;crouch:boolean;prone:boolean;dogAttack:boolean;dogRadar:boolean;dismount:boolean};
export const neutral=(round:string,seq=0,tick=0):Command=>({round,seq,tick,throttle:0,steer:0,aimYaw:0,aimPitch:0,fire:false,shot:0,hop:false,hopHeld:false,burst:false,utility:false,repair:false,recover:false,swap:false,slot:0,reload:false,cycleMode:false,aimMode:0,lean:0,crouch:false,prone:false,dogAttack:false,dogRadar:false,dismount:false});
export function weaponSocket(p:RidePose,skin:string,aimYaw:number,aimPitch:number,aimBlend=0,lean=0){
 const scale=skin.startsWith('DS_Mascot_')?.48:1,yaw=p.headingY+aimYaw;
 const prone=p.footProne||0,crouch=p.footCrouch||0;
 const turn=aimYaw*.6,side=-.02,forward=(scale<1?-.03:.14)+prone*.34;const x=(Math.cos(turn)*side+Math.sin(turn)*forward+p.rollAngle*.9+lean*.025)*scale,y=((1.43+.12*aimBlend)*scale+(scale<1?.08:0)-(p.footBlend||0)*.296*(scale<1?.75:.86)-crouch*.34*scale)*(1-prone)+.40*scale*prone,z=(-Math.sin(turn)*side+Math.cos(turn)*forward)*scale;
 const grip={x:p.x+Math.cos(p.headingY)*x+Math.sin(p.headingY)*z,y:p.y+y,z:p.z-Math.sin(p.headingY)*x+Math.cos(p.headingY)*z};
 const reach=.52*scale;return {grip,muzzle:{x:grip.x+Math.sin(yaw)*Math.cos(aimPitch)*reach,y:grip.y+Math.sin(aimPitch)*reach,z:grip.z+Math.cos(yaw)*Math.cos(aimPitch)*reach}};
}
export type Motion={wheelId?:string;controller:RideController;energy:number;burstUntil:number;burstLatch:boolean};
export function move(a:Motion,c:Command,tick:number){
 if(!a.controller.poseValue.footMode&&c.burst&&!a.burstLatch&&a.energy>=40&&tick>=a.burstUntil){a.energy-=40;a.burstUntil=tick+36;}a.burstLatch=c.burst;
 const boosted=tick<a.burstUntil;a.energy=Math.min(100,a.energy+(boosted?0:DT*10));
 const profile=wheelProfile(a.wheelId);
 a.controller.regulatedSpeed=true;
 a.controller.setHandling({...profile.tuning,driveAcceleration:profile.tuning.driveAcceleration*(boosted?1.65:1)});

 const input={...NEUTRAL_ACTIONS,throttle:c.throttle,steer:c.steer,crouch:c.crouch,prone:c.prone,hop:c.hop,hopHeld:c.hopHeld,dismount:c.dismount||c.prone&&!a.controller.poseValue.footMode&&Math.abs(a.controller.poseValue.speed)<=1,run:c.burst};
 a.controller.step(DT/2,input);a.controller.step(DT/2,{...input,hop:false});
}
export type Actor=Motion&{dogPower:DogPower;dog:BattleDog;scopes:Scope[];combat:CombatState;id:string;name:string;skin:string;bot:boolean;connected:boolean;disconnectTick:number;integrity:number;shield:number;alive:boolean;lastDamage:number;lastSeq:number;ack:number;lastShot:number;lastInput:number;shotAt:number;slot:number;switchUntil:number;loadout:Weapon[];ammo:Record<Weapon,number>;utility:number;shieldUntil:number;repairs:number;repairUntil:number;queue:Command[];input:Command;kills:number;damage:number;shots:number;hits:number;distance:number;eliminatedAt:number;path:Vec3[];target?:Vec3;seenAt:number;aimAt:number;recoverTick:number;pose:RidePose};
export type Projectile={id:string;owner:string;shot:number;weapon:Weapon;p:Vec3;v:Vec3;expires:number};
export type Loot={id:string;p:Vec3;kind:Weapon|'repair'|'shield'|'ammo'|'dog'|Scope;available:boolean};
export type Field={x:number;z:number;radius:number;nextRadius:number;remaining:number;phase:number;damage:number};
export function fieldAt(tick:number,seed:number,zones=ZONE_CANDIDATES,radii:readonly number[]=DEFAULT_FIELD_RADII):Field{
 const t=Math.max(0,tick-PROTECTION)/60,center=zones[Math.abs(seed)%zones.length];
 const ends=[0,80,170,255,335,360],stages=ends.slice(0,-1).map((a,i)=>({a,b:ends[i+1],r0:radii[i],r1:radii[i+1]}));
 const phase=Math.min(4,stages.findIndex(s=>t<s.b)<0?4:stages.findIndex(s=>t<s.b)),s=stages[phase],f=clamp((t-s.a)/(s.b-s.a),0,1);
 return {...center,radius:s.r0+(s.r1-s.r0)*f,nextRadius:s.r1,remaining:Math.max(0,s.b-t),phase,damage:[2,4,8,18,100][phase]};
}
function targetHit(p:Vec3,d:Vec3,a:Actor,r:number){const q=a.pose,b=stanceBounds(q,a.skin),lo=[q.x-b.x-r,q.y+b.minY-r,q.z-b.z-r],hi=[q.x+b.x+r,q.y+b.maxY+r,q.z+b.z+r],o=[p.x,p.y,p.z],v=[d.x,d.y,d.z];let t0=0,t1=1;for(let i=0;i<3;i++){if(Math.abs(v[i])<1e-8){if(o[i]<lo[i]||o[i]>hi[i])return null;}else{let a=(lo[i]-o[i])/v[i],b=(hi[i]-o[i])/v[i];if(a>b)[a,b]=[b,a];t0=Math.max(t0,a);t1=Math.min(t1,b);if(t0>t1)return null;}}return t0;}
export class RoyaleMatch{
 phase:'lobby'|'deployment'|'active'|'results'='lobby';round='';tick=0;seed=0;actors:Actor[]=[];projectiles:Projectile[]=[];loot:Loot[]=[];winner:string|null=null;reason='';events:{tick:number;kind:string;actor:string;target?:string}[]=[];
 private awarded=new Map<string,number>();
 private brains=new Map<string,{think:number;enemy?:string;acquired:number;stuck:number;last:Vec3;backUntil:number}>();
 private kernel?:RoyaleKernel;
 constructor(readonly terrain:BattleTerrain,readonly engineEnabled=engineReady(),readonly size:6|10=6,readonly botChase=true){}
 add(id:string,name:string,bot=false,skin='hero',wheelId='euc'){if(this.phase!=='lobby'||this.actors.length>=this.size||this.actors.some(a=>a.id===id))throw Error('ROOM_COMBATANTS_FULL');
 const profile=wheelProfile(wheelId);let spawn=this.terrain.spawns[this.actors.length%this.terrain.spawns.length];
 // Practice/fill opponents begin on supported, visible nearby ground, so a solo
 // rider does not spend the opening minutes searching distant human spawn sites.
 const human=this.actors.find(a=>!a.bot);
 if(bot&&human){for(let attempt=0;attempt<32;attempt++){
  const direction=this.actors.length*2.4+attempt*.42,distance=38+this.actors.length*8+Math.floor(attempt/8)*10,x=human.pose.x+Math.sin(direction)*distance,z=human.pose.z+Math.cos(direction)*distance,y=this.terrain.ground(x,z,human.pose.y).height;
  if(Math.abs(y-human.pose.y)>.6||!this.terrain.clear(x,z,1,y)||this.actors.some(a=>Math.hypot(a.pose.x-x,a.pose.z-z)<9)||!this.terrain.line({x:human.pose.x,y:human.pose.y+.7,z:human.pose.z},{x,y:y+.7,z},.6))continue;
  spawn={position:{x,y,z},headingY:Math.atan2(human.pose.x-x,human.pose.z-z)};break;
 }}
 const controller=new RideController(this.terrain,{spawn,tuning:profile.tuning});
 const a:Actor={dogPower:{charges:0,until:0,ready:0,radarUntil:0,radarReady:0},dog:createBattleDog(controller.poseValue),scopes:[],wheelId,combat:initialCombat(),id,name:name.slice(0,20),skin,bot,connected:true,disconnectTick:-1,controller,energy:100,burstUntil:0,burstLatch:false,integrity:100,shield:50,alive:true,lastDamage:-99999,lastSeq:0,ack:0,lastShot:0,lastInput:0,shotAt:-999,slot:0,switchUntil:0,loadout:['static'],ammo:{static:80,heart:0,bass:0},utility:1,shieldUntil:0,repairs:1,repairUntil:0,queue:[],input:neutral(''),kills:0,damage:0,shots:0,hits:0,distance:0,eliminatedAt:-1,path:[],seenAt:0,aimAt:0,recoverTick:0,pose:{...controller.poseValue}};this.actors.push(a);return a;
 }
 start(round:string,seed=1){if(this.actors.length!==this.size||!['lobby','results'].includes(this.phase))throw Error('ALL_ROOM_RIDERS_REQUIRED');
 this.round=round;this.seed=seed;this.tick=0;this.phase='deployment';this.winner=null;this.reason='';this.events=[];this.projectiles=[];this.awarded.clear();this.brains.clear();
 const roster=this.actors.map(a=>({id:a.id,name:a.name,bot:a.bot,skin:a.skin,wheelId:a.wheelId,connected:a.connected}));this.actors=[];this.phase='lobby';for(const r of roster){const a=this.add(r.id,r.name,r.bot,r.skin,r.wheelId);a.connected=r.connected;a.input=neutral(round);a.disconnectTick=r.connected?-1:0;}this.phase='deployment';
 this.loot=this.terrain.supplies?this.terrain.supplies.map((p,i)=>({id:'district-'+i,p:{...p},kind:(['static','heart','bass','ammo','repair','shield','dog'] as const)[i%7],available:true} as Loot)):this.terrain.spawns.flatMap((s,i)=>{const x=s.position.x*.87,z=s.position.z*.87;return [{id:'weapon-'+i,p:{x,y:this.terrain.ground(x,z).height,z},kind:i%2?'heart':'bass',available:true},{id:'supply-'+i,p:{x:x+6,y:this.terrain.ground(x+6,z).height,z},kind:'ammo',available:true}] as Loot[];});
 for(const [i,p]of this.terrain.zones.entries())this.loot.push({id:'central-'+i,p:{...p,y:this.terrain.ground(p.x,p.z).height},kind:i%2?'repair':'shield',available:true});
 for(const [i,site]of (this.terrain.optics??this.terrain.spawns.map(s=>({p:{x:s.position.x+Math.sin(s.headingY)*9,y:s.position.y,z:s.position.z+Math.cos(s.headingY)*9},kind:'scope2' as Scope}))).entries())this.loot.push({id:'optic-'+i,p:{...site.p},kind:site.kind,available:true});
 this.kernel?.dispose();this.kernel=this.engineEnabled?new RoyaleKernel(this.actors,seed,this.loot,this.terrain.zones,this.terrain.fieldRadii):undefined;
 }
 command(id:string,value:unknown){const a=this.actors.find(a=>a.id===id);if(!a||a.bot||!a.connected||!a.alive||this.phase==='results'||!value||typeof value!=='object')return false;
 const c=value as Command;if(c.round!==this.round||!Number.isSafeInteger(c.seq)||c.seq<=a.lastSeq||c.seq>a.lastSeq+180||!Number.isInteger(c.tick)||Math.abs(c.tick-this.tick)>180||!Number.isSafeInteger(c.shot)||c.shot<0||c.shot>a.lastShot+600)return false;
 for(const k of ['throttle','steer','aimYaw','aimPitch','slot','aimMode','lean'] as const)if(!Number.isFinite(c[k]))return false;
 if(Math.abs(c.throttle)>1||Math.abs(c.steer)>1||Math.abs(c.aimYaw)>1.25||Math.abs(c.aimPitch)>.65||![0,1].includes(c.slot)||![0,1,2].includes(c.aimMode)||Math.abs(c.lean)>1)return false;
 for(const k of ['fire','hop','hopHeld','burst','utility','repair','recover','swap','reload','cycleMode','crouch','prone','dogAttack','dogRadar','dismount']as const)if(typeof c[k]!=='boolean')return false;
 if(Object.keys(c).length!==Object.keys(neutral('')).length||a.queue.length>=24)return false;
 a.lastSeq=c.seq;a.lastInput=this.tick;a.queue.push({...c});return true;
 }
 release(id:string){const a=this.actors.find(a=>a.id===id);if(a){a.queue=[];a.lastInput=this.tick-22;a.input=neutral(this.round);}}
 disconnect(id:string){const a=this.actors.find(a=>a.id===id);if(a){a.connected=false;a.disconnectTick=this.tick;this.release(id);}}
 reconnect(id:string){const a=this.actors.find(a=>a.id===id);if(a){a.connected=true;a.disconnectTick=-1;a.lastInput=this.tick;}}
 private botInput(a:Actor):Command{
 const p=a.pose,c=neutral(this.round,++a.lastSeq,this.tick),f=this.kernel?.field()??fieldAt(this.tick,this.seed,this.terrain.zones,this.terrain.fieldRadii);
 const index=this.actors.indexOf(a);let brain=this.brains.get(a.id);if(!brain){brain={think:this.tick,acquired:this.tick,stuck:0,last:{x:p.x,y:p.y,z:p.z},backUntil:0};this.brains.set(a.id,brain);}
 if(this.tick>=brain.think){brain.think=this.tick+18+index;
  const progress=Math.hypot(p.x-brain.last.x,p.z-brain.last.z);brain.stuck=progress<.15?brain.stuck+1:0;brain.last={x:p.x,y:p.y,z:p.z};
  if(brain.stuck>8){brain.backUntil=this.tick+40;brain.stuck=0;}
  const enemy=this.actors.filter(b=>b!==a&&b.alive&&Math.hypot(b.pose.x-p.x,b.pose.z-p.z)<85&&this.terrain.line({x:p.x,y:p.y+1.3,z:p.z},{x:b.pose.x,y:b.pose.y+1.3,z:b.pose.z})).sort((b,c)=>Math.hypot(b.pose.x-p.x,b.pose.z-p.z)-Math.hypot(c.pose.x-p.x,c.pose.z-p.z))[0];
  if(enemy){if(brain.enemy!==enemy.id)brain.acquired=this.tick;brain.enemy=enemy.id;a.target={x:enemy.pose.x,y:enemy.pose.y,z:enemy.pose.z};a.seenAt=this.tick;}else if(this.tick-a.seenAt>240)a.target=undefined;
  const weapon=a.loadout[a.slot],defend=a.integrity<45||a.combat.reloadStart>=0;
  const supplies=this.loot.filter(l=>l.available&&(a.ammo[weapon]<20?l.kind==='ammo':a.integrity<65?l.kind==='repair':a.loadout.length<2?l.kind==='heart'||l.kind==='bass':false)).map(l=>l.p);
  const hunted=this.botChase?this.actors.filter(b=>!b.bot&&b.alive).sort((b,c)=>Math.hypot(b.pose.x-p.x,b.pose.z-p.z)-Math.hypot(c.pose.x-p.x,c.pose.z-p.z))[0]:undefined;
  const target=tacticalDestination(this.terrain,p,f,enemy?.pose,a.target??hunted?.pose,defend,supplies,index,this.tick).point;
  a.path=this.terrain.route(p,target);a.aimAt=enemy?this.tick:0;
 }
 while(a.path.length&&Math.hypot(a.path[0].x-p.x,a.path[0].z-p.z)<5)a.path.shift();
 // A fresh grid route begins at the closest node, which can be behind the rider.
 // Skip visible intermediate nodes so replanning cannot pull a moving EUC back
 // around that node. Swept clearance keeps the shortcut outside solid cover.
 while(a.path.length>1&&this.terrain.line({x:p.x,y:p.y+.7,z:p.z},{...a.path[1],y:a.path[1].y+.7},1.2))a.path.shift();
 const next=a.path[0]??{x:f.x,z:f.z},turn=angle(Math.atan2(next.x-p.x,next.z-p.z)-p.headingY);
 // RideCore's positive steering command decreases world heading.
 c.steer=clamp(-turn*2,-1,1);c.throttle=Math.abs(turn)>1.2?(p.speed>2?-1:.25):Math.abs(turn)>.55?.4:.85;
 const visible=this.actors.find(b=>b.id===brain.enemy&&b.alive&&Math.hypot(b.pose.x-p.x,b.pose.z-p.z)<85&&this.terrain.line({x:p.x,y:p.y+1.3,z:p.z},{x:b.pose.x,y:b.pose.y+1.3,z:b.pose.z}));
 if(visible&&this.tick-brain.acquired>18+index*3){const profile=WEAPONS[a.loadout[a.slot]],target=leadTarget(p,visible.pose,{x:Math.sin(visible.pose.headingY)*visible.pose.speed,z:Math.cos(visible.pose.headingY)*visible.pose.speed},profile.speed,profile.gravity),yaw=angle(Math.atan2(target.x-p.x,target.z-p.z)-p.headingY);c.aimYaw=clamp(yaw+Math.sin(this.tick*.075+index)*.035,-1.25,1.25);c.aimPitch=clamp(Math.atan2(target.y-p.y,Math.hypot(target.x-p.x,target.z-p.z)),-.65,.65);if(Math.abs(yaw)<1.2&&this.tick-a.shotAt>=profile.interval+12&&!a.repairUntil){c.fire=true;c.shot=a.lastShot+1;}}
 if(this.tick<brain.backUntil){c.throttle=-.35;c.steer=index%2?.7:-.7;}
 c.reload=this.engineEnabled&&a.combat.magazine[a.loadout[a.slot]]<(visible?1:5)&&a.combat.reloadStart<0;c.aimMode=visible?1:0;
 c.recover=a.controller.crashed;c.repair=a.integrity<55&&this.tick-a.lastDamage>180;c.utility=a.shield<10&&this.tick-a.lastDamage<120;c.slot=a.slot;c.burst=Math.hypot(p.x-f.x,p.z-f.z)>f.radius;
 if(a.dogPower.charges&&visible){c.dogAttack=this.tick>=a.dogPower.ready;c.dogRadar=this.tick>=a.dogPower.radarReady;}return c;
 }
 step(){if(this.phase==='lobby'||this.phase==='results')return;if(this.kernel){this.stepEngine();return;}this.tick++;if(this.tick>=PROTECTION)this.phase='active';
 const damage:{target:Actor;amount:number;owner?:Actor;bypass?:boolean}[]=[];
 for(const a of this.actors){if(!a.alive)continue;
  if(!a.connected&&a.disconnectTick>=0&&this.tick-a.disconnectTick>=1200){damage.push({target:a,amount:999,bypass:true});continue;}
  let c=a.bot?this.botInput(a):a.queue.shift();if(c){a.input=c;a.ack=c.seq;}else c={...a.input,hop:false,utility:false,repair:false,recover:false,swap:false,reload:false,cycleMode:false};
  if(!a.bot&&(this.tick-a.lastInput>21||!a.connected))c={...neutral(this.round),throttle:a.pose.speed>.05?-1:a.pose.speed<-.05?1:0};
  if(c.recover&&a.controller.crashed&&this.tick-a.recoverTick>180){
   // Battle recovery stands up locally; normal ride mode's last-safe teleport is not used.
   const p=a.pose,f=fieldAt(this.tick,this.seed,this.terrain.zones,this.terrain.fieldRadii),outside=Math.hypot(p.x-f.x,p.z-f.z)>f.radius;
   const candidates=[{x:p.x,z:p.z},...Array.from({length:16},(_,i)=>({x:p.x+Math.sin(i*Math.PI/8)*1.2,z:p.z+Math.cos(i*Math.PI/8)*1.2}))];
   const at=candidates.find(q=>this.terrain.clear(q.x,q.z,.8)&&(Math.hypot(q.x-f.x,q.z-f.z)>f.radius)===outside&&this.terrain.line({x:p.x,y:p.y+.7,z:p.z},{x:q.x,y:this.terrain.ground(q.x,q.z).height+.7,z:q.z},.35));
   if(at){a.controller.reset({position:{...at,y:this.terrain.ground(at.x,at.z).height},headingY:p.headingY});a.recoverTick=this.tick;}
  }
  const previous=a.pose;move(a,c,this.tick);a.pose={...a.controller.poseValue};a.distance+=Math.hypot(a.pose.x-previous.x,a.pose.z-previous.z);
  if(c.slot<a.loadout.length&&c.slot!==a.slot){a.slot=c.slot;a.switchUntil=this.tick+24;}
  if(this.phase!=='active')continue;
  if(c.utility&&a.utility>0&&this.tick>=a.shieldUntil){a.utility--;a.shieldUntil=this.tick+150;}
  if(c.repair&&a.repairs>0&&!a.repairUntil){a.repairs--;a.repairUntil=this.tick+180;}
  if(c.fire){a.repairUntil=0;this.fire(a,c);}
  if(a.repairUntil&&this.tick>=a.repairUntil){a.integrity=Math.min(100,a.integrity+35);a.repairUntil=0;}
  if(this.tick-a.lastDamage>480)a.shield=Math.min(50,a.shield+DT*3);
  const f=fieldAt(this.tick,this.seed,this.terrain.zones,this.terrain.fieldRadii);if(Math.hypot(a.pose.x-f.x,a.pose.z-f.z)>f.radius)damage.push({target:a,amount:f.damage*DT,bypass:true});
  for(const item of this.loot){if(!item.available||isScope(item.kind)||Math.hypot(a.pose.x-item.p.x,a.pose.z-item.p.z)>2.5)continue;
   if(item.kind==='repair'){if(a.repairs>=2)continue;a.repairs++;}
   else if(item.kind==='shield'){if(a.utility>=1)continue;a.utility++;}
   else if(item.kind==='ammo'){for(const w of a.loadout)a.ammo[w]=Math.min(WEAPONS[w].ammo,a.ammo[w]+Math.ceil(WEAPONS[w].ammo*.3));}
   else if(item.kind==='dog'){if(a.dogPower.charges>=2)continue;a.dogPower.charges++;}
   else if(a.loadout.includes(item.kind)){a.ammo[item.kind]=Math.min(WEAPONS[item.kind].ammo,a.ammo[item.kind]+12);}
   else if(a.loadout.length<2){a.loadout.push(item.kind);a.ammo[item.kind]=WEAPONS[item.kind].ammo;}
   else if(c.swap){a.loadout[a.slot]=item.kind;a.ammo[item.kind]=WEAPONS[item.kind].ammo;a.switchUntil=this.tick+24;}else continue;
   item.available=false;this.events.push({tick:this.tick,kind:'pickup',actor:a.id});
  }
 }
 for(const shot of this.projectiles){if(shot.expires<this.tick)continue;const spec=WEAPONS[shot.weapon],d={x:shot.v.x*DT,y:shot.v.y*DT,z:shot.v.z*DT},wall=this.terrain.sweep(shot.p,d,spec.radius);let first=wall??1.001,target:Actor|undefined;
  for(const a of this.actors){if(!a.alive||a.id===shot.owner)continue;const t=targetHit(shot.p,d,a,spec.radius);if(t!==null&&t<first){first=t;target=a;}}
  if(first<=1){shot.expires=-1;if(target){
   const facing=Math.sin(target.pose.headingY)*(-shot.v.x)+Math.cos(target.pose.headingY)*(-shot.v.z),blocked=target.shieldUntil>this.tick&&facing>Math.hypot(shot.v.x,shot.v.z)*.45;
   const key=shot.owner+':'+shot.shot+':'+target.id,used=this.awarded.get(key)??0,amount=Math.max(0,Math.min(spec.damage,(shot.weapon==='bass'?48:spec.damage)-used));
   if(!blocked&&amount){this.awarded.set(key,used+amount);damage.push({target,amount,owner:this.actors.find(a=>a.id===shot.owner)});}
  }}else {shot.p.x+=d.x;shot.p.y+=d.y;shot.p.z+=d.z;if(shot.p.y<this.terrain.ground(shot.p.x,shot.p.z).height)shot.expires=-1;}
 }
 this.projectiles=this.projectiles.filter(p=>p.expires>=this.tick);
 if(this.tick%120===0){const active=new Set(this.projectiles.map(p=>p.owner+':'+p.shot+':'));for(const key of this.awarded.keys())if(![...active].some(prefix=>key.startsWith(prefix)))this.awarded.delete(key);}
 for(const hit of damage){const a=hit.target;a.lastDamage=this.tick;a.repairUntil=0;const shield=hit.bypass?0:Math.min(a.shield,hit.amount);a.shield-=shield;const injury=Math.min(a.integrity,hit.amount-shield);a.integrity=Math.max(0,a.integrity-injury);if(hit.owner){hit.owner.damage+=shield+injury;hit.owner.hits++;this.events.push({tick:this.tick,kind:'hit',actor:hit.owner.id,target:a.id});}}
 for(const a of this.actors)if(a.alive&&a.integrity<=0){a.alive=false;a.eliminatedAt=this.tick;const owner=damage.filter(d=>d.target===a&&d.owner).at(-1)?.owner;if(owner)owner.kills++;this.events.push({tick:this.tick,kind:'eliminated',actor:a.id});}
 if(this.phase==='active'){const live=this.actors.filter(a=>a.alive);if(live.length<=1)this.finish(live[0]?.id??null,live.length?'Last rider standing':'Simultaneous elimination');
 else if(this.tick>=PROTECTION+DEADLINE){for(const a of live){a.integrity=0;a.alive=false;a.eliminatedAt=this.tick;}this.finish(null,'Static Field deadline');}}
 this.collectScopes();
 if(this.events.length>32)this.events.splice(0,this.events.length-32);
 }
 private fire(a:Actor,c:Command){if(c.shot<=a.lastShot)return;a.lastShot=c.shot;const weapon=a.loadout[a.slot],w=WEAPONS[weapon];
 if(this.phase!=='active'||a.shieldUntil>this.tick||a.controller.crashed||this.tick<a.switchUntil||this.tick-a.shotAt<w.interval||a.ammo[weapon]<=0)return;
 a.ammo[weapon]--;a.shotAt=this.tick;a.shots++;const yaw=a.pose.headingY+c.aimYaw,origin=weaponSocket(a.pose,a.skin,c.aimYaw,c.aimPitch).muzzle;
 if(!this.terrain.line({x:a.pose.x,y:origin.y,z:a.pose.z},origin,.1))return;
 for(let i=0;i<w.pellets;i++){const y=yaw+(i-(w.pellets-1)/2)*w.spread,pitch=c.aimPitch;this.projectiles.push({id:a.id+'-'+c.shot+'-'+i,owner:a.id,shot:c.shot,weapon,p:{...origin},v:{x:Math.sin(y)*Math.cos(pitch)*w.speed,y:Math.sin(pitch)*w.speed,z:Math.cos(y)*Math.cos(pitch)*w.speed},expires:this.tick+w.life});}
 }
 private finish(winner:string|null,reason:string){this.phase='results';this.winner=winner;this.reason=reason;this.projectiles=[];for(const a of this.actors){a.queue=[];a.input=neutral(this.round);}}
 private stepEngine(){
  const previousPoses=this.actors.map(a=>({...a.pose}));const k=this.kernel!;k.begin();this.tick=k.tick;this.phase=k.phase;
  for(const [slot,a]of this.actors.entries()){
   if(!a.alive){k.pose(slot,a);continue;}
   let c=a.bot?this.botInput(a):a.queue.shift();
   if(c){a.input=c;a.ack=c.seq;}else c={...a.input,hop:false,utility:false,repair:false,recover:false,swap:false,reload:false,cycleMode:false};
   if(!a.bot&&(this.tick-a.lastInput>21||!a.connected))c={...neutral(this.round),throttle:a.pose.speed>.05?-1:a.pose.speed<-.05?1:0};
   c=k.input(slot,c);a.input=c;
   if(c.recover&&a.controller.crashed&&this.tick-a.recoverTick>180){
    const p=a.pose,f=k.field(),outside=Math.hypot(p.x-f.x,p.z-f.z)>f.radius;
    const candidates=[{x:p.x,z:p.z},...Array.from({length:16},(_,i)=>({x:p.x+Math.sin(i*Math.PI/8)*1.2,z:p.z+Math.cos(i*Math.PI/8)*1.2}))];
    const at=candidates.find(q=>this.terrain.clear(q.x,q.z,.8)&&(Math.hypot(q.x-f.x,q.z-f.z)>f.radius)===outside&&this.terrain.line({x:p.x,y:p.y+.7,z:p.z},{x:q.x,y:this.terrain.ground(q.x,q.z).height+.7,z:q.z},.35));
    if(at){a.controller.reset({position:{...at,y:this.terrain.ground(at.x,at.z).height},headingY:p.headingY});a.recoverTick=this.tick;}
   }
   const previous=a.pose;move(a,c,this.tick);a.pose={...a.controller.poseValue};a.distance+=Math.hypot(a.pose.x-previous.x,a.pose.z-previous.z);k.pose(slot,a);
  }
  k.rules();
  if(this.tick%3===0)for(const [owner,a]of this.actors.entries()){a.dogPower=k.power(owner);const target=advanceBattleDog(a.dog,a,a.dogPower,this.actors,this.terrain,this.tick);if(target){const index=this.actors.findIndex(r=>r.id===target);if(k.core.call("dog_contact",owner,index,a.dog.x,a.dog.y,a.dog.z)===1){const victim=this.actors[index];victim.controller.knockOff();victim.pose={...victim.controller.poseValue};a.dog.mode="pounce";}}}
  for(const shot of k.projectiles(this.actors)){
   const owner=this.actors.find(a=>a.id===shot.owner)!,spec=WEAPONS[shot.weapon];
   // Geometry is queried only by the authoritative host. A new muzzle cannot shoot through cover.
   if(shot.expires===this.tick+spec.life&&!this.terrain.line({x:owner.pose.x,y:shot.p.y,z:owner.pose.z},shot.p,.1)){k.resolve(shot.index,shot.serial,-1);continue;}
   const targets=this.actors.map((a,index)=>({id:index,previous:previousPoses[index],current:a.pose,bounds:stanceBounds(a.pose,a.skin),alive:a.alive&&a.id!==shot.owner}));
   const collision=traceBallistic(t=>k.trajectory(shot.index,t),spec.radius,targets,(p,d,r)=>this.terrain.sweep(p,d,r),(x,z)=>this.terrain.ground(x,z));
   k.resolve(shot.index,shot.serial,collision);

  }
  k.finish();k.sync(this.actors,this.loot);this.phase=k.phase;this.winner=k.winner<0?null:this.actors[k.winner].id;this.reason=k.reason;
  this.projectiles=k.projectiles(this.actors);this.events.push(...k.events(this.actors));this.collectScopes();if(this.events.length>32)this.events.splice(0,this.events.length-32);
  if(this.phase==='results')for(const a of this.actors){a.queue=[];a.input=neutral(this.round);}
 }
 /** Attachment collection runs on the same authoritative host as collision and the C++ match.
  * Scope choice changes camera optics only; projectile rules and damage remain in C++. */
 private collectScopes(){
  if(this.phase!=='active')return;
  for(const a of this.actors){if(!a.alive||!a.connected)continue;
   for(const item of this.loot){if(!item.available||!isScope(item.kind)||a.scopes.includes(item.kind)||!canReachScope(a.pose,item.p,(p,q,r)=>this.terrain.line(p,q,r)))continue;
    a.scopes.push(item.kind);item.available=false;this.events.push({tick:this.tick,kind:'pickup-'+item.kind,actor:a.id});
   }
  }
 }
 captureEngineState(){
  if(!this.kernel)throw Error('Engine session is not running');
  return {version:1,size:this.size,botChase:this.botChase,engine:ENGINE_ID.module,round:this.round,seed:this.seed,rules:this.kernel.core.capture(),brains:structuredClone([...this.brains]),events:structuredClone(this.events),loot:structuredClone(this.loot),
   actors:this.actors.map(a=>{const {controller,...host}=a;return {host:structuredClone(host),controller:controller.captureState()};})};
 }
 restoreEngineState(saved:ReturnType<RoyaleMatch['captureEngineState']>){
  if(saved.version!==1||saved.engine!==ENGINE_ID.module||saved.actors.length!==this.size||saved.size!==this.size||!this.engineEnabled)throw Error('Incompatible whole simulation snapshot');
  // Trusted host/replay only; never exposed as a remote client command.
  const candidate=new RoyaleMatch(this.terrain,true,this.size,this.botChase);
  try{
   for(const a of saved.actors){const actor=candidate.add(a.host.id,a.host.name,a.host.bot,a.host.skin,a.host.wheelId);Object.assign(actor,structuredClone(a.host));actor.controller.restoreState(a.controller);}
   candidate.round=saved.round;candidate.seed=saved.seed;candidate.loot=structuredClone(saved.loot);candidate.events=structuredClone(saved.events);candidate.brains=new Map(structuredClone(saved.brains??[]));
   candidate.kernel=new RoyaleKernel(candidate.actors,candidate.seed,candidate.loot,this.terrain.zones,this.terrain.fieldRadii);candidate.kernel.core.restore(saved.rules);candidate.kernel.sync(candidate.actors,candidate.loot);
   candidate.tick=candidate.kernel.tick;candidate.phase=candidate.kernel.phase;candidate.winner=candidate.kernel.winner<0?null:candidate.actors[candidate.kernel.winner].id;candidate.reason=candidate.kernel.reason;candidate.projectiles=candidate.kernel.projectiles(candidate.actors);
  }catch(error){candidate.dispose();throw error;}
  this.kernel?.dispose();
  this.kernel=candidate.kernel;this.actors=candidate.actors;this.round=candidate.round;this.seed=candidate.seed;
  this.loot=candidate.loot;this.brains=candidate.brains;this.events=candidate.events;this.tick=candidate.tick;this.phase=candidate.phase;
  this.winner=candidate.winner;this.reason=candidate.reason;this.projectiles=candidate.projectiles;
 }
 dispose(){this.kernel?.dispose();this.kernel=undefined;}
 snapshot(viewer?:string){
  const me=this.actors.find(a=>a.id===viewer),playing=this.phase==='active'||this.phase==='deployment';
  const visible=(a:Actor)=>!playing||a===me||!!me?.alive&&Math.hypot(a.pose.x-me.pose.x,a.pose.z-me.pose.z)<150&&this.terrain.line({x:me.pose.x,y:me.pose.y+1.4,z:me.pose.z},{x:a.pose.x,y:a.pose.y+1.4,z:a.pose.z});
  return {round:this.round,size:this.size,tick:this.tick,phase:this.phase,field:this.kernel?.field()??fieldAt(this.tick,this.seed,this.terrain.zones,this.terrain.fieldRadii),winner:this.winner,reason:this.reason,remaining:this.actors.filter(a=>a.alive).length,
   engine:this.engineEnabled?ENGINE_ID:undefined,engineInputFrames:this.kernel?.core.call('frames')??0,
   roster:this.actors.map(a=>({id:a.id,name:a.name,bot:a.bot,skin:a.skin,wheelId:a.wheelId,alive:a.alive,connected:a.connected})),
   actors:this.actors.filter(visible).map(a=>({id:a.id,skin:a.skin,wheelId:a.wheelId,scope:bestScope(a.scopes),combat:structuredClone(a.combat),pose:{...a.pose},dog:{...structuredClone(a.dog),path:[],target:undefined,radar:a.dogPower.radarUntil>this.tick},aimYaw:a.input.aimYaw,aimPitch:a.input.aimPitch,alive:a.alive,shieldActive:a.shieldUntil>this.tick,weapon:a.loadout[a.slot]})),
   self:me?{id:me.id,dogPower:{...me.dogPower},radar:me.dogPower.radarUntil>this.tick?this.actors.filter(a=>a!==me&&a.alive&&Math.hypot(a.pose.x-me.pose.x,a.pose.z-me.pose.z)<90).map(a=>({id:a.id,x:Math.round(a.pose.x/10)*10,z:Math.round(a.pose.z/10)*10})):[],wheelId:me.wheelId,scopes:[...me.scopes],combat:structuredClone(me.combat),integrity:me.integrity,shield:me.shield,energy:me.energy,burstUntil:me.burstUntil,burstLatch:me.burstLatch,controller:me.controller.captureState(),ack:me.ack,inputCursor:me.lastSeq,shotCursor:me.lastShot,slot:me.slot,loadout:[...me.loadout],ammo:{...me.ammo},utility:me.utility,repairs:me.repairs,alive:me.alive,shotAt:me.shotAt}:undefined,
   projectiles:!playing||me?.alive?this.projectiles.filter(s=>!me||Math.hypot(s.p.x-me.pose.x,s.p.z-me.pose.z)<(s.owner===me.id?500:150)&&this.terrain.line({x:me.pose.x,y:me.pose.y+1.4,z:me.pose.z},s.p)).map(s=>({...s,p:{...s.p},v:{...s.v}})):[],
   loot:me?.alive||!playing?this.loot.filter(l=>l.available).map(l=>({...l,p:{...l.p}})):[],
   events:this.events.filter(e=>!playing||e.actor===viewer||e.target===viewer),
   results:this.phase==='results'?this.actors.map(a=>({id:a.id,name:a.name,kills:a.kills,damage:Math.round(a.damage),distance:Math.round(a.distance),shots:a.shots,hits:a.hits})):[]};
 }
}
export type RoyaleSnapshot=ReturnType<RoyaleMatch['snapshot']>;



