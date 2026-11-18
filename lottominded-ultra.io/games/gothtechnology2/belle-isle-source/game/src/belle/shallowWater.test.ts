import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inside,ParkTerrain,type ParkMap} from './terrain.ts';
import * as T from 'three';
import {createWater} from './water.ts';
import {SHALLOW_LIMITS,planShallows} from './shallowWater.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('shallow lagoon detail stays bounded, deterministic and inside actual water',()=>{
 const a=planShallows(map);assert.deepEqual(a,planShallows(map));
 assert(a.edges>0&&a.edges<=2100);
 assert.equal(a.points.length,a.edges*12);
 assert.equal(a.index.length,a.edges*6);
 assert(a.stones.length<=115);
 for(const p of a.stones){assert([p.x,p.y,p.z,p.size,p.yaw].every(Number.isFinite));
  assert(map.water.some(w=>inside(p.x,p.z,w.points)&&!w.holes.some(h=>inside(p.x,p.z,h))));}
 assert.equal(SHALLOW_LIMITS.smooth.stones,0);assert(SHALLOW_LIMITS.high.stones>SHALLOW_LIMITS.automatic.stones);
});

test('render-order and transparency keep submerged stones visible through High/Automatic water',()=>{
 const scene=new T.Scene();
 const water=createWater(scene,{} as T.WebGLRenderer,map,new ParkTerrain(map),
  ()=>new T.PlaneGeometry(1,1).rotateX(-Math.PI/2));
 const lagoon=scene.children.find(x=>x.name.startsWith('Lagoon · ')) as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
 const bed=scene.getObjectByName('Submerged lagoon sediment bed') as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const stones=scene.getObjectByName('Visible submerged lagoon stones') as T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const edge=scene.getObjectByName('Lagoon shallow-depth and ripple gradient') as T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 assert(lagoon&&bed&&stones&&edge,'real lagoon layers must exist');
 for(const tier of ['automatic','high']){
  water.setQuality(tier);const p=planShallows(map).stones[0];water.update(p.x,p.z,tier==='high'?1:2);
  assert(lagoon.material.transparent&&lagoon.material.depthWrite===false);
  assert(lagoon.material.depthTest&&lagoon.material.opacity>0&&lagoon.material.opacity<1);
  assert.equal(bed.visible,true);assert.equal(bed.material.transparent,false);
  assert.equal(stones.material.transparent,false);assert(stones.count>0);
  assert(edge.visible&&edge.material.transparent&&!edge.material.depthWrite);
  assert(edge.renderOrder>lagoon.renderOrder,'shallow ripple must be drawn after lagoon refraction');
 }
 water.setQuality('smooth');
 const p=planShallows(map).stones[0];water.update(p.x,p.z,3);
 assert.equal(lagoon.material.transparent,false);
 assert.equal(lagoon.material.depthWrite,true);
 assert.equal(bed.visible,false);assert.equal(edge.visible,false);
 assert.equal(stones.visible,false);
});
