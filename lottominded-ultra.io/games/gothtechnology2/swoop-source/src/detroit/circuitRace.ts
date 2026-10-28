import * as T from 'three';
import {LapRace,outAndBack,type RaceEntry,type RacePoint} from '../../../ride-core/src/lapRace.ts';
import './circuitRace.css';
export type CircuitHost={name:string;context?:()=>string;entries:()=>RaceEntry[];points:()=>RacePoint[];clear:(a:RacePoint,b:RacePoint)=>boolean;ground:(x:number,z:number,y:number)=>number;focus:()=>void};
/** Short out-and-back races are available wherever the current map has a clear
 * lane. Existing point-to-point/AI events remain independent. */
export class CircuitRace {
 private root=document.createElement('section');private launch=document.createElement('button');private panel=document.createElement('div');private status=document.createElement('output');private help=document.createElement('p');private cancel=document.createElement('button');private start=document.createElement('button');
 private marker=new T.Group();private ring:T.Mesh;private course:RacePoint[]=[];race?:LapRace;private clock=0;private hint='';
 private context='';
 constructor(scene:T.Scene,private canvas:HTMLCanvasElement,private host:CircuitHost){
  this.root.className='circuit-race';this.root.hidden=true;this.root.setAttribute('aria-label','Circuit race');this.launch.type='button';this.launch.textContent='Lap race';this.launch.setAttribute('aria-expanded','false');
  this.panel.hidden=true;this.panel.className='circuit-panel';this.start.type=this.cancel.type='button';this.start.textContent='Start 3 laps';this.cancel.textContent='Close';this.status.setAttribute('aria-live','polite');
  this.help.textContent='Three laps through ordered gates, out and back along a clear lane. Solo time trial or all local riders. Return to the start marker for the countdown.';
  this.panel.append(this.help,this.start,this.cancel);this.root.append(this.launch,this.panel,this.status);document.body.append(this.root);
  this.launch.onclick=()=>{this.panel.hidden=!this.panel.hidden;this.launch.setAttribute('aria-expanded',String(!this.panel.hidden));if(!this.panel.hidden)this.preview();};
  this.start.onclick=()=>{this.preview();if(this.course.length<3)return;this.race=new LapRace(this.course,this.host.entries());this.panel.hidden=true;this.launch.setAttribute('aria-expanded','false');this.launch.textContent='Race options';this.host.focus();};
  this.cancel.onclick=()=>{this.reset();this.host.focus();};
  this.ring=new T.Mesh(new T.TorusGeometry(3.2,.07,6,40),new T.MeshBasicMaterial({color:0x70ffe0,depthTest:true}));this.marker.add(this.ring);
  const arrow=new T.Mesh(new T.ConeGeometry(.4,1,5),new T.MeshBasicMaterial({color:0xffd078}));arrow.position.y=4.2;arrow.rotation.z=Math.PI;this.marker.add(arrow);this.marker.visible=false;scene.add(this.marker);
 }
 private preview(){
  const entries=this.host.entries(),p=entries[0]?.pose;if(!p)return;
  const supplied=this.host.points();let best:RacePoint[]=[];
  const tryPath=(points:RacePoint[])=>{const path=[{...p}];for(const q of points){const a=path.at(-1)!,n=Math.ceil(Math.hypot(q.x-a.x,q.z-a.z)/10);let blocked=false;for(let i=1;i<=n;i++){const f=i/n,x=a.x+(q.x-a.x)*f,z=a.z+(q.z-a.z)*f,y=this.host.ground(x,z,path.at(-1)!.y),b={x,y,z};if(!Number.isFinite(y)||Math.abs(y-path.at(-1)!.y)>.8||!this.host.clear(path.at(-1)!,b)){blocked=true;break;}path.push(b);}if(blocked)break;}return path;};
  if(supplied.length)best=tryPath(supplied);
  if(best.length<5)for(let i=0;i<16;i++){const a=i*Math.PI/8,path=tryPath([{x:p.x+Math.sin(a)*80,y:p.y,z:p.z+Math.cos(a)*80}]);if(path.length>best.length)best=path;}
  this.course=outAndBack(best);this.start.disabled=this.course.length<4;
  this.hint=this.start.disabled?'Move to an open lane, then reopen Lap race.':'3 laps · '+Math.round(best.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b.x-best[i].x,b.z-best[i].z),0)*2)+' m per lap · '+entries.length+' rider'+(entries.length===1?' · solo time trial':'s');
  this.status.textContent=this.hint;
 }
 update(dt:number,visible:boolean,paused:boolean){
  if(document.querySelector('.community-panel[open]:not([hidden])'))visible=false;
  const context=this.host.context?.()??this.host.name;if(context!==this.context){this.reset();this.context=context;}
  this.root.hidden=!visible;this.marker.visible=visible&&!!this.race;
  const entries=this.host.entries();if(this.race&&this.race.racers.some(r=>!entries.some(e=>e.id===r.id)))this.reset();this.race?.update(dt,entries,paused||!visible);
  this.clock+=dt;if(this.clock<.15)return;this.clock=0;
  if(!visible)return;
  if(innerWidth<700&&innerHeight>=500){const reserved=[...document.querySelectorAll('#hud,.session-hud,#elmwood-controls,.on-foot-controls,.community-panel')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().bottom).filter(y=>y<innerHeight*.65);this.root.style.top=Math.max(172,...reserved.map(y=>y+8))+'px';}else this.root.style.top='';
  const race=this.race;if(!race)return;
  const own=race.racers[0],p=entries.find(e=>e.id===own.id)?.pose;if(!p)return;
  const gate=race.course[race.stage==='grid'?0:own.next];this.marker.position.set(gate.x,gate.y+2,gate.z);const prev=race.course[(own.next+race.course.length-1)%race.course.length];this.ring.rotation.y=Math.atan2(gate.x-prev.x,gate.z-prev.z);
  const gap=Math.hypot(gate.x-p.x,gate.z-p.z),rank=race.rank().findIndex(r=>r.id===own.id)+1;
  const bearing=Math.atan2(gate.x-p.x,gate.z-p.z)-(p.headingY??0),direction=['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(bearing/(Math.PI/4))%8+8)%8];
  this.status.textContent=race.stage==='grid'?(gap>6?'Return to START · '+Math.ceil(gap)+' m':'Ready · '+Math.ceil(race.countdown)):(own.finish!==undefined?'Finished · '+own.finish.toFixed(2)+'s':`Lap ${race.lap(own)}/${race.laps} · Gate ${own.next===0?race.course.length:own.next}/${race.course.length} · ${Math.ceil(gap)} m`)+` · ${rank}/${race.racers.length} place`+(own.finish===undefined?' · '+race.elapsed.toFixed(1)+'s':'')+(own.invalid?' · Return to the next gate':'');
  this.marker.visible=own.finish===undefined;
  if(own.finish===undefined)this.status.textContent=direction+' '+this.status.textContent;
  this.canvas.dataset.lapRace=JSON.stringify({map:this.host.name,stage:race.stage,lap:race.lap(own),laps:race.laps,next:own.next,gate,place:rank,entrants:race.racers.length,elapsed:race.elapsed,completed:own.completed,finish:own.finish??null,course:race.course});
 }
 reset(){this.race=undefined;this.marker.visible=false;this.panel.hidden=true;this.status.textContent='';this.hint='';this.launch.textContent='Lap race';this.launch.setAttribute('aria-expanded','false');delete this.canvas.dataset.lapRace;}
 dispose(){this.root.remove();this.marker.removeFromParent();this.marker.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});}
}
