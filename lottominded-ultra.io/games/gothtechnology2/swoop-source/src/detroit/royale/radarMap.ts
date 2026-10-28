import {MiniMapControls} from '../../../../ride-core/src/miniMapControls.ts';import type {RoyaleSnapshot} from '../../../../ride-core/src/royale/rules.ts';import type {DowntownArena} from '../../../../ride-core/src/royale/downtownArena.ts';
import {CITY} from '../geography.ts';
import {northUp} from '../routeMap.ts';
import {DETROIT_MAP_PLACES} from '../detroitMapPlaces.ts';
import {MapInformation,mapDistance} from '../../../../ride-core/src/mapInformation.ts';
/** Streets and public nearby actors; temporary dog scans contain coarse host pings. */
export class RoyaleRadarMap {
 readonly root=document.createElement('aside');private canvas=document.createElement('canvas');private controls:MiniMapControls;private at=0;
 private information:MapInformation;
  private roads=CITY.roads.map(road=>road.points.map(p=>northUp(p[0],p[1])));
 constructor(private terrain:DowntownArena,settingsParent?:HTMLElement){this.root.className='tactical-minimap royale-map';this.root.setAttribute('aria-label','Royale map and dog radar');this.canvas.width=180;this.canvas.height=150;this.canvas.setAttribute('aria-label','Nearby original Detroit streets');const footer=document.createElement('div');footer.className='map-actions';this.root.append(this.canvas);(settingsParent??this.root).append(footer);document.body.append(this.root);this.controls=new MiniMapControls(this.root,'royale',footer);
  // Keep markers opaque; the saved preference adjusts only the map background.
  const opacityLabel=footer.querySelector('label'),opacityRange=footer.querySelector('input');
  if(opacityLabel?.firstChild)opacityLabel.firstChild.textContent='Map background opacity ';
  opacityRange?.setAttribute('aria-label','Map background opacity');
  this.information=new MapInformation(this.root);
  const style=document.createElement('style');style.textContent='.royale-map{position:fixed;right:12px;top:68px;width:180px;z-index:6;background:#09282b80;border:1px solid #9fcabb80;border-radius:8px;overflow:hidden}.royale-map.tactical-minimap:not(.mini-map-collapsed){opacity:1;background:rgb(9 31 34 / var(--mini-map-opacity,.68))}.royale-map canvas{height:150px;width:180px;pointer-events:none}.royale-map .map-actions{padding:4px;font-size:10px}.royale-map .map-actions input{width:80px!important}.royale-map .mini-map-hide{background:#173b3270;padding:3px}@media(max-width:620px),(max-height:500px){.royale-map{width:120px;top:68px}.royale-map canvas{width:120px;height:100px}.royale-map .map-actions{display:none}}@media(max-height:500px){.royale-map canvas{height:80px}}';document.head.append(style);
 }
  update(s:RoyaleSnapshot,now:number,visible:boolean){this.root.hidden=!visible;const me=s.actors.find(a=>a.id===(s.spectating?.target||s.self?.id));if(!me||this.controls.hidden||now-this.at<200)return;this.at=now;
   const ctx=this.canvas.getContext('2d')!,p=me.pose,scale=180/250,t=this.terrain.terrain.fixture.transform;
   const map=(x:number,z:number)=>northUp(x*t.sx+t.tx,z+t.tz),centre=map(p.x,p.z),screenMap=(q:{x:number;y:number})=>({x:90+(q.x-centre.x)*scale,y:75+(q.y-centre.y)*scale}),screen=(x:number,z:number)=>screenMap(map(x,z));
   const ahead=map(p.x+Math.sin(p.headingY),p.z+Math.cos(p.headingY)),heading=Math.atan2(ahead.x-centre.x,-(ahead.y-centre.y));
   ctx.clearRect(0,0,180,150);ctx.strokeStyle='#cce4cd77';ctx.lineWidth=2;ctx.beginPath();
    for(const road of this.roads)for(let i=1;i<road.length;i++){const x=screenMap(road[i-1]),y=screenMap(road[i]);if((x.x<0&&y.x<0)||(x.x>180&&y.x>180)||(x.y<0&&y.y<0)||(x.y>150&&y.y>150))continue;ctx.moveTo(x.x,x.y);ctx.lineTo(y.x,y.y);}ctx.stroke();
   const field=screen(s.field.x,s.field.z);ctx.strokeStyle='#7ed8ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(field.x,field.y,s.field.radius*scale,0,Math.PI*2);ctx.stroke();
   for(const item of s.loot){if(!item.available)continue;const q=screen(item.p.x,item.p.z);if(q.x<6||q.x>174||q.y<20||q.y>133)continue;ctx.fillStyle=item.kind==='repair'?'#9effa8':item.kind.startsWith('scope')?'#d9beff':'#ffe395';
    if(item.kind==='repair'){ctx.fillRect(q.x-1,q.y-4,2,8);ctx.fillRect(q.x-4,q.y-1,8,2);}else if(item.kind.startsWith('scope')){ctx.beginPath();ctx.moveTo(q.x,q.y-4);ctx.lineTo(q.x+4,q.y);ctx.lineTo(q.x,q.y+4);ctx.lineTo(q.x-4,q.y);ctx.closePath();ctx.fill();}else ctx.fillRect(q.x-2,q.y-2,4,4);
   }
   for(const a of s.actors){if(!a.alive||a.id===me.id)continue;const q=screen(a.pose.x,a.pose.z);ctx.fillStyle='#ffb778';ctx.beginPath();ctx.arc(q.x,q.y,3,0,Math.PI*2);ctx.fill();}
   for(const ping of s.self?.radar??[]){const q=screen(ping.x,ping.z);ctx.strokeStyle='#ffc96d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,6,0,Math.PI*2);ctx.stroke();}this.root.dataset.radar=String(s.self?.radar.length??0);
   ctx.save();ctx.translate(90,75);ctx.rotate(heading);ctx.fillStyle='#96ffe7';ctx.strokeStyle='#061e22';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
   ctx.fillStyle='#edf8f5';ctx.font='bold 10px system-ui';ctx.fillText('N ↑',8,14);ctx.fillRect(8,142,50*scale,2);ctx.fillText('50 m',8,137);
   const edge=s.field.radius-Math.hypot(p.x-s.field.x,p.z-s.field.z),distance=(a:{p:{x:number;z:number}})=>Math.hypot(p.x-a.p.x,p.z-a.p.z);
   const loot=s.loot.filter(a=>a.available).sort((a,b)=>distance(a)-distance(b));
   const health=loot.find(a=>a.kind==='repair'),scope=loot.find(a=>a.kind.startsWith('scope'));
   const status=[`${s.remaining} riders alive · Round ${s.series.number||1}/${s.series.total}`,edge>=0?`Inside safe zone · boundary ${mapDistance(edge)}`:`Outside safe zone · ${mapDistance(-edge)} to safety`,`Next field radius ${mapDistance(s.field.nextRadius)} · ${Math.ceil(s.field.remaining)}s`,...(health?[`Health pack · ${mapDistance(distance(health))}`]:[]),...(scope?[`${scope.kind.replace('scope','')}× scope · ${mapDistance(distance(scope))}`]:[]),`Dog radar · ${s.self?.radar.length??0} pings`];
   this.information.update(centre,heading,DETROIT_MAP_PLACES,status,'Mint arrow: you / watched rider. Orange: visible opponents. Gold ring: dog scan. Green +: health. Violet diamond: scope. Gold square: weapon / supply. Blue line: safe-zone boundary.');
   this.canvas.setAttribute('aria-label',`North-up Detroit map. ${status.join('. ')}`);
 }
}
