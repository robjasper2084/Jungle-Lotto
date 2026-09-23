import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trafficAt,CUT_TRAFFIC,TRAFFIC_RUNOUT} from './world.ts';

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
