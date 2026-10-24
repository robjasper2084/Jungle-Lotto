import type {CombatState,Weapon} from '../../../../ride-core/src/royale/rules.ts';
import {WEAPONS} from '../../../../ride-core/src/royale/combatProfiles.ts';
export function reloadReadout(c:CombatState,tick:number){
 if(c.reloadStart<0)return null;
 return{progress:Math.max(0,Math.min(1,(tick-c.reloadStart)/Math.max(1,c.reloadEnd-c.reloadStart))),remaining:Math.max(0,(c.reloadEnd-tick)/60),stage:tick<c.reloadCommit?'Loading magazine':'Readying weapon'};
}
/** Compact status text and a steady progress meter work with reduced motion. */
export class CombatReadout{
 readonly root=document.createElement('div');private meter=document.createElement('progress');private label=document.createElement('span');
 constructor(parent:HTMLElement){this.root.className='combat-readout';this.root.style.cssText='display:flex;gap:8px;align-items:center;font:12px system-ui;max-width:300px';this.meter.max=1;this.meter.style.cssText='width:90px;height:8px;accent-color:#82ead0';this.meter.setAttribute('aria-label','Reload progress');this.root.append(this.meter,this.label);parent.append(this.root);}
 update(c:CombatState|undefined,weapon:Weapon|undefined,tick:number){const r=c?reloadReadout(c,tick):null;this.root.hidden=!c||!weapon;this.meter.hidden=!r;
  this.meter.value=r?.progress??0;this.label.textContent=r?`${r.stage} · ${r.remaining.toFixed(1)}s`:weapon==='static'?'Static Blaster · steady bursts':weapon==='heart'?'Heartbreaker · precise single shots':weapon==='bass'?'Bass Cannon · close-range spread':'';
  this.root.title=weapon?`${WEAPONS[weapon].name}: controlled bursts preserve accuracy`:'';
 }
}
