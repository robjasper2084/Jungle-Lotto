import test from 'node:test';
import assert from 'node:assert/strict';
import type {WebGLRenderer} from 'three';
import {installRoutePassCensus} from './routePassCensus.ts';
function fixture(){const ledger:unknown[][]=[],marker={};let target:object|null=null,fail=false;
 const info={render:{calls:0,triangles:0,lines:0,points:0}};
 const renderer={info,getRenderTarget:()=>target,renderBufferDirect(this:unknown,...args:unknown[]){ledger.push([this,...args]);if(fail)throw marker;info.render.calls+=1;info.render.triangles+=6;return marker;}};
 const probe=installRoutePassCensus(renderer as unknown as WebGLRenderer);
 const obj={id:7,name:'MacArthur',parent:{name:'Bridge'}},mat={id:3,name:'steel',type:'MeshStandardMaterial'};
 const draw=(scene:object|null)=>renderer.renderBufferDirect({},scene,{},mat,obj,null);
 return {probe,renderer,draw,ledger,marker,target:(v:object|null)=>{target=v;},fail:()=>{fail=true;}};
}
const loc={sample:1,frameMs:20,renderMs:4,x:440,z:800,place:'Landing'};
test('real calls retain receiver, arguments and result; separate shadow, screen and offscreen accounting',()=>{
 const f=fixture();f.probe.reset();f.probe.begin(true);
 assert.equal(f.draw(null),f.marker);assert.equal(f.draw({}),f.marker);f.target({});f.draw({});
 f.probe.accept(loc);const row=f.probe.report().rows[0];
 for(const p of ['shadow','screen','offscreen'] as const){assert.equal(row.passes[p].calls,1);assert.equal(row.passes[p].triangles,6);assert.equal(row.top[p][0].object,'MacArthur');}
 assert.equal(row.invalid,0);assert.equal(f.ledger.length,3);assert.equal(f.ledger[0][0],f.renderer);
 row.passes.shadow.calls=99;assert.equal(f.probe.report().rows[0].passes.shadow.calls,1);
});
test('sampling skips three eligible attempts, never observes ineligible draws, and cancels rejected rows',()=>{
 const f=fixture();f.probe.begin(false);f.draw({});f.probe.accept(loc);assert.equal(f.probe.report().rows.length,0);
 f.probe.begin(true);f.draw({});f.probe.cancel();f.probe.accept(loc);
 for(let i=0;i<3;i++){f.probe.begin(true);f.draw({});f.probe.accept(loc);}
 assert.equal(f.probe.report().rows.length,0);assert.equal(f.probe.report().discarded,1);
 f.probe.begin(true);f.draw({});f.probe.accept({...loc,sample:5});assert.equal(f.probe.report().rows[0].sample,5);
});
test('native errors propagate unchanged and invalid counter deltas do not look like successful counts',()=>{
 const f=fixture();f.probe.begin(true);f.fail();assert.throws(()=>f.draw({}),e=>e===f.marker);f.probe.accept(loc);
 assert.equal(f.probe.report().rows[0].invalid,1);assert.equal(f.probe.report().rows[0].passes.screen.calls,0);
 const g=fixture();g.renderer.info.render.triangles=NaN;g.probe.begin(true);g.draw({});g.probe.accept(loc);assert.equal(g.probe.report().rows[0].invalid,1);
});
