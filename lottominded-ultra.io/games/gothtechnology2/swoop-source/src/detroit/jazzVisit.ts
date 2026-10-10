import * as T from 'three';import {FootTraffic,solveFootContact} from './footTraffic.ts';import type {Hero,loadActors} from './actors.ts';
import {jazzMap,jazzCoordinates,type JazzSite} from './jazzSites.ts';import {toLocal,toMap} from './geo-profile.ts';
/** Load the user's actual Unity performance only after choosing a seat. */
export class JazzVisit{
 readonly panel=document.createElement('section');private title=document.createElement('strong');private sit=document.createElement('button');private leave=document.createElement('button');private status=document.createElement('p');
 private iframe?:HTMLIFrameElement;private walker?:FootTraffic;private hiddenHero?:Hero;private selected?:JazzSite;private entered?:string;private oldPaused=false;active=false;
 constructor(private scene:T.Scene,private clubs:readonly {site:JazzSite;root:T.Object3D}[],private data:Awaited<ReturnType<typeof loadActors>>,private hero:()=>Hero,private suspend:()=>boolean,private resume:(paused:boolean)=>void,private coordinates={toMap,toLocal}){
  this.panel.className='jazz-visit';this.panel.hidden=true;this.panel.setAttribute('aria-label','Jazz club performance');this.sit.textContent='Sit down & watch the performance';this.leave.textContent='Return to your wheel';this.leave.hidden=true;this.status.setAttribute('role','status');this.panel.append(this.title,this.status,this.sit,this.leave);document.body.append(this.panel);
  const css=document.createElement('style');css.textContent='.jazz-visit{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(70px,env(safe-area-inset-bottom));z-index:74;max-width:min(320px,85vw);padding:14px;background:#16262bef;color:#f8ebc9;border:1px solid #ceac67;border-radius:10px;font:13px system-ui}.jazz-visit button{min-height:44px;padding:10px}.jazz-visit p{line-height:1.45}.jazz-stage-frame{position:fixed;z-index:60;border:3px solid #32211c;border-radius:3px;background:#121615;box-shadow:0 0 20px #b9985a44}.jazz-visit[hidden]{display:none!important}';document.head.append(css);
  this.sit.onclick=()=>this.start();this.leave.onclick=()=>this.stop();document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.active)this.stop();});addEventListener('pagehide',()=>this.stop(),{once:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.active){e.preventDefault();e.stopPropagation();this.stop();}},true);
 }
 private start(){
  if(!this.selected||this.active)return;const s=this.selected;this.entered=s.id;this.oldPaused=this.suspend();this.active=true;this.hiddenHero=this.hero();this.hiddenHero.root.visible=false;
  this.walker=new FootTraffic(this.data.get(this.hiddenHero.riderId)!,false);const seat=jazzMap(s,2.3,2.8),at=this.coordinates.toLocal(seat.x,s.floor+.04,seat.z);this.walker.root.position.set(at.x,at.y,at.z);this.walker.root.rotation.y=Math.PI-s.heading;this.scene.add(this.walker.root);this.walker.apply(0,0);
  const hip=this.walker.hips.getWorldPosition(new T.Vector3());hip.y=at.y+.59;this.walker.hips.position.copy(this.walker.hips.parent!.worldToLocal(hip));this.walker.root.updateMatrixWorld(true);
  for(const [i,l]of this.walker.legs.entries()){const target=this.walker.root.localToWorld(new T.Vector3(i===0?.12:-.12,.09,.45)),pole=new T.Vector3(0,0,1).transformDirection(this.walker.root.matrixWorld);solveFootContact(l,target,pole,this.walker.root.getWorldQuaternion(new T.Quaternion()).multiply(l.rotation));}
  for(const [i,l]of this.walker.arms.entries())solveFootContact(l,this.walker.root.localToWorld(new T.Vector3(i===0?.15:-.15,.64,.34)),new T.Vector3(i===0?1:-1,-.4,.2).transformDirection(this.walker.root.matrixWorld));
  this.iframe=document.createElement('iframe');this.iframe.title='Jazz club stage · Bloom Through Gloom Unity performance';this.iframe.className='jazz-stage-frame';this.iframe.allow='autoplay; fullscreen';this.iframe.src=new URL('./exports/jazz-stage/index.html',location.href).href;document.body.append(this.iframe);this.sit.hidden=true;this.leave.hidden=false;this.status.textContent='Seated at the stage. Choose WATCH THE PERFORMANCE on the stage screen. Escape or Return leaves your seat.';
 }
 stop(){if(!this.active)return;this.active=false;this.iframe?.remove();this.iframe=undefined;this.walker?.root.removeFromParent();this.walker?.rider.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});this.walker=undefined;if(this.hiddenHero)this.hiddenHero.root.visible=true;this.hiddenHero=undefined;this.leave.hidden=true;this.sit.hidden=false;this.resume(this.oldPaused);}
 update(x:number,z:number,visible:boolean,camera:T.PerspectiveCamera){
  const p=this.coordinates.toMap(x,0,z),club=this.clubs.find(c=>{const q=jazzCoordinates(c.site,p.x,p.z);return Math.abs(q.u)<c.site.width/2-1&&q.v<c.site.depth/2+5&&q.v> -c.site.depth/2;});
  if(!club)this.entered=undefined;
  if(this.active&&!visible){this.stop();this.panel.hidden=true;return;}
  if(!this.active){this.selected=club?.site;this.panel.hidden=!visible||!club;this.title.textContent=club?.site.name??'';this.status.textContent='An open entrance, seats, and a stage. Enter to sit and watch.';if(club&&visible&&this.entered!==club.site.id&&jazzCoordinates(club.site,p.x,p.z).v<club.site.depth/2-.4)this.start();else return;}
  if(!this.selected||!this.walker||!this.iframe)return;
  this.hiddenHero!.root.visible=false;this.panel.hidden=false;const s=this.selected,seat=this.walker.root.position,target=jazzMap(s,0,-s.depth/2+.30),stage=this.coordinates.toLocal(target.x,s.floor+2.35,target.z),back=jazzMap(s,2.3,4.2),eye=this.coordinates.toLocal(back.x,s.floor+1.65,back.z);camera.position.set(eye.x,eye.y,eye.z);camera.lookAt(stage.x,stage.y,stage.z);camera.fov=55;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  // Camera faces a fixed physical stage plane; the embedded player stays on it.
  const corners=[[-2,-1.125],[2,1.125]].map(([u,v])=>{const pt=jazzMap(s,u,-s.depth/2+.32),q=this.coordinates.toLocal(pt.x,s.floor+2.35+v,pt.z);return new T.Vector3(q.x,q.y,q.z).project(camera);});
  const left=(Math.min(...corners.map(q=>q.x))+1)*innerWidth/2,top=(1-Math.max(...corners.map(q=>q.y)))*innerHeight/2,width=Math.abs(corners[1].x-corners[0].x)*innerWidth/2,height=Math.abs(corners[1].y-corners[0].y)*innerHeight/2;Object.assign(this.iframe.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});this.panel.dataset.seated='true';this.panel.dataset.club=s.id;void seat;
 }
}
