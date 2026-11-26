import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {addStreetDetails} from './streetDetails.ts';
import type {StreetBox,StreetPlan} from './streetPlan.ts';

function canvasFixture(){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const context={fillRect(){},strokeRect(){},fillText(){},measureText(text:string){return{width:text.length*10};}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(name:string){assert.equal(name,'canvas');return{width:0,height:0,getContext:()=>context};}}});
 return()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');};
}
function dispose(scene:T.Scene){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
 scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
 for(const g of geometries)g.dispose();for(const m of materials){(m as T.MeshStandardMaterial).map?.dispose();m.dispose();}
}
function shippedPlan():StreetPlan{
 const meta=JSON.parse(readFileSync(new URL('../../public/belle/street-details.json',import.meta.url),'utf8')) as StreetPlan&{stride:number;materials:StreetBox['material'][]};
 const bytes=readFileSync(new URL('../../public/belle/street-details.bin',import.meta.url));
 // Pin the actual audited input independently of the newly indexed factory.
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'9660caa782604b0a9e1b4f472208532c2597563ed9e5794801e645a0b4e1fc1b');
 const floats=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);meta.boxes=[];
 for(let i=0;i<floats.length;i+=meta.stride)meta.boxes.push({x:floats[i],y:floats[i+1],z:floats[i+2],w:floats[i+3],h:floats[i+4],l:floats[i+5],yaw:floats[i+6],material:meta.materials[floats[i+7]],grade:floats[i+8]});
 return meta;
}
function expandedBits(attribute:T.BufferAttribute,index:T.BufferAttribute|null){
 assert(attribute.array instanceof Float32Array);
 const original=new Uint32Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.length);
 if(!index)return original;
 const expanded=new Uint32Array(index.count*attribute.itemSize);
 for(let i=0;i<index.count;i++)for(let c=0;c<attribute.itemSize;c++)expanded[i*attribute.itemSize+c]=original[index.getX(i)*attribute.itemSize+c];
 return expanded;
}
const bytesOf=(array:Uint32Array|Float32Array|Float64Array)=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
function receipt(scene:T.Scene){
 const streams=createHash('sha256'),bounds=createHash('sha256'),signs=createHash('sha256'),states=createHash('sha256'),materials=new Map<T.Material|T.Material[],number>();
 let vertices=0,indices=0,tiles=0,indexBytes=0,maxVertices=0,negativeZeros=0;
 for(const mesh of scene.children){
  assert(mesh instanceof T.Mesh);
  const geometry=mesh.geometry,isTile=mesh.name.startsWith('Street detail '),target=isTile?streams:signs;
  target.update(mesh.name+'\0');
  for(const [name,attribute] of Object.entries(geometry.attributes)){
   assert(attribute instanceof T.BufferAttribute);
   target.update(name+'\0');const expanded=expandedBits(attribute,geometry.index);target.update(bytesOf(expanded));
   for(const bits of expanded)if(bits===0x80000000)negativeZeros++;
  }
  if(mesh instanceof T.InstancedMesh)target.update(bytesOf(mesh.instanceMatrix.array as Float32Array));
  if(isTile){
   assert(geometry.index?.array instanceof Uint16Array);
   tiles++;vertices+=geometry.attributes.position.count;indices+=geometry.index.count;indexBytes+=geometry.index.array.byteLength;maxVertices=Math.max(maxVertices,geometry.attributes.position.count);
   const sphere=geometry.boundingSphere;assert(sphere);bounds.update(mesh.name+'\0');bounds.update(bytesOf(Float64Array.from([...sphere.center.toArray(),sphere.radius])));
  }
  const material=mesh.material;if(!materials.has(material))materials.set(material,materials.size);
  states.update(JSON.stringify({name:mesh.name,material:materials.get(material),cast:mesh.castShadow,receive:mesh.receiveShadow,layers:mesh.layers.mask,renderOrder:mesh.renderOrder,visible:mesh.visible,position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray(),scale:mesh.scale.toArray(),groups:geometry.groups,drawRange:{start:geometry.drawRange.start,count:geometry.drawRange.count===Infinity?'Infinity':geometry.drawRange.count}}));
 }
 return{tiles,vertices,indices,indexBytes,maxVertices,negativeZeros,streams:streams.digest('hex'),bounds:bounds.digest('hex'),signs:signs.digest('hex'),states:states.digest('hex')};
}

