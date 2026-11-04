import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {applySlideSeat} from './slideSeat.ts';
function rig(x:number,y:number,z:number,heading:number){
 const root=new T.Group(),rider=new T.Group(),hips=new T.Bone();root.position.set(x,y,z);root.rotation.y=heading;root.add(rider);rider.add(hips);hips.position.y=1;
 const limb=(side:number,arm:boolean)=>{const upper=new T.Bone(),knee=new T.Bone(),foot=new T.Bone();hips.add(upper);upper.position.set(side*(arm?.22:.14),arm?.48:0,0);upper.add(knee);knee.position.y=arm?-.32:-.43;knee.add(foot);foot.position.y=arm?-.30:-.42;return{upper,knee,foot,target:new T.Vector3(),rotation:new T.Quaternion()};};
 const legs=[limb(1,false),limb(-1,false)],arms=[limb(1,true),limb(-1,true)],bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];rider.traverse(o=>{if(o instanceof T.Bone)bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});root.updateMatrixWorld(true);return{root,rider,hips,legs,arms,bones,motionScale:1};
}
test('seated hands and feet stay at the rider at distant island coordinates',()=>{
 for(const heading of [0,.8,Math.PI,-2.3]){
  const local=rig(0,0,0,heading),world=rig(1370,14,910,heading);
  applySlideSeat(local,heading,1);applySlideSeat(world,heading,1);
  for(const [i,chain]of [...world.legs,...world.arms].entries()){
   const p=chain.foot.getWorldPosition(new T.Vector3()).sub(world.root.position),q=[...local.legs,...local.arms][i].foot.getWorldPosition(new T.Vector3());
   assert.ok(p.distanceTo(q)<1e-8,'pose must be invariant under world translation');
   assert.ok(p.y>.10&&p.y<.5,'hands/feet remain beside the mat, not above shoulders or under it');
   assert.ok(Math.hypot(p.x,p.z)<1,'limbs stay next to the rider');
  }
  for(const b of world.bones)if(b.o!==world.hips)assert.ok(b.o.position.distanceTo(b.p)<1e-10,'posing must not resize imported bones');
 }
});
