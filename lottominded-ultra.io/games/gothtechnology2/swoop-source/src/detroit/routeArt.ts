import * as T from 'three';
import {cutPoint,heightAt} from './world.ts';
import type {DetroitWorld,Solid} from './world.ts';
import {GEO,nearestRamp} from './geo-profile.ts';

/** Authored game advertising; these are not claims about real Detroit installations. */
export const ROUTE_BILLBOARDS=[
 {at:1080,offset:-8.5,art:0},
 {at:1900,offset:-8.5,art:1},
 {at:2425,offset:-8.5,art:3},
] as const;
// Keep the photos in the gallery; the trail has only three curated campaigns.
export const ROUTE_GALLERY:{at:number;offset:number;art:number}[]=[];
const WIDTH=6.4,HEIGHT=3.6;
export const DETROIT_FIELD_SIGN={at:1600,offset:-22,width:14,height:9.4};
export function fittedArtwork(width:number,height:number){const scale=Math.min((WIDTH-.3)/width,(HEIGHT-.4)/height);return {width:width*scale,height:height*scale};}
export function billboardPlacement(at:number,offset:number){
 const p=cutPoint(at,offset),look=cutPoint(at-14),yaw=Math.atan2(look.x-p.x,look.z-p.z);
 const base=heightAt(p.x,p.z),centreY=base+1.5+HEIGHT/2;
 const solids:Solid[]=[{x:p.x,y:centreY,z:p.z,hx:WIDTH/2+.08,hy:HEIGHT/2+.08,hz:.1,yaw,kind:'billboard'}];
 for(const u of [-2.1,2.1]){
  const x=p.x+Math.cos(yaw)*u,z=p.z-Math.sin(yaw)*u,ground=heightAt(x,z),top=centreY+HEIGHT/2;
  solids.push({x,y:(top+ground)/2,z,hx:.085,hy:(top-ground)/2,hz:.085,yaw,kind:'billboard-post'});
 }
 return{...p,y:centreY,yaw,solids};
}
function panelGeometry(w:number,h:number){
 const g=new T.PlaneGeometry(w,h),uv=g.attributes.uv;
 // Parent map scene reflects X. Correct the printed artwork once at this boundary.
 for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));return g;
}
export async function buildRouteArt(world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group){
 const urls=[
  new URL('../../art/route-campaign/lottomind-refined.png',import.meta.url).href,
  new URL('../../art/route-campaign/gothtechnology-refined.png',import.meta.url).href,
  new URL('../../art/route-campaign/detroit-dreams.jpg',import.meta.url).href,
  new URL('../../art/route-campaign/serengeti-refined.png',import.meta.url).href,
  new URL('../../art/route-campaign/detroit-heart.png',import.meta.url).href,
 ];
 const maps=await Promise.all(urls.map(url=>new T.TextureLoader().loadAsync(url)));
 const materials=maps.map(map=>{map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return new T.MeshStandardMaterial({map,roughness:.88,metalness:0});});
 const frame=new T.MeshStandardMaterial({color:'#273536',roughness:.72,metalness:.45});
 let billboards=0,murals=0,photos=0;
 for(const site of [...ROUTE_BILLBOARDS,...ROUTE_GALLERY]){
  const p=billboardPlacement(site.at,site.offset);
  if(nearestRamp(p.x,p.z).distance<7)continue;
  const group=groupAt(p.x,p.z);
  for(const solid of p.solids){
   const mesh=new T.Mesh(new T.BoxGeometry(solid.hx*2,solid.hy*2,solid.hz*2),frame);
   mesh.position.set(solid.x,solid.y,solid.z);mesh.rotation.y=solid.yaw??0;
   mesh.name='Campaign '+solid.kind+' '+site.at;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
   world.solids.push(solid);world.addBox(solid);
  }
  for(const yaw of [p.yaw,p.yaw+Math.PI]){
   const mesh=new T.Mesh(panelGeometry(WIDTH,HEIGHT),materials[site.art]);
   mesh.name=['Lotto Mind','GothTechnology','Detroit Dreams','Serengeti Galleries'][site.art]+' campaign '+site.at;
   mesh.position.set(p.x+Math.sin(yaw)*.112,p.y,p.z+Math.cos(yaw)*.112);mesh.rotation.y=yaw;group.add(mesh);
  }
  billboards++;
 }
 // Small murals use existing wall panels, retaining the original landmark murals nearby.
 for(const at of [1832,2120]){
  const wall=GEO.walls.reduce((best,w)=>Math.abs(w.at-at)<Math.abs(best.at-at)?w:best);
  const p=cutPoint(wall.at+3.9,wall.offset),h=Math.min(2.08,wall.height-.14),w=h*16/9;
  if(nearestRamp(p.x,p.z).distance<6)continue;
  const yaw=p.heading-Math.PI+(wall.offset>0?-Math.PI/2:Math.PI/2);
  const mesh=new T.Mesh(panelGeometry(w,h),materials[2]);mesh.name='Detroit Dreams painted wall '+at;
  mesh.position.set(p.x+Math.sin(yaw)*.195,heightAt(p.x,p.z)+wall.height/2,p.z+Math.cos(yaw)*.195);mesh.rotation.y=yaw;
  groupAt(p.x,p.z).add(mesh);murals++;
 }
 // The original artwork stays intact on disk. The sign material keys out only
 // its dark fabric background, so the skyline/heart reads as a freestanding cutout.
 const art=materials[4],cutout=art.clone();cutout.side=T.DoubleSide;
 cutout.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 if(max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))<0.035) discard;`);};
 cutout.customProgramCacheKey=()=> 'detroit-field-cutout-v1';
 const graphic=(w:number,h:number)=>{const g=panelGeometry(w,h),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.165+uv.getX(i)*.67,.30+uv.getY(i)*.455);return g;};
 const site=DETROIT_FIELD_SIGN,p=cutPoint(site.at,site.offset),look=cutPoint(site.at),yaw=Math.atan2(look.x-p.x,look.z-p.z);
 const ground=Math.max(...[-7,0,7].map(d=>{const q=cutPoint(site.at+d,site.offset);return heightAt(q.x,q.z);})),base=ground+.3;
 const group=groupAt(p.x,p.z);
 // Closely spaced silhouette layers give the monumental field sign physical depth.
 for(const depth of [-.18,-.09,0,.09,.18]){const mesh=new T.Mesh(graphic(site.width,site.height),cutout);mesh.name='Detroit heart monumental field sign';mesh.position.set(p.x+Math.sin(yaw)*depth,base+site.height/2,p.z+Math.cos(yaw)*depth);mesh.rotation.y=yaw;group.add(mesh);}
 for(const u of [-5,0,5]){const x=p.x+Math.cos(yaw)*u,z=p.z-Math.sin(yaw)*u,y=heightAt(x,z),top=base+.55;const s:Solid={x,y:(top+y)/2,z,hx:.13,hy:(top-y)/2,hz:.13,yaw,kind:'art-sign-support'};const mesh=new T.Mesh(new T.BoxGeometry(.26,s.hy*2,.26),frame);mesh.position.set(x,s.y,z);mesh.castShadow=true;group.add(mesh);world.solids.push(s);world.addBox(s);}
 const body:Solid={x:p.x,y:base+site.height/2,z:p.z,hx:7,hy:site.height/2,hz:.2,yaw,kind:'art-sign'};world.solids.push(body);world.addBox(body);
 // Adelaide's existing concrete wall carries the same artwork beneath the span.
 const wall=GEO.walls.find(w=>w.at===1860&&w.offset===9)!;
 const mp=cutPoint(wall.at+3.9,wall.offset),myaw=mp.heading-Math.PI-Math.PI/2,mh=wall.height-.18;
 const mural=new T.Mesh(graphic(mh*.67/.455,mh),art);mural.name='Detroit heart Adelaide overpass mural';mural.position.set(mp.x+Math.sin(myaw)*.201,heightAt(mp.x,mp.z)+wall.height/2,mp.z+Math.cos(myaw)*.201);mural.rotation.y=myaw;groupAt(mp.x,mp.z).add(mural);murals++;
 return{billboards,murals,photos,fieldSigns:1};
}
