import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BuildingEntranceIndex,createBuildingEntrance} from './buildingEntrances.ts';
import {batchStaticGroup} from './static-batch.ts';
const block={id:'one',points:[[0,0],[20,0],[20,12],[0,12],[0,0]]};
const road={points:[[-30,-12],[50,-12]],kind:'residential',width:8};

test('entry faces its street for either polygon winding, with or without a closing point',()=>{
 for(const points of [block.points,[...block.points].reverse(),block.points.slice(0,-1)]){
  const b={...block,points},entry=new BuildingEntranceIndex([road],[b]).entrance(b,18,()=>2)!;
  assert(entry);assert.equal(entry.z,0);assert(Math.abs(entry.nx)<1e-8);assert.equal(entry.nz,-1);assert.equal(entry.y,2.04);
  assert(Math.abs(entry.x-10)<.01);assert(entry.y+entry.height<18);
 }
});

test('adjacent buildings hide party-wall doors; exposed frontage is chosen instead',()=>{
 const attached={id:'two',points:[[-2,-8],[22,-8],[22,0],[ -2,0],[-2,-8]]};
 const east={points:[[30,-30],[30,40]],kind:'secondary',width:8};
 const entry=new BuildingEntranceIndex([road,east],[block,attached]).entrance(block,12,()=>0)!;
 assert(entry);assert.equal(entry.x,20);assert.equal(entry.nx,1);assert(Math.abs(entry.nz)<1e-8);
});

test('a sloping threshold clears local ground and a steep or short frontage is omitted',()=>{
 const index=new BuildingEntranceIndex([road],[block]),entry=index.entrance(block,18,x=>2+x*.05)!;
 assert(entry);assert(entry.y>=2+(entry.x+1.15)*.05);
 assert.equal(index.entrance(block,2,()=>0),undefined);
 assert.equal(index.entrance(block,10,()=>Number.NaN),undefined);
});

test('landlocked buildings retain a clear fallback without accepting elevated bridges as street access',()=>{
 const east={points:[[30,-30],[30,40]],kind:'residential',width:8};
 const index=new BuildingEntranceIndex([{...road,bridge:true},east],[block]);
 assert.equal(index.entrance(block,18,()=>0)!.x,20);
 assert(new BuildingEntranceIndex([],[block]).entrance(block,18,()=>0));
});

test('entry geometry stays in its one ground-floor bay and shares static materials',()=>{
 const index=new BuildingEntranceIndex([road],[block]),entry=index.entrance(block,18,()=>0)!;
 const materials={stone:new T.MeshStandardMaterial(),door:new T.MeshStandardMaterial(),metal:new T.MeshStandardMaterial()};
 const root=createBuildingEntrance(entry,materials,block.id),bounds=new T.Box3().setFromObject(root);
 assert(Math.abs(bounds.min.y-entry.y)<1e-6);assert(bounds.max.y<entry.y+3.01);
 assert(bounds.min.x>=entry.x-1.21&&bounds.max.x<=entry.x+1.21);
 assert(bounds.max.z<.001,'all faces sit outside the opaque building wall');
 let triangles=0;root.traverse(o=>{if(o instanceof T.Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.equal(o.castShadow,false);assert(Object.values(materials).includes(o.material as T.MeshStandardMaterial));}});
 assert(triangles<=100,'entry does not introduce a heavyweight model');
 const tile=new T.Group();tile.add(root,createBuildingEntrance({...entry,x:entry.x+15},materials,'next'));batchStaticGroup(tile);
 let draws=0;tile.traverse(o=>{if(o instanceof T.Mesh)draws++;});assert.equal(draws,3,'doors consolidate to three shared material batches per tile');
});
