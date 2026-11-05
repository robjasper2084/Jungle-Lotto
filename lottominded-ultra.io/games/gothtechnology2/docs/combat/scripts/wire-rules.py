from pathlib import Path
root=Path(__file__).resolve().parents[3]
p=root/'ride-core/src/royale/rules.ts'
s=p.read_text(encoding='utf-8')
def replace(old,new):
 global s
 if old not in s: raise RuntimeError('Missing expected edit: '+old[:100])
 s=s.replace(old,new)
start=s.index('export const WEAPONS=')
end=s.index('export type Command=',start)
s=s[:start]+"""export {WEAPONS} from './combatProfiles.ts';
export type {Weapon} from './combatProfiles.ts';
import {WEAPONS,type Weapon} from './combatProfiles.ts';
import {wheelProfile} from './wheelProfiles.ts';
import {traceBallistic} from './ballisticSweep.ts';
export type CombatState={magazine:Record<Weapon,number>;reloadStart:number;reloadCommit:number;reloadEnd:number;committed:boolean;kickYaw:number;kickPitch:number;aimBlend:number;lean:number;fireMode:number;shotCounter:number};
export const initialCombat=():CombatState=>({magazine:{static:20,heart:0,bass:0},reloadStart:-1,reloadCommit:0,reloadEnd:0,committed:false,kickYaw:0,kickPitch:0,aimBlend:0,lean:0,fireMode:0,shotCounter:0});
"""+s[end:]
replace('swap:boolean;slot:number','swap:boolean;slot:number;reload:boolean;cycleMode:boolean;aimMode:number;lean:number;crouch:boolean')
replace("swap:false,slot:0});","swap:false,slot:0,reload:false,cycleMode:false,aimMode:0,lean:0,crouch:false});")
start=s.index('export function weaponSocket(');end=s.index('export type Motion=',start)
s=s[:start]+"""export function weaponSocket(p:RidePose,skin:string,aimYaw:number,aimPitch:number,aimBlend=0,lean=0){
 const scale=skin.startsWith('DS_Mascot_')?.48:1,yaw=p.headingY+aimYaw;
 const x=(.18-.08*aimBlend+lean*.035)*scale,y=(1.33+.22*aimBlend)*scale,z=(.26-.06*aimBlend)*scale;
 const grip={x:p.x+Math.cos(p.headingY)*x+Math.sin(p.headingY)*z,y:p.y+y,z:p.z-Math.sin(p.headingY)*x+Math.cos(p.headingY)*z};
 const reach=.52*scale;return {grip,muzzle:{x:grip.x+Math.sin(yaw)*Math.cos(aimPitch)*reach,y:grip.y+Math.sin(aimPitch)*reach,z:grip.z+Math.cos(yaw)*Math.cos(aimPitch)*reach}};
}
"""+s[end:]
replace('export type Motion={controller:RideController;','export type Motion={wheelId?:string;controller:RideController;')
replace("a.controller.setHandling({...BATTLE_HANDLING,maxSpeed:boosted?13:10,driveAcceleration:boosted?19:8});",
"""const profile=wheelProfile(a.wheelId);
 a.controller.regulatedSpeed=true;
 a.controller.setHandling({...profile.tuning,driveAcceleration:profile.tuning.driveAcceleration*(boosted?1.65:1)});
""")
replace('steer:c.steer,hop:c.hop','steer:c.steer,crouch:c.crouch,hop:c.hop')
replace('export type Actor=Motion&{id:', 'export type Actor=Motion&{combat:CombatState;id:')
replace("add(id:string,name:string,bot=false,skin='hero')","add(id:string,name:string,bot=false,skin='hero',wheelId='euc')")
replace("const spawn=this.terrain.spawns[this.actors.length],controller=new RideController(this.terrain,{spawn,tuning:BATTLE_HANDLING});","const profile=wheelProfile(wheelId),spawn=this.terrain.spawns[this.actors.length],controller=new RideController(this.terrain,{spawn,tuning:profile.tuning});")
replace('const a:Actor={id,name:', 'const a:Actor={wheelId,combat:initialCombat(),id,name:')
replace('skin:a.skin,connected:a.connected','skin:a.skin,wheelId:a.wheelId,connected:a.connected')
replace('this.add(r.id,r.name,r.bot,r.skin)','this.add(r.id,r.name,r.bot,r.skin,r.wheelId)')
replace("['throttle','steer','aimYaw','aimPitch','slot']","['throttle','steer','aimYaw','aimPitch','slot','aimMode','lean']")
replace("||![0,1].includes(c.slot)","||![0,1].includes(c.slot)||![0,1,2].includes(c.aimMode)||Math.abs(c.lean)>1")
replace("['fire','hop','hopHeld','burst','utility','repair','recover','swap']","['fire','hop','hopHeld','burst','utility','repair','recover','swap','reload','cycleMode','crouch']")
replace('c.recover=a.controller.crashed;',"""c.reload=this.engineEnabled&&a.combat.magazine[a.loadout[a.slot]]===0&&a.combat.reloadStart<0;c.aimMode=a.target?1:0;
 c.recover=a.controller.crashed;""")
replace("c={...a.input,fire:false,hop:false,utility:false,repair:false,recover:false,swap:false};","c={...a.input,hop:false,utility:false,repair:false,recover:false,swap:false,reload:false,cycleMode:false};")
replace("const k=this.kernel!;k.begin();","const previousPoses=this.actors.map(a=>({...a.pose}));const k=this.kernel!;k.begin();")
start=s.index('   const d={x:shot.v.x*DT',s.index('private stepEngine()'))
end=s.index('\n  }\n  k.finish()',start)
s=s[:start]+"""   const targets=this.actors.map((a,index)=>({id:index,previous:previousPoses[index],current:a.pose,alive:a.alive&&a.id!==shot.owner}));
   const collision=traceBallistic(t=>k.trajectory(shot.index,t),spec.radius,targets,(p,d,r)=>this.terrain.sweep(p,d,r),(x,z)=>this.terrain.ground(x,z));
   k.resolve(shot.index,shot.serial,collision);
"""+s[end:]
replace('candidate.add(a.host.id,a.host.name,a.host.bot,a.host.skin)','candidate.add(a.host.id,a.host.name,a.host.bot,a.host.skin,a.host.wheelId)')
replace('skin:a.skin,alive:a.alive','skin:a.skin,wheelId:a.wheelId,alive:a.alive')
replace('skin:a.skin,pose:{...a.pose}',"skin:a.skin,wheelId:a.wheelId,combat:structuredClone(a.combat),pose:{...a.pose}")
replace('self:me?{id:me.id,','self:me?{id:me.id,wheelId:me.wheelId,combat:structuredClone(me.combat),')
p.write_text(s,encoding='utf-8')
