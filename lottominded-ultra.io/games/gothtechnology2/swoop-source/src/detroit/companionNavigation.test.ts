import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DogFollower} from './companion.ts';
import {companionRoute} from './companionNavigation.ts';
import {createPose} from './controller.ts';
import type {NavigationObstacle,TerrainSampler} from './terrain.ts';
const obstacle=(kind:string,radius=.42,height=.7):NavigationObstacle=>({id:kind,x:1.3,y:0,z:10,radius,height,kind,vx:0,vz:0});
function course(objects:NavigationObstacle[]):TerrainSampler{return {
  sampleGround(_x,_z,out){out.height=0;out.surface='pavement';out.offCourse=false;Object.assign(out.normal,{x:0,y:1,z:0});return out;},
  raycast:()=>null,navigationObstacles:()=>objects,
  raycastObstacle(origin,direction,distance,width=0){
    const n=Math.hypot(direction.x,direction.z),dx=direction.x/n,dz=direction.z/n;let hit=Infinity;
    for(const o of objects){if(origin.y<o.y||origin.y>o.y+o.height)continue;
      const x=o.x-origin.x,z=o.z-origin.z,along=x*dx+z*dz,side=x*dz-z*dx,r=o.radius+width;
      if(Math.abs(side)>=r)continue;const d=along-Math.sqrt(r*r-side*side);
      if(d<=distance&&along+r>=0)hit=Math.min(hit,Math.max(0,d));
    }return Number.isFinite(hit)?hit:null;
  }
};}
for(const [kind,radius,height] of [['cone',.42,.7],['bench',.9,.64],['rock',.5,.44]] as const){
  test(`dog clears a ${kind} with a ballistic jump and lands before resuming its gait`,t=>{
    const o=obstacle(kind,radius,height),dog=new DogFollower(course([o])),hero=createPose();dog.reset(hero);hero.speed=5;
    let peak=0,clearance=Infinity,landed=false,wasAir=false;
    for(let i=0;i<960;i++){
      hero.z+=5/120;dog.step(1/120,hero);const p=dog.current;peak=Math.max(peak,p.jumpHeight??0);
      if(Math.abs(p.z-o.z)<radius+.65&&Math.abs(p.x-o.x)<radius+.3)clearance=Math.min(clearance,p.y-o.height);
      if(wasAir&&(p.jumpHeight??0)===0)landed=true;wasAir=(p.jumpHeight??0)>0;
    }
    assert.equal(dog.jumps,1);assert.ok(peak>height+.3&&peak<1.7);assert.ok(clearance>.1,`body/foot clearance ${clearance}`);
    assert.ok(landed&&dog.current.z>20);assert.equal(dog.current.jumpHeight,0);assert.ok(dog.current.speed>3);
    t.diagnostic(`${kind}: apex ${peak.toFixed(2)} m; obstacle clearance ${clearance.toFixed(2)} m`);
  });
}
test('dog goes around a pedestrian without jumping or intersecting their footprint',()=>{
  const person=obstacle('pedestrian',.3,1.7),dog=new DogFollower(course([person])),hero=createPose();dog.reset(hero);hero.speed=3;
  let minimum=Infinity,detour=0;
  for(let i=0;i<1000;i++){
    hero.z+=3/120;person.z+=.35/120;person.vz=.35;dog.step(1/120,hero);
    minimum=Math.min(minimum,Math.hypot(dog.current.x-person.x,dog.current.z-person.z));detour=Math.max(detour,Math.abs(dog.current.x-1.3));
  }
  assert.equal(dog.jumps,0);assert.ok(minimum>=.62-1e-6,`overlap ${minimum}`);assert.ok(detour>.7);assert.ok(dog.current.z>person.z+3);
});
test('jump planning rejects people, tall barriers and occupied landings',()=>{
  for(const kind of ['pedestrian','cyclist','segway','barrier']){
    const o=obstacle(kind);o.z=2;const plan=companionRoute(1.3,0,0,0,4,[o],0);assert.ok(!plan?.jump);
  }
  const cone=obstacle('cone'),person=obstacle('pedestrian',.5,1.7);cone.z=2.2;person.z=4.4;
  assert.ok(!companionRoute(1.3,0,0,0,4,[cone,person],0)?.jump);
});
