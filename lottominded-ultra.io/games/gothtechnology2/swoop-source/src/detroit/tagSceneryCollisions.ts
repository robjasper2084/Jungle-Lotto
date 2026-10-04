import type {DetroitWorld} from './world.ts';
import {cutPoint,heightAt} from './world.ts';
import {LOTTO_SHOP,LOTTO_WALLS,LOTTO_FIXTURES,lottoMap} from './lottoShopSite.ts';
import {PENNY_SHOP,PENNY_SOLIDS,pennyMap} from './pennyShopSite.ts';
import {MACK_STUDIO,studioMap,studioRoom} from './mackStudioSite.ts';
import {STUDIO_FIXTURES,RETAIL_FIXTURES} from './studioInteriorLayout.ts';

/** Asset-free collision registration shared by the visible stores and Tag export.
 * Central door openings remain open; floors are foundations, not overhead decks. */
export function registerRetailShell(world:DetroitWorld,kind:'lotto'|'penny'|'studio'){
 const site=kind==='lotto'?LOTTO_SHOP:kind==='penny'?PENNY_SHOP:MACK_STUDIO;
 const map=kind==='lotto'?lottoMap:kind==='penny'?pennyMap:studioMap;
 const box=(u:number,v:number,w:number,h:number,d:number,y=h/2)=>{const p=map(u,v);world.addBox({x:p.x,y:site.floor+y,z:p.z,hx:w/2,hy:h/2,hz:d/2,yaw:-site.heading,kind:'retail '+kind});};
 if(kind==='lotto'){
  for(const p of LOTTO_WALLS)box(p.u,p.v,p.width,p.height,p.depth,p.y);
  for(const p of LOTTO_FIXTURES)box(p.u,p.v,p.width,p.height,p.depth);
 }else if(kind==='penny')for(const p of PENNY_SOLIDS)box(p.u,p.v,p.width,p.height,p.depth,p.y);
 else{
  box(-24.266,0,.26,6.1,43.912);box(24.266,0,.26,6.1,43.912);box(0,-21.956,48.533,6.1,.26);
  for(const side of [-1,1])box(side*13.048,21.956,22.436,6.1,.26);
  box(0,21.956,3.66,1.2,.26,5.5);
  for(const p of [...STUDIO_FIXTURES,...RETAIL_FIXTURES])box(p.u,p.v,p.width,p.height,p.depth,p.y??p.height/2);
 }
 const hx=kind==='lotto'?6.7:kind==='penny'?3.9:24.266,hz=kind==='studio'?21.956:9.4,dy=kind==='lotto'?.068:kind==='penny'?.071:.05;
 const q=[[-hx,-hz],[-hx,hz],[hx,hz],[hx,-hz]].map(([u,v])=>map(u,v));
 world.addRideSurface(new Float32Array([0,2,1,0,3,2].flatMap(i=>[q[i].x,site.floor+dy,q[i].z])),true);
}

export const freightSites=()=>Array.from({length:9},(_,i)=>cutPoint(2045+Math.floor(i/3)*9,-16-(i%3)*8));
export function registerFreightCollisions(world:DetroitWorld){for(const p of freightSites())world.addBox({x:p.x,y:heightAt(p.x,p.z)+1.3,z:p.z,hx:3,hy:1.3,hz:2,kind:'container',yaw:p.heading});}

export function registerDestinationCollision(world:DetroitWorld,store:boolean){
 const room=studioRoom(store),map=(x:number,z:number)=>studioMap(room.u+x,room.v+z);
 for(const [near,far,y]of [[-7.5,7.5,.06],[6,10.4,0]]){const q=[[-9,near],[-9,far],[9,far],[9,near]].map(([x,z])=>map(x,z));world.addRideSurface(new Float32Array([0,2,1,0,3,2].flatMap(i=>[q[i].x,MACK_STUDIO.floor+y,q[i].z])),true);}
 for(const [x,z,w,d]of [[-9,0,.3,12],[9,0,.3,12],[0,-6,18,.3]]){const p=map(x,z);world.addBox({x:p.x,y:MACK_STUDIO.floor+3.6,z:p.z,hx:w/2,hy:3.6,hz:d/2,yaw:-MACK_STUDIO.heading,kind:'building'});}
}
