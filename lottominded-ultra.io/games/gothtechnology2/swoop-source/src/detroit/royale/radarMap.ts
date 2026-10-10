import {MiniMapControls} from '../../../../ride-core/src/miniMapControls.ts';import type {RoyaleSnapshot} from '../../../../ride-core/src/royale/rules.ts';import type {DowntownArena} from '../../../../ride-core/src/royale/downtownArena.ts';
import {CITY} from '../geography.ts';
/** Streets and public nearby actors; temporary dog scans contain coarse host pings. */
export class RoyaleRadarMap {
 readonly root=document.createElement('aside');private canvas=document.createElement('canvas');private controls:MiniMapControls;private at=0;
 constructor(private terrain:DowntownArena){this.root.className='tactical-minimap royale-map';this.root.setAttribute('aria-label','Royale map and dog radar');this.canvas.width=180;this.canvas.height=150;this.canvas.setAttribute('aria-label','Nearby original Detroit streets');const footer=document.createElement('div');footer.className='map-actions';this.root.append(this.canvas,footer);document.body.append(this.root);this.controls=new MiniMapControls(this.root,'royale',footer);
  const style=document.createElement('style');style.textContent='.royale-map{position:fixed;right:12px;top:68px;width:180px;z-index:6;background:#09282b80;border:1px solid #9fcabb80;border-radius:8px;overflow:hidden}.royale-map canvas{height:150px;width:180px;pointer-events:none}.royale-map .map-actions{padding:4px;font-size:10px}.royale-map .map-actions input{width:80px!important}.royale-map .mini-map-hide{background:#173b3270;padding:3px}@media(max-width:620px){.royale-map{width:120px;top:68px}.royale-map canvas{width:120px;height:100px}.royale-map .map-actions{display:none}}';document.head.append(style);
 }
 update(s:RoyaleSnapshot,now:number,visible:boolean){this.root.hidden=!visible;const me=s.actors.find(a=>a.id===s.self?.id);if(!me||this.controls.hidden||now-this.at<200)return;this.at=now;
  const ctx=this.canvas.getContext('2d')!,p=me.pose,scale=180/250,screen=(x:number,z:number)=>({x:90+(x-p.x)*scale,y:75+(z-p.z)*scale});ctx.clearRect(0,0,180,150);ctx.strokeStyle='#cce4cd77';ctx.lineWidth=2;ctx.beginPath();const t=this.terrain.terrain.fixture.transform;
  for(const road of CITY.roads)for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],x=screen((a[0]-t.tx)/t.sx,a[1]-t.tz),y=screen((b[0]-t.tx)/t.sx,b[1]-t.tz);if((x.x<0&&y.x<0)||(x.x>180&&y.x>180)||(x.y<0&&y.y<0)||(x.y>150&&y.y>150))continue;ctx.moveTo(x.x,x.y);ctx.lineTo(y.x,y.y);}ctx.stroke();
  for(const a of s.actors){if(!a.alive)continue;const q=screen(a.pose.x,a.pose.z);ctx.fillStyle=a.id===s.self?.id?'#96ffe7':'#ffb778';ctx.beginPath();ctx.arc(q.x,q.y,a.id===s.self?.id?4:3,0,Math.PI*2);ctx.fill();}
  for(const ping of s.self?.radar??[]){const q=screen(ping.x,ping.z);ctx.strokeStyle='#ffc96d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,6,0,Math.PI*2);ctx.stroke();}this.root.dataset.radar=String(s.self?.radar.length??0);
 }
}
