import type {Command,CombatState} from './rules.ts';
import {WEAPON_DRAW_TICKS} from '../heroActions.ts';
export type HolsterState={stowed:boolean;from:number;to:number;start:number;end:number};
export const initialHolster=():HolsterState=>({stowed:false,from:1,to:1,start:0,end:0});
export function weaponReadyAmount(state:CombatState,tick:number){
 const h=state.holster;if(!h)return 1;
 const t=h.end<=h.start?1:Math.max(0,Math.min(1,(tick-h.start)/(h.end-h.start)));
 return h.from+(h.to-h.from)*t;
}
export function weaponReady(state:CombatState,tick:number){return !state.holster?.stowed&&tick>=(state.holster?.end??0);}
/** Called only on the authoritative host, before either combat engine sees input.
 * Snapshots/replays carry the timestamps, so rendering never decides fire eligibility.
 */
export function routeHolster(state:CombatState,c:Command,tick:number,canToggle=true){
 const h=state.holster??=initialHolster(),busy=tick<h.end;
 if(canToggle&&!state.melee?.brawl&&state.reloadStart<0&&!busy&&
    (c.holster||(h.stowed&&!c.brawl&&(c.fire||c.aimMode>0)))){
  const stowed=c.holster?!h.stowed:false;
  Object.assign(h,{stowed,from:weaponReadyAmount(state,tick),to:stowed?0:1,start:tick,end:tick+WEAPON_DRAW_TICKS});
 }
  // Stowing blocks firearm actions, not the separate unarmed combat system.
  // In Brawl, fire is the punch input; the authoritative melee rules own it.
  if(!weaponReady(state,tick)){
   const melee=!!state.melee?.brawl&&!c.brawl;
   return {...c,fire:melee&&c.fire,reload:false,aimMode:0,light:melee&&c.light,heavy:melee&&c.heavy};
  }
 return c;
}
