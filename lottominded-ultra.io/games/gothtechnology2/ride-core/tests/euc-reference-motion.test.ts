import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crashLimb,CRASH_KINDS} from '../src/kimodoCrash.ts';
import {KIMODO_CRASHES} from '../src/kimodoCrashData.ts';
import {createPose} from '../src/controller.ts';
import {stanceTargets} from '../src/riderMotion.ts';
import {stanceTargets as swoopTargets} from '../../swoop-source/src/detroit/riderMotion.ts';

test('each impact leaves elbow travel to absorb contact and mirrors the whole limb',()=>{
 for(let kind=1;kind<=CRASH_KINDS.length;kind++){
  const contact=KIMODO_CRASHES[CRASH_KINDS[kind-1]].contact;
  for(let arm=0;arm<2;arm++){
   const a=crashLimb(kind,contact+.10,arm,1),b=crashLimb(kind,contact+.10,1-arm,-1);
   assert(Math.hypot(a.x,a.y,a.z)<=.861,'bracing elbow must not lock straight');
   assert.equal(a.x,-b.x);assert.equal(a.y,b.y);assert.equal(a.z,b.z);
  }
  let previous=crashLimb(kind,0,0,1);
  for(let frame=1;frame<=600;frame++){
   const next=crashLimb(kind,frame/600,0,1);
   assert(Object.values(next).every(Number.isFinite));
   assert(Math.hypot(next.x-previous.x,next.y-previous.y,next.z-previous.z)<.08,'impact brace must blend without a hand pop');
   previous=next;
  }
 }
});

test('drop anticipation softens the knees and reaches the hands before landing absorption',()=>{
 const p=createPose();p.speed=7;
 const riding=stanceTargets(p);
 p.landingAnticipation=1;const approach=stanceTargets(p);
 assert(approach.drop>riding.drop+.04,'pre-load knees before contact');
 assert(approach.pitch>riding.pitch+.02,'hinge the chest with the hips');
 assert(approach.hands.every((hand,i)=>hand.y>riding.hands[i].y+.025&&hand.z>riding.hands[i].z+.04));
 p.landingAnticipation=0;p.landingCompression=1;const landing=stanceTargets(p);
 assert(landing.drop>approach.drop+.10,'contact needs more knee compression than anticipation');
 assert(landing.hands.every((hand,i)=>hand.y>approach.hands[i].y+.03));
});

test('Swoop and shared Royale/Elmwood articulation agree through a landing and a turn reversal',()=>{
 const p=createPose();p.speed=7;
 for(let frame=0;frame<=240;frame++){
  p.rollAngle=Math.sin(frame/30)*.5;p.turnIntent=Math.sin(frame/30)*.8;
  p.landingAnticipation=Math.max(0,1-Math.abs(frame-60)/30);
  p.landingCompression=Math.max(0,1-Math.abs(frame-120)/40);
  assert.deepEqual(swoopTargets(p),stanceTargets(p));
 }
});
