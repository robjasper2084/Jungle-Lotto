import * as T from 'three';
import {GEO,profileLevel,nearestRamp} from './geo-profile.ts';
import {pointOnCut,nearestCut} from './geography.ts';
import {CITY_DETAIL} from './city-spatial.ts';
export function buildingPartGeometry(part:typeof CITY_DETAIL.buildingParts[number],heightAt:(x:number,z:number)=>number){
  const cx=part.points.reduce((s,p)=>s+p[0],0)/part.points.length,cz=part.points.reduce((s,p)=>s+p[1],0)/part.points.length;
  const base=part.rencen?heightAt(CITY_DETAIL.renCenOrigin[0],CITY_DETAIL.renCenOrigin[1]):heightAt(cx,cz);
  const g=new T.ExtrudeGeometry(new T.Shape(part.points.map(p=>new T.Vector2(p[0],-p[1]))),{depth:Math.max(.1,part.height-part.minHeight),bevelEnabled:false});
  g.rotateX(-Math.PI/2);g.translate(0,base+part.minHeight,0);g.userData.streetBase=base;return g;
}
export function buildingEnvelope(b:{points:number[][];height:number},heightAt:(x:number,z:number)=>number){
  const cx=b.points.reduce((s,p)=>s+p[0],0)/b.points.length,cz=b.points.reduce((s,p)=>s+p[1],0)/b.points.length,c=nearestCut(cx,cz);
  const base=Math.abs(c.u)<90&&c.d>280?profileLevel(c.d,'street'):heightAt(cx,cz);
  // Extend foundations down to the bank without shifting the mapped footprint or roof.
  const bottom=c.distance<100?Math.min(base,...b.points.map(p=>heightAt(p[0],p[1])-.2)):base;
  const geometry=new T.ExtrudeGeometry(new T.Shape(b.points.map(p=>new T.Vector2(p[0]-cx,-p[1]+cz))),{depth:b.height+base-bottom,bevelEnabled:false,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(cx,bottom,cz);geometry.userData.streetBase=base;return geometry;
}
export type GeoMesh={name:string;kind:'deck'|'abutment'|'wall';geometry:T.BufferGeometry;source:string};
export function geospatialMeshes(heightAt:(x:number,z:number)=>number):GeoMesh[]{
  const items:GeoMesh[]=[];
  for(const bridge of GEO.bridges){
    const top=profileLevel(bridge.at,'street'),shape=new T.Shape(bridge.points.map(p=>new T.Vector2(p[0],-p[1])));
    const geometry=new T.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,top-.8,0);
    items.push({name:bridge.name,kind:'deck',geometry,source:bridge.source});
    for(let i=1;i<bridge.points.length;i++){
      const a=bridge.points[i-1],b=bridge.points[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      // A deck edge can cross the trail even when its midpoint is outside it.
      // Keep inferred abutments only on edges entirely clear of both corridors.
      const samples=Math.ceil(length);
      if(length<3||Array.from({length:samples+1},(_,j)=>{
        const px=a[0]+(b[0]-a[0])*j/samples,pz=a[1]+(b[1]-a[1])*j/samples;
        return Math.abs(nearestCut(px,pz).u)<7||nearestRamp(px,pz).distance<5;
      }).some(Boolean))continue;
      const base=profileLevel(bridge.at,'floor'),height=top-base-.8;
      if(height<.1)continue;
      const geo=new T.BoxGeometry(.55,height,length);geo.rotateY(Math.atan2(b[0]-a[0],b[1]-a[1]));geo.translate(x,base+height/2,z);
      items.push({name:bridge.name+' abutment '+i,kind:'abutment',geometry:geo,source:'Mapped footprint edge; vertical profile estimate'});
    }
  }
  for(const wall of GEO.walls){
    const a=pointOnCut(wall.at,wall.offset),b=pointOnCut(wall.at+7.8,wall.offset),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
    if(nearestRamp(x,z).distance<5)continue;
    const geo=new T.BoxGeometry(.35,wall.height,Math.hypot(b.x-a.x,b.z-a.z));geo.rotateY(Math.atan2(b.x-a.x,b.z-a.z));geo.translate(x,heightAt(x,z)+wall.height/2,z);
    items.push({name:'Retaining '+wall.at+' / '+wall.offset,kind:'wall',geometry:geo,source:wall.source});
  }
  for(const wall of GEO.mappedWalls)for(let i=1;i<wall.points.length;i++){
    const a=wall.points[i-1],b=wall.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    if(length<.2||Array.from({length:Math.ceil(length)+1},(_,j)=>{const t=j/Math.ceil(length),px=a[0]+(b[0]-a[0])*t,pz=a[1]+(b[1]-a[1])*t;return nearestCut(px,pz).distance<4.2||nearestRamp(px,pz).distance<3;}).some(Boolean))continue;
    const base=Math.min(heightAt(...a as [number,number]),heightAt(...b as [number,number])),top=Math.max(heightAt(...a as [number,number]),heightAt(...b as [number,number]))+wall.height;
    const g=new T.BoxGeometry(.35,top-base,length);g.rotateY(Math.atan2(b[0]-a[0],b[1]-a[1]));g.translate(x,(top+base)/2,z);
    items.push({name:'Mapped wall '+wall.id+' / '+i,kind:'wall',geometry:g,source:wall.source+'; '+wall.heightSource});
  }
  return items;
}
