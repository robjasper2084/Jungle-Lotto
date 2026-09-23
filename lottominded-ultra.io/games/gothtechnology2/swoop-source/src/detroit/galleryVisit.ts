import {useOuterApproach} from './entryPath.ts';
import {destinationLayout} from './destinationLayout.ts';
import {buildGalleryApproach} from './destinationApproach.ts';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {FootTraffic} from './footTraffic.ts';
import {Hero} from './actors.ts';
import {heightAt} from './world.ts';
import {toMap,toLocal} from './geo-profile.ts';
import {routePosition} from './districtView.ts';
import {CUT_METRES} from './geography.ts';
import {GALLERY_URL,galleryArrival} from './galleryArrival.ts';
import {createPose,type RidePose} from './controller.ts';
import type {RiderId} from './riderChoices.ts';
export class GalleryVisit {
 readonly building=new T.Group();readonly panel=document.createElement('section');readonly door=new T.Vector3();readonly approach=new T.Vector3();readonly anchor;readonly forward:T.Vector3;
 active=false;dismissed=false;private time=0;private walker?:FootTraffic;private parked?:Hero;private origin=new T.Vector3();private side=new T.Vector3();private waypoint=new T.Vector3();private parkedPose=createPose();private boneStart=new Map<string,T.Quaternion>();private copy:HTMLElement;private visit:HTMLButtonElement;private enter:HTMLAnchorElement;private catalog=document.createElement('details');
 constructor(private scene:T.Scene,private begin:()=>void,private leave:()=>void,readonly store=false){
  this.anchor=routePosition(CUT_METRES);this.forward=new T.Vector3(Math.sin(this.anchor.heading),0,Math.cos(this.anchor.heading));
  const layout=destinationLayout(store),centre=new T.Vector3(layout.local.x,layout.local.y,layout.local.z);this.building.scale.setScalar(layout.scale);const depth=layout.foundationDepth/layout.scale;const skirt=new T.Mesh(new T.BoxGeometry(18,depth,17),new T.MeshStandardMaterial({color:0x343934,roughness:.9}));skirt.position.set(0,-depth/2,-1.5);skirt.receiveShadow=true;this.building.add(skirt);
  const facing=new T.Vector3(Math.sin(layout.heading),0,Math.cos(layout.heading));this.door.copy(centre).addScaledVector(facing,store?3:8*layout.scale);this.approach.copy(centre).addScaledVector(facing,12*layout.scale);
  this.building.position.copy(centre);this.building.rotation.y=Math.atan2(facing.x,facing.z);scene.add(this.building);
  if(!store)buildGalleryApproach(scene);
  this.panel.id=store?'boutiqueArrival':'galleryArrival';this.panel.className='destinationPanel';this.panel.hidden=true;this.panel.setAttribute('aria-label',store?'GothTechnology store':'Serengeti Galleries');
  this.panel.innerHTML='<p class="eyebrow"></p><h2></h2><p data-copy role="status"></p><div><button data-visit></button><a data-enter target="_blank" rel="noopener noreferrer" hidden></a><button data-back>Keep riding</button></div>';
  this.panel.querySelector('.eyebrow')!.textContent=store?'MACK AVENUE / THE ARMORY':'MACK AVENUE / DESTINATION';this.panel.querySelector('h2')!.textContent=store?'GOTHTECHNOLOGY':'Serengeti Galleries';
  this.copy=this.panel.querySelector('[data-copy]')!;this.visit=this.panel.querySelector('[data-visit]')!;this.enter=this.panel.querySelector('[data-enter]')!;this.visit.textContent=store?'Park & enter store':'Dismount & walk to gallery';this.enter.textContent=store?'Full storefront ↗':'Enter gallery ↗';this.enter.href=store?'https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/':GALLERY_URL;
  this.copy.textContent='Park your wheel and explore.';this.visit.onclick=()=>this.begin();this.panel.querySelector<HTMLButtonElement>('[data-back]')!.onclick=()=>{this.reset();this.dismissed=true;this.leave();};this.catalog.className='boutiqueCatalog';const browse=document.createElement('summary');browse.textContent='Browse collection / availability on storefront';this.catalog.append(browse);this.catalog.hidden=true;this.panel.append(this.catalog);document.body.append(this.panel);
 }
 async load(){const data=await new GLTFLoader().loadAsync(this.store?'/exports/boutique/GothTechnology-Store.glb?v=retail-floor-20260923':'/exports/gallery/Serengeti-Galleries.glb?v=retail-floor-20260923');data.scene.traverse(o=>{if((o as T.Mesh).isMesh){(o as T.Mesh).castShadow=true;(o as T.Mesh).receiveShadow=true;}});this.building.add(data.scene);
  if(this.store){const response=await fetch('/exports/boutique/catalog.json');if(!response.ok)throw Error('Store catalog unavailable');const products=await response.json() as {title:string;image:string;url:string;price:number;pending:boolean;concept:boolean}[];
   const note=document.createElement('p');note.textContent='Official catalog concepts. Availability and checkout are managed by the storefront; concept items cannot be ordered.';this.catalog.append(note);
   for(const p of products){const a=document.createElement('a');a.href=p.url;a.target='_blank';a.rel='noopener noreferrer';const img=document.createElement('img');img.src='/exports/boutique/'+p.image;img.alt=p.title;img.loading='lazy';const label=document.createElement('strong');label.textContent=p.title;const status=document.createElement('span');status.textContent=(p.pending?'Price pending':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.price))+(p.concept?' · Concept preview':'');a.append(img,label,status);this.catalog.append(a);}
  }
 }
 offer(station:number,offset:number,p:RidePose,attemptActive:boolean,visible:boolean){if(this.active)return;const near=Math.hypot(p.x-this.approach.x,p.z-this.approach.z)<18;if(!near&&Math.abs(station-CUT_METRES)>30)this.dismissed=false;this.panel.hidden=this.dismissed||!visible||attemptActive||Math.abs(p.speed)>=.5||p.crashBlend>0||!(near||(!this.store&&galleryArrival(station,CUT_METRES,offset,p.speed,false,false)));}
 start(data:Map<string,GLTF>,rider:RiderId,hero:Hero,p:RidePose){this.active=true;document.body.classList.add('visitingGallery');this.time=0;this.parked=hero;Object.assign(this.parkedPose,p);this.origin.set(p.x,p.y,p.z);this.side.copy(this.origin).add(new T.Vector3(Math.cos(p.headingY),0,-Math.sin(p.headingY)).multiplyScalar(.75));// Skip the outside staging point when already closer to the door. Never walk
 // back out of the entrance merely to reach a fixed approach marker.
 const outward=this.approach.clone().sub(this.door).normalize();
 this.waypoint.copy(useOuterApproach(this.side,this.approach,outward)?this.approach:this.door);
 this.walker=new FootTraffic(data.get(rider)!,false);this.walker.root.rotation.y=p.headingY;this.scene.add(this.walker.root);hero.rider.visible=false;this.boneStart.clear();for(const b of hero.bones)this.boneStart.set(b.o.name,b.o.quaternion.clone());this.visit.hidden=true;this.enter.hidden=true;this.panel.hidden=false;this.copy.textContent='Parking the wheel · walking to the entrance';}
 update(dt:number,camera:T.PerspectiveCamera){if(!this.walker||!this.parked)return this.parkedPose;this.time+=Math.max(0,dt);const w=this.walker,p=this.parkedPose;this.parked.apply(p);this.parked.rider.visible=false;const t=Math.min(1,this.time/1.25),ease=t*t*(3-2*t),first=this.side.distanceTo(this.waypoint),last=this.waypoint.distanceTo(this.door),distance=first+last,walk=Math.min(1,Math.max(0,this.time-1.9)*1.4/Math.max(.01,distance)),travel=walk*distance;
  const dest=travel<first?this.side.clone().lerp(this.waypoint,travel/Math.max(.01,first)):this.waypoint.clone().lerp(this.door,(travel-first)/Math.max(.01,last));w.root.position.copy(t<1?this.origin.clone().lerp(this.side,ease):dest);const ground=toMap(w.root.position.x,0,w.root.position.z);w.root.position.y=travel>=first?this.door.y+.07:toLocal(ground.x,heightAt(ground.x,ground.z),ground.z).y;
  const localFoot=this.building.worldToLocal(w.root.position.clone());if(Math.abs(localFoot.x)<9&&localFoot.z>=-7.5&&localFoot.z<=10.4)w.root.position.y=Math.max(w.root.position.y,this.building.position.y+.06*this.building.scale.y);
  const direction=travel<first?this.waypoint.clone().sub(this.side):this.door.clone().sub(this.waypoint),heading=direction.lengthSq()>.001?Math.atan2(direction.x,direction.z):w.root.rotation.y;w.root.rotation.y+=(T.MathUtils.euclideanModulo(heading-w.root.rotation.y+Math.PI,Math.PI*2)-Math.PI)*(1-Math.exp(-dt*6));w.apply(this.time>=1.9&&walk<1?1.4:0,dt);if(t<1){w.root.rotation.y=p.headingY;w.root.position.y+=this.parked.mountHeight*(1-ease);for(const b of w.bones){const q=this.boneStart.get(b.o.name);if(q)b.o.quaternion.slerpQuaternions(q,b.o.quaternion.clone(),ease);}}
  if(walk>=1){this.enter.hidden=false;this.catalog.hidden=!this.store;this.copy.textContent=this.store?'Welcome to the Armory. Open Browse collection to inspect the catalog, or enjoy the interior.':'Welcome. Enter the online gallery, or return to your wheel.';}
  const position=w.root.position,eye=position.clone().add(new T.Vector3(-Math.sin(heading)*(this.store?2.5:4),1.9,-Math.cos(heading)*(this.store?2.5:4)));camera.position.lerp(eye,1-Math.exp(-dt*5));camera.lookAt(position.x,position.y+1.2,position.z);camera.fov=55;camera.updateProjectionMatrix();this.panel.dataset.phase=walk>=1?'entrance':t<1?'dismount':'walking';return {...p,x:position.x,y:position.y,z:position.z,headingY:heading,speed:walk<1&&this.time>=1.9?1.4:0};
 }
 reset(){document.body.classList.remove('visitingGallery');if(this.walker){this.walker.root.removeFromParent();this.walker.rider.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});}if(this.parked)this.parked.rider.visible=true;this.walker=undefined;this.parked=undefined;this.active=false;this.dismissed=false;this.panel.hidden=true;this.visit.hidden=false;this.enter.hidden=true;this.catalog.hidden=true;this.catalog.open=false;this.copy.textContent='Park your wheel and explore.';}
}

