import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trafficAt,CUT_TRAFFIC,TRAFFIC_RUNOUT,DetroitWorld,cutPoint,heightAt} from './world.ts';
import {trafficPoint} from './trafficRoute.ts';
import {roadAt} from './geography.ts';

test('pedestrians, bikes, scooters and skaters travel continuously in their original direction',()=>{
  const kinds=new Set<string>();
  for(let id=0;id<62;id++){
    const first=trafficAt(id,0);if(!first.speed)continue;kinds.add(first.kind);
    for(let time=1;time<=300;time++){
      const a=trafficAt(id,time-1),b=trafficAt(id,time);
      assert.equal(b.direction,first.direction);assert.equal(b.speed,first.speed);
      const distance=b.routeDistance!-a.routeDistance!;
      if(Math.abs(distance)>CUT_TRAFFIC.length)continue; // Departure/arrival at opposite ends.
      assert.ok(Math.abs(distance-first.direction!*first.speed)<1e-8,'route progress reversed or stopped');
      // Inside-lane arc length is shorter than the centre spline around bends.
      assert.ok((b.x-a.x)*Math.sin(a.heading)+(b.z-a.z)*Math.cos(a.heading)>first.speed*.5,'actor faces against its travel');
      const turn=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading));
      assert.ok(Math.abs(turn)<.25,'sudden heading reversal');
    }
  }
  assert.deepEqual([...kinds].sort(),['cyclist','jogger','pedestrian','scooter','segway','skater']);
});

test('traffic recycling happens beyond the trail and never changes a persons travel direction',()=>{
  const span=CUT_TRAFFIC.length+2*TRAFFIC_RUNOUT;
  for(let id=1;id<62;id++){
    const a=trafficAt(id,0);if(!a.speed)continue;
    const untilExit=(a.direction!>0?CUT_TRAFFIC.length+TRAFFIC_RUNOUT-a.routeDistance!:a.routeDistance!+TRAFFIC_RUNOUT)/a.speed;
    const before=trafficAt(id,untilExit-.05),after=trafficAt(id,untilExit+.05);
    assert.ok(before.routeDistance!< -170||before.routeDistance!>CUT_TRAFFIC.length+170);
    assert.ok(after.routeDistance!< -170||after.routeDistance!>CUT_TRAFFIC.length+170);
    assert.equal(before.direction,after.direction);assert.equal(before.speed,after.speed);
    assert.ok(Math.abs(Math.abs(after.routeDistance!-before.routeDistance!)-span)<1);
  }
});

test('cones and barriers remain static over a long session',()=>{
  for(let id=0;id<62;id++){
    const a=trafficAt(id,0);if(a.speed)continue;
    for(const time of [30,120,1200,7200])assert.deepEqual(trafficAt(id,time),a);
  }
});

test('the southern traffic exit stays on the dry mapped Riverwalk',()=>{
  for(let d=-TRAFFIC_RUNOUT;d< -8;d+=2){
    const center=trafficPoint(d,0);
    assert.equal(roadAt(center.x,center.z)?.name,'Detroit Riverwalk',`exit station ${d}`);
    for(const lane of [-1.65,0,1.65]){const p=trafficPoint(d,lane);assert.ok(heightAt(p.x,p.z)>-.2,`water at exit ${d}, lane ${lane}`);}
  }
});

test('a ten-minute mapped traffic session does not pile up at the waterfront entrance',async()=>{
  const map=await new DetroitWorld().init(),player=cutPoint(0,14),blocked=new Map<number,number>();
  try{
    for(let tick=0;tick<=2400;tick++){
      map.updateTraffic(tick/4,player.x,player.z);map.step();
      const present=new Set<number>();
      for(const actor of map.traffic){
        if(actor.direction===0||actor.routeDistance!>100||actor.routeDistance!< -175)continue;
        present.add(actor.id);const seconds=actor.speed<.05?(blocked.get(actor.id)??0)+.25:0;
        blocked.set(actor.id,seconds);
        assert.ok(seconds<20,`actor ${actor.id} queued at ${actor.routeDistance} for ${seconds}s`);
      }
      for(const id of blocked.keys())if(!present.has(id))blocked.delete(id);
    }
  }finally{map.physics.free();}
});
