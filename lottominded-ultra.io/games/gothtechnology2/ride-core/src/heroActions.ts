import {HERO_ACTIONS} from './heroActionData.ts';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
/** Small baked control curves, shared by all rigs; no extra model downloads. */
export function sampleHeroAction(name:keyof typeof HERO_ACTIONS,phase:number){
 const rows=HERO_ACTIONS[name].samples,f=clamp(phase)*(rows.length-1),i=Math.floor(f),j=Math.min(i+1,rows.length-1);
 return rows[i].map((n,k)=>n+(rows[j][k]-n)*(f-i));
}
export function standingIdle(time:number){return sampleHeroAction('idle',((time%8)+8)%8/8);}
export const WEAPON_DRAW_TICKS=Math.ceil(HERO_ACTIONS.draw.duration*60);
