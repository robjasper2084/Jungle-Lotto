import {drapeStreet,streetSurfaceLift} from './street-geometry.ts';
import type {TerrainChunk} from './world.ts';
import {pavementMaterials} from './pavementPaint.ts';
import * as T from 'three';
import {cutPoint} from './world.ts';
import {cutWidth,GEO,nearestRamp} from './geo-profile.ts';

/** Separate pedestrian strip and opposing bicycle arrows, from the supplied Cut photo. */
export function trailPaintSites(){
 const sites:{at:number;offset:number;type:'bike'|'walk'|'arrow';reverse:boolean}[]=[];
 for(let at=24;at<2550;at+=55){
  if(GEO.bridges.some(b=>Math.abs(b.at-at)<24))continue;
  const width=cutWidth(at),p=cutPoint(at);
  if(nearestRamp(p.x,p.z).distance<12)continue;
  for(const [offset,type,reverse] of [[-width*.25,'bike',true],[width*.15,'bike',false],[width*.38,'walk',false]] as const){
   const station=at+(type==='walk'?9:0);
   sites.push({at:station,offset,type,reverse});sites.push({at:station+(reverse?-3:3),offset,type:'arrow',reverse});
  }
 }
 return sites;
}
export function trailLineSites(){
 const sites:{at:number;offset:number;type:'centre'|'divider';length:number}[]=[];
 for(let at=8;at<2550;at+=6){const p=cutPoint(at);if(nearestRamp(p.x,p.z).distance<6)continue;sites.push({at,offset:0,type:'centre',length:2.5},{at,offset:cutWidth(at)*.28,type:'divider',length:6.1});}
 return sites;
}
export function trailPaintGeometry(chunks:TerrainChunk[],width:number,length:number,x:number,z:number,yaw:number){
 const forward={x:Math.sin(yaw),z:Math.cos(yaw)},right={x:Math.cos(yaw),z:-Math.sin(yaw)};
 const pieces=drapeStreet({a:{x:x-forward.x*length/2,z:z-forward.z*length/2},b:{x:x+forward.x*length/2,z:z+forward.z*length/2},half:width/2,offset:0,lift:streetSurfaceLift({kind:'cycleway',name:'Dequindre Cut Greenway'})+.008},chunks,(_x,_z,terrain)=>terrain);
 return pieces.map(piece=>{const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(piece.positions,3));const uv=[];
  for(let i=0;i<piece.positions.length;i+=3){const dx=piece.positions[i]-x,dz=piece.positions[i+2]-z;uv.push((dx*right.x+dz*right.z)/width+.5,(dx*forward.x+dz*forward.z)/length+.5);}
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();return {geometry,chunk:piece.chunk};});
}
export function buildTrailPaint(groupAt:(x:number,z:number)=>T.Group,chunks:TerrainChunk[]){
 const materials=pavementMaterials();
 const sites=trailPaintSites();
 for(const site of sites){
  const width=site.type==='arrow'?.68:site.type==='walk'?.8:1.12,height=site.type==='arrow'?1.45:1.65;
  const p=cutPoint(site.at,site.offset),yaw=p.heading+(site.reverse?Math.PI:0);
  for(const {geometry,chunk}of trailPaintGeometry(chunks,width,height,p.x,p.z,yaw)){const mesh=new T.Mesh(geometry,materials.get(site.type));mesh.name='Painted trail '+site.type;mesh.receiveShadow=true;mesh.renderOrder=2;groupAt(chunk.x,chunk.z).add(mesh);}
 }
 const centre=new T.MeshStandardMaterial({color:'#f0d075',roughness:1,polygonOffset:true,polygonOffsetFactor:-2});
 const divider=new T.MeshStandardMaterial({color:'#eee9d8',roughness:1,polygonOffset:true,polygonOffsetFactor:-2});
 for(const site of trailLineSites()){const p=cutPoint(site.at,site.offset);for(const {geometry,chunk}of trailPaintGeometry(chunks,site.type==='centre'?.13:.11,site.length,p.x,p.z,p.heading)){const mesh=new T.Mesh(geometry,site.type==='centre'?centre:divider);mesh.name='Painted trail '+site.type;mesh.receiveShadow=true;mesh.renderOrder=2;groupAt(chunk.x,chunk.z).add(mesh);}}
 return sites.length;
}
