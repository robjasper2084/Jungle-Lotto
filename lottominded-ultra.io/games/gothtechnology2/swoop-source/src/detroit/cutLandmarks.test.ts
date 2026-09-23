import {gpsAt} from './geo-profile.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {buildCutLandmarks,flowerSites,CUT_LANDMARKS} from './cutLandmarks.ts';
import {buildRouteRails} from './routeRails.ts';
import {DetroitWorld,cutPoint,heightAt,cutCoords} from './world.ts';
import {cutWidth,nearestRamp} from './geo-profile.ts';
import {CUT_THROUGH,RACE_ROUTE} from './raceRules.ts';
test('flower drifts are deterministic, varied, grounded and clear of the riding lane and ramps',t=>{
 const sites=flowerSites();assert.ok(sites.length>2000);assert.equal(new Set(sites.map(p=>p.type)).size,4);assert.deepEqual(sites,flowerSites());
 for(const p of sites){const c=cutCoords(p.x,p.z),r=nearestRamp(p.x,p.z);assert.ok(Math.abs(c.u)>cutWidth(c.d)/2+1);assert.ok(r.distance>=r.width/2+1);assert.ok(Math.abs(p.y-heightAt(p.x,p.z)-.018)<1e-6);}
 t.diagnostic(JSON.stringify({plants:sites.length}));
});
test('built amenities and rail colliders leave the complete race route and Freight Yard side line open',async t=>{
 const world=await new DetroitWorld().init(),group=new Group(),labels:string[]=[];t.after(()=>world.physics.free());
 const result=buildCutLandmarks(world,()=>group,(_g,name)=>{labels.push(name);});buildRouteRails(world,()=>group,heightAt);world.step();
 assert.equal(result.sites.length,CUT_LANDMARKS.length);for(const key of ['FIT PARK','DAVID CAMPBELL TERRACE','GRAND TRUNKS','MOGO / BIKE REPAIR'])assert.ok(labels.includes(key));
 for(let d=RACE_ROUTE.start;d<RACE_ROUTE.end;d+=2)for(const u of [-1.35,0,1.35]){const p=cutPoint(d,u);assert.equal(world.raycastObstacle({x:p.x,y:heightAt(p.x,p.z)+.7,z:p.z},{x:Math.sin(p.heading),y:0,z:Math.cos(p.heading)},1.2,.45),null,'blocked riding lane '+d+'/'+u);}
 for(let i=1;i<CUT_THROUGH.length;i++){const a=cutPoint(...CUT_THROUGH[i-1]),b=cutPoint(...CUT_THROUGH[i]),length=Math.hypot(b.x-a.x,b.z-a.z);for(let j=0;j<length;j+=.5){const f=j/length,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;assert.equal(world.raycastObstacle({x,y:heightAt(x,z)+.7,z},{x:0,y:1,z:0},1.3),null,'blocked Freight Yard side line');}}
 t.diagnostic(JSON.stringify({fixtures:result.fixtures,sites:result.sites.map(l=>l.name)}));
});

test('Campbell Terrace matches Google Maps pin on the west side north of Lafayette',()=>{const c=CUT_LANDMARKS.find(x=>x.id==='campbell')!,p=cutPoint(c.at,c.offset),gps=gpsAt(p.x,p.z);assert.ok(Math.abs(gps.lat-42.3406046)<.000001);assert.ok(Math.abs(gps.lon+83.0315474)<.000001);});
