import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GEO,profileLevel,BRIDGE_LEVELS,cutWidth} from './geo-profile.ts';
import {pointOnCut} from './geography.ts';
import {completeBridges,bridgeFrame} from './bridges.ts';
import {heightAt} from './world.ts';
import {batchStaticGroup} from './static-batch.ts';

const parts=completeBridges(heightAt);
test('all rendered decks and beams keep full-width headroom through the entire crossing',()=>{
  for(const b of BRIDGE_LEVELS){
    const group=new T.Group(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
    for(const p of parts.filter(m=>m.bridge===b.name))group.add(new T.Mesh(p.geometry,material));
    batchStaticGroup(group);group.updateMatrixWorld(true);let hits=0;
    for(let d=b.start-3;d<=b.end+3;d+=.5)for(let lane=-1;lane<=1.001;lane+=.25){
      const p=pointOnCut(d,lane*cutWidth(d)/2),floor=heightAt(p.x,p.z);
      const hit=new T.Raycaster(new T.Vector3(p.x,floor+.1,p.z),new T.Vector3(0,1,0),0,15).intersectObject(group,true)[0];
      if(!hit)continue;hits++;assert.ok(hit.distance+.1>=b.minClearance,`${b.name}: low rendered structure at ${d}, lane ${lane}: ${hit.distance+.1}m`);
    }
    assert.ok(hits>20,`${b.name}: bridge missing from audit`);
  }
});
test('every crossing has both bank supports and edge protection, not just a slab',()=>{
  for(const b of GEO.bridges){
    const f=bridgeFrame(b),objects=parts.filter(m=>m.bridge===b.name);
    for(const kind of ['deck','roadway','abutment','parapet','sidewalk','beam'])assert.ok(objects.some(m=>m.kind===kind),b.name+' missing '+kind);
    const supports=objects.find(m=>m.kind==='abutment')!.geometry.attributes.position;
    const xs=Array.from({length:supports.count},(_,i)=>f.project(supports.getX(i),supports.getZ(i))[0]);
    assert.ok(Math.min(...xs)<-7&&Math.max(...xs)>7,b.name+' needs support on both banks');
    const rail=objects.find(m=>m.kind==='parapet')!.geometry.attributes.position;
    const zs=Array.from({length:rail.count},(_,i)=>f.project(rail.getX(i),rail.getZ(i))[1]);
    assert.ok(Math.min(...zs)<f.near+.5&&Math.max(...zs)>f.far-.5,b.name+' needs both parapets');
    assert.ok(objects.every(m=>Array.from(m.geometry.attributes.position.array).every(Number.isFinite)),b.name+' invalid vertices');
  }
});

test('bridge tops and underpasses remain closed surfaces after static batching',()=>{
  for(const b of GEO.bridges){
    const objects=parts.filter(m=>m.bridge===b.name),group=new T.Group(),material=new T.MeshStandardMaterial();
    for(const m of objects)group.add(new T.Mesh(m.geometry,material));
    batchStaticGroup(group);group.updateMatrixWorld(true);
    const f=bridgeFrame(b),top=profileLevel(b.at,'street');
    for(const z of [f.near+1,(f.near+f.far)/2,f.far-1]){
      const p=f.point((f.lo+f.hi)/2,z);
      const down=new T.Raycaster(new T.Vector3(p.x,top+2,p.z),new T.Vector3(0,-1,0),0,3);
      assert.ok(down.intersectObject(group,true).length,b.name+' hole in roadway');
      const up=new T.Raycaster(new T.Vector3(p.x,top-2,p.z),new T.Vector3(0,1,0),0,3);
      assert.ok(up.intersectObject(group,true).length,b.name+' hole in soffit');
    }
  }
});

test('the outer ends of both approaches join the bank surface',()=>{
  for(const b of GEO.bridges){
    const approach=parts.find(m=>m.bridge===b.name&&m.kind==='approach');if(!approach)continue;
    const f=bridgeFrame(b),p=approach.geometry.attributes.position;
    const coords=Array.from({length:p.count},(_,i)=>({...f.project(p.getX(i),p.getZ(i)),i}));
    for(const extreme of [Math.min(...coords.map(c=>c[0])),Math.max(...coords.map(c=>c[0]))]){
      const edge=coords.filter(c=>Math.abs(c[0]-extreme)<.04);
      assert.ok(edge.some(c=>Math.abs(p.getY(c.i)-heightAt(p.getX(c.i),p.getZ(c.i)))<.08),b.name+' floating approach edge');
    }
  }
});
