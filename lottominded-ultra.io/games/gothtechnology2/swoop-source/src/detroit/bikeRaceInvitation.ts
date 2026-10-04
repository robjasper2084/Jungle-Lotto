import type {NavigationObstacle} from './terrain.ts';
import './bikeRaceInvitation.css';
import {bikeChallenger} from './cyclistContacts.ts';
/** A nearby computer cyclist can invite a race. Accepting is always the rider's choice. */
export class BikeRaceInvitation{
 readonly panel=document.createElement('aside');private copy=document.createElement('p');
 private clock=0;private nextOffer=0;private expires=0;private challenger?:string;
 constructor(accept:()=>void,focus:()=>void){
  this.panel.className='bikeRaceInvitation';this.panel.hidden=true;this.panel.setAttribute('aria-label','Nearby cyclist race invitation');
  const label=document.createElement('strong');label.textContent='UP FOR A RACE?';
  const race=document.createElement('button');race.type='button';race.textContent='Race the cyclists →';race.onclick=()=>{this.nextOffer=this.clock+120;this.challenger=undefined;this.panel.hidden=true;accept();focus();};
  const later=document.createElement('button');later.type='button';later.textContent='Keep riding';later.onclick=()=>{this.nextOffer=this.clock+75;this.challenger=undefined;this.panel.hidden=true;focus();};
  this.panel.addEventListener('pointerdown',e=>{if((e.target as HTMLElement).closest('button'))e.preventDefault();});
  this.panel.append(label,this.copy,race,later);document.body.append(this.panel);
 }
 update(dt:number,active:boolean,player:{x:number;y:number;z:number},actors:readonly NavigationObstacle[]){
  if(!active){this.panel.hidden=true;this.challenger=undefined;return;}
  this.clock+=Math.max(0,Math.min(dt,.1));
  const candidate=bikeChallenger(player,actors);
  if(this.challenger&&(!candidate||this.clock>this.expires)){this.nextOffer=this.clock+35;this.challenger=undefined;}
  if(!this.challenger&&candidate&&this.clock>=this.nextOffer){this.challenger=candidate.id;this.expires=this.clock+14;this.copy.textContent=(candidate.id.startsWith('community-')?'A cyclist in your group':'A nearby Cut cyclist')+' wants to race. Keep your current ride and race three bicycle rivals from the Cut entrance to Mack.';}
  this.panel.hidden=!this.challenger;
 }
}
