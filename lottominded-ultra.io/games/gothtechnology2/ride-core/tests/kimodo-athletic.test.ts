import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Quaternion,Vector3} from 'three';
import {KIMODO_ATHLETIC,sampleAthletic,sampleSmoothSprint} from '../src/kimodoAthletic.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import type {TerrainSampler} from '../src/terrain.ts';

test('Kimodo source provenance, finite normalized captures and closed sprint/crouch loops',()=>{
 for(const [name,clip]of Object.entries(KIMODO_ATHLETIC.clips)){
  const source=readFileSync(new URL(`../art/kimodo-athletic/${name}/motion.npz`,import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),clip.sourceSha256);
  for(const row of clip.frames){assert(row.every(Number.isFinite));for(const k of [0,3,6,9,12,15,18,21,38,41])assert(Math.abs(new Vector3().fromArray(row,k).length()-1)<.00001);for(const k of [30,34,47])assert(Math.abs(new Quaternion().fromArray(row,k).length()-1)<.00001);}
  if(clip.loop){assert.deepEqual(clip.frames[0],clip.frames.at(-1));for(const phase of [0,.25,.5,.75])assert.deepEqual(sampleAthletic(name as 'sprint',phase),sampleAthletic(name as 'sprint',phase+1));}
 }
 const sprint=KIMODO_ATHLETIC.clips.sprint.frames;
 const elbow=sprint.map(row=>new Vector3().fromArray(row,12).angleTo(new Vector3().fromArray(row,15)));
 assert(Math.max(...elbow)>1.2,'Sprint needs a visibly bent driving elbow');
 assert(Math.max(...sprint.map(row=>row[2]))>.5,'Sprint needs forward knee drive');
 const duck=KIMODO_ATHLETIC.clips.duck.frames;
 assert(duck.at(-1)![45]<-.32,'Duck must lower the pelvis');
});

test('on-foot lean eases, releases, respects cover, and leaves position and wheel unchanged',()=>{
 let obstructed=false;
 const terrain:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>obstructed?0:null};
 const c=new RideController(terrain),step=(n:number,extra={})=>{for(let i=0;i<n;i++)c.step(1/120,{...NEUTRAL_ACTIONS,...extra});};
 step(1,{dismount:true});step(100);const p=c.poseValue,origin=[p.x,p.y,p.z,p.parkX,p.parkY,p.parkZ];
 step(1,{lean:-1});assert(p.footLean<0&&p.footLean>-.2);step(100,{lean:-1});assert(p.footLean<-.99);
 assert.deepEqual([p.x,p.y,p.z,p.parkX,p.parkY,p.parkZ],origin);
 obstructed=true;step(100,{lean:-1});assert(Math.abs(p.footLean)<.001);
 obstructed=false;step(100,{lean:1});assert(p.footLean>.99);step(100);assert(Math.abs(p.footLean)<.001);
 step(100,{lean:1,prone:true});assert(Math.abs(p.footLean)<.001);
});

test('fitted sprint removes the unequal half-stride and samples smoothly across the loop seam',()=>{
 for(let i=0;i<128;i++){
  const row=sampleSmoothSprint(i/128),opposite=sampleSmoothSprint(i/128+.5);
  assert(row.every(Number.isFinite));
  for(const k of [0,3,6,9,12,15,18,21,38,41])assert(Math.abs(new Vector3().fromArray(row,k).length()-1)<1e-10);
  for(const k of [30,34,47])assert(Math.abs(new Quaternion().fromArray(row,k).length()-1)<1e-10);
  for(const k of [0,3,12,15])for(let axis=0;axis<3;axis++)assert(Math.abs(row[k+axis]-opposite[k+6+axis]*(axis===0?-1:1))<1e-10);
  assert(Math.abs(row[44]+opposite[44])<1e-10);
  assert(Math.abs(row[45]-opposite[45])<1e-10);
  assert(Math.abs(row[26])<.6&&Math.abs(row[29])<.6);
 }
 const h=1e-6,before=sampleSmoothSprint(-h),at=sampleSmoothSprint(0),after=sampleSmoothSprint(h);
 for(let k=0;k<at.length;k++)assert(Math.abs((at[k]-before[k])/h-(after[k]-at[k])/h)<.01,'sprint loop velocity should not pop');
});
