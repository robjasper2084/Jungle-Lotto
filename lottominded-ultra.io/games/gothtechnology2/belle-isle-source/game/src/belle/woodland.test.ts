import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import type {ParkMap,Point} from './terrain.ts';
import {addWoodlandFloor} from './woodland.ts';
import {surfaceKind} from './realisticMaterialRules.ts';

const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
type Area=ParkMap['areas'][number];

/** Independent pre-batching construction, including the authored polygon order. */
function originalGeometry(areas:readonly Area[]){
 return areas.filter(a=>a.kind==='wood'||a.kind==='forest').map(a=>{
  const shape=new T.Shape(a.points.map(([x,z])=>new T.Vector2(x,-z)));
  for(const hole of a.holes??[])shape.holes.push(new T.Path(hole.map(([x,z])=>new T.Vector2(x,-z))));
  return new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,2.006,0);
 });
}

/** Expand indices so a changed triangle, winding, order or vertex value changes the bytes. */
function expandedBytes(geometries:readonly T.BufferGeometry[],name:string){
 const arrays=geometries.map(g=>{
  const attribute=g.getAttribute(name) as T.BufferAttribute;
  assert.ok(attribute.array instanceof Float32Array);
  const count=g.index?.count??attribute.count,values=new Float32Array(count*attribute.itemSize);
  for(let i=0;i<count;i++){
   const vertex=g.index?g.index.getX(i):i,start=vertex*attribute.itemSize;
   values.set(attribute.array.subarray(start,start+attribute.itemSize),i*attribute.itemSize);
  }
  return Buffer.from(values.buffer);
 });
 return Buffer.concat(arrays);
}

function assertTriangles(actual:T.BufferGeometry,expected:readonly T.BufferGeometry[]){
 const names=Object.keys(expected[0].attributes).sort();
 assert.deepEqual(Object.keys(actual.attributes).sort(),names);
 assert.equal(actual.index!.count,expected.reduce((count,g)=>count+g.index!.count,0));
 for(const name of names){
  const attribute=actual.getAttribute(name),reference=expected[0].getAttribute(name);
  assert.equal(attribute.itemSize,reference.itemSize,name+' component count');
  assert.equal(attribute.normalized,reference.normalized,name+' normalization');
  assert.deepEqual(expandedBytes([actual],name),expandedBytes(expected,name),name+' triangle bytes');
 }
 assert.deepEqual(actual.groups,[]);
 assert.deepEqual(actual.drawRange,{start:0,count:Infinity});
}

function collectFloorSources(scene:T.Scene){
 const sources:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]=[];
 scene.addEventListener('childadded',event=>{
  if(event.child instanceof T.Mesh&&event.child.name.startsWith('Woodland leaf litter '))sources.push(event.child);
 });
 return sources;
}

function compiled(material:T.Material){
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
 material.onBeforeCompile(shader as Parameters<T.Material['onBeforeCompile']>[0],{} as T.WebGLRenderer);
 return shader;
}

test('full mapped woodland joins into one draw without changing authored triangle or attribute bytes',()=>{
 const scene=new T.Scene(),before=JSON.stringify(map),expected=originalGeometry(map.areas),sources=collectFloorSources(scene);
 let originalShader:ReturnType<typeof compiled>|undefined,originalCompile:T.Material['onBeforeCompile']|undefined;
 scene.addEventListener('childadded',event=>{
  if(event.child instanceof T.Mesh&&event.child.name.startsWith('Woodland leaf litter ')&&!originalShader){
   originalShader=compiled(event.child.material);originalCompile=event.child.material.onBeforeCompile;
  }
 });
 addWoodlandFloor(scene,map);
 assert.equal(sources.length,expected.length);
 assert.ok(sources.length>1,'the actual map exercises a merge');
 assert.equal(scene.children.length,1);
 const mesh=scene.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 assertTriangles(mesh.geometry,expected);
 assert.equal(JSON.stringify(map),before,'display construction does not mutate map or collision inputs');

 const bounds=new T.Box3(),points:T.Vector3[]=[];
 for(const geometry of expected){
  geometry.computeBoundingBox();bounds.union(geometry.boundingBox!);
  const position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++)points.push(new T.Vector3().fromBufferAttribute(position,i));
 }
 assert.ok(mesh.geometry.boundingBox!.equals(bounds));
 assert.ok(mesh.geometry.boundingSphere!.equals(new T.Sphere().setFromPoints(points)));
 assert.ok(mesh.matrix.equals(new T.Matrix4()));
 assert.ok(mesh.matrixWorld.equals(new T.Matrix4()));
 assert.equal(mesh.visible,true);assert.equal(mesh.frustumCulled,true);
 assert.equal(mesh.receiveShadow,true);assert.equal(mesh.castShadow,false);assert.equal(mesh.renderOrder,0);
 assert.equal(mesh.layers.mask,1);assert.equal(mesh.parent,scene);

 const material=sources[0].material;
 assert.ok(sources.every(source=>source.material===material));
 assert.equal(mesh.material,material,'the exact original material owns the merged draw');
 assert.equal(material.name,'Flatwoods forest floor');assert.equal(material.color.getHex(),0x69694a);
 assert.equal(material.roughness,1);assert.equal(material.metalness,0);assert.equal(material.side,T.FrontSide);
 assert.equal(material.transparent,false);assert.equal(material.opacity,1);
 assert.equal(material.depthWrite,true);assert.equal(material.depthTest,true);
 assert.equal(material.customProgramCacheKey(),'flatwoods-leaf-litter-v1');
 assert.equal(material.onBeforeCompile,originalCompile);
 assert.deepEqual(compiled(material),originalShader,'batching retains the original shader bytes and uniforms');
 assert.equal(mesh.onBeforeRender,T.Object3D.prototype.onBeforeRender);
 assert.equal(mesh.onBeforeShadow,T.Object3D.prototype.onBeforeShadow);
 expected.forEach(g=>g.dispose());
});

