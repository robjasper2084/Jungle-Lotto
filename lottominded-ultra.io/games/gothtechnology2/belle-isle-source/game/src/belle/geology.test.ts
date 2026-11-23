import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {Color,BoxGeometry,InstancedMesh,Matrix4,MeshStandardMaterial,Scene} from 'three';
import {addGeology,planBoulders,MAX_BOULDERS} from './geology.ts';
import {addLivingCanals,planLivingCanals} from './livingCanals.ts';
import {createShoreDetailPool} from './shoreDetail.ts';
import {roadIndex} from './streetPlan.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('mapped rock, canal and shore pools warm their actual color shader before first approach',()=>{
 const scene=new Scene(),terrain=new ParkTerrain(map);
 const layout=planLivingCanals(map,terrain),canals=addLivingCanals(scene,map,terrain),rocks=addGeology(scene,map,terrain);
 const item={x:12,y:3,z:34,yaw:0,sx:1,sy:1,sz:1,color:0x247239};
 const shore=createShoreDetailPool(scene,new BoxGeometry(),new MeshStandardMaterial(),[item],'plants','Shore test');
 const pools=scene.children.filter((object):object is InstancedMesh=>object instanceof InstancedMesh);
 assert.equal(pools.length,9);
 const attributes=pools.map(mesh=>{
  assert.equal(mesh.count,0);assert.equal(mesh.visible,false);
  assert.equal(mesh.instanceColor?.count,mesh.instanceMatrix.count,mesh.name);
  return mesh.instanceColor;
 });
 shore.update(item.x,item.z);canals.update(layout.reeds[0].x,layout.reeds[0].z,0);
 rocks.update(rocks.boulders[0].x,rocks.boulders[0].z);
 assert(pools.find(m=>m.name==='Sheltered canal reeds and sedges')!.count>0);
 assert(pools.some(m=>m.name.startsWith('Clustered mapped mineral boulders')&&m.count>0));
 const bank=pools.find(m=>m.name==='Shore test')!;assert.equal(bank.count,1);
 const actualColor=new Color(),matrix=new Matrix4();bank.getColorAt(0,actualColor);bank.getMatrixAt(0,matrix);
 assert.equal(actualColor.getHex(),item.color);assert.deepEqual(matrix.elements.slice(12,15),[item.x,item.y,item.z]);
 pools.forEach((mesh,i)=>assert.equal(mesh.instanceColor,attributes[i],mesh.name));
});

test('permanently empty mapped pools allocate no color buffer and draw no instances',()=>{
 const terrain=new ParkTerrain(map),scene=new Scene();terrain.land=()=>false;
 const canals=addLivingCanals(scene,map,terrain),rocks=addGeology(scene,map,terrain);
 const shore=createShoreDetailPool(scene,new BoxGeometry(),new MeshStandardMaterial(),[],'rocks','Empty shore');
 canals.update(0,0,0);rocks.update(0,0);shore.update(0,0);
 assert.equal(rocks.boulders.length,0);
 for(const mesh of scene.children){
  assert(mesh instanceof InstancedMesh);assert.equal(mesh.count,0);assert.equal(mesh.instanceColor,null);
 }
});
test('natural rock clusters are finite, deterministic, and do not block mapped ride shoulders',()=>{
 const terrain=new ParkTerrain(map),original=JSON.stringify(map),rocks=planBoulders(map,terrain),compare=planBoulders(map,terrain);
 assert.deepEqual(rocks,compare);
 assert.equal(JSON.stringify(map),original);
 assert(rocks.length>=12&&rocks.length<=MAX_BOULDERS,'should form bounded natural clusters');
 const occupied=roadIndex(map.roads);
 for(const b of rocks){
  assert(terrain.land(b.x,b.z));
  assert(!terrain.obstructed(b.x,b.z,b.radius+.3));
  assert(!occupied(b.x,b.z,'',9+b.radius),'geology cannot enter protected racing and pathway corridors');
  assert([b.x,b.z,b.y,b.radius,b.height,b.yaw].every(Number.isFinite));
  assert(b.radius>=.7&&b.radius<=1.56);
 }
});
test('new mineral obstacles join real on-foot and flight collision with no terrain height changes',()=>{
 const terrain=new ParkTerrain(map),rock=planBoulders(map,terrain)[0];
 assert(rock,'expected at least one rock');
 const before=terrain.height(rock.x,rock.z);
 terrain.registerBoulders([{x:rock.x,z:rock.z,bottom:rock.y,top:rock.y+rock.height,radius:rock.radius*.78}]);
 assert(terrain.obstructed(rock.x,rock.z,.15),'footpath and rider collision must reject the rock');
 const hit=terrain.raycastFlight({x:rock.x-4,y:rock.y+rock.height*.5,z:rock.z},{x:1,y:0,z:0},8,.2);
 assert(hit!==null&&hit<6,'rider and camera rays must see the solid');
 assert.equal(terrain.height(rock.x,rock.z),before,'geology never edits the existing ground/collision surface');
});
