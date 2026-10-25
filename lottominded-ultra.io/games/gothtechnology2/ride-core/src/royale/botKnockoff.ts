import type {Actor} from './rules.ts';
import type {RidePose} from '../controller.ts';
import type {BattleTerrain} from './battleTerrain.ts';

/** Only an active human impact can knock a mounted bot off. Recovery continues
 * through the normal stagger, return-to-wheel and pickup animation. */
export function playerHitBot(player:Actor|undefined,bot:Actor|undefined,tick:number,wheelImpact?:{speed:number;vx:number;vz:number}){
 if(!player||player.bot||!player.alive||!player.connected||!bot?.bot||!bot.alive||bot.protectedUntil>tick||bot.pose.footMode||bot.controller.crashed)return false;
 const dx=bot.pose.x-player.pose.x,dz=bot.pose.z-player.pose.z,length=Math.max(.001,Math.hypot(dx,dz));
 const impact=wheelImpact??{speed:3,vx:dx/length*3,vz:dz/length*3};
 if(!bot.controller.knockOff(wheelImpact?'collision':'player hit',impact))return false;
 bot.pose={...bot.controller.poseValue};return true;
}

/** Sweep relative motion so a fast rider cannot skip a bot between host ticks.
 * Slow brushes, other bots, separated floors and contact through cover do not
 * count as a player crash. */
export function playerCollidesWithBot(player:Actor,bot:Actor,beforePlayer:RidePose,beforeBot:RidePose,terrain:BattleTerrain,dt:number){
 if(player.bot||!bot.bot||!player.alive||!player.connected||!bot.alive||player.pose.footMode||bot.pose.footMode)return false;
 const p=player.pose,b=bot.pose,dx=p.x-beforePlayer.x,dz=p.z-beforePlayer.z;
 if(Math.hypot(dx,dz)/dt<3)return false;
 const rx=beforePlayer.x-beforeBot.x,rz=beforePlayer.z-beforeBot.z;
 const vx=dx-(b.x-beforeBot.x),vz=dz-(b.z-beforeBot.z),vv=vx*vx+vz*vz;
 if(vv<1e-8||rx*vx+rz*vz>=0)return false;
 const u=Math.max(0,Math.min(1,-(rx*vx+rz*vz)/vv));
 if(Math.hypot(rx+vx*u,rz+vz*u)>.85)return false;
 const py=beforePlayer.y+(p.y-beforePlayer.y)*u,by=beforeBot.y+(b.y-beforeBot.y)*u;
 return Math.abs(py-by)<.7&&terrain.line({x:p.x,y:p.y+.65,z:p.z},{x:b.x,y:b.y+.65,z:b.z},.12);
}
