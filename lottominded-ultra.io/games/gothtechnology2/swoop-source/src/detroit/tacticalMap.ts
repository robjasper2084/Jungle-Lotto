import './tacticalHud.css';
import {raceMapProgress,checkpointScreenPoint,fitRaceCourse,type RaceMapCourse} from './raceMap.ts';
import {MapLayout} from './mapLayout.ts';
import {compassReading,compassTicks,miniMapView} from './mapHeading.ts';
export type MapPoint={x:number;y:number};
export type MapLine={points:MapPoint[];color:string;width:number;fill?:boolean};
export type MapMarker=MapPoint&{heading:number;color?:string;label?:string};
/** DOM/canvas HUD: no second WebGL renderer, physics loop or tile requests. */
export class TacticalMap{
 readonly button=document.createElement('button');
 private widget=document.createElement('div');
 readonly dialog=document.createElement('dialog');
 readonly layout:MapLayout;
 private mini=document.createElement('canvas');private full=document.createElement('canvas');
 private caption=document.createElement('span');private note=document.createElement('p');
 private compass=document.createElement('div');private compassTrack=document.createElement('div');private bearing=document.createElement('strong');
 private compassTicks:HTMLElement[]=[];private trail:MapPoint[][]=[];private trailLabel='';private legend=document.createElement('span');
 private lines:MapLine[]=[];private labels:{point:MapPoint;text:string}[]=[];
 private markers:MapMarker[]=[];private route:MapPoint[]=[];private approach:MapPoint[]=[];
 private race?:RaceMapCourse;private raceProgress?:ReturnType<typeof raceMapProgress>;private courseFit=false;private navCaption='';private courseButton=document.createElement('button');
 private bounds={x:0,y:0,w:100,h:100};private next=0;private zoom=1;
 private miniZoom=2;private zoomSteps=[100,180,290,450,700];
 constructor(title:string,pause:()=>void,focus:()=>void){
  this.widget.className='tactical-minimap';this.widget.hidden=true;this.widget.setAttribute('role','group');this.widget.setAttribute('aria-label',title+' mini-map controls');this.button.className='tactical-map-open';this.button.type='button';this.button.setAttribute('aria-label','Open '+title+' map');this.button.setAttribute('aria-haspopup','dialog');
  this.compass.className='tactical-compass';this.compass.hidden=true;this.compass.setAttribute('role','img');this.compassTrack.className='compass-track';this.compassTrack.setAttribute('aria-hidden','true');this.bearing.className='compass-bearing';this.bearing.setAttribute('aria-hidden','true');this.compass.append(this.compassTrack,this.bearing);
  this.mini.width=480;this.mini.height=300;this.mini.setAttribute('aria-hidden','true');const compass=document.createElement('b');compass.className='map-north';compass.textContent='N ↑';this.caption.textContent=this.navCaption=title;this.caption.className='mini-map-caption';this.legend.className='mini-map-legend';this.legend.hidden=true;this.button.append(this.mini,compass,this.caption);this.widget.append(this.button,this.legend);document.body.append(this.widget,this.compass);
  const zoomKey='tactical-map-zoom-v1-'+title;try{const v=Number(localStorage.getItem(zoomKey)??2);if(Number.isInteger(v)&&v>=0&&v<this.zoomSteps.length)this.miniZoom=v;}catch{}
  const miniTools=document.createElement('div');miniTools.className='mini-map-zoom';
  const zoomButtons:HTMLButtonElement[]=[];
  const refreshZoom=()=>{zoomButtons[0].disabled=this.miniZoom===this.zoomSteps.length-1;zoomButtons[1].disabled=this.miniZoom===0;this.widget.dataset.zoomMetres=String(this.zoomSteps[this.miniZoom]);};
  for(const [label,symbol,delta]of [['Zoom out mini-map','−',1],['Zoom in mini-map','+',-1]] as const){const b=document.createElement('button');b.type='button';b.textContent=symbol;b.setAttribute('aria-label',label);b.onclick=()=>{this.miniZoom=Math.max(0,Math.min(this.zoomSteps.length-1,this.miniZoom+delta));try{localStorage.setItem(zoomKey,String(this.miniZoom));}catch{}refreshZoom();this.draw();};miniTools.append(b);zoomButtons.push(b);}this.widget.append(miniTools);refreshZoom();
  this.dialog.className='tactical-map-dialog';this.dialog.setAttribute('aria-label',title+' map');const header=document.createElement('div');header.className='tactical-map-heading';const name=document.createElement('h2');name.textContent=title;const close=document.createElement('button');close.textContent='Close map';header.append(name,close);
  this.full.width=840;this.full.height=700;this.full.setAttribute('role','img');this.full.setAttribute('aria-label','North-up map, your heading, and highlighted route');
  const footer=document.createElement('div');footer.className='map-actions';for(const [label,value] of [['Full area',1],['Near rider',3]] as const){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{this.zoom=value;this.courseFit=false;this.draw();};footer.append(b);}
  this.courseButton.textContent='Race route';this.courseButton.hidden=true;this.courseButton.onclick=()=>{this.courseFit=true;this.draw();};footer.append(this.courseButton);
  this.note.className='map-route-note';this.dialog.append(header,this.full,this.note,footer);document.body.append(this.dialog);
  this.button.onclick=()=>{pause();this.dialog.showModal();this.zoom=1;this.courseFit=!!this.race;this.draw();close.focus();};close.onclick=()=>this.dialog.close();this.dialog.onclose=()=>focus();
  this.dialog.addEventListener('keydown',e=>e.stopPropagation());this.dialog.addEventListener('pointerdown',e=>e.stopPropagation());
  this.widget.dataset.mapTitle=title;this.layout=new MapLayout(this.widget,title,pause);
  const customize=document.createElement('button');customize.textContent='Customize mini-map';customize.onclick=()=>{this.dialog.close();this.layout.edit();};footer.append(customize);
 }
 setMap(lines:MapLine[],labels:{point:MapPoint;text:string}[]=[]){this.lines=lines;this.labels=labels;const points=lines.flatMap(l=>l.points);if(!points.length)return;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);this.bounds={x:x-25,y:y-25,w:Math.max(...xs)-x+50,h:Math.max(...ys)-y+50};}
 setTrail(segments:MapPoint[][],label:string){this.trail=segments;this.trailLabel=label;this.widget.dataset.trail=label;this.refreshNote();}
 setRaceCourse(course:RaceMapCourse|null){
  if(!course){if(!this.race)return;this.race=undefined;this.raceProgress=undefined;this.courseFit=false;delete this.widget.dataset.raceCourse;delete this.widget.dataset.raceNext;delete this.widget.dataset.raceTotal;this.refreshNote();return;}
  if(this.race?.id!==course.id||this.race.next!==course.next||this.race.finished!==course.finished||this.race.points!==course.points)this.raceProgress=raceMapProgress(course);
  this.race=course;this.widget.dataset.raceCourse=course.id;this.widget.dataset.raceNext=this.raceProgress!.target?String(this.raceProgress!.next+1):'complete';this.widget.dataset.raceTotal=String(course.checkpoints.length);this.refreshNote();
 }
 private refreshNote(){
  const race=this.race,progress=this.raceProgress,target=progress?.target,player=this.markers[0];
  const caption=race&&progress?(target?'Next '+(progress.next+1)+'/'+progress.total+(player?' · '+Math.round(Math.hypot(target.x-player.x,target.y-player.y))+' m':''):'All checkpoints passed'):this.navCaption;
  if(this.caption.textContent!==caption)this.caption.textContent=caption;
  this.courseButton.hidden=!race;this.legend.hidden=!race&&!this.trail.length;const legend=race?.label??this.trailLabel;if(this.legend.textContent!==legend)this.legend.textContent=legend;
  this.widget.classList.toggle('race-map-active',!!race);
  this.note.textContent=race?race.label+' · '+caption+' · Cyan: race route · Gold: next checkpoint · Numbers: checkpoint order · F: finish · Gray: passed · White arrow: you':caption+(this.trail.length?' · Red: '+this.trailLabel:'')+' · Gold: navigation route · Dashed: join the lane · White arrow: your heading';
  this.full.setAttribute('aria-label',race?this.note.textContent!:'North-up map, your heading, and highlighted route');
 }
 setRoute(route:MapPoint[],approach:MapPoint[],text:string){this.route=route;this.approach=approach;this.navCaption=text;if(!this.race)this.refreshNote();}
 update(markers:MapMarker[],visible:boolean){this.compass.hidden=!visible||this.layout.active;const hidden=!visible&&!this.layout.active;if(this.widget.hidden!==hidden){this.widget.hidden=hidden;this.layout.refresh();}if(!visible&&!this.dialog.open&&!this.layout.active)return;if(markers.length)this.markers=markers;const now=performance.now();if(now<this.next)return;this.next=now+150;this.draw();}
 open(){this.button.click();}
 private draw(){
  this.refreshNote();
  const heading=this.markers[0]?.heading??0,reading=compassReading(heading);
  this.compass.setAttribute('aria-label','Compass: '+reading.direction+' '+reading.bearing+' degrees');
  this.bearing.textContent=reading.direction+' '+String(reading.bearing).padStart(3,'0')+'°';
  const ticks=compassTicks(heading);ticks.forEach((t,i)=>{let tick=this.compassTicks[i];if(!tick){tick=document.createElement('b');this.compassTicks[i]=tick;this.compassTrack.append(tick);}tick.hidden=false;tick.style.left=t.position+'%';if(tick.textContent!==t.label)tick.textContent=t.label;tick.className=t.major?'major':'';});for(let i=ticks.length;i<this.compassTicks.length;i++)this.compassTicks[i].hidden=true;
  const p=this.markers[0]??{x:this.bounds.x+this.bounds.w/2,y:this.bounds.y+this.bounds.h/2};const range=this.zoomSteps[this.miniZoom];
  this.paint(this.mini,miniMapView(p,range,this.mini.width/this.mini.height),true);
  if(this.dialog.open){let b=this.bounds;
   if(this.courseFit&&this.race?.points.length)b=fitRaceCourse(this.race.points);
   const side=Math.max(b.w,b.h)/(this.courseFit?1:this.zoom);this.paint(this.full,this.courseFit||this.zoom===1?{x:b.x+b.w/2-side/2,y:b.y+b.h/2-side/2,w:side,h:side}:{x:p.x-side/2,y:p.y-side/2,w:side,h:side},false);}
 }
 private paint(canvas:HTMLCanvasElement,view:{x:number;y:number;w:number;h:number},mini:boolean){
  const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,scale=Math.min(w/view.w,h/view.h),ox=(w-view.w*scale)/2,oy=(h-view.h*scale)/2;
  const point=(p:MapPoint)=>({x:ox+(p.x-view.x)*scale,y:oy+(p.y-view.y)*scale});c.fillStyle='#243c30';c.fillRect(0,0,w,h);c.lineJoin=c.lineCap='round';
  c.strokeStyle='#e2e8cc0b';c.lineWidth=1;for(let i=0;i<w;i+=w/4){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();}for(let i=0;i<h;i+=h/4){c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}
  const line=(points:readonly MapPoint[],color:string,width:number,fill=false)=>{if(!points.length)return;c.beginPath();for(let i=0;i<points.length;i++){const p=point(points[i]);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}c.strokeStyle=c.fillStyle=color;c.lineWidth=width;if(fill){c.closePath();c.fill();}else c.stroke();};
  for(const l of this.lines){if(mini&&!l.points.some(p=>p.x>=view.x-150&&p.x<=view.x+view.w+150&&p.y>=view.y-150&&p.y<=view.y+view.h+150))continue;line(l.points,l.color,Math.max(mini?1.4:.7,l.width*scale),l.fill);}
  for(const segment of this.trail){line(segment,'#ff555542',mini?13:10);line(segment,'#ff5555',mini?7:5);}
  if(!this.race){line(this.route,'#18251d',mini?5:6);line(this.route,'#f4d477',mini?3:3.5);c.setLineDash([4,5]);line(this.approach,'#fff0bd',2);c.setLineDash([]);
  if(this.route.length){const p=point(this.route.at(-1)!);c.fillStyle='#f4d477';c.beginPath();c.arc(p.x,p.y,mini?5:6,0,Math.PI*2);c.fill();}}
  if(this.raceProgress){
   line(this.raceProgress.passed,'#81938e',mini?4:4.5);
   line(this.raceProgress.remaining,'#082b32',mini?10:9);line(this.raceProgress.remaining,'#63f0df',mini?6:5);
   const checkpoints=mini?this.raceProgress.checkpoints.filter(g=>g.index>=this.raceProgress!.next&&g.index<this.raceProgress!.next+3):this.raceProgress.checkpoints;
   for(const gate of checkpoints){
    const raw=point(gate.point),p=mini&&gate.state==='next'?checkpointScreenPoint(raw,w,h):{...raw,edge:false,angle:0};
    if(p.x<14||p.y<14||p.x>w-14||p.y>h-14)continue;
    const radius=gate.state==='next'?17:13;c.fillStyle=gate.state==='next'?'#ffe391':gate.state==='passed'?'#657b73':'#63f0df';c.strokeStyle='#0b242a';c.lineWidth=3;
    c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fill();c.stroke();
    c.font='800 '+(gate.state==='next'?15:13)+'px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#0b242a';c.fillText(gate.finish?'F':String(gate.number),p.x,p.y);
    if(gate.state==='next'){
     c.font='800 11px system-ui';const label=gate.finish?'FINISH':'NEXT '+gate.number,tw=c.measureText(label).width,ly=p.y>h-50?p.y-29:p.y+29;c.fillStyle='#0b242a';c.fillRect(p.x-tw/2-5,ly-9,tw+10,18);c.fillStyle='#ffe391';c.fillText(label,p.x,ly);
     if(p.edge){c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.fillStyle='#ffe391';c.beginPath();c.moveTo(23,0);c.lineTo(16,-5);c.lineTo(16,5);c.closePath();c.fill();c.restore();}
    }
    c.textBaseline='alphabetic';
   }
  }
  if(!mini&&!this.race){c.font='600 13px system-ui';c.textAlign='center';for(const l of this.labels){const p=point(l.point);c.fillStyle='#101f1ccc';const tw=c.measureText(l.text).width;c.fillRect(p.x-tw/2-4,p.y-16,tw+8,20);c.fillStyle='#eee7ce';c.fillText(l.text,p.x,p.y);}}
  for(const [i,m] of this.markers.entries()){const p=point(m);c.save();c.translate(p.x,p.y);c.rotate(m.heading);c.fillStyle=m.color??(i?'#f5d078':'#ffffff');c.strokeStyle='#04151d';c.lineWidth=2;c.beginPath();c.moveTo(0,-13);c.lineTo(9,10);c.lineTo(0,5);c.lineTo(-9,10);c.closePath();c.fill();c.stroke();c.restore();if(m.label){c.font='700 12px system-ui';c.textAlign='center';c.fillStyle='#06131ce8';const width=c.measureText(m.label).width+8;c.fillRect(p.x-width/2,p.y+14,width,18);c.fillStyle=m.color??'#ffffff';c.fillText(m.label,p.x,p.y+27);}}
  c.fillStyle='#d9e4d8';c.font='600 11px system-ui';c.textAlign='left';const metres=mini?50:Math.round(view.w/5/50)*50;const px=metres*scale;c.fillRect(12,h-20,px,2);c.fillText(metres+' m',12,h-27);if(!mini)c.fillText('N ↑',w-42,24);
 }
}
