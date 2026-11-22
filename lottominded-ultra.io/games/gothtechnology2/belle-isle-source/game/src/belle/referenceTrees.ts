import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {referenceLeafEdges} from './referenceLeafDisplay.ts';

/** Shared, deterministic silhouettes; native placement, seasons and distance pools remain in charge. */
export function referenceTree(id:string,low:boolean,height:number){
 let seed=Array.from(id).reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),81);
 const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const trunks:T.BufferGeometry[]=[],leaves:T.BufferGeometry[]=[],up=new T.Vector3(0,1,0),matrix=new T.Matrix4(),q=new T.Quaternion(),color=new T.Color();
 const pine=id==='pine',willow=id==='willow',birch=id==='birch',radius=height*(willow?.32:pine?.20:birch?.22:.29);
 function branch(a:T.Vector3,b:T.Vector3,r:number){const g=new T.CylinderGeometry(r*.27,r,a.distanceTo(b),low?5:7);q.setFromUnitVectors(up,b.clone().sub(a).normalize());matrix.compose(a.clone().add(b).multiplyScalar(.5),q,new T.Vector3(1,1,1));trunks.push(g.applyMatrix4(matrix));}
 branch(new T.Vector3(),new T.Vector3(.18,height*.91,0),birch?.17:.29);
 const centers:T.Vector3[]=[];
 for(let i=0;i<12;i++){const a=i*2.39996,level=i/12;const r=pine?radius*(1-level*.8):radius*(.42+random()*.24);const y=height*(pine?.26+level*.67:.56+level*.33);const c=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);centers.push(c);branch(new T.Vector3(0,y*.66,0),c,.075);}
 centers.push(new T.Vector3(0,height*.91,0));
 const leafShape=new T.Shape();
 referenceLeafEdges.forEach(([y,x],i)=>i?leafShape.lineTo(x?-x:0,y):leafShape.moveTo(-x,y));
 for(let i=referenceLeafEdges.length-2;i>=0;i--){const [y,x]=referenceLeafEdges[i];leafShape.lineTo(x,y);}
 leafShape.closePath();
 const leaf=new T.ShapeGeometry(leafShape);leaf.rotateX(-Math.PI/2);
 const count=low?700:1800;
 // Bake all leaves directly into one geometry. Cloning a geometry per leaf
 // allocated thousands of short-lived buffers before the first frame.
 const vertices=leaf.getAttribute('position'),normals=leaf.getAttribute('normal');
 const uv=leaf.getAttribute('uv'),template=leaf.getIndex()!,stride=vertices.count;
 const batch=new T.BufferGeometry(),total=count*stride;
 const positions=new T.BufferAttribute(new Float32Array(total*3),3);
 const directions=new T.BufferAttribute(new Float32Array(total*3),3);
 const coords=new T.BufferAttribute(new Float32Array(total*2),2);
 const colors=new T.BufferAttribute(new Float32Array(total*3),3);
 const indices=new Uint16Array(template.count*count);
 const vertex=new T.Vector3(),normalMatrix=new T.Matrix3();
 const smoothIndex=low?new Uint16Array(count*6+centers.length*60):undefined;
 for(let i=0;i<count;i++){
  const c=centers[i%centers.length];
  const a=random()*Math.PI*2,v=random()*2-1,r=Math.pow(random(),.43)*radius*.68,s=Math.sqrt(1-v*v);const p=c.clone().add(new T.Vector3(Math.cos(a)*s*r,v*r*(willow?1.45:.8),Math.sin(a)*s*r));const size=(low?1.15:.75)+random()*(low?1.1:.8);matrix.compose(p,q.setFromEuler(new T.Euler((random()-.5)*2,random()*6,(random()-.5)*2)),new T.Vector3(size*(willow?.6:1),size,size*(willow?1.6:1)));
  color.setHSL(.22+random()*.035,.35,.37+random()*.13);
  const base=i*stride;
  normalMatrix.getNormalMatrix(matrix);
  for(let j=0;j<stride;j++){
   vertex.fromBufferAttribute(vertices,j).applyMatrix4(matrix);
   positions.setXYZ(base+j,vertex.x,vertex.y,vertex.z);
   vertex.fromBufferAttribute(normals,j).applyNormalMatrix(normalMatrix);
   directions.setXYZ(base+j,vertex.x,vertex.y,vertex.z);
   coords.setXY(base+j,uv.getX(j),uv.getY(j));
   colors.setXYZ(base+j,color.r,color.g,color.b);
  }
  for(let j=0;j<template.count;j++)indices[i*template.count+j]=base+template.getX(j);
  // The stem, tip and widest two points of the outline span two triangles.
  // Distance LOD keeps every leaf's placement, color and seasonal shading.
  if(smoothIndex)smoothIndex.set([base,base+9,base+6,base,base+6,base+3],i*6);
 }
 batch.setAttribute('position',positions);batch.setAttribute('normal',directions);
 batch.setAttribute('uv',coords);batch.setAttribute('color',colors);
 batch.setIndex(new T.BufferAttribute(indices,1));leaves.push(batch);
 for(const c of centers){const g=new T.IcosahedronGeometry(1,0),positions=g.getAttribute('position');for(let i=0;i<positions.count;i++){const v=new T.Vector3().fromBufferAttribute(positions,i);v.multiplyScalar(.80+random()*.3);positions.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();g.setIndex(Array.from({length:positions.count},(_,i)=>i));matrix.compose(c,q.setFromEuler(new T.Euler(random(),random()*6,random())),new T.Vector3(radius*.35,radius*.38,radius*.35));g.applyMatrix4(matrix);const colors=new Float32Array(positions.count*3);color.setRGB(.055,.085,.025);for(let i=0;i<positions.count;i++){colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));leaves.push(g);}
 leaf.dispose();const trunk=mergeGeometries(trunks)!,canopy=mergeGeometries(leaves)!;trunks.forEach(g=>g.dispose());leaves.forEach(g=>g.dispose());
 if(smoothIndex)smoothIndex.set(canopy.getIndex()!.array.subarray(indices.length),count*6);
 canopy.userData.referenceLeafCount=count;
 return{trunk,leaves:canopy,smoothLeafIndex:smoothIndex?new T.BufferAttribute(smoothIndex,1):undefined,bark:new T.MeshStandardMaterial({color:birch?0xb6aea1:0x70513a,roughness:.95}),foliage:new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.87,side:T.DoubleSide})};
}
