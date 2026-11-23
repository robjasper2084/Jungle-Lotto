import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain} from '../../belle-isle-source/game/src/belle/terrain.ts';
import {planDetroitProps} from '../../belle-isle-source/game/src/belle/detroitProps.ts';
import {RideCore} from '../../belle-isle-source/game/runtime/ride-core/src/ridecore.ts';
import {districts} from '../../belle-isle-source/game/src/belle/detroitGround.ts';
import {portalStates,macarthurAnchorPair} from '../src/connectionMath.ts';

const map=JSON.parse(readFileSync(new URL('../../belle-isle-source/game/public/belle/map.json',import.meta.url)));
const terrain=new ParkTerrain(map,true);
test('both loaded crossings are physically supported and an unloaded host stays closed',()=>{
 const host={routes:districts.routes,terrain,pavementReady:true};
 assert.ok(portalStates(host).every(p=>p.connected));
 assert.ok(portalStates({...host,pavementReady:false}).every(p=>!p.connected));
 const a=macarthurAnchorPair();
 assert.ok(Math.hypot(a.mainland.x-map.bridge.a[0],a.mainland.z-map.bridge.a[1])<.02);
 assert.ok(Math.hypot(a.island.x-map.bridge.b[0],a.island.z-map.bridge.b[1])<.02);
});
test('East Jefferson supports a rider on the street and another on the lower greenway',()=>{
 const [x,z]=districts.cut;
 const deck=terrain.height(x,z,2),trail=terrain.height(x,z,-4);
 assert.ok(deck-trail>4,'street and trail must have independent levels');
 assert.ok(terrain.land(x,z,deck)&&terrain.land(x,z,trail));
});
test('all six supplied scenery sources have dry placements and renderable meshes',()=>{
 const placed=planDetroitProps(terrain);
 const modelRoot=new URL('../../belle-isle-source/game/src/belle/districtModels/',import.meta.url);
 function nodes(name){
  const bytes=readFileSync(new URL(name+'.glb',modelRoot));
  assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.length,bytes.readUInt32LE(8));
  const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  return doc.nodes.filter(n=>n.mesh!==undefined).map(n=>n.name);
 }
 const packed=nodes('detroit-scenery');
 for(const type of ['ParkBin','CityFacade','GrassTuft','Wildflower','Gull','Driftwood']){
  const points=placed.get(type);assert.ok(points?.length,type+' is missing');
  assert.ok(packed.includes(type+'__LOD0'));assert.ok(points.every(p=>terrain.land(p.x,p.z)),type+' in water');
 }
 assert.equal(nodes('street-at-sunset').filter(n=>n.startsWith('SunsetBlock')).length,4);
});
function resample(points){
 const path=[points[0]];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.5);
  for(let j=1;j<=steps;j++)path.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
 }
 return path;
}
for(const [name,line] of Object.entries(districts.routes))for(const reverse of [false,true]){
 test(name+' full RideCore crossing '+(reverse?'return':'outbound'),()=>{
  const path=resample(reverse?line.toReversed():line),[x,z]=path[0];
  const core=new RideCore(terrain,{spawn:{position:{x,y:terrain.height(x,z),z},headingY:Math.atan2(path[1][0]-x,path[1][1]-z)}});
  let near=0,idle=0;
  for(let t=0;t<70000;t++){
   const pose=core.current,distance=i=>Math.hypot(pose.x-path[i][0],pose.z-path[i][1]);
   let next=near;
   for(let j=near;j<Math.min(near+12,path.length);j++)if(distance(j)<=distance(next))next=j;
   if(next>=path.length-2&&distance(path.length-1)<2.2)return;
   idle=near===next?idle+1:0;near=next;assert.ok(idle<450,'stalled near '+path[near]);
   const target=path[Math.min(near+4,path.length-1)];
   const yaw=Math.atan2(target[0]-pose.x,target[1]-pose.z)-pose.headingY;
   const error=Math.atan2(Math.sin(yaw),Math.cos(yaw)),speed=Math.abs(error)>.5?2.3:6;
   const {events}=core.advance(1/30,{throttle:Math.max(-.45,Math.min(1,(speed-pose.speed)*.8+.08)),steer:Math.max(-.78,Math.min(.78,-error*2.2))});
   assert.ok(!events.some(e=>e.type==='crash'),'crash near '+path[near]);
  }
  assert.fail('Never arrived at the destination');
 });
}
