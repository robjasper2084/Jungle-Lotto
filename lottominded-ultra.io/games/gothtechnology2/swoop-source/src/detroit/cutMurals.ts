import * as T from 'three';
import {GEO,profileLevel,BRIDGE_SLAB_DEPTH,nearestRamp} from './geo-profile.ts';
import {bridgeFrame} from './bridges.ts';
import {cutPoint,cutCoords,heightAt,type DetroitWorld} from './world.ts';

/** Photo sources and section locations: Conservancy 2025 Art Walk map.
 * Bridge dimensions and surface fitting remain game approximations. */
export const CUT_MURALS=[
 {artist:'Ivan Montoya',year:2022,bridge:'Adelaide Street',side:-1,file:'ivanmontoyamural.jpg',crop:[.02,.05,.98,.98],ceiling:true},
 {artist:'Sydney James',year:2018,bridge:'Wilkins Street',side:-1,file:'sydneyjames2.jpg',crop:[0,.03,1,.97],ceiling:true},
 {artist:'Freddy Diaz',year:2019,bridge:'Division Street',side:-1,file:'freddymural.jpg',crop:[0,.20,1,.72],ceiling:false},
 {artist:'Fel3000ft',year:2012,bridge:'Antietam Avenue',side:-1,file:'fel3000mural.jpg',crop:[0,.33,1,.74],ceiling:false},
 {artist:'Mitchell Schorr',year:2014,bridge:'East Larned Street',side:1,file:'carsmuraldequindrecut.jpg',crop:[.02,.23,.98,.93],ceiling:false},
 {artist:'Mike Han / We Are Detroit',year:2013,bridge:'Antietam Avenue',side:1,file:'we-are-detroit-user.jpg',crop:[.045,.25,.98,.47],ceiling:false},
 {artist:'Blue dragon � supplied reference (placement provisional)',year:2013,bridge:'Chestnut Street',side:-1,file:'blue-dragon-user.jpg',crop:[0,.21,1,.91],ceiling:false},
] as const;

export async function buildCutMurals(world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group){
 const urls=[
  new URL('../../art/cut-murals/ivanmontoyamural.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/sydneyjames2.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/freddymural.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/fel3000mural.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/carsmuraldequindrecut.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/we-are-detroit-user.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/blue-dragon-user.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/hdl-user.jpg',import.meta.url).href,
 ];
 const maps=await Promise.all(urls.map(u=>new T.TextureLoader().loadAsync(u)));
 const materials=maps.map(map=>{map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return new T.MeshStandardMaterial({map,roughness:1,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});});
 const panel=(points:T.Vector3[],crop:readonly number[],material:T.Material,name:string)=>{
  const [u0,v0,u1,v1]=crop,g=new T.BufferGeometry();g.setFromPoints(points);g.setIndex([0,1,2,0,2,3]);
  // Same handedness correction as the route art; preserve signatures and readable lettering.
  g.setAttribute('uv',new T.Float32BufferAttribute([u1,v0,u0,v0,u0,v1,u1,v1],2));g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.name=name;mesh.receiveShadow=true;const p=points[0];groupAt(p.x,p.z).add(mesh);
 };
 let walls=0,ceilings=0;
 CUT_MURALS.forEach((site,i)=>{
  const b=GEO.bridges.find(b=>b.name===site.bridge)!,f=bridgeFrame(b),side=site.side;
  // A shallow concrete art return brings the abutment artwork down to trail
  // level; the simplified outer road supports otherwise bury it in the bank.
  const x=side*7.4,mid=(f.near+f.far)/2;
  let width=Math.min(14,(f.far-f.near)-1.2);
  while(width>3&&[-1,1].some(end=>{const p=f.point(x,mid+end*width/2);return Math.abs(cutCoords(p.x,p.z).u)<5.1||nearestRamp(p.x,p.z).distance<3;}))width-=.5;
  const za=mid-width/2,zb=mid+width/2;
  const roof=profileLevel(b.at,'street')-BRIDGE_SLAB_DEPTH-.3;
  const origin=f.point(x,mid),base=Math.max(heightAt(origin.x,origin.z)+.10,roof-5.2);
  if(roof-base<.7||nearestRamp(origin.x,origin.z).distance<3)return;
  const wallYaw=Math.atan2(f.matrix.elements[8],f.matrix.elements[10]);
  const backing=new T.Mesh(new T.BoxGeometry(.3,roof-base,width),new T.MeshStandardMaterial({color:'#a4a197',roughness:1}));
  const back=f.point(x+side*.17,mid);backing.position.set(back.x,(base+roof)/2,back.z);backing.rotation.y=wallYaw;backing.receiveShadow=true;groupAt(back.x,back.z).add(backing);
  const solid={x:back.x,y:(base+roof)/2,z:back.z,hx:.15,hy:(roof-base)/2,hz:width/2,yaw:wallYaw,kind:'mural-abutment'};world.solids.push(solid);world.addBox(solid);
  const vertex=(xx:number,y:number,z:number)=>{const p=f.point(xx,z);return new T.Vector3(p.x,y,p.z);};
  const [u0,v0,u1,v1]=site.crop,split=site.ceiling?v0+(v1-v0)*.68:v1;
  // Order the face along the trail consistently on either bank.
  const a=side<0?za:zb,c=side<0?zb:za;
  const artTop=site.artist.startsWith('Mike Han')?Math.min(roof,base+width/5.6):roof;
  panel([vertex(x,base,a),vertex(x,base,c),vertex(x,artTop,c),vertex(x,artTop,a)],[u0,v0,u1,split],materials[i],site.artist+' — '+site.year+' — '+site.bridge);walls++;
  if(site.ceiling){
   const y=profileLevel(b.at,'street')-BRIDGE_SLAB_DEPTH-.018,inner=x-side*3.8;
   panel([vertex(x,y,a),vertex(x,y,c),vertex(inner,y,c),vertex(inner,y,a)],[u0,split,u1,v1],materials[i],site.artist+' painted bridge underside');ceilings++;
  }
 });
 // The surviving freestanding HDL wall between Larned and Lafayette.
 const p=cutPoint(615,-9.2),look=cutPoint(615),yaw=Math.atan2(look.x-p.x,look.z-p.z),base=heightAt(p.x,p.z),w=12,h=4.5;
 const concrete=new T.MeshStandardMaterial({color:'#8b897a',roughness:1});
 const block=new T.Mesh(new T.BoxGeometry(w,h,.45),concrete);block.position.set(p.x,base+h/2,p.z);block.rotation.y=yaw;block.castShadow=block.receiveShadow=true;groupAt(p.x,p.z).add(block);
 const s={x:p.x,y:base+h/2,z:p.z,hx:w/2,hy:h/2,hz:.225,yaw,kind:'mural-wall'};world.solids.push(s);world.addBox(s);
 const v=(u:number,y:number)=>new T.Vector3(p.x+Math.cos(yaw)*u+Math.sin(yaw)*.242,y,p.z-Math.sin(yaw)*u+Math.cos(yaw)*.242);
 panel([v(-w/2,base),v(w/2,base),v(w/2,base+h),v(-w/2,base+h)],[.033,.23,.965,.99],materials[7],'Hygienic Dress League — 2014');walls++;
 return {walls,ceilings,source:'Detroit Riverfront Conservancy Art Walk 2025',placements:'approximate'};
}
