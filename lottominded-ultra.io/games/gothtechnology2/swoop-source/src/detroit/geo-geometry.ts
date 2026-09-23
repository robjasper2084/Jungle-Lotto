import * as T from 'three';
import {GEO,profileLevel,nearestRamp} from './geo-profile.ts';
import {pointOnCut,nearestCut} from './geography.ts';
import {completeBridges} from './bridges.ts';
import type {BridgeMesh} from './bridges.ts';
export function buildingEnvelope(b:{points:number[][];height:number},heightAt:(x:number,z:number)=>number){
  const cx=b.points.reduce((s,p)=>s+p[0],0)/b.points.length,cz=b.points.reduce((s,p)=>s+p[1],0)/b.points.length,c=nearestCut(cx,cz);
  const base=Math.abs(c.u)<90&&c.d>280?profileLevel(c.d,'street'):heightAt(cx,cz);
  // Extend foundations down to the bank without shifting the mapped footprint or roof.
  const bottom=c.distance<100?Math.min(base,...b.points.map(p=>heightAt(p[0],p[1])-.2)):base;
  const geometry=new T.ExtrudeGeometry(new T.Shape(b.points.map(p=>new T.Vector2(p[0]-cx,-p[1]+cz))),{depth:b.height+base-bottom,bevelEnabled:false,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(cx,bottom,cz);geometry.userData.streetBase=base;return geometry;
}
export type GeoMesh=BridgeMesh|{name:string;kind:'wall';geometry:T.BufferGeometry;source:string;collision?:boolean};
export function geospatialMeshes(heightAt:(x:number,z:number)=>number):GeoMesh[]{
  const items:GeoMesh[]=[...completeBridges(heightAt)];
  for(const wall of GEO.walls){
    if(wall.offset>0&&wall.at<945&&wall.at+7.8>916)continue; // Open Campbell Terrace frontage.
    const a=pointOnCut(wall.at,wall.offset),b=pointOnCut(wall.at+7.8,wall.offset),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
    if(nearestRamp(x,z).distance<5)continue;
    const geo=new T.BoxGeometry(.35,wall.height,Math.hypot(b.x-a.x,b.z-a.z));geo.rotateY(Math.atan2(b.x-a.x,b.z-a.z));geo.translate(x,heightAt(x,z)+wall.height/2,z);
    items.push({name:'Retaining '+wall.at+' / '+wall.offset,kind:'wall',geometry:geo,source:wall.source});
  }
  return items;
}
