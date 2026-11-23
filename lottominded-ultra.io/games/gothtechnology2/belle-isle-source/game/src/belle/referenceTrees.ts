import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {referenceLeafEdges} from './referenceLeafDisplay.ts';

/** A tileable leaf surface. Mipmaps blend the leaf detail into shaded crowns as
 * it gets smaller on screen, without changing the canopy's coverage. */
export function referenceCanopyTexture(){
 const size=256,canvas=document.createElement('canvas');
 canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#5c5c5c';ctx.fillRect(0,0,size,size);
 let seed=0x5da1338;
 const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 for(let i=0;i<1100;i++){
  const x=random()*size,y=random()*size,angle=random()*Math.PI;
  const length=2+random()*6,width=length*(.4+random()*.26);
  const tone=135+Math.floor(random()*116);
  const gradient=ctx.createLinearGradient(-length,-width,length,width);
  gradient.addColorStop(0,'#5c5c5c');
  gradient.addColorStop(.42,`rgb(${tone},${tone},${tone})`);
  gradient.addColorStop(1,'#aaa');
  for(let dy=-size;dy<=size;dy+=size)for(let dx=-size;dx<=size;dx+=size){
   if(x+dx<-length||x+dx>size+length||y+dy<-length||y+dy>size+length)continue;
   ctx.save();ctx.translate(x+dx,y+dy);ctx.rotate(angle);
   ctx.fillStyle=gradient;
   ctx.beginPath();ctx.moveTo(-length,0);ctx.quadraticCurveTo(0,-width,length,0);
   ctx.quadraticCurveTo(0,width,-length,0);ctx.fill();ctx.restore();
  }
 }
 const texture=new T.CanvasTexture(canvas);
 texture.wrapS=texture.wrapT=T.RepeatWrapping;
 texture.colorSpace=T.SRGBColorSpace;
 texture.anisotropy=4;
 return texture;
}

/** Shared, deterministic silhouettes; native placement, seasons and distance pools remain in charge. */
export function referenceTree(id:string,low:boolean,height:number,solidCanopy?:'full'|'compact'){
 let seed=Array.from(id).reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),81);
 const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const trunks:T.BufferGeometry[]=[],leaves:T.BufferGeometry[]=[],up=new T.Vector3(0,1,0),matrix=new T.Matrix4(),q=new T.Quaternion(),color=new T.Color();
 const pine=id==='pine',willow=id==='willow',birch=id==='birch',radius=height*(willow?.32:pine?.20:birch?.22:.29);
 function branch(a:T.Vector3,b:T.Vector3,r:number){const g=new T.CylinderGeometry(r*.27,r,a.distanceTo(b),low?5:7);q.setFromUnitVectors(up,b.clone().sub(a).normalize());matrix.compose(a.clone().add(b).multiplyScalar(.5),q,new T.Vector3(1,1,1));trunks.push(g.applyMatrix4(matrix));}
 branch(new T.Vector3(),new T.Vector3(.18,height*.91,0),birch?.17:.29);
 const centers:T.Vector3[]=[];
 for(let i=0;i<12;i++){const a=i*2.39996,level=i/12;const r=pine?radius*(1-level*.8):radius*(.42+random()*.24);const y=height*(pine?.26+level*.67:.56+level*.33);const c=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);centers.push(c);branch(new T.Vector3(0,y*.66,0),c,.075);}
 centers.push(new T.Vector3(0,height*.91,0));
 if(solidCanopy){
  const crowns:T.BufferGeometry[]=[];
  const phases=Array.from({length:3},()=>random()*Math.PI*2);
  const lobe=(center:T.Vector3,width:number,depth:number)=>{
   const geometry=solidCanopy==='compact'?new T.SphereGeometry(1,7,5):new T.SphereGeometry(1,10,7);
   const position=geometry.getAttribute('position');
   const uv=geometry.getAttribute('uv');
   const colors=new Float32Array(position.count*3);
   const variation=.5+.5*Math.sin(center.x*3.1+center.y*6.3+center.z*7.5);
   for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const ripple=Math.sin(x*6.8+y*3.7+phases[0])*Math.sin(y*7.5-z*5.1+phases[1]);
    const detail=Math.sin(z*12+x*7+phases[2])*Math.sin(x*13-y*4);
    const profile=1+ripple*.17+detail*.075;
    position.setXYZ(i,x*profile,y*profile,z*profile);
    color.setHSL((pine?.275:willow?.217:.245)+variation*.026,pine?.40:.53,.237+variation*.048+(y+1)*.042+ripple*.025+detail*.014);
    colors.set([color.r,color.g,color.b],i*3);
    uv.setXY(i,uv.getX(i)*2+variation,uv.getY(i)+variation*.79);
   }
   geometry.setAttribute('color',new T.BufferAttribute(colors,3));
   geometry.scale(width,depth,width*.92).translate(center.x,center.y,center.z);
   crowns.push(geometry);
  };
  // Build coherent branch-sized clusters, then fill the silhouette with smaller
  // lobes. Every lobe is closed and has the same shape from above or below.
  for(const [i,center] of centers.entries()){
   const taper=pine?1-i/centers.length*.61:1;
   lobe(center,radius*(.34+i%3*.038)*taper,radius*(willow?.51:.33)*taper);
  }
  const satellites=solidCanopy==='compact'?1:2;
  for(const [i,center] of centers.entries()){
   const taper=pine?1-i/centers.length*.61:1;
   for(let j=0;j<satellites;j++){
    const angle=(i*satellites+j)*2.39996;
    const reach=radius*(.19+random()*.25)*taper;
    const point=center.clone().add(new T.Vector3(Math.cos(angle)*reach,(random()-.48)*radius*(willow?.75:.41),Math.sin(angle)*reach));
    const size=radius*(.19+random()*.14)*taper;
    lobe(point,size,size*(willow?1.6:.87));
   }
  }
  const trunk=mergeGeometries(trunks)!,canopy=mergeGeometries(crowns)!;
  canopy.userData.crownLobeIndices=crowns[0].getIndex()!.count;
  for(const part of [...trunks,...crowns])part.dispose();
  return{trunk,leaves:canopy,bark:new T.MeshStandardMaterial({color:birch?0xb6aea1:0x70513a,roughness:.95}),foliage:new T.MeshStandardMaterial({vertexColors:true,roughness:1})};
 }
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
