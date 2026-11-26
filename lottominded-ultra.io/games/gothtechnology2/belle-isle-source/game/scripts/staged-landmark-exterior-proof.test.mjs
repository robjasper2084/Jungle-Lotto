import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ParkTerrain} from '../src/belle/terrain.ts';
import {STUDY_SITES} from '../src/belle/stagedLandmarkStudies.ts';
import {readStagedExterior,readStagedRouteGround} from '../src/belle/stagedLandmarkGroundFit.ts';
import {createExteriorPlanner,assertExteriorEvidence} from './staged-landmark-exterior-proof.mjs';

const map=JSON.parse(await readFile(new URL('../public/belle/map.json',import.meta.url),'utf8'));
const terrain=new ParkTerrain(map),root=new T.Group();
for(const spec of STUDY_SITES){
 const raw=await readFile(new URL('../public/belle/staged-architecture/'+spec.files[0],import.meta.url)),{scene}=await new GLTFLoader().parseAsync(Uint8Array.from(raw).buffer,'');
 const lod=new T.LOD();lod.name=spec.id+'_STAGED_LODS';lod.position.set(spec.center[0],2,spec.center[1]);lod.rotation.y=spec.yaw;lod.addLevel(scene,0);root.add(lod);
}
root.updateMatrixWorld(true);
const world=(cfg,u,v)=>({x:cfg.center[0]+Math.cos(cfg.yaw)*u-Math.sin(cfg.yaw)*v,z:cfg.center[1]-Math.sin(cfg.yaw)*u-Math.cos(cfg.yaw)*v});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('both real buildings have two opposite complete-model viewpoints reachable on original terrain in both viewports',async()=>{
 for(const layout of['desktop','phone'])for(const spec of STUDY_SITES){
  const camera=new T.PerspectiveCamera(60,layout==='phone'?390/844:1280/800,.08,22000),read=readStagedExterior(root,spec.id,camera);
  const cfg=spec.id==='107227742'?map.aquarium:map.conservatory,queryGround=points=>readStagedRouteGround(terrain,points);
  const planner=await createExteriorPlanner({bounds:read.bounds,camera:read.camera,layout,queryGround});
  // Exact observed native dismount coordinates from run 45882624790. No
  // synthetic pose is supplied to a browser: this is route geometry only.
  let start=spec.id==='107227742'?world(cfg,-.68,-44):world(cfg,-24,.68);
  const front=spec.id==='107227742'?Math.atan2(Math.sin(cfg.yaw),Math.cos(cfg.yaw)):Math.atan2(-Math.cos(cfg.yaw),Math.sin(cfg.yaw));
  const bearings=[];
  for(const bearing of[front+Math.PI/4,front+Math.PI*1.25]){
   const route=await planner.route(start,bearing).catch(error=>{throw Error(`${layout} ${spec.id} bearing ${bearing}: ${error.message}`,{cause:error});});assert(route.halfMetreSamples>0);assert(route.waypoints.length>=2);
   // Check every compressed segment independently; diagonal or corner shortcuts
   // cannot pass just because their grid endpoints are on dry land.
   let previous=start;
   for(const point of route.waypoints){
    const count=Math.max(1,Math.ceil(distance(previous,point)/.25));
    for(let i=0;i<=count;i++){
     const x=previous.x+(point.x-previous.x)*i/count,z=previous.z+(point.z-previous.z)*i/count;
     assert(terrain.land(x,z,2)&&!terrain.obstructed(x,z,.7),`${layout} ${spec.id} original obstruction at ${x},${z}`);
    }
    previous=point;
   }
   const end=route.endpoint,center=new T.Vector3().fromArray(read.bounds.center);
   camera.position.set(end.x,terrain.height(end.x,end.z,2)+1.55,end.z);camera.lookAt(center);camera.updateMatrixWorld(true);
   assert(readStagedExterior(root,spec.id,camera).completeBoundsInFrame,layout+' actual full model must fit');
   bearings.push(Math.atan2(end.x-center.x,end.z-center.z));start=end;
  }
  const delta=Math.abs(Math.atan2(Math.sin(bearings[1]-bearings[0]),Math.cos(bearings[1]-bearings[0])));assert(delta>=Math.PI*.8);
 }
});

