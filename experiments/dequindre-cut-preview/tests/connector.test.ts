import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildConnectorRoute,validateConnectorRoute,connectorNavigationRoad} from '../src/connector.ts';
import {ParkTerrain} from '../src/terrain.ts';
import {fromSourceMap} from '../src/geo.ts';
import {pointOnCut} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geography.ts';
import {districts} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/detroitGround.ts';

const route=buildConnectorRoute();
test('mapped connector reaches the at-grade entrance without joining the Jefferson overpass to the lower trail',()=>{
  assert.deepEqual(route.points[0],districts.routes.cut[0]);
  const p=pointOnCut(8),last=fromSourceMap(p.x,0,p.z);
  assert.ok(Math.hypot(route.points.at(-1)![0]-last.x,route.points.at(-1)![1]-last.z)<.001);
  assert.ok(route.junctionGap<.2);assert.ok(route.length>3000&&route.length<5000);
  assert.deepEqual([...new Set(route.segments.filter(s=>s.source.startsWith('swoop:')).map(s=>s.name))],['Saint Aubin Street','Atwater Street','Dequindre Cut Greenway']);
  const overpass=districts.cut;
  assert.ok(route.points.every(p=>Math.hypot(p[0]-overpass[0],p[1]-overpass[1])>60),'route must use the southern street entrance');
  assert.ok(route.segments.every(s=>s.length<750),'no invented long cross-district link');
});

test('navigation route remains held until both directions pass full-scene collision verification',()=>{
  const fake={height:()=>2,sampleGround(_x:number,_z:number,out:any){out.height=2;out.offCourse=false;return out;},land:()=>true,raycast:()=>null,raycastObstacle:()=>null};
  const base=validateConnectorRoute(fake,route);
  assert.ok(base.ok);assert.throws(()=>connectorNavigationRoad(route,base,base),/full-scene/);
  const outbound={...base,phase:'complete-scene' as const},inbound={...base,direction:'return' as const,phase:'complete-scene' as const};
  assert.equal(connectorNavigationRoad(route,outbound,inbound).points.length,route.points.length);
  const blocked={...outbound,ok:false};assert.throws(()=>connectorNavigationRoad(route,blocked,inbound),/full-scene/);
  assert.throws(()=>connectorNavigationRoad(route,outbound,outbound),/both directions/);
  assert.throws(()=>connectorNavigationRoad({...route,points:route.points.slice(1)},outbound,inbound),/exact route/);
  assert.throws(()=>validateConnectorRoute(fake,route,{maxGrade:.3}),/weakened/);
});

const map=JSON.parse(readFileSync(new URL('../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/public/belle/map.json',import.meta.url),'utf8'));
const terrain=new ParkTerrain(map,true);
before(async()=>terrain.prepareSwoop());after(()=>terrain.sourceWorld.physics.free());
for(const reverse of [false,true])test('actual source/base terrain supports the complete connector '+(reverse?'return':'outbound'),()=>{
  const report=validateConnectorRoute(terrain,route,{reverse});
  assert.ok(report.samples>4000);
  assert.ok(report.ok,JSON.stringify({direction:report.direction,issues:report.issues.slice(0,12),count:report.issues.length,maximumGrade:report.maximumGrade,maximumStep:report.maximumStep}));
});
