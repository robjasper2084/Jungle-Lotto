import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {finalizeStaticLocalMatrix} from './staticLocalMatrix.ts';
import {addStreetDetails} from './streetDetails.ts';
import {addWoodlandFloor} from './woodland.ts';
import {addParkFacilities} from './parkFacilities.ts';
import type {ParkMap} from './terrain.ts';
import type {StreetPlan,StreetBox} from './streetPlan.ts';

const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
function streetPlan():StreetPlan{
 const meta=JSON.parse(readFileSync(new URL('../../public/belle/street-details.json',import.meta.url),'utf8')) as StreetPlan&{stride:number;materials:StreetBox['material'][]};
 const bytes=readFileSync(new URL('../../public/belle/street-details.bin',import.meta.url));
 const floats=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
 meta.boxes=[];
 for(let i=0;i<floats.length;i+=meta.stride)meta.boxes.push({x:floats[i],y:floats[i+1],z:floats[i+2],w:floats[i+3],h:floats[i+4],l:floats[i+5],yaw:floats[i+6],material:meta.materials[floats[i+7]],grade:floats[i+8]});
 return meta;
}
function canvasFixture(){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const context={fillRect(){},strokeRect(){},fillText(){},measureText(text:string){return{width:text.length*10};}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(name:string){assert.equal(name,'canvas');return{width:0,height:0,getContext:()=>context};}}});
 return()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');};
}
function dispose(scene:T.Scene){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
 scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.BatchedMesh)o.dispose();}});
 for(const g of geometries)g.dispose();for(const m of materials){(m as T.MeshStandardMaterial).map?.dispose();m.dispose();}
}
function compareWorldMatrices(scene:T.Scene,update:(x:number,z:number)=>void){
 const objects=[...scene.children];assert(objects.length>0);
 assert(objects.every(o=>!o.matrixAutoUpdate&&o.matrixWorldAutoUpdate),'Only local composition is frozen; world updates remain native');
 let compositions=0;
 for(const object of objects){const original=object.updateMatrix;object.updateMatrix=function(){compositions++;return original.call(this);};}
 const camera=new T.PerspectiveCamera(60,1.6,.1,10000);
 let eager=0,optimized=0;
 for(const [x,z,yaw] of [[0,0,0],[460,880,.23],[2000,1900,-.71],[4300,-230,1.1],[0,0,0]]){
  update(x,z);scene.position.set(x*.001,2,z*.001);scene.rotation.y=yaw;scene.scale.set(1.01,.99,1.03);
  camera.position.set(x+5,12,z+7);camera.lookAt(x,2,z);camera.updateMatrixWorld(true);
  const visible=objects.map(o=>o.visible);
  compositions=0;scene.updateMatrixWorld(true);optimized+=compositions;
  const frozen=objects.map(o=>({local:o.matrix.elements.slice(),world:o.matrixWorld.elements.slice(),view:new T.Matrix4().multiplyMatrices(camera.matrixWorldInverse,o.matrixWorld).elements.slice(),normal:new T.Matrix3().getNormalMatrix(new T.Matrix4().multiplyMatrices(camera.matrixWorldInverse,o.matrixWorld)).elements.slice()}));
  // Compare the same real authored objects against native eager composition.
  for(const o of objects)o.matrixAutoUpdate=true;
  compositions=0;scene.updateMatrixWorld(true);eager+=compositions;
  for(const [i,o] of objects.entries()){
   const view=new T.Matrix4().multiplyMatrices(camera.matrixWorldInverse,o.matrixWorld);
   assert.deepEqual(o.matrix.elements,frozen[i].local,o.name+' local');
   assert.deepEqual(o.matrixWorld.elements,frozen[i].world,o.name+' world');
   assert.deepEqual(view.elements,frozen[i].view,o.name+' view');
   assert.deepEqual(new T.Matrix3().getNormalMatrix(view).elements,frozen[i].normal,o.name+' normal');
   assert.equal(o.visible,visible[i]);o.matrixAutoUpdate=false;
  }
 }
 assert.equal(optimized,0);assert.equal(eager,objects.length*5);
 return{objects:objects.length,eager,optimized};
}

test('finalized authored local matrices retain nonidentity parent transforms and native raycasts',()=>{
 const parent=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial());
 mesh.position.set(2,1,-4);mesh.rotation.y=.3;mesh.scale.set(.9,1.1,1.2);
 parent.add(finalizeStaticLocalMatrix(mesh));
 for(const x of [0,3,-7]){
  parent.position.x=x;parent.rotation.y=x*.1;parent.updateMatrixWorld(true);
  const world=mesh.matrixWorld.clone(),center=mesh.getWorldPosition(new T.Vector3());
  const ray=new T.Raycaster(center.clone().add(new T.Vector3(0,10,0)),new T.Vector3(0,-1,0));
  const hits=ray.intersectObject(mesh).map(h=>[h.distance,...h.point.toArray(),h.faceIndex]);assert(hits.length>0);
  mesh.matrixAutoUpdate=true;parent.updateMatrixWorld(true);assert.deepEqual(mesh.matrixWorld.elements,world.elements);
  assert.deepEqual(ray.intersectObject(mesh).map(h=>[h.distance,...h.point.toArray(),h.faceIndex]),hits);mesh.matrixAutoUpdate=false;
 }
 mesh.geometry.dispose();mesh.material.dispose();
});

test('shipped street, woodland and facilities retain exact matrices through real visibility updates',()=>{
 const restore=canvasFixture(),street=new T.Scene(),wood=new T.Scene(),facilities=new T.Scene(),multi=new T.Scene();
 try{
  const plan=streetPlan(),streets=addStreetDetails(street,plan);addWoodlandFloor(wood,map);
  const parks=addParkFacilities(facilities,map,false);
  const subset={...map,facilities:{version:1 as const,notes:'',sites:[],gates:[],fences:([20,600] as const).map(x=>({id:String(x),a:[x,20] as [number,number],b:[x+4,20] as [number,number],height:1.3,style:'stone' as const}))}};
  const batched=addParkFacilities(multi,subset,true);assert(multi.children.some(o=>o instanceof T.BatchedMesh));
  const rows=[compareWorldMatrices(street,streets.update),compareWorldMatrices(wood,()=>{}),compareWorldMatrices(facilities,parks.update),compareWorldMatrices(multi,batched.update)];
  const total=rows.reduce((n,r)=>n+r.objects,0);assert(total>100,'Use real shipped scenery, not a trivial synthetic fixture');
  console.log(JSON.stringify({measurement:'native local matrix compositions in five renderer-style scene updates',street:rows[0],woodland:rows[1],facilities:rows[2],multiDrawFixture:rows[3],totalStaticObjects:total}));
 }finally{restore();for(const scene of [street,wood,facilities,multi])dispose(scene);}
});