test('a sub-grid thin collision wall is found by independent edge samples and cannot create a false connected route',async()=>{
 const planner=await createExteriorPlanner({bounds:{min:[-1,0,-1],max:[1,2,1],center:[0,1,0]},camera:{fov:60,aspect:1.6},layout:'desktop',
  queryGround:points=>points.map(p=>({...p,height:2,walkable:Math.abs(p.x-2.17)>.3}))});
 await assert.rejects(planner.route({x:-5,z:0},Math.PI/2),/No connected|could not pass/);
});

function evidence(){
 const report={groundFit:{structuralReceiptPassed:true},captures:[],exteriorViews:[],exteriorLegs:[],nativeEvidence:{events:[],held:[],focusLossDuringInput:[],overflow:false}};
 const events=report.nativeEvidence.events;events.push({type:'click',target:'#start',trusted:true});
 for(const [landmark,text]of[['Belle Isle Aquarium','Travel to entrance'],['Anna Scripps Whitcomb Conservatory','Travel to path']])events.push({type:'click',landmark,text,trusted:true});
 for(const code of['KeyW','KeyF','KeyV'])for(const type of['keydown','keyup'])events.push({type,code,trusted:true});
 for(const id of['107227742','107310050'])for(const [i,bearing]of[0,Math.PI].entries()){
  const name=id+'-'+i,frame={completeBoundsInFrame:true,selectedLevels:[0]};
  report.exteriorViews.push({id,name,bearing,before:frame,after:frame});report.captures.push({id,name,bytes:5000,sha256:'fixture'});
  for(const type of['pointerdown','pointermove','pointerup'])events.push({type,phase:name+'-aim',trusted:true});
 }
 const before={frames:1,actor:{x:0,z:0,onFoot:true}},after={frames:10,actor:{x:5,z:0,onFoot:true}};
 report.exteriorLegs.push({name:'real-leg',before,after,trace:[before,after],goal:{x:5,z:0},ground:[{walkable:true,planningClearance:.7}],maxLateral:.41});
 for(const type of['keydown','keyup'])events.push({type,code:'KeyW',phase:'real-leg',trusted:true});return report;
}
test('exterior acceptance requires actual PNGs, opposite views and every real actor/native-input leg',()=>{
 assert.doesNotThrow(()=>assertExteriorEvidence(evidence()));
 for(const change of[
  r=>r.captures.pop(),r=>r.exteriorViews[1].bearing=0,r=>r.exteriorViews[0].before={completeBoundsInFrame:false,selectedLevels:[0]},
  r=>r.exteriorViews[0].after={completeBoundsInFrame:true,selectedLevels:[0,1]},r=>r.nativeEvidence.events[0].trusted=false,
  r=>r.exteriorLegs[0].after.frames=1,r=>r.exteriorLegs[0].after.actor.x=0,r=>r.exteriorLegs[0].trace[1].actor.onFoot=false,
  r=>r.exteriorLegs[0].trace.splice(1,0,{frames:3,actor:{x:1,z:2,onFoot:true}}),r=>r.exteriorLegs[0].after.actor.z=2,
  r=>r.nativeEvidence.events=r.nativeEvidence.events.filter(e=>e.phase!=='real-leg'),r=>r.nativeEvidence.events=r.nativeEvidence.events.filter(e=>e.type!=='pointermove'),
  r=>r.groundFit.structuralReceiptPassed=false,r=>r.nativeEvidence.focusLossDuringInput.push({reason:'blur'}),
 ]){const candidate=evidence();change(candidate);assert.throws(()=>assertExteriorEvidence(candidate));}
});
