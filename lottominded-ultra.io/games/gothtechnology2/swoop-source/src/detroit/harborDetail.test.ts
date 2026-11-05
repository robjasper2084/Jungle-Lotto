import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import data from './harbor-data.json' with {type:'json'};
import {buildHarbor} from './harbor.ts';
import {harborMoorings} from './harborDetail.ts';
import {DOCK_TOP,DOCK_WIDTH} from './harborLayout.ts';
import type {SceneryWorld} from './sceneryWorld.ts';

test('detailed docks retain every original flat riding surface and batch small fittings',()=>{
 const scene=new T.Group(),surfaces:Float32Array[]=[];
 buildHarbor({addRideSurface:(vertices:Float32Array)=>surfaces.push(vertices)} as unknown as SceneryWorld,()=>scene);
 const segments=data.ways.filter(w=>w.tags.man_made==='pier').reduce((n,w)=>n+w.points.length-1,0);
 assert.equal(surfaces.length,segments);
 for(const vertices of surfaces)for(let i=1;i<vertices.length;i+=3)assert.ok(Math.abs(vertices[i]-DOCK_TOP)<1e-6);
 assert.ok(scene.children.length<45,'decorations should be instanced, not one draw per plank or fastener');
 for(const name of ['Milliken Harbor dock decking','Harbor rubber fenders','Round timber mooring piles','Harbor plank fasteners']){
  const mesh=scene.getObjectByName(name) as T.InstancedMesh;
  assert.ok(mesh?.isInstancedMesh);assert.ok(mesh.count>0);assert.ok(mesh.boundingSphere&&Number.isFinite(mesh.boundingSphere.radius));
 }
 const decking=scene.getObjectByName('Milliken Harbor dock decking') as T.InstancedMesh;
 assert.ok(decking.instanceColor);const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
 decking.getMatrixAt(0,m);m.decompose(p,q,s);assert.ok(Math.abs(s.x-DOCK_WIDTH)<1e-6);
});

test('mooring ropes stay on the outside edge of the pier rather than crossing the riding aisle',()=>{
 const piers=data.ways.filter(w=>['59202738','59202739'].includes(w.id));
 const distance=(p:T.Vector3)=>Math.min(...piers.map(w=>{
  const [a,b]=w.points,dx=b[0]-a[0],dz=b[1]-a[1];return Math.abs((p.x-a[0])*dz-(p.z-a[1])*dx)/Math.hypot(dx,dz);
 }));
 for(const line of harborMoorings()){
  assert.ok(distance(line.cleat)>1.0);assert.ok(distance(line.stern)>2);
  for(let t=0;t<=1;t+=.1)assert.ok(distance(line.cleat.clone().lerp(line.stern,t))>=1,'central two-metre riding aisle remains clear');
 }
});