test('original and joined woodland names retain leaf surface dressing rather than timber',()=>{
 const scene=new T.Scene(),sources=collectFloorSources(scene);addWoodlandFloor(scene,map);
 assert.ok(sources.length>1);assert.equal(scene.children.length,1);
 const joined=scene.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 assert.equal(joined.name,'Woodland leaf litter · joined patches');
 for(const mesh of [...sources,joined]){
  assert.equal(mesh.material.name,'Flatwoods forest floor');
  assert.equal(surfaceKind(mesh.material.name,mesh.name,mesh.material.metalness),'leaf',mesh.name+' must keep the original leaf texture/profile');
 }
});

const rectangle=(x:number,z:number,w:number,h:number):Point[]=>[[x,z],[x+w,z],[x+w,z+h],[x,z+h],[x,z]];
const area=(id:string,kind:string,points:Point[],holes?:Point[][]):Area=>({id,name:id,kind,points,...(holes?{holes}:{})});
const withAreas=(areas:Area[]):ParkMap=>({...map,areas});

test('synthetic water hole remains open while merged dry ground, separation and ignored kinds are preserved',()=>{
 const areas=[area('wood-with-water','wood',rectangle(0,0,12,12),[rectangle(3,3,6,6)]),
  area('forest','forest',rectangle(20,0,5,5)),area('water','water',rectangle(30,0,5,5))];
 const scene=new T.Scene(),input=withAreas(areas),before=JSON.stringify(input),expected=originalGeometry(areas);
 addWoodlandFloor(scene,input);scene.updateMatrixWorld(true);
 const mesh=scene.children[0] as T.Mesh;
 assert.equal(scene.children.length,1);assertTriangles(mesh.geometry,expected);
 const original=expected.map(g=>new T.Mesh(g,new T.MeshBasicMaterial()));
 const down=new T.Vector3(0,-1,0);
 for(const [x,z,dry] of [[1,1,true],[11,6,true],[6,6,false],[21,1,true],[16,2,false],[31,1,false],[-1,1,false]] as const){
  const ray=new T.Raycaster(new T.Vector3(x,10,z),down),hits=ray.intersectObject(mesh);
  assert.equal(hits.length>0,dry,`ground at ${x}, ${z}`);
  assert.deepEqual(hits.map(hit=>hit.point.toArray()),ray.intersectObjects(original).map(hit=>hit.point.toArray()));
  for(const hit of hits)assert.equal(hit.point.y,Math.fround(2.006));
 }
 assert.equal(JSON.stringify(input),before);
 expected.forEach(g=>g.dispose());
});

test('batching only consumes new woodland patches and leaves other scene geometry intact',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),geometry=new T.PlaneGeometry(1,1);
 const unrelated=[new T.Mesh(geometry,material),new T.Mesh(geometry,material)];scene.add(...unrelated);
 const input=withAreas([area('a','wood',rectangle(0,0,2,2)),area('b','forest',rectangle(4,0,2,2))]);
 addWoodlandFloor(scene,input);
 assert.equal(scene.children.length,3);
 for(const mesh of unrelated){assert.equal(mesh.parent,scene);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);}
});

test('empty and non-woodland maps add no floor meshes',()=>{
 for(const areas of [[],[area('lawn','grass',rectangle(0,0,2,2)),area('lake','water',rectangle(4,0,2,2))]]){
  const scene=new T.Scene(),existing=new T.Group();scene.add(existing);
  addWoodlandFloor(scene,withAreas(areas));assert.deepEqual(scene.children,[existing]);
 }
});

test('one woodland patch retains its source mesh and original indexed geometry',()=>{
 const scene=new T.Scene(),sources=collectFloorSources(scene),input=withAreas([area('single','forest',rectangle(0,0,10,10),[rectangle(3,3,4,4)])]);
 const expected=originalGeometry(input.areas);addWoodlandFloor(scene,input);
 assert.equal(sources.length,1);assert.deepEqual(scene.children,sources);
 const mesh=sources[0];assert.equal(mesh.name,'Woodland leaf litter single');
 assertTriangles(mesh.geometry,expected);
 assert.equal(mesh.geometry.boundingBox,null);assert.equal(mesh.geometry.boundingSphere,null);
 assert.equal(mesh.receiveShadow,true);assert.equal(mesh.castShadow,false);
 assert.ok(mesh.matrix.equals(new T.Matrix4()));assert.equal(mesh.material.customProgramCacheKey(),'flatwoods-leaf-litter-v1');
 assert.equal(surfaceKind(mesh.material.name,mesh.name,mesh.material.metalness),'leaf');
 expected.forEach(g=>g.dispose());
});