test('indexed shipped streets expand to the independently captured original triangle stream and bounds',()=>{
 const restore=canvasFixture(),scene=new T.Scene();
 try{
  const stats=addStreetDetails(scene,shippedPlan()),result=receipt(scene);
  // Golden receipts were captured from the unchanged factory at repository
  // commit 6518764b9735f78bdc95ec6227d0ba26ba291b48 with Three 0.185.1.
  // They cover every source tile and expanded Float32 position/normal bit,
  // original Float64 sphere, signs/posts, material sharing and object state.
  // npm test requires no Git objects or online baseline fetch.
  assert.deepEqual(result,{
   tiles:429,vertices:1187024,indices:2031258,indexBytes:4062516,maxVertices:54804,negativeZeros:349746,
   streams:'56d7957913e56f8b379bb86f7a143b27470bcce0c00a6a04bdd34c6b0e433a7d',
   bounds:'ec16694eecf04031272107176287e1427ecc1f7a18168469369b8aced2b3811b',
   signs:'156e3fd2b23b36a3b9edaf6a30d70cb31b2db6221c5a3620e604e5159402667d',
   states:'62055c8cf00184cfea7e3c7f30cc095f4a200c1963dbf1ec6f63f7f8e86b6110'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(stats)),{batches:432,signs:55,boxes:46034,atlas:[1024,2048]});
  console.log(JSON.stringify({streetIndexProof:'original expanded Float32 bits and Float64 bounds',originalVertices:2031258,indexedVertices:result.vertices,triangles:result.indices/3,attributeBytes:result.vertices*24,indexBytes:result.indexBytes}));
 }finally{dispose(scene);restore();}
});

test('primitive selection, material identity, input order and the original 440 metre tile boundary remain intact',()=>{
 const restore=canvasFixture(),scene=new T.Scene();
 try{
  const box=(x:number,h:number,material:StreetBox['material']='curb'):StreetBox=>({x,y:2.12,z:20,w:1,h,l:4,yaw:-.37,grade:.08,material});
  // These three heights select top-only, original box, and chamfered extrusion.
  const boxes=[box(20,.029999),box(40,.03),box(60,.030001),box(276,.15),box(20,.012,'yellow')],plan:StreetPlan={boxes,signs:[],stats:{},notes:[]};
  const input=JSON.stringify(plan),street=addStreetDetails(scene,plan);assert.equal(JSON.stringify(plan),input);
  const first=scene.getObjectByName('Street detail 0,0,curb') as T.Mesh,second=scene.getObjectByName('Street detail 1,0,curb') as T.Mesh,yellow=scene.getObjectByName('Street detail 0,0,yellow') as T.Mesh;
  assert(first&&second&&yellow);assert.equal(first.material,second.material);assert.notEqual(first.material,yellow.material);
  assert.equal(first.geometry.attributes.position.count,4+24+76);assert.equal(first.geometry.index!.count,6+36+132);
  const index=first.geometry.index!,positions=first.geometry.attributes.position;
  for(const [start,count,center] of [[0,6,20],[6,36,40],[42,132,60]])for(let i=start;i<start+count;i++)assert(Math.abs(positions.getX(index.getX(i))-center)<3,'Input box order and triangle blocks must remain intact');
  assert.equal(first.castShadow,false);assert.equal(first.receiveShadow,true);assert.equal(first.geometry.groups.length,0);assert.deepEqual(first.geometry.drawRange,{start:0,count:Infinity});
  street.update(128+440,128);assert.equal(first.visible,false);street.update(128+440-1e-8,128);assert.equal(first.visible,true);street.update(2000,2000);assert.equal(first.visible,false);assert.equal(second.visible,false);
  assert.equal(scene.children.length,6,'Three original street tiles, sign front/back, and instanced posts');
 }finally{dispose(scene);restore();}
});

