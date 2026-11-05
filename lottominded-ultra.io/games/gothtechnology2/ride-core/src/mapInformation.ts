export type MapPlace={point:{x:number;y:number};text:string};
export function mapDistance(metres:number){return metres>=1000?(metres/1000).toFixed(1)+' km':Math.round(metres)+' m';}
export function mapBearing(radians:number){const bearing=((Math.round(radians*180/Math.PI)%360)+360)%360;return ['N','NE','E','SE','S','SW','W','NW'][Math.round(bearing/45)%8]+' '+String(bearing).padStart(3,'0')+'°';}
export function nearbyMapPlaces(position:{x:number;y:number},places:readonly MapPlace[],limit=3){
 const seen=new Set<string>();return places.map(p=>({...p,distance:Math.hypot(p.point.x-position.x,p.point.y-position.y)})).filter(p=>Number.isFinite(p.distance)&&p.text.trim()).sort((a,b)=>a.distance-b.distance).filter(p=>{if(seen.has(p.text))return false;seen.add(p.text);return true;}).slice(0,limit);
}
/** Extra map detail is opt-in and shares the existing low-frequency HUD update. */
export class MapInformation{
 readonly root=document.createElement('details');private content=document.createElement('div');private previous='';private next=0;
 constructor(parent:HTMLElement,expanded=false){
  this.root.className='map-information';this.root.open=expanded;
  const summary=document.createElement('summary');summary.textContent='Map info';this.root.append(summary,this.content);parent.append(this.root);
  this.root.addEventListener('pointerdown',e=>e.stopPropagation());this.root.addEventListener('keydown',e=>e.stopPropagation());
  if(parent instanceof HTMLDialogElement){const header=parent.querySelector<HTMLElement>('.tactical-map-heading');if(header)Object.assign(header.style,{position:'sticky',top:'0',zIndex:'2',background:'#0b242bf2'});const actions=parent.querySelector<HTMLElement>('.map-actions');if(actions)actions.style.flexWrap='wrap';}
  if(!document.getElementById('map-information-style')){const style=document.createElement('style');style.id='map-information-style';style.textContent='.map-information{color:#edf9f4;background:#071e2799;border-top:1px solid #b5e5df55;font:12px/1.4 system-ui;text-align:left;overflow-wrap:anywhere}.map-information>summary{cursor:pointer;min-height:44px;box-sizing:border-box;padding:13px 10px;font-weight:700;touch-action:manipulation}.map-information>summary:focus-visible{outline:2px solid #74e5d4;outline-offset:-3px}.map-information>div{max-height:min(30dvh,230px);overflow:auto;overscroll-behavior:contain;padding:0 10px 10px}.map-information p{font:inherit;margin:0 0 7px}.map-information ul{padding-left:16px;margin:0 0 8px}.map-information li{margin:4px 0}.map-information .map-information-key{color:#c8ded7;font-size:11px}.tactical-map-dialog .map-information>div{max-height:none}.tactical-minimap .map-information{font-size:11px}@media(max-width:620px){.royale-map .map-information{font-size:10px}.map-information>div{max-height:160px}}';document.head.append(style);}
 }
 update(position:{x:number;y:number},heading:number,places:readonly MapPlace[],status:readonly string[],legend:string){
  const now=performance.now();if(now<this.next)return;this.next=now+500;
  const nearby=nearbyMapPlaces(position,places),rows=nearby.map(p=>p.text+' · '+mapDistance(p.distance)+' '+mapBearing(Math.atan2(p.point.x-position.x,-(p.point.y-position.y))).split(' ')[0]);
  const lines=['Facing '+mapBearing(heading),...status],key=JSON.stringify([lines,rows,legend]);if(key===this.previous)return;this.previous=key;
  const nodes:HTMLElement[]=[];for(const text of lines){const p=document.createElement('p');p.textContent=text;nodes.push(p);}
  if(rows.length){const title=document.createElement('p');title.textContent='Nearby landmarks';const list=document.createElement('ul');for(const text of rows){const li=document.createElement('li');li.textContent=text;list.append(li);}nodes.push(title,list);}
  const note=document.createElement('p');note.className='map-information-key';note.textContent=legend+' Distances are straight-line.';nodes.push(note);this.content.replaceChildren(...nodes);
 }
}
