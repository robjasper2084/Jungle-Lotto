import type {TagFixture,TagTerrain} from './fixture.ts';
import type {TagSnapshot} from './rules.ts';
/** Map markers never reveal a hidden opponent through cover. */
export class TagMapView{
 readonly button=document.createElement('button');readonly dialog=document.createElement('dialog');
 private mini=document.createElement('canvas');private full=document.createElement('canvas');private base=document.createElement('canvas');private clock=0;
 private fixture?:TagFixture;private terrain?:TagTerrain;
 constructor(){this.button.className='lt-ui lt-map lt-hidden';this.button.setAttribute('aria-label','Open LOVE TAG map');this.mini.width=192;this.mini.height=144;this.button.append(this.mini);
  this.dialog.className='lt-ui lt-dialog lt-map-dialog';this.dialog.innerHTML='<h2>LOVE TAG map</h2><p>Explore safe ground across this map. Water is closed. Pink markers show opponents you can see; cover hides them.</p>';this.full.width=this.full.height=512;this.full.style.width='100%';this.dialog.append(this.full);
  const close=document.createElement('button');close.textContent='Back to riding';close.onclick=()=>this.dialog.close();this.dialog.append(close);this.button.onclick=()=>this.dialog.showModal();document.body.append(this.button,this.dialog);}
 prepare(f:TagFixture,terrain:TagTerrain){this.fixture=f;this.terrain=terrain;this.base.width=this.base.height=768;const c=this.base.getContext('2d')!,g=f.grid,sx=768/((g.width-1)*g.spacing),sz=768/((g.height-1)*g.spacing);c.fillStyle='#0a2738';c.fillRect(0,0,768,768);
  if(f.walkable){const bytes=Uint8Array.from(atob(f.walkable),c=>c.charCodeAt(0));c.fillStyle='#304b45';const step=Math.max(1,Math.floor(Math.max(g.width,g.height)/768));for(let j=0;j<g.height;j+=step)for(let i=0;i<g.width;i+=step){const n=j*g.width+i;if(bytes[n>>3]&(1<<(n&7)))c.fillRect(i*g.spacing*sx,j*g.spacing*sz,step*g.spacing*sx+.5,step*g.spacing*sz+.5);}}
  c.strokeStyle='#adc4b4';c.lineWidth=1;c.beginPath();for(const l of f.lanes){c.moveTo((l.a.x-g.x)*sx,(l.a.z-g.z)*sz);c.lineTo((l.b.x-g.x)*sx,(l.b.z-g.z)*sz);}c.stroke();}
 update(dt:number,s:TagSnapshot,me:string){this.clock+=dt;if(this.clock<.15)return;this.clock=0;if(!this.fixture)return;const player=s.actors.find(a=>a.id===me)??s.actors[0];if(!player)return;
  const f=this.fixture,g=f.grid,w=(g.width-1)*g.spacing,h=(g.height-1)*g.spacing,p=player.pose;
  for(const [canvas,full]of [[this.mini,false],[this.full,true]] as const){const c=canvas.getContext('2d')!,span=full?Math.max(w,h):150,scale=canvas.width/span,x=full?g.x-(span-w)/2:p.x-span/2,z=full?g.z-(span-h)/2:p.z-span*canvas.height/canvas.width/2;
   c.fillStyle='#071b28';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(this.base,(g.x-x)*scale,(g.z-z)*scale,w*scale,h*scale);
   for(const a of s.actors){const q=a.pose,isMe=a.id===player.id,d=Math.hypot(q.x-p.x,q.z-p.z),delta={x:q.x-p.x,y:q.y-p.y,z:q.z-p.z};
    if(!isMe&&(d>45||this.terrain!.raycastObstacle({x:p.x,y:p.y+1.05,z:p.z},delta,Math.hypot(delta.x,delta.y,delta.z),0)!==null))continue;
    c.fillStyle=isMe?'#5bf3dc':'#ff77ac';c.beginPath();c.arc((q.x-x)*scale,(q.z-z)*scale,isMe?4:3,0,Math.PI*2);c.fill();
    if(isMe){const px=(q.x-x)*scale,pz=(q.z-z)*scale;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(px,pz);c.lineTo(px+Math.sin(p.headingY)*10,pz+Math.cos(p.headingY)*10);c.stroke();}}
   c.fillStyle='#fff';c.font='bold 12px system-ui';c.fillText('LOVE TAG',8,16);if(!full){c.font='10px system-ui';c.fillText('MAP · tap to expand',8,canvas.height-7);}}
 }
 show(on:boolean){this.button.classList.toggle('lt-hidden',!on);if(!on&&this.dialog.open)this.dialog.close();}
}