test('indexed street raycasts retain exact hit values, winding and triangle indices',()=>{
 const restore=canvasFixture(),scene=new T.Scene();
 try{
  const boxes:StreetBox[]=[{material:'curb',x:20,y:2.1,z:20,w:.3,h:.15,l:4,yaw:-.37,grade:.08},{material:'curb',x:25,y:2.1,z:20,w:.3,h:.15,l:6,yaw:.71,grade:-.12},{material:'white',x:20,y:2.1,z:276,w:.3,h:.012,l:4,yaw:0,grade:0}];
  addStreetDetails(scene,{boxes,signs:[],stats:{},notes:[]});scene.updateMatrixWorld(true);
  const ray=new T.Raycaster(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let comparisons=0,addressChanges=0;
  for(const source of scene.children){
   if(!(source instanceof T.Mesh)||!source.name.startsWith('Street detail '))continue;
   const geometry=source.geometry,index=geometry.index!;const expanded=geometry.toNonIndexed(),reference=new T.Mesh(expanded,source.material);reference.updateMatrixWorld(true);
   try{
    for(let i=0;i<index.count;i+=9){
     a.fromBufferAttribute(geometry.attributes.position,index.getX(i));b.fromBufferAttribute(geometry.attributes.position,index.getX(i+1));c.fromBufferAttribute(geometry.attributes.position,index.getX(i+2));
     const center=a.clone().add(b).add(c).multiplyScalar(1/3),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(!normal.lengthSq())continue;
     ray.set(center.addScaledVector(normal,2),normal.negate());
     const original:T.Intersection[]=ray.intersectObject(reference,false),indexed:T.Intersection[]=ray.intersectObject(source,false);
     const fields=(hits:T.Intersection[])=>hits.map(hit=>({distance:hit.distance,point:hit.point.toArray(),normal:hit.normal?.toArray(),faceIndex:hit.faceIndex,faceNormal:hit.face!.normal.toArray(),materialIndex:hit.face!.materialIndex,uv:hit.uv?.toArray(),barycoord:hit.barycoord?.toArray()}));
     assert.deepEqual(fields(indexed),fields(original));assert(original.length>0);
     for(let j=0;j<original.length;j++)if(original[j].face!.a!==indexed[j].face!.a||original[j].face!.b!==indexed[j].face!.b||original[j].face!.c!==indexed[j].face!.c)addressChanges++;
     comparisons++;
    }
   }finally{expanded.dispose();}
  }
  assert(comparisons>=20);assert(addressChanges>0,'Vertex-address fields change while triangle faceIndex and physical hits remain exact');
 }finally{dispose(scene);restore();}
});

test('larger authored tiles choose Uint32 before the reserved 65535 restart index',()=>{
 const restore=canvasFixture(),scene=new T.Scene();
 try{
  const box:StreetBox={material:'white',x:20,y:2.1,z:20,w:.2,h:.012,l:4,yaw:0,grade:0};
  addStreetDetails(scene,{boxes:Array.from({length:16384},()=>({...box})),signs:[],stats:{},notes:[]});
  const tile=scene.getObjectByName('Street detail 0,0,white') as T.Mesh;
  assert.equal(tile.geometry.attributes.position.count,65536);assert.equal(tile.geometry.index!.count,98304);assert(tile.geometry.index!.array instanceof Uint32Array);
  assert.equal(Math.max(...tile.geometry.index!.array),65535);
  assert.equal(tile.geometry.index!.count/3,32768);
 }finally{dispose(scene);restore();}
});
