import * as T from 'three';
import type {VendorId} from './foodTruckSites.ts';
import {VENDORS} from './foodTruckSites.ts';
/** All vendors share one decoder and one GPU video texture. A Play gesture is
 * required; distance, visibility and reduced motion suspend the movie. */
export class FoodVendorMedia {
 readonly video=document.createElement('video');readonly panel=document.createElement('details');
 private title=document.createElement('summary');private menu=document.createElement('p');private play=document.createElement('button');private sound=document.createElement('button');private status=document.createElement('p');
 private requested=false;private nearby=false;private blocked=false;private starting=false;private texture:T.VideoTexture;private material:T.MeshBasicMaterial;private poster:T.Texture;private lastVendor='';
 constructor(){
  this.video.playsInline=true;this.video.loop=true;this.video.muted=true;this.video.preload='none';this.video.hidden=true;this.video.setAttribute('aria-label','Paradise Sea Moss vendor commercial');this.video.setAttribute('playsinline','');this.video.src='/exports/street-life/paradise-commercial.mp4';document.body.append(this.video);
  this.poster=new T.TextureLoader().load('/exports/street-life/paradise-poster.jpg');this.poster.colorSpace=T.SRGBColorSpace;
  this.texture=new T.VideoTexture(this.video);this.texture.colorSpace=T.SRGBColorSpace;this.texture.generateMipmaps=false;this.material=new T.MeshBasicMaterial({map:this.poster,toneMapped:false});
  this.panel.className='food-vendor-media';this.panel.hidden=true;this.panel.setAttribute('aria-label','Nearby food stall menu and screen');this.title.textContent='Food stall · menu + LCD';this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');this.status.textContent='Paradise Sea Moss commercial · press Play';this.play.type=this.sound.type='button';this.play.textContent='Play commercial';this.sound.textContent='Sound off';this.sound.setAttribute('aria-pressed','false');
  this.panel.append(this.title,this.menu,this.play,this.sound,this.status);document.body.append(this.panel);
  const style=document.createElement('style');style.textContent='.food-vendor-media{position:fixed;left:max(12px,env(safe-area-inset-left));top:calc(var(--royale-hud-bottom,70px) + 105px);z-index:68;width:min(230px,45vw);padding:8px 10px;background:#102923eb;color:#f5e9ca;border:1px solid #bc9c56;border-radius:10px;font:12px system-ui}.food-vendor-media summary{min-height:35px;display:flex;align-items:center;cursor:pointer;font-weight:700}.food-vendor-media p{line-height:1.4;margin:8px 0}.food-vendor-media button{font-size:12px;padding:7px;margin:3px 3px 3px 0;min-height:44px}.food-vendor-media[hidden]{display:none!important}';document.head.append(style);
  this.play.onclick=()=>{this.requested=!this.requested;if(this.requested&&this.nearby)void this.start();else this.video.pause();this.refresh();};
  this.sound.onclick=()=>{this.video.muted=!this.video.muted;this.refresh();};
  this.video.onplaying=()=>{this.material.map=this.texture;this.material.needsUpdate=true;this.refresh();};this.video.onpause=()=>this.refresh();this.video.onerror=()=>{this.requested=false;this.status.textContent='Commercial unavailable · retry Play';this.material.map=this.poster;this.material.needsUpdate=true;this.refresh();};
  addEventListener('visibilitychange',()=>{if(document.hidden)this.video.pause();});addEventListener('pagehide',()=>this.dispose(),{once:true});
 }
 private async start(){if(this.starting)return;this.starting=true;try{await this.video.play();this.blocked=false;}catch{this.blocked=true;this.requested=false;this.status.textContent='Tap Play to start the screen.';this.refresh();}finally{this.starting=false;}}
 private refresh(){this.play.textContent=this.requested?'Pause commercial':'Play commercial';this.sound.textContent=this.video.muted?'Sound off':'Sound on';this.sound.setAttribute('aria-pressed',String(!this.video.muted));this.video.dataset.vendorPlayback=JSON.stringify({playing:!this.video.paused,muted:this.video.muted,nearby:this.nearby});}
 add(root:T.Object3D){let found=false;root.traverse(o=>{if(o instanceof T.Mesh&&o.name.startsWith('LCD_Pixels')){o.material=this.material;found=true;}});if(found)return;
  const bezel=new T.Mesh(new T.BoxGeometry(.06,.72,1.2),new T.MeshStandardMaterial({color:'#141b1d',metalness:.6,roughness:.35}));bezel.position.set(1.445,3.17,-.15);root.add(bezel);
  const pixels=new T.Mesh(new T.PlaneGeometry(1.12,.63),this.material);pixels.name='LCD_Pixels';pixels.rotation.y=Math.PI/2;pixels.position.set(1.478,3.17,-.15);root.add(pixels);
 }
 update(distance:number,vendor:VendorId,reduced:boolean){this.nearby=distance<18;this.panel.hidden=!this.nearby;const v=VENDORS[vendor];if(this.lastVendor!==vendor){this.title.textContent=v.name+' · menu + LCD';this.menu.textContent=v.menu;this.lastVendor=vendor;}
  if(!this.nearby||document.hidden||reduced){if(!this.video.paused)this.video.pause();}
  else if(this.requested&&this.video.paused&&!this.blocked)void this.start();
 }
 dispose(){this.video.pause();this.video.removeAttribute('src');this.video.load();this.video.remove();this.texture.dispose();this.poster.dispose();this.material.dispose();this.panel.remove();}
}
