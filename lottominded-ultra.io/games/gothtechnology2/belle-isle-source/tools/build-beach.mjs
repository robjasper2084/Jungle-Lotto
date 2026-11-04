import fs from 'node:fs/promises';
import path from 'node:path';
import pc from '../game/node_modules/polygon-clipping/dist/polygon-clipping.esm.js';
import * as T from '../game/node_modules/three/build/three.module.js';
import {mergeVertices} from '../game/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {makeBeachProfiles,beachHeight} from '../game/src/belle/beachProfile.ts';
const root=path.resolve(import.meta.dirname,'..'),map=JSON.parse(await fs.readFile(root+'/game/public/belle/map.json','utf8'));
const beaches=makeBeachProfiles(map),land=map.landPolygons||[[map.island,...map.water.map(w=>w.points)]];
const dryLand=pc.difference(land,...beaches.map(b=>[b.points]));
await fs.writeFile(root+'/game/public/belle/beach-land.json',JSON.stringify(dryLand));
const positions=[],uv=[],index=[];
for(const b of beaches){
 const s=new T.Shape(b.points.map(p=>new T.Vector2(p[0],p[1]))),g=new T.ShapeGeometry(s),v=g.attributes.position,idx=g.index;
 const vertex=(i)=>[v.getX(i),v.getY(i)];
 function tri(a,b,c,depth=0){
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const ab=dist(a,b),bc=dist(b,c),ca=dist(c,a),maxEdge=Math.max(ab,bc,ca);
  const ha=beachHeight(beaches,a[0],a[1]),hb=beachHeight(beaches,b[0],b[1]),hc=beachHeight(beaches,c[0],c[1]);
  const cross=new T.Vector3(b[0]-a[0],hb-ha,b[1]-a[1]).cross(new T.Vector3(c[0]-a[0],hc-ha,c[1]-a[1]));
  const up=Math.abs(cross.y)/Math.max(1e-12,cross.length());
  if(depth<22&&(maxEdge>3||(up<.9&&maxEdge>.08))){const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];if(ab>=bc&&ab>=ca){const p=mid(a,b);tri(a,p,c,depth+1);tri(p,b,c,depth+1);}else if(bc>=ca){const p=mid(b,c);tri(a,b,p,depth+1);tri(a,p,c,depth+1);}else{const p=mid(c,a);tri(a,b,p,depth+1);tri(p,b,c,depth+1);}return;}
  const base=positions.length/3;
  for(const p of [a,b,c]){positions.push(p[0],beachHeight(beaches,p[0],p[1])+.012,p[1]);uv.push(p[0]/3,p[1]/3);}
  // ShapeGeometry is CCW in XY; our plane is XZ, so reverse it for +Y.
  index.push(base,base+2,base+1);
 }
 for(let i=0;i<idx.count;i+=3)tri(vertex(idx.getX(i)),vertex(idx.getX(i+1)),vertex(idx.getX(i+2)));
}
const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(positions,3));source.setAttribute('uv',new T.Float32BufferAttribute(uv,2));source.setIndex(index);
const geometry=mergeVertices(source,.001);geometry.computeVertexNormals();const pos=geometry.attributes.position,normal=geometry.attributes.normal,tex=geometry.attributes.uv;
const packed=new Float32Array(pos.count*8);let k=0;
for(let i=0;i<pos.count;i++)for(const v of [pos.getX(i),pos.getY(i),pos.getZ(i),normal.getX(i),normal.getY(i),normal.getZ(i),tex.getX(i),tex.getY(i)])packed[k++]=v;
await fs.writeFile(root+'/game/public/belle/beach-surface.bin',new Uint8Array(packed.buffer));
await fs.writeFile(root+'/game/public/belle/beach-surface.json',JSON.stringify({stride:8,vertices:pos.count,indices:Array.from(geometry.index.array),beaches:beaches.map(b=>({id:b.id,waterEdges:b.waterside.length}))}));
console.log('Beaches:',beaches.length,'graded surface triangles:',index.length/3,'bytes:',packed.byteLength);
