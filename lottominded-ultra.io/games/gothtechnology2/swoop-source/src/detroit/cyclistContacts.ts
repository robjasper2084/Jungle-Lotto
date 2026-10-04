import type {NavigationObstacle} from './terrain.ts';

/** Only the joined pack and bicycle race participants are the player's riding companions. */
export function ridingCompanion(o:NavigationObstacle,joined:boolean,bicycleRace:boolean){
 return o.kind==='cyclist'&&(joined&&/^community-\d+$/.test(o.id)||bicycleRace&&/^rival-\d+$/.test(o.id));
}
export function computerBikeContact(o:NavigationObstacle){return o.kind==='cyclist'&&!o.fallen;}
/** A subset of moving cyclists offers casual races, only when close and on the same level. */
export function bikeChallenger(player:{x:number;y:number;z:number},actors:readonly NavigationObstacle[]){
 return actors.filter(o=>o.kind==='cyclist'&&!o.fallen&&Math.abs(o.y-player.y)<2&&Math.hypot(o.x-player.x,o.z-player.z)<24&&Math.hypot(o.vx,o.vz)>.35&&(/^community-(0|2)$/.test(o.id)||/^traffic-\d+$/.test(o.id)&&Number(o.id.slice(8))%20===3))
 .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];
}
