import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,ShaderMaterial} from 'three';
import {SmokeView} from './smokeView.ts';
import {smokeRadius} from '../../../../ride-core/src/royale/smoke.ts';

test('smoke keeps authoritative bounds, soft growth and shared resources through its lifetime',()=>{
 const view=new SmokeView(),c={id:'test',owner:'r',p:{x:3,y:5,z:7},start:0,end:1080};
 view.update([c],0,false);const cloud=view.children[0] as Mesh<never,ShaderMaterial>;
 assert(!cloud.visible);view.update([c],60,false);assert(cloud.visible);
 assert.equal(cloud.scale.x,smokeRadius(c,60));assert.equal(cloud.position.y,c.p.y+1.4);
 const geometry=cloud.geometry,noise=cloud.material.uniforms.volumeNoise.value;
 view.update([c,{...c,id:'other'}],90,false);assert.equal(view.children.length,2);
 const other=view.children[1] as Mesh<never,ShaderMaterial>;
 assert.equal(other.geometry,geometry);assert.equal(other.material.uniforms.volumeNoise.value,noise);
 let disposed=false;cloud.material.addEventListener('dispose',()=>disposed=true);
 view.update([],1080,false);assert(disposed);assert.equal(view.children.length,0);view.dispose();
});

test('reduced motion freezes smoke turbulence while low graphics retains the same cover volume',()=>{
 const view=new SmokeView(),c={id:'test',owner:'r',p:{x:0,y:0,z:0},start:0,end:1080};
 view.update([c],120,true,16);const cloud=view.children[0] as Mesh<never,ShaderMaterial>,scale=cloud.scale.toArray();
 assert.equal(cloud.material.uniforms.time.value,0);assert.equal(cloud.material.uniforms.steps.value,16);
 view.update([c],240,true,28);assert.equal(cloud.material.uniforms.time.value,0);assert.deepEqual(cloud.scale.toArray(),scale);
 view.update([c],240,false);assert(cloud.material.uniforms.time.value>0);assert.deepEqual(cloud.scale.toArray(),scale);view.dispose();
});
