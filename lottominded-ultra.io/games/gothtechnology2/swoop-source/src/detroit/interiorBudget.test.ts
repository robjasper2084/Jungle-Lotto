import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {visibleSceneryMatrices} from '@digital-static/ridecore';
import {batchStaticGroup} from './static-batch.ts';
import {interiorVisibility,interiorVisitorsVisible} from './interiorBudget.ts';
import {useThinDisplayGlass} from './displayGlass.ts';
import {readFileSync} from 'node:fs';

test('enclosed interiors use hysteresis and remain visible during visits',()=>{
 assert.equal(interiorVisibility(84,false),true);
 assert.equal(interiorVisibility(90,false),false);
 assert.equal(interiorVisibility(90,true),true);
 assert.equal(interiorVisibility(101,true),false);
 assert.equal(interiorVisibility(300,false,true),true);
 assert.equal(interiorVisitorsVisible(44,false),true);
 assert.equal(interiorVisitorsVisible(50,false),false);
 assert.equal(interiorVisitorsVisible(50,true),true);
 assert.equal(interiorVisitorsVisible(56,true),false);
 assert.equal(interiorVisitorsVisible(300,false,true),true);
});

test('static frame batching preserves world bounds on a hidden translated room and keeps glass separate',()=>{
 const scene=new T.Scene(),room=new T.Group();scene.add(room);room.position.set(45,8,-23);room.rotation.y=.7;room.scale.setScalar(1.2);
 visibleSceneryMatrices(room);const brass=new T.MeshStandardMaterial({color:0xbba26b}),glass=new T.MeshPhysicalMaterial({transparent:true,opacity:.1});
 const frames:T.Mesh[]=[];
 for(let i=0;i<16;i++){const frame=new T.Group();frame.position.set(i%4*2,Math.floor(i/4),i*.02);frame.rotation.y=i*.08;room.add(frame);
  for(let j=0;j<4;j++){const m=new T.Mesh(new T.BoxGeometry(.03,1,.04),brass);m.position.x=j*.25;frame.add(m);frames.push(m);}}
 const pane=new T.Mesh(new T.PlaneGeometry(2,2),glass);room.add(pane);
 const hidden=new T.Mesh(new T.BoxGeometry(8,1,8),brass);hidden.visible=false;hidden.name='Hidden removed roof';room.add(hidden);
 room.updateWorldMatrix(true,true);const before=new T.Box3();for(const m of frames)before.union(new T.Box3().setFromObject(m,true));
 room.visible=false;batchStaticGroup(room,{opaqueOnly:true});
 const batched=room.children.filter((o):o is T.Mesh=>(o as T.Mesh).isMesh&&(o as T.Mesh).material===brass&&o.visible);
 assert.equal(batched.length,1);assert.equal(batched[0].geometry.index!.count,frames.length*36);
 const after=new T.Box3().setFromObject(batched[0],true);assert.ok(before.min.distanceTo(after.min)<.0001);assert.ok(before.max.distanceTo(after.max)<.0001);
 assert.equal(pane.parent,room);assert.equal(hidden.parent,room);assert.equal(hidden.visible,false);assert.equal(room.visible,false);
 assert.equal(batched[0].material,brass);
});

test('animated characters and morph meshes are never merged into furnishings',()=>{
 const room=new T.Group(),mat=new T.MeshStandardMaterial();
 const rig=new T.SkinnedMesh(new T.BoxGeometry(),mat),morph=new T.Mesh(new T.BoxGeometry(),mat);
 morph.geometry.morphAttributes.position=[morph.geometry.attributes.position.clone()];room.add(rig,morph);
 batchStaticGroup(room,{opaqueOnly:true});assert.equal(rig.parent,room);assert.equal(morph.parent,room);assert.equal(room.children.length,2);
});

test('different GPU attribute types cannot enter the same static batch',()=>{
 const room=new T.Group(),mat=new T.MeshStandardMaterial(),meshes=[0,1].map(i=>{const g=new T.BoxGeometry();(g.attributes.position as T.BufferAttribute).gpuType=i?T.IntType:T.FloatType;const m=new T.Mesh(g,mat);room.add(m);return m;});
 batchStaticGroup(room,{opaqueOnly:true});assert.equal(room.children.length,2);for(const m of meshes)assert.equal(m.parent,room);
});

test('supplied Penny display glazing retains alpha and tint without a scene-wide transmission pass',()=>{
 const bytes=readFileSync(new URL('../../public/exports/atwater/penny-exchange.glb',import.meta.url));
 const glb=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const source=glb.materials.find((m:any)=>m.name==='Auction display glass'),pbr=source.pbrMetallicRoughness;
 const glass=new T.MeshPhysicalMaterial({color:new T.Color(...pbr.baseColorFactor.slice(0,3) as [number,number,number]),opacity:pbr.baseColorFactor[3],transparent:true,transmission:source.extensions.KHR_materials_transmission.transmissionFactor,roughness:pbr.roughnessFactor});
 const tint=glass.color.clone(),opaque=new T.MeshStandardMaterial(),root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(),glass),new T.Mesh(new T.BoxGeometry(),glass),new T.Mesh(new T.BoxGeometry(),opaque));
 assert.equal(useThinDisplayGlass(root),1);assert.equal(glass.transmission,0);assert.equal(glass.opacity,pbr.baseColorFactor[3]);assert.ok(glass.color.equals(tint));assert.equal(glass.roughness,pbr.roughnessFactor);assert.equal(glass.depthWrite,false);assert.equal(opaque.transparent,false);assert.equal(useThinDisplayGlass(root),0);
});
