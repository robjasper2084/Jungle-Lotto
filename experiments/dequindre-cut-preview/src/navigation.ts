import {fromSourceMap} from './geo.ts';
import type {ParkMap,SwoopCoverage} from './terrain.ts';

type SourceRoad={id:string;name:string;kind:string;width:number;bridge:boolean;points:number[][]};
type Point=[number,number];
const supported=new Set(['footway','path','cycleway','pedestrian','service','residential','unclassified','tertiary','secondary','primary','trunk']);
const footways=new Set(['footway','path','cycleway','pedestrian']);
const same=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7;

/** Navigation references only. Split at the actual imported coverage boundary
 * rather than extending a city road through unsupported terrain or tile gaps.
 * Preserve bridge and highway metadata so road users keep their distinctions. */
export function sourceNavigationRoads(roads:readonly SourceRoad[],coverage:Pick<SwoopCoverage,'segments'>):ParkMap['roads']{
  const result:ParkMap['roads']=[];
  for(const road of roads){
    if(!supported.has(road.kind)||!Number.isFinite(road.width)||road.width<=0)continue;
    const parts:Point[][]=[];let current:Point[]|undefined;
    for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i];
      if(![a[0],a[1],b[0],b[1]].every(Number.isFinite)){current=undefined;continue;}
      const dx=b[0]-a[0],dz=b[1]-a[1];if(Math.hypot(dx,dz)<1e-8)continue;
      for(const interval of coverage.segments({x:a[0],y:0,z:a[1]},{x:dx,y:0,z:dz},1)){
        if(!interval.source){current=undefined;continue;}
        const p=fromSourceMap(a[0]+dx*interval.start,0,a[1]+dz*interval.start);
        const q=fromSourceMap(a[0]+dx*interval.end,0,a[1]+dz*interval.end);
        const start:Point=[p.x,p.z],end:Point=[q.x,q.z];
        if(current&&same(current.at(-1)!,start))current.push(end);
        else{current=[start,end];parts.push(current);}
      }
    }
    for(const [part,points]of parts.entries())result.push({id:'preview-source-road-'+road.id+'-'+part,name:road.name,points,width:road.width,foot:footways.has(road.kind),bridge:road.bridge,highway:road.kind,surface:'pavement'});
  }
  return result;
}
