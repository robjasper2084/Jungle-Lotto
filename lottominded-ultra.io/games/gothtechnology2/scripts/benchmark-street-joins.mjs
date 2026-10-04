import {performance} from 'node:perf_hooks';
import {CITY} from '../swoop-source/src/detroit/geography.ts';
import {terrainChunks,heightAt} from '../swoop-source/src/detroit/world.ts';
import {drapeStreet,streetElevation,streetSurfaceLift,streetVertexNormal} from '../swoop-source/src/detroit/street-geometry.ts';
import {streetJoinExclusions} from '../swoop-source/src/detroit/streetJunctions.ts';
import {parallelStreetSidewalk} from '../swoop-source/src/detroit/streetSidewalk.ts';
const chunks=terrainChunks(),report=[];
for(const joined of [false,true]){
 const started=performance.now();let triangles=0,sections=0,maxPieces=0;
 for(const road of CITY.roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],walk=['cycleway','footway','path','pedestrian'].includes(road.kind);
  if(walk&&road.name!=='Dequindre Cut Greenway'&&parallelStreetSidewalk(a,b))continue;
  const pieces=drapeStreet({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half:road.width/2,offset:0,lift:streetSurfaceLift(road),...(joined?{joinA:streetVertexNormal(road.points,i-1),joinB:streetVertexNormal(road.points,i),exclude:walk?streetJoinExclusions(road,a,b,road.width/2+4,heightAt):undefined}:{})},chunks,(x,z,h)=>streetElevation(road,x,z,h));
  sections++;maxPieces=Math.max(maxPieces,pieces.length);for(const {positions}of pieces){triangles+=positions.length/9;if(positions.some(v=>!Number.isFinite(v)))throw Error('Invalid surface geometry');}
 }
 report.push({joined,sections,triangles,maxPieces,seconds:+((performance.now()-started)/1000).toFixed(3)});
}
console.log(JSON.stringify({scope:'Actual mapped road and path CPU tessellation; excludes rendering, curb overlays and GPU frames',report},null,2));
