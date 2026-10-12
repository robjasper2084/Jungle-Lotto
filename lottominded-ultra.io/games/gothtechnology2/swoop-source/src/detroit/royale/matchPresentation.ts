import type {RoyaleSnapshot} from '../../../../ride-core/src/royale/rules.ts';
import {PROTECTION} from '../../../../ride-core/src/royale/rules.ts';
/** Brief DOM cues stay clear of aiming and never capture input. */
export class MatchPresentation {
 readonly root=document.createElement('div');private banner=document.createElement('div');private title=document.createElement('strong');private subtitle=document.createElement('span');
 private marker=document.createElement('div');private direction=document.createElement('div');private danger=document.createElement('div');
 private round='';private phase='';private remaining=99;private until=0;private hitUntil=0;private directionUntil=0;private resultsAt=0;private reduced=false;
 constructor(){this.root.id='royale-feedback';this.banner.className='royale-moment';this.banner.setAttribute('role','status');this.banner.append(this.title,this.subtitle);
  this.marker.className='royale-confirmed-hit';this.marker.setAttribute('aria-hidden','true');this.direction.className='royale-damage-direction';this.direction.setAttribute('aria-hidden','true');this.danger.className='royale-field-danger';this.root.append(this.danger,this.banner,this.marker,this.direction);document.body.append(this.root);}
 private announce(title:string,subtitle:string,now:number,duration=2300){this.title.textContent=title;this.subtitle.textContent=subtitle;this.until=now+duration;this.banner.getAnimations().forEach(a=>a.cancel());if(!this.reduced)this.banner.animate([{opacity:0,translate:'0 9px'},{opacity:1,translate:'0 0'}],{duration:350,easing:'ease-out'});}
 hit(now:number){this.hitUntil=now+180;}
 damage(now:number,bearing?:number){this.directionUntil=now+650;this.direction.dataset.directional=String(bearing!==undefined);this.direction.style.setProperty('--bearing',`${bearing??0}rad`);}
 shieldBreak(now:number){this.announce('SHIELD BROKEN','Find cover to recover',now,1900);}
 update(s:RoyaleSnapshot,me:string,now:number,hidden:boolean,reduced:boolean){
  this.reduced=reduced;
  if(this.round!==s.round){this.round=s.round;this.phase='';this.remaining=99;this.until=this.hitUntil=this.directionUntil=this.resultsAt=0;}
  if(s.phase==='deployment'){this.title.textContent=String(Math.max(1,Math.ceil((PROTECTION-s.tick)/60)));this.subtitle.textContent='GET READY · SURVIVE THE STATIC';this.until=now+200;}
  else if(s.phase!==this.phase&&s.phase==='active')this.announce('RIDE OUT','Find cover. Stay inside the field.',now);
  else if(s.phase==='active'&&s.remaining<=3&&s.remaining<this.remaining)this.announce(s.remaining===2?'FINAL TWO':`${s.remaining} RIDERS LEFT`,'Keep your head on a swivel',now);
  if(s.phase==='results'&&this.phase!=='results'){this.resultsAt=now;this.announce(s.winner===me?'VICTORY':'ROUND COMPLETE',s.winner===me?'LAST RIDER STANDING':'Your next run starts here',now,2600);}
  this.phase=s.phase;this.remaining=s.remaining;this.root.hidden=hidden;this.root.dataset.reduced=String(reduced);
  this.banner.hidden=now>=this.until;this.marker.hidden=now>=this.hitUntil;this.direction.hidden=now>=this.directionUntil;
  const self=s.actors.find(a=>a.id===me);const outside=!!self?.alive&&Math.hypot(self.pose.x-s.field.x,self.pose.z-s.field.z)>s.field.radius;
  this.danger.hidden=!outside||s.phase!=='active';this.danger.setAttribute('aria-label',outside?'Outside the Static Field':'');
 }
 get resultsStarted(){return this.resultsAt;}
 hide(){this.root.hidden=true;}
}
