import {MACK_STUDIO,studioMap,studioRoom,studioWalk} from './mackStudioSite.ts';
import {destinationLayout} from './destinationLayout.ts';
import * as T from 'three';
import {GLTFLoader,type GLTF} from './compressedGLTFLoader.ts';
import {FootTraffic} from './footTraffic.ts';
import {RetailVisitors} from './retailVisitors.ts';
import {Hero} from './actors.ts';
import {HelmetSkinDecal} from './helmetSkin.ts';
import {ArmorKeychain} from './armorKeychain.ts';

import {toLocal} from './geo-profile.ts';
import {routePosition} from './districtView.ts';
import {CUT_METRES} from './geography.ts';
import {GALLERY_URL} from './galleryArrival.ts';
import {createPose,type RidePose} from './controller.ts';
import type {RiderId} from './riderChoices.ts';
import {addPhotographyExhibition} from './photographyExhibition.ts';
export class GalleryVisit {
 readonly building=new T.Group();readonly panel=document.createElement('section');readonly door=new T.Vector3();readonly approach=new T.Vector3();readonly anchor;readonly forward:T.Vector3;
 loaded=false;active=false;dismissed=false;private walker?:FootTraffic;private parked?:Hero;private parkedPose=createPose();private insideHeading=0;private walkerSkin?:HelmetSkinDecal;private walkerCharm?:ArmorKeychain;private copy:HTMLElement;private visit:HTMLButtonElement;private enter:HTMLAnchorElement;private catalog=document.createElement('details');
 private visitors?:RetailVisitors;private visitorReport=0;
 constructor(private scene:T.Scene,private begin:()=>void,private leave:()=>void,readonly store=false){
  this.anchor=routePosition(CUT_METRES);this.forward=new T.Vector3(Math.sin(this.anchor.heading),0,Math.cos(this.anchor.heading));
  const layout=destinationLayout(store),centre=new T.Vector3(layout.local.x,layout.local.y,layout.local.z);this.building.scale.setScalar(layout.scale);const depth=layout.foundationDepth/layout.scale;const skirt=new T.Mesh(new T.BoxGeometry(18,depth,17),new T.MeshStandardMaterial({color:0x343934,roughness:.9}));skirt.position.set(0,-depth/2,-1.5);skirt.receiveShadow=true;this.building.add(skirt);
  const facing=new T.Vector3(Math.sin(layout.heading),0,Math.cos(layout.heading));
  const room=studioRoom(store),outside=studioMap(room.u,29),end=studioWalk(store).at(-1)!;
  const inside=toLocal(end.x,MACK_STUDIO.floor,end.z);this.door.set(inside.x,inside.y,inside.z);
  const arrival=toLocal(outside.x,MACK_STUDIO.floor,outside.z);this.approach.set(arrival.x,arrival.y,arrival.z);
  this.building.position.copy(centre);this.building.rotation.y=Math.atan2(facing.x,facing.z);scene.add(this.building);
  this.panel.id=store?'boutiqueArrival':'galleryArrival';this.panel.className='destinationPanel arrival-hud';this.panel.hidden=true;this.panel.setAttribute('aria-label',store?'GothTechnology store':'Serengeti Galleries');
  this.panel.innerHTML='<div class="arrival-topline"><p class="eyebrow"></p><span class="arrival-status">Destination reached</span></div><div class="arrival-content"><svg class="arrival-portal" viewBox="0 0 84 92" fill="none" aria-hidden="true"><path d="M4 85h76M12 85V8l62 17v60M23 85V22l42 12v51M33 85V37l24 6v42M42 85V49l10 2v34" stroke="currentColor" stroke-width="1"/><path d="M42 85V49l10 2v34" fill="#e9ca83" fill-opacity=".55" stroke="#e9ca83"/></svg><div class="arrival-copy"><h2></h2><p data-copy role="status"></p></div></div><div class="arrival-actions"><button data-visit></button><a data-enter target="_blank" rel="noopener noreferrer" hidden></a><button data-back>Keep riding</button></div>';
  this.panel.querySelector('.eyebrow')!.textContent='2000 MACK AVENUE / GOTHTECH STUDIO';this.panel.querySelector('h2')!.textContent=store?'GOTHTECHNOLOGY':'Serengeti Galleries';
  this.copy=this.panel.querySelector('[data-copy]')!;this.visit=this.panel.querySelector('[data-visit]')!;this.enter=this.panel.querySelector('[data-enter]')!;this.visit.textContent=store?'Park & enter store':'Park & enter gallery';this.enter.textContent=store?'Shop GothTech merch ↗':'Shop / visit Serengeti ↗';this.enter.href=store?'https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/shop/':GALLERY_URL;
  this.copy.textContent='Park your wheel and explore the studio. Shop online on each brand’s website.';this.visit.onclick=()=>this.begin();this.panel.querySelector<HTMLButtonElement>('[data-back]')!.onclick=()=>{this.reset();this.dismissed=true;this.leave();};this.catalog.className='boutiqueCatalog';const browse=document.createElement('summary');browse.textContent='Browse collection / availability on storefront';this.catalog.append(browse);this.catalog.hidden=true;this.panel.append(this.catalog);document.body.append(this.panel);
 }
 async load(){const data=await new GLTFLoader().loadAsync(this.store?'/exports/boutique/GothTechnology-Store.glb?v=retail-polish-20261003':'/exports/gallery/Serengeti-Galleries.glb?v=production-studio-20261003');data.scene.traverse(o=>{if((o as T.Mesh).isMesh){(o as T.Mesh).castShadow=true;(o as T.Mesh).receiveShadow=true;}});this.building.add(data.scene);
  // Keep the user's art, merchandise and retail furnishings inside the warehouse.
  // Remove standalone roofs, forecourts and Gothic tower extensions.
  data.scene.traverse(o=>{if(/^(Roof|Crown|Gothic Gothic|Forecourt|Entry canopy|Canopy|Bronze facade fin|Icosphere|Facade vertical joint)/.test(o.name.replace(/_/g,' ')))o.visible=false;});
  if(!this.store)await addPhotographyExhibition(this.building,'serengeti');
  this.visitors=new RetailVisitors(this.store);this.building.add(this.visitors.root);await this.visitors.load();this.panel.dataset.visitorCount=String(this.visitors.count);
  if(this.store){for(const x of [-5,0,5]){const light=new T.PointLight(0xffe6c9,38,11,2);light.position.set(x,3.8,-1.5);this.building.add(light);}const response=await fetch('/exports/boutique/catalog.json');if(!response.ok)throw Error('Store catalog unavailable');const products=await response.json() as {title:string;image:string;url:string;price:number;pending:boolean;concept:boolean}[];
   const note=document.createElement('p');note.textContent='Official catalog concepts. Availability and checkout are managed by the storefront; concept items cannot be ordered.';this.catalog.append(note);
   for(const p of products){const a=document.createElement('a');a.href=p.url;a.target='_blank';a.rel='noopener noreferrer';const img=document.createElement('img');img.src='/exports/boutique/'+p.image;img.alt=p.title;img.loading='lazy';const label=document.createElement('strong');label.textContent=p.title;const status=document.createElement('span');status.textContent=(p.pending?'Price pending':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.price))+(p.concept?' · Concept preview':'');a.append(img,label,status);this.catalog.append(a);}
  }
 this.loaded=true; }
 animateVisitors(dt:number){if(!this.visitors||!this.building.visible||dt<=0)return;this.visitors.update(dt);this.visitorReport+=dt;if(this.visitorReport>.5){this.visitorReport=0;this.panel.dataset.visitors=JSON.stringify(this.visitors.summary);}}
 offer(station:number,_offset:number,p:RidePose,attemptActive:boolean,visible:boolean){if(!this.loaded||this.active)return;const near=Math.hypot(p.x-this.approach.x,p.z-this.approach.z)<16;if(!near&&Math.abs(station-CUT_METRES)>30)this.dismissed=false;this.panel.hidden=this.dismissed||!visible||attemptActive||Math.abs(p.speed)>=.5||p.crashBlend>0||!near;}

 /** The entrance movie covers dismounting and the walk; arrive inside immediately. */
 start(data:Map<string,GLTF>,rider:RiderId,hero:Hero,p:RidePose){
  this.active=true;document.body.classList.add('visitingGallery');this.parked=hero;Object.assign(this.parkedPose,p,{speed:0});
  const route=studioWalk(this.store),a=route.at(-2)!,b=route.at(-1)!,from=toLocal(a.x,MACK_STUDIO.floor,a.z),to=toLocal(b.x,MACK_STUDIO.floor,b.z);
  this.insideHeading=Math.atan2(to.x-from.x,to.z-from.z);
  this.walker=new FootTraffic(data.get(rider)!,false);this.walker.playInteraction('door');if(rider==='DS_Armored_Rider_01'){this.walkerSkin=new HelmetSkinDecal(this.walker.rider);this.walkerCharm=new ArmorKeychain(this.walker.rider);}this.walker.root.position.copy(this.door);this.walker.root.position.y+=.06;this.walker.root.rotation.y=this.insideHeading;this.scene.add(this.walker.root);hero.rider.visible=false;
  this.panel.dataset.walkAnimation='Entrance film / direct interior arrival';this.panel.dataset.phase='entrance';this.panel.querySelector('.arrival-status')!.textContent='Inside the studio';
  this.visit.hidden=true;this.enter.hidden=false;this.catalog.hidden=!this.store;this.panel.hidden=false;
  this.copy.textContent=this.store?'Welcome to GothTech inside the studio. Browse the collection or shop merch on the GothTech website.':'Welcome to Serengeti inside the studio. Visit its website to browse and shop, or return to your wheel.';
 }
 update(dt:number,camera:T.PerspectiveCamera){
  if(!this.walker||!this.parked)return this.parkedPose;
  this.parked.apply(this.parkedPose);this.parked.rider.visible=false;this.walker.apply(0,dt);
  const position=this.walker.root.position,heading=this.insideHeading,eye=position.clone().add(new T.Vector3(-Math.sin(heading)*(this.store?2.5:4),1.9,-Math.cos(heading)*(this.store?2.5:4)));
  camera.position.copy(eye);camera.lookAt(position.x,position.y+1.2,position.z);camera.fov=55;camera.updateProjectionMatrix();
  return {...this.parkedPose,x:position.x,y:position.y,z:position.z,headingY:heading,speed:0};
 }
 reset(){this.walkerSkin?.dispose();this.walkerCharm?.dispose();this.walkerSkin=this.walkerCharm=undefined;document.body.classList.remove('visitingGallery');if(this.walker){this.walker.root.removeFromParent();this.walker.rider.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});}if(this.parked)this.parked.rider.visible=true;this.walker=undefined;this.parked=undefined;this.active=false;this.dismissed=false;this.panel.hidden=true;this.visit.hidden=false;this.enter.hidden=true;this.catalog.hidden=true;this.catalog.open=false;this.copy.textContent='Park your wheel and explore the studio. Shop online on each brand’s website.';}
}
