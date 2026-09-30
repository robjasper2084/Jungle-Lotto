import './tacticalHud.css';
import {MapLayout} from './mapLayout.ts';
export type MapPoint={x:number;y:number};
export type MapLine={points:MapPoint[];color:string;width:number;fill?:boolean};
export type MapMarker=MapPoint&{heading:number;color?:string};
/** DOM/canvas HUD: no second WebGL renderer, physics loop or tile requests. */
export class TacticalMap{
 readonly button=document.createElement('button');
 private widget=document.createElement('div');
 readonly dialog=document.createElement('dialog');
 readonly layout:MapLayout;
 private mini=document.createElement('canvas');private full=document.createElement('canvas');
 private caption=document.createElement('span');private note=document.createElement('p');
 private lines:MapLine[]=[];private labels:{point:MapPoint;text:string}[]=[];
 private markers:MapMarker[]=[];private route:MapPoint[]=[];private approach:MapPoint[]=[];
 private bounds={x:0,y:0,w:100,h:100};private next=0;private zoom=1;
 private miniZoom=2;private zoomSteps=[100,180,290,450,700];
 constructor(title:string,pause:()=>void,focus:()=>void){
  this.widget.className='tactical-minimap';this.widget.hidden=true;this.widget.setAttribute('role','group');this.widget.setAttribute('aria-label',title+' mini-map controls');this.button.className='tactical-map-open';this.button.type='button';this.button.setAttribute('aria-label','Open '+title+' map');this.button.setAttribute('aria-haspopup','dialog');
  this.mini.width=this.mini.height=240;this.mini.setAttribute('aria-hidden','true');const compass=document.createElement('b');compass.className='map-north';compass.textContent='N';this.caption.textContent=title;this.button.append(this.mini,compass,this.caption);this.widget.append(this.button);document.body.append(this.widget);
  const zoomKey='tactical-map-zoom-v1-'+title;try{const v=Number(localStorage.getItem(zoomKey)??2);if(Number.isInteger(v)&&v>=0&&v<this.zoomSteps.length)this.miniZoom=v;}catch{}
  const miniTools=document.createElement('div');miniTools.className='mini-map-zoom';
  const zoomButtons:HTMLButtonElement[]=[];
  const refreshZoom=()=>{zoomButtons[0].disabled=this.miniZoom===this.zoomSteps.length-1;zoomButtons[1].disabled=this.miniZoom===0;this.widget.dataset.zoomMetres=String(this.zoomSteps[this.miniZoom]);};
  for(const [label,symbol,delta]of [['Zoom out mini-map','−',1],['Zoom in mini-map','+',-1]] as const){const b=document.createElement('button');b.type='button';b.textContent=symbol;b.setAttribute('aria-label',label);b.onclick=()=>{this.miniZoom=Math.max(0,Math.min(this.zoomSteps.length-1,this.miniZoom+delta));try{localStorage.setItem(zoomKey,String(this.miniZoom));}catch{}refreshZoom();this.draw();};miniTools.append(b);zoomButtons.push(b);}this.widget.append(miniTools);refreshZoom();
  this.dialog.className='tactical-map-dialog';this.dialog.setAttribute('aria-label',title+' map');const header=document.createElement('div');header.className='tactical-map-heading';const name=document.createElement('h2');name.textContent=title;const close=document.createElement('button');close.textContent='Close map';header.append(name,close);
  this.full.width=840;this.full.height=700;this.full.setAttribute('role','img');this.full.setAttribute('aria-label','North-up map, your heading, and highlighted route');
  const footer=document.createElement('div');footer.className='map-actions';for(const [label,value] of [['Full area',1],['Near rider',3]] as const){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{this.zoom=value;this.draw();};footer.append(b);}
  this.note.className='map-route-note';this.dialog.append(header,this.full,this.note,footer);document.body.append(this.dialog);
  this.button.onclick=()=>{pause();this.dialog.showModal();this.zoom=1;this.draw();close.focus();};close.onclick=()=>this.dialog.close();this.dialog.onclose=()=>focus();
  this.dialog.addEventListener('keydown',e=>e.stopPropagation());this.dialog.addEventListener('pointerdown',e=>e.stopPropagation());
  this.widget.dataset.mapTitle=title;this.layout=new MapLayout(this.widget,title,pause);
  const customize=document.createElement('button');customize.textContent='Customize mini-map';customize.onclick=()=>{this.dialog.close();this.layout.edit();};footer.append(customize);
 }
 setMap(lines:MapLine[],labels:{point:MapPoint;text:string}[]=[]){this.lines=lines;this.labels=labels;const points=lines.flatMap(l=>l.points);if(!points.length)return;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);this.bounds={x:x-25,y:y-25,w:Math.max(...xs)-x+50,h:Math.max(...ys)-y+50};}
 setRoute(route:MapPoint[],approach:MapPoint[],text:string){this.route=route;this.approach=approach;if(this.caption.textContent!==text){this.caption.textContent=text;this.note.textContent=text+' · Gold line: route · Dashed line: join the lane · Arrow: your heading';}}
 update(markers:MapMarker[],visible:boolean){const hidden=!visible&&!this.layout.active;if(this.widget.hidden!==hidden){this.widget.hidden=hidden;this.layout.refresh();}if(!visible&&!this.dialog.open&&!this.layout.active)return;if(markers.length)this.markers=markers;const now=performance.now();if(now<this.next)return;this.next=now+150;this.draw();}
 open(){this.button.click();}
 private draw(){const p=this.markers[0]??{x:this.bounds.x+this.bounds.w/2,y:this.bounds.y+this.bounds.h/2};const range=this.zoomSteps[this.miniZoom];this.paint(this.mini,{x:p.x-range/2,y:p.y-range/2,w:range,h:range},true);if(this.dialog.open){const b=this.bounds;const side=Math.max(b.w,b.h)/this.zoom;this.paint(this.full,this.zoom===1?{x:b.x+b.w/2-side/2,y:b.y+b.h/2-side/2,w:side,h:side}:{x:p.x-side/2,y:p.y-side/2,w:side,h:side},false);}}
 private paint(canvas:HTMLCanvasElement,view:{x:number;y:number;w:number;h:number},mini:boolean){
  const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,scale=Math.min(w/view.w,h/view.h),ox=(w-view.w*scale)/2,oy=(h-view.h*scale)/2;
  const point=(p:MapPoint)=>({x:ox+(p.x-view.x)*scale,y:oy+(p.y-view.y)*scale});c.fillStyle='#203c35';c.fillRect(0,0,w,h);c.lineJoin=c.lineCap='round';
  c.strokeStyle='#e2e8cc0b';c.lineWidth=1;for(let i=0;i<w;i+=w/4){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();}for(let i=0;i<h;i+=h/4){c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}
  const line=(points:MapPoint[],color:string,width:number,fill=false)=>{if(!points.length)return;c.beginPath();for(let i=0;i<points.length;i++){const p=point(points[i]);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}c.strokeStyle=c.fillStyle=color;c.lineWidth=width;if(fill){c.closePath();c.fill();}else c.stroke();};
  for(const l of this.lines){if(mini&&!l.points.some(p=>p.x>=view.x-150&&p.x<=view.x+view.w+150&&p.y>=view.y-150&&p.y<=view.y+view.h+150))continue;line(l.points,l.color,Math.max(mini?1.4:.7,l.width*scale),l.fill);}
  line(this.route,'#18251d',mini?7:6);line(this.route,'#f4d477',mini?4:3.5);c.setLineDash([4,5]);line(this.approach,'#fff0bd',2);c.setLineDash([]);
  if(this.route.length){const p=point(this.route.at(-1)!);c.fillStyle='#f4d477';c.beginPath();c.arc(p.x,p.y,mini?5:6,0,Math.PI*2);c.fill();}
  if(!mini){c.font='600 13px system-ui';c.textAlign='center';for(const l of this.labels){const p=point(l.point);c.fillStyle='#101f1ccc';const tw=c.measureText(l.text).width;c.fillRect(p.x-tw/2-4,p.y-16,tw+8,20);c.fillStyle='#eee7ce';c.fillText(l.text,p.x,p.y);}}
  for(const [i,m] of this.markers.entries()){const p=point(m);c.save();c.translate(p.x,p.y);c.rotate(m.heading);c.fillStyle=m.color??(i?'#80d9ff':'#fff3ba');c.strokeStyle='#101e19';c.lineWidth=2;c.beginPath();c.moveTo(0,-11);c.lineTo(8,9);c.lineTo(0,5);c.lineTo(-8,9);c.closePath();c.fill();c.stroke();c.restore();}
  c.fillStyle='#d9e4d8';c.font='600 11px system-ui';c.textAlign='left';const metres=mini?50:Math.round(view.w/5/50)*50;const px=metres*scale;c.fillRect(12,h-20,px,2);c.fillText(metres+' m',12,h-27);if(!mini)c.fillText('N ↑',w-42,24);
 }
}
