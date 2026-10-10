export type AimPreset='classic'|'hold'|'toggle';
export class StanceGesture {
 value:0|1|2=0;
 down(stance:1|2){this.value=this.value===stance?0:stance;}
 reset(){this.value=0;}
}
export class LeanGesture {
 mode:'toggle'|'hold'='toggle';value=0;
 down(direction:number){if(this.mode==='toggle')this.value=this.value===direction?0:direction;}
 reset(){this.value=0;}
 get(left:boolean,right:boolean,heldLeft:boolean,heldRight:boolean){
  if(left||right)return Number(right)-Number(left);
  return this.mode==='hold'?Number(heldRight)-Number(heldLeft):this.value;
 }
}
/** Only a release shorter than the threshold toggles ADS in Classic. */
export class AimGesture {
 private downAt:number|undefined;private toggled=false;
 constructor(public preset:AimPreset='classic',public thresholdMs=180){}
 down(now:number){if(this.downAt===undefined)this.downAt=now;}
 up(now:number){if(this.downAt===undefined)return;if(this.preset==='toggle'||(this.preset==='classic'&&now-this.downAt<this.thresholdMs))this.toggled=!this.toggled;this.downAt=undefined;}
 get(now:number){if(this.preset==='hold')return this.downAt===undefined?0:2;if(this.preset==='classic'&&this.downAt!==undefined&&now-this.downAt>=this.thresholdMs)return 1;return this.toggled?2:0;}
 reset(){this.downAt=undefined;this.toggled=false;}
}
export const COMBAT_BINDINGS={forward:'KeyW',brake:'KeyS',left:'KeyA',right:'KeyD',reload:'KeyR',recover:'KeyK',hop:'Space',burst:'ShiftLeft',leanLeft:'KeyQ',leanRight:'KeyE',freeLook:'AltLeft',crouch:'KeyC',prone:'KeyX',dogAttack:'KeyZ',dogRadar:'KeyN',cycleMode:'KeyB',pickup:'KeyF',utility:'KeyG',repair:'KeyH',camera:'KeyV',scope:'KeyT',loadout:'Tab'} as const;
export type CombatBindings=Record<keyof typeof COMBAT_BINDINGS,string>;
export function readBindings(value:unknown):CombatBindings{
 const bindings={...COMBAT_BINDINGS} as CombatBindings;
 if(value&&typeof value==='object')for(const key of Object.keys(bindings) as (keyof CombatBindings)[]){const code=(value as Record<string,unknown>)[key];if(typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Space|Tab|AltLeft|ShiftLeft)$/.test(code))bindings[key]=code;}
 if(new Set(Object.values(bindings)).size!==Object.keys(bindings).length)return {...COMBAT_BINDINGS};
 return bindings;
}
export const deadZone=(n:number,zone=.15)=>!Number.isFinite(n)||Math.abs(n)<=zone?0:Math.sign(n)*(Math.min(1,Math.abs(n))-zone)/(1-zone);

