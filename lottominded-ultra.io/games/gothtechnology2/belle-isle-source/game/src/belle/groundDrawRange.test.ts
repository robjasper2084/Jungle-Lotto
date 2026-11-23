import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {limitGroundDrawRange,orderPavementIndices,type GroundRange} from './groundDrawRange.ts';

test('each camera retains all intersecting triangles in one range and restores the mesh for other observers',()=>{
 for(const order of ['authored','joined pavement'] as const){
  const g=new T.BufferGeometry(),positions:number[]=[],indices:number[]=[];
  for(let row=0;row<30;row++)for(let col=0;col<40;col++){
   const id=indices.length,x=col*19,z=row*52;
   positions.push(x,0,z,x+7,0,z+8,x+14,0,z);indices.push(id,id+1,id+2);
  }
  // A long triangle intersects this view with its centroid several cells away.
  positions.push(-20,0,-50,1800,0,1200,-10,0,-50);indices.push(indices.length,indices.length+1,indices.length+2);
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  const ordered=indices.slice(),position=g.getAttribute('position');
  let bounds:GroundRange[];
  if(order==='joined pavement')bounds=orderPavementIndices(ordered,position);
  else{
   bounds=[];const p=new T.Vector3();
   for(let i=0;i<ordered.length;i+=192){
    const box=new T.Box3(),end=Math.min(ordered.length,i+192);
    for(let j=i;j<end;j++)box.expandByPoint(p.fromBufferAttribute(position,ordered[j]));
    bounds.push([end,box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z]);
   }
  }
  g.setIndex(ordered);
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial());mesh.castShadow=true;mesh.position.set(41,2,-17);mesh.updateMatrixWorld();
  limitGroundDrawRange(mesh,bounds);const rebuilt=Array.from(g.index!.array);
  assert.deepEqual(rebuilt.filter((_,i)=>i%3===0).sort((a,b)=>a-b),indices.filter((_,i)=>i%3===0));
  if(order==='authored')assert.deepEqual(rebuilt,indices);
  const camera=new T.PerspectiveCamera(55,1,.1,450),scene=new T.Scene();
  let smallest=indices.length;for(const angle of [0,1.2,Math.PI,0]){
   camera.position.set(41,5,-17);camera.lookAt(41+Math.sin(angle)*100,1,-17+Math.cos(angle)*100);camera.updateMatrixWorld();
   const args=[{} as T.WebGLRenderer,scene,camera,g,mesh.material,undefined] as unknown as Parameters<typeof mesh.onBeforeRender>;
   mesh.onBeforeRender(...args);
   smallest=Math.min(smallest,g.drawRange.count);
   const submitted=new Set(rebuilt.slice(g.drawRange.start,g.drawRange.start+g.drawRange.count));
   const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld));
   const a=g.getAttribute('position'),vertex=new T.Vector3(),box=new T.Box3();
   for(let i=0;i<indices.length;i+=3){
    box.makeEmpty();for(let n=0;n<3;n++)box.expandByPoint(vertex.fromBufferAttribute(a,indices[i+n]));
    if(frustum.intersectsBox(box))assert(submitted.has(indices[i]),'conservative bounds retain every intersecting triangle');
   }
   const expected={...g.drawRange};mesh.onAfterRender(...args);assert.deepEqual(g.drawRange,{start:0,count:Infinity});
   const other=new T.PerspectiveCamera();
   const shadowArgs=[args[0],scene,other,camera,g,mesh.material,args[5]] as Parameters<typeof mesh.onBeforeShadow>;
   mesh.onBeforeShadow(...shadowArgs);assert.deepEqual(g.drawRange,expected);
   mesh.onAfterShadow(...shadowArgs);assert.deepEqual(g.drawRange,{start:0,count:Infinity});
  }
  assert(smallest<indices.length);mesh.material.dispose();g.dispose();
 }
});
