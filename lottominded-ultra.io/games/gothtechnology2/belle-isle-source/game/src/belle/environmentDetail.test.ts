import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SHORE_BUDGETS,visibleWithHysteresis} from './environmentDetail.ts';
import {createShoreDetailPool,type ShoreInstance} from './shoreDetail.ts';

test('landmark visibility stays stable inside a culling dead band',()=>{
 let visible=true;
 for(const distance of [99,101,104,98,109]){visible=visibleWithHysteresis(distance,100,visible,10);assert(visible);}
 visible=visibleWithHysteresis(111,100,visible,10);assert.equal(visible,false);
 for(const distance of [109,101,99,91]){visible=visibleWithHysteresis(distance,100,visible,10);assert.equal(visible,false);}
 assert(visibleWithHysteresis(89,100,visible,10));assert.equal(visibleWithHysteresis(Infinity,100,true),false);
});
test('shore pools keep a fixed draw/instance budget and stop drawing far from the bank',()=>{
 const scene=new T.Scene(),instances:ShoreInstance[]=Array.from({length:2200},(_,i)=>({x:(i%40)-20,y:2,z:Math.floor(i/40)-28,yaw:0,sx:1,sy:1,sz:1,color:0x667744}));
 const pool=createShoreDetailPool(scene,new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial(),instances,'rocks','test bank');
 const mesh=scene.children[0] as T.InstancedMesh;
 for(const quality of ['smooth','automatic','high'] as const){pool.setQuality(quality);pool.update(0,0);assert.equal(mesh.count,SHORE_BUDGETS[quality].rocks);assert.equal(scene.children.length,1);assert(mesh.visible);}
 pool.update(10000,10000);assert.equal(mesh.count,0);assert.equal(mesh.visible,false);
});
test('stationary and small camera moves do not reupload shore instance transforms',()=>{
 const scene=new T.Scene(),pool=createShoreDetailPool(scene,new T.PlaneGeometry(),new T.MeshStandardMaterial(),[{x:0,y:2,z:0,yaw:0,sx:1,sy:1,sz:1,color:0x667744}],'plants','test grass');
 const mesh=scene.children[0] as T.InstancedMesh;pool.update(0,0);const version=mesh.instanceMatrix.version;
 for(let x=0;x<8;x+=.25)pool.update(x,0);
 assert.equal(mesh.instanceMatrix.version,version);
 pool.update(8,0);assert(mesh.instanceMatrix.version>version);
});
