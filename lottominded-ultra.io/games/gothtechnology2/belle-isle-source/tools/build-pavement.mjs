import fs from 'node:fs/promises';
import path from 'node:path';
import * as T from '../game/node_modules/three/build/three.module.js';
import {mergeVertices} from '../game/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {ParkTerrain} from '../game/src/belle/terrain.ts';
import {aquariumFloor} from '../game/src/belle/aquarium.ts';
import {makePavementPlan} from './pavement-plan.mjs';
const root=path.resolve(import.meta.dirname,'..'),map=JSON.parse(await fs.readFile(root+'/game/public/belle/map.json','utf8')),terrain=new ParkTerrain(map),plan=makePavementPlan(map,terrain);
const materials=['asphalt','concrete','gravel','wood','pavers'],groups=[],chunks=[];let offset=0,triangles=0;
for(const kind of materials){
 const positions=[],uv=[],normals=[];
 for(const part of plan.filter(p=>p.kind===kind))for(const polygon of part.polygons){
  const ring=p=>p.map(v=>new T.Vector2(v[0],-v[1])),shape=new T.Shape(ring(polygon[0]));for(const hole of polygon.slice(1))shape.holes.push(new T.Path(ring(hole)));
  const source=new T.ShapeGeometry(shape),v=source.attributes.position,idx=source.index;
  const height=(x,z)=>(map.aquarium&&aquariumFloor(map.aquarium,x,z)!==null?2:terrain.height(x,z,part.level==='ground'?2:undefined))+.065;
  const vertex=i=>[v.getX(i),-v.getY(i)];
  function triangle(a,b,c,depth=0){
   const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),ab=dist(a,b),bc=dist(b,c),ca=dist(c,a),longest=Math.max(ab,bc,ca),mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
   const ha=height(...a),hb=height(...b),hc=height(...c),error=Math.max(...[[a,b,ha,hb],[b,c,hb,hc],[c,a,hc,ha]].map(([a,b,ha,hb])=>Math.abs(height(...mid(a,b))-(ha+hb)/2)));
   if(depth<18&&(longest>32||(longest>.4&&error>.018))){if(ab>=bc&&ab>=ca){const m=mid(a,b);triangle(a,m,c,depth+1);triangle(m,b,c,depth+1);}else if(bc>=ca){const m=mid(b,c);triangle(a,b,m,depth+1);triangle(a,m,c,depth+1);}else{const m=mid(c,a);triangle(a,b,m,depth+1);triangle(m,b,c,depth+1);}return;}
   for(const p of [a,b,c]){positions.push(p[0],height(...p),p[1]);uv.push(p[0]/8,p[1]/8);const step=.15,dx=(height(p[0]+step,p[1])-height(p[0]-step,p[1]))/(2*step),dz=(height(p[0],p[1]+step)-height(p[0],p[1]-step))/(2*step),n=Math.hypot(dx,1,dz);normals.push(-dx/n,1/n,-dz/n);}
  }
  for(let i=0;i<idx.count;i+=3)triangle(vertex(idx.getX(i)),vertex(idx.getX(i+1)),vertex(idx.getX(i+2)));
  source.dispose();
 }
 const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(positions,3));source.setAttribute('normal',new T.Float32BufferAttribute(normals,3));source.setAttribute('uv',new T.Float32BufferAttribute(uv,2));const g=mergeVertices(source,.0001),p=g.attributes.position,n=g.attributes.normal,t=g.attributes.uv,packed=new Float32Array(p.count*8);let j=0;
 for(let i=0;i<p.count;i++)for(const value of [p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),t.getX(i),t.getY(i)])packed[j++]=value;
 // Clip operations can produce sub-millimetre slivers. Float32 conversion may
 // collapse or reverse those; never ship a backwards/zero-area pavement face.
 const indices=[];for(let i=0;i<g.index.count;i+=3){let a=g.index.getX(i),b=g.index.getX(i+1),c=g.index.getX(i+2);const cy=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));if(Math.abs(cy)<1e-7)continue;if(cy<0)[b,c]=[c,b];indices.push(a,b,c);}
 chunks.push(Buffer.from(packed.buffer));groups.push({kind,offset,vertices:p.count,indices});offset+=packed.byteLength;triangles+=indices.length/3;g.dispose();source.dispose();
}
await fs.writeFile(root+'/game/public/belle/pavement.bin',Buffer.concat(chunks));await fs.writeFile(root+'/game/public/belle/pavement.json',JSON.stringify({version:1,stride:8,groups,triangles,bytes:offset}));console.log('Joined pavement:',triangles,'triangles,',offset,'bytes,',groups.length,'materials');
