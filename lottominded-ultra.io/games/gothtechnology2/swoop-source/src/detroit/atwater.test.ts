import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cityPoint} from './atwater.ts';
import {SPOTS,locationAt,terrainChunks} from './world.ts';
import {roadAt} from './geography.ts';
import {FallMotion} from './fallMotion.ts';
import {createPose} from './controller.ts';
test('default start is on mapped Atwater facing the georeferenced skyline',()=>{
 const p=SPOTS[0],skyline=cityPoint(42.3298,-83.0397);
 assert.equal(roadAt(p.x,p.z)?.name,'Atwater Street');assert.equal(locationAt(p.x,p.z),'Atwater Street');
 const bearing=Math.atan2(skyline.x-p.x,skyline.z-p.z);assert.ok(Math.abs(bearing-p.heading)<.2);
 const chunks=terrainChunks();for(let t=0;t<=1;t+=.1){const x=p.x+(skyline.x-p.x)*t,z=p.z+(skyline.z-p.z)*t;assert.ok(chunks.some(c=>Math.abs(c.x-x)<=50&&Math.abs(c.z-z)<=50),'riverfront corridor has missing ground');}
});
test('forward fall braces before the shoulder rolls onto the ground',()=>{
 const p=createPose();p.speed=9;const fall=new FallMotion(p,'collision');fall.sample(fall.contactTime-.05,p);assert.ok(Math.abs(p.crashRoll)<.2);assert.ok(p.crashReach>.5);
 fall.sample(fall.contactTime+.8,p);assert.ok(Math.abs(p.crashRoll)>1.2);
});

test('Ze Mound is at the mapped west-harbor pin with visible collision terrain',()=>{
 const pin=cityPoint(42.3318321,-83.0273376),chunks=terrainChunks();
 const tile=chunks.find(c=>Math.abs(c.x-pin.x)<50&&Math.abs(c.z-pin.z)<50);assert.ok(tile,'mound tile must be streamed');
 let peak=0;for(let i=0;i<tile.vertices.length;i+=3)if(Math.hypot(tile.vertices[i]-pin.x,tile.vertices[i+2]-pin.z)<5)peak=Math.max(peak,tile.vertices[i+1]);
 assert.ok(peak>7,'mound must appear in the rendered/collision mesh');
 assert.ok(SPOTS.some(s=>s.name==='Ze Mound overlook'&&Math.hypot(s.x-pin.x,s.z-pin.z)<50));
});
