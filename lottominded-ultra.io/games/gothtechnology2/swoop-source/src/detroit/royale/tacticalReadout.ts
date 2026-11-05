import type {RoyaleSnapshot} from '../../../../ride-core/src/royale/rules.ts';
import {EVADE_TICKS} from '../../../../ride-core/src/royale/evade.ts';

export type TacticalAction='smoke'|'evade'|'vault'|'repair';
export type TacticalStatus={action:TacticalAction;name:string;state:'ready'|'cooldown'|'blocked'|'active';label:string;reason:string;available:boolean};
export type TacticalContext={phase:string;tick:number;alive:boolean;footMode:number;prone:number;vaulting:boolean;canVault:boolean;smokeCharges:number;smokeReady:number;evadeUntil:number;staggerUntil:number;health:number;healthPacks:number;healingUntil:number};
export type TacticalBindings=Record<TacticalAction,string>;
const actions:TacticalAction[]=['smoke','evade','vault','repair'];
const names:Record<TacticalAction,string>={smoke:'Smoke',evade:'Evade',vault:'Vault',repair:'Heal'};
const seconds=(until:number,tick:number)=>Math.max(.1,Math.ceil((until-tick)/6)/10).toFixed(1)+'s';

export function tacticalContext(s:RoyaleSnapshot,canVault=false):TacticalContext{
 const me=s.self,pose=s.actors.find(a=>a.id===me?.id)?.pose,m=me?.combat.melee;
 return {phase:s.phase,tick:s.tick,alive:!!me?.alive,footMode:pose?.footMode??0,prone:pose?.footProne??0,vaulting:(pose?.footVault??0)>0,canVault,smokeCharges:me?.smokeCharges??0,smokeReady:me?.smokeReady??0,evadeUntil:m?.evadeUntil??0,staggerUntil:m?.staggerUntil??0,health:me?.integrity??0,healthPacks:me?.repairs??0,healingUntil:me?.healingUntil??0};
}

/** The engine's evade lasts 96 ticks and recovers at tick 180; its end remains in snapshots. */
export function evadeReadyAt(until:number){return until>0?until+(180-EVADE_TICKS):0;}

export function tacticalStatus(action:TacticalAction,c:TacticalContext):TacticalStatus{
 const result=(state:TacticalStatus['state'],label:string,reason:string):TacticalStatus=>({action,name:names[action],state,label,reason,available:state==='ready'});
 const blocked=(label:string,reason=label)=>result('blocked',label,reason);
 if(!c.alive)return blocked('Eliminated','Unavailable while eliminated');
 if(c.phase!=='active')return blocked(c.phase==='deployment'?'Deploying':'Round ended',c.phase==='deployment'?'Available when deployment ends':'Start the next round to use tactical actions');
 if(action==='repair'){
  if(c.healingUntil>c.tick)return result('active',seconds(c.healingUntil,c.tick),'Already healing');
  if(c.health>=100)return blocked('Full health','Already at full health · no pack used');
  if(c.healthPacks<=0)return blocked('No packs','Find a health pack to heal');
  return result('ready',`${c.healthPacks} ${c.healthPacks===1?'pack':'packs'}`,'');
 }
 if(c.footMode!==2)return blocked(c.footMode===1?'Dismounting':'On wheel',c.footMode===1?'Finish dismounting first':`Get off your wheel to ${action==='smoke'?'throw smoke':action}`);
 if(action==='smoke'){
  if(c.smokeCharges<=0)return blocked('Empty','No smoke grenades left');
  if(c.smokeReady>c.tick)return result('cooldown',`${c.smokeCharges} · ${seconds(c.smokeReady,c.tick)}`,`Smoke recharging · ${seconds(c.smokeReady,c.tick)}`);
  if(c.vaulting||c.evadeUntil>c.tick)return blocked('Finish move','Finish the vault or evade before throwing smoke');
  return result('ready',`${c.smokeCharges} ready`,'');
 }
 if(action==='evade'){
  if(c.evadeUntil>c.tick)return result('active',seconds(c.evadeUntil,c.tick),'Evade already in progress');
  if(c.prone>=.3)return blocked('Stand up','Stand up before evading');
  if(c.staggerUntil>c.tick)return result('cooldown',seconds(c.staggerUntil,c.tick),'Recover from the hit before evading');
  const ready=evadeReadyAt(c.evadeUntil);if(ready>c.tick)return result('cooldown',seconds(ready,c.tick),`Evade recovering · ${seconds(ready,c.tick)}`);
  if(c.vaulting)return blocked('Vaulting','Finish the vault before evading');
  return result('ready','Ready','');
 }
 if(c.vaulting)return result('active','Vaulting','Vault already in progress');
 if(c.evadeUntil>c.tick)return blocked('Evading','Finish the evade before vaulting');
 if(!c.canVault)return blocked('No cover','Move closer to low cover or an open window');
 return result('ready','Ready','');
}

export const tacticalKeyLabel=(code:string)=>code.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Arrow/,'');

/** Informational desktop readout; controls keep their existing keyboard/touch handlers. */
export class TacticalReadout{
 readonly root:HTMLElement;readonly note:HTMLElement;private items=new Map<TacticalAction,{root:HTMLElement;key:HTMLElement;label:HTMLElement}>();private context?:TacticalContext;private noteUntil=0;private noteKey='';private lastNote=-Infinity;
 constructor(parent:HTMLElement=document.body){
  this.root=document.createElement('aside');this.root.className='royale-tactical-readout';this.root.setAttribute('aria-label','Tactical actions');this.root.hidden=true;
  for(const action of actions){const root=document.createElement('div'),key=document.createElement('kbd'),name=document.createElement('strong'),label=document.createElement('span');root.className='royale-tactical-item';root.dataset.action=action;name.textContent=names[action];root.append(key,name,label);this.root.append(root);this.items.set(action,{root,key,label});}
  this.note=document.createElement('div');this.note.className='royale-action-note';this.note.setAttribute('role','status');this.note.setAttribute('aria-live','polite');this.note.setAttribute('aria-atomic','true');this.note.hidden=true;parent.append(this.root,this.note);
 }
 update(context:TacticalContext,bindings:TacticalBindings,now:number,hidden=false,compact=false){
  this.context=context;const unavailable=hidden||!context.alive||context.phase!=='active';this.root.hidden=unavailable||compact;this.note.hidden=unavailable||now>=this.noteUntil;
  for(const action of actions){const status=tacticalStatus(action,context),item=this.items.get(action)!;item.root.dataset.state=status.state;item.root.title=status.reason;item.root.setAttribute('aria-label',`${status.name}: ${status.label}${status.reason?' · '+status.reason:''}`);item.key.textContent=tacticalKeyLabel(bindings[action]);item.label.textContent=status.label;}
 }
 attempt(action:TacticalAction,now:number,context=this.context){
  if(!context)return false;const status=tacticalStatus(action,context);if(status.available)return true;
  if(this.noteKey!==status.reason||now-this.lastNote>=1000){this.note.textContent=status.reason;this.note.hidden=false;this.noteUntil=now+2200;this.noteKey=status.reason;this.lastNote=now;}
  return false;
 }
 hide(){this.root.hidden=this.note.hidden=true;this.context=undefined;this.noteUntil=0;this.noteKey='';this.lastNote=-Infinity;}
 dispose(){this.root.remove();this.note.remove();}
}
