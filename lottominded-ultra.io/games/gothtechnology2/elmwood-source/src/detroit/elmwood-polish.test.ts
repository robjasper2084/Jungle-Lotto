import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {createGroundSample} from '../simulation/world.ts';
import {elmwoodSun,validElmwoodDate,WEATHER} from './elmwood-weather.ts';
import {ElmwoodPerformance} from './elmwood-performance.ts';
import {ELMWOOD_PARKING,inRing} from './elmwood-details.ts';
import {RideController,createPose,NEUTRAL_ACTIONS} from '@digital-static/ridecore';
import {rideCoreTerrain} from './ridecore-terrain.ts';
const read=(name:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+name,import.meta.url),'utf8'));
const placements=read('placements.json'),site=read('site.json'),polish=read('site-polish.json'),terrain=new ElmwoodTerrain(read('terrain.json'),site.features,placements);
await terrain.init();
test('all three replacement bridges match mapped endpoints and ride surface',()=>{
 assert.equal(polish.bridges.length,3);assert.equal(placements.filter((p:any)=>p.asset==='creek-bridge').length,0);
 for(const b of polish.bridges){const p=placements.find((p:any)=>p.asset===b.asset);assert.equal(p.scale,1);const f=site.features.find((f:any)=>f.id===b.id);
  for(let i=0;i<=20;i++){const t=i/20,a=f.points[0],z=f.points.at(-1),x=a[0]+(z[0]-a[0])*t,n=a[1]+(z[1]-a[1])*t;assert.ok(Math.abs(terrain.height(x,n)-b.surfaceHeight)<.002,`${b.id}: surface/deck gap`);}
  assert.ok(b.width>3);assert.ok(Math.abs(Math.hypot(...[f.points[1][0]-f.points[0][0],f.points[1][1]-f.points[0][1]])-b.length)<.01);
 }
});
test('bridge parapets block side travel but each centreline stays clear',()=>{
 for(const b of polish.bridges){const [x,n,h]=b.center,c=Math.cos(b.heading),s=Math.sin(b.heading),origin={x,y:h+.7,z:-n};
  assert.equal(terrain.raycastObstacle(origin,{x:-s,y:0,z:-c},b.length*.45),null,`${b.id}: centre blocked`);
  for(const sign of [-1,1])assert.ok(terrain.raycastObstacle(origin,{x:sign*c,y:0,z:-sign*s},b.width/2+.5)!==null,`${b.id}: missing rail`);
 }
});
test('RideCore crosses each mapped bridge in both directions without a crash',()=>{
 for(const b of polish.bridges)for(const sign of [-1,1]){
  const f=site.features.find((f:any)=>f.id===b.id),a=f.points[sign===1?0:1],z=f.points[sign===1?1:0],dx=(z[0]-a[0])/b.length,dn=(z[1]-a[1])/b.length;
  const sim=new RideController(rideCoreTerrain(terrain)),x=a[0]+dx*.15,n=a[1]+dn*.15;sim.reset({position:{x,y:terrain.height(x,n),z:-n},headingY:Math.atan2(dx,-dn)});
  const pose=createPose();let progress=0;for(let k=0;k<1600&&progress<b.length-.3;k++){sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.20});sim.writePose(pose);progress=(pose.x-x)*dx+(-pose.z-n)*dn;if(sim.crashed)break;}
  assert.equal(sim.crashed,false,`${b.id}: crash direction ${sign}`);assert.ok(progress>b.length-.35,`${b.id}: did not cross (${progress})`);
 }
});
test('parking is paved and free of estimated graves and trees',()=>{
 const s=terrain.sampleGround(-5,-22,createGroundSample());assert.equal(s.surface,'pavement');assert.equal(s.offCourse,false);
 assert.equal(placements.filter((p:any)=>p.layer==='estimated'&&inRing(p.position[0],p.position[1],ELMWOOD_PARKING)).length,0);
 assert.ok(Math.abs(s.height-terrain.surfaceGround(-5,22)-.046)<.001);
});
test('sun travels east to west and follows seasonal solar elevation',()=>{
 const morning=elmwoodSun(8,'2026-06-21'),evening=elmwoodSun(18,'2026-06-21');assert.ok(morning.x>0&&evening.x<0);assert.ok(elmwoodSun(12,'2026-06-21').y>elmwoodSun(12,'2026-12-21').y);assert.ok(elmwoodSun(21,'2026-12-21').y<0);
 for(const w of Object.values(WEATHER))assert.ok(w.cloud>=0&&w.cloud<=1&&w.sun>=0&&w.rain>=0);
});
test('invalid and cleared solar inputs always retain finite lighting',()=>{
 for(const date of ['', 'invalid', '2026-02-30']){
  assert.equal(validElmwoodDate(date),false);
  assert.deepEqual(elmwoodSun(14,date),elmwoodSun(14,'2026-09-15'));
 }
 assert.equal(validElmwoodDate('2024-02-29'),true);
 assert.ok(Object.values(elmwoodSun(NaN,'')).every(Number.isFinite));
});
test('performance counts rendered frames at 30 FPS and excludes hidden-tab gaps',()=>{
 const p=new ElmwoodPerformance();
 for(let i=0;i<=31;i++)p.rendered(i*1000/30);
 assert.equal(p.frames,32);assert.ok(Math.abs(p.fps-30)<.1);assert.ok(Math.abs(p.frameMsP95-1000/30)<.1);
 p.resetWindow();p.rendered(60000);assert.equal(p.frames,33);
 for(let i=1;i<=61;i++)p.rendered(60000+i*1000/60);
 assert.ok(Math.abs(p.fps-60)<.1);assert.ok(p.frameMsP99<17);
});
test('baked parking and roads are one paved surface above the terrain',()=>{
 const b=fs.readFileSync(new URL('../../public/elmwood/models/elmwood-foundation.glb',import.meta.url));
 const length=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+length)),binary=b.subarray(28+length);
 assert.equal(g.nodes.filter((n:any)=>n.name?.startsWith('Path_')&&n.mesh!==undefined).length,0);
 const node=g.nodes.find((n:any)=>n.name==='Elmwood_Connected_Pavement');assert.ok(node);
 const primitive=g.meshes[node.mesh].primitives[0],accessor=g.accessors[primitive.attributes.POSITION],view=g.bufferViews[accessor.bufferView];
 let area=0;const points:number[][]=[];
 for(let i=0;i<accessor.count;i++){
  const offset=(view.byteOffset??0)+(accessor.byteOffset??0)+i*12;
  const x=binary.readFloatLE(offset),h=binary.readFloatLE(offset+4),n=-binary.readFloatLE(offset+8);
  assert.ok(h>=terrain.surfaceGround(x,n)+.044,'Pavement penetrates the terrain');
  points.push([x,n]);if(points.length===3){const [a,c,d]=points;area+=Math.abs((c[0]-a[0])*(d[1]-a[1])-(d[0]-a[0])*(c[1]-a[1]))/2;points.length=0;}
 }
 const report=JSON.parse(fs.readFileSync(new URL('../../art/elmwood/audit-fixes/pavement-repair.json',import.meta.url),'utf8'));
 assert.ok(Math.abs(area-report.pavedAreaM2)<.1,'Pavement has overlapping or missing faces');
});
test('crypts use named official map references and keep full thresholds above terrain',()=>{
 const mapped=placements.filter((p:any)=>p.sourceId==='1416751635');assert.equal(mapped.length,1);assert.equal(mapped[0].asset,'pond-family-crypt');
 const c=mapped[0];
 for(const u of [-2,-1,0,1,2]){const x=c.position[0]+Math.cos(c.rotation)*u+Math.sin(c.rotation)*3.9,n=c.position[1]+Math.sin(c.rotation)*u-Math.cos(c.rotation)*3.9;assert.ok(c.position[2]>=terrain.ground(x,n)+.119);}
 for(const id of ['buhl-mausoleum','alger-mausoleum','schmidt-mausoleum','hammond-bank-vault','davis-hillside-vault']){
  const matches=placements.filter((p:any)=>p.asset===id);assert.equal(matches.length,1);const p=matches[0];assert.ok(p.confidence.includes('Official Elmwood'));assert.ok(terrain.nearest(p.position[0],p.position[1]).distance>=p.footprint[1]/2+3.9);
  assert.notEqual(terrain.raycastObstacle({x:p.position[0],y:p.position[2]+1,z:-p.position[1]},{x:1,y:0,z:0},1),null);
 }
 const davis=placements.find((p:any)=>p.asset==='davis-hillside-vault');
 assert.ok(davis.footprint[1]>7,'Davis must include its buried chamber, not just the front wall');
 for(const u of [-1,-.5,0,.5,1]){
  const x=davis.position[0]+Math.cos(davis.rotation)*u+Math.sin(davis.rotation)*3.48,n=davis.position[1]+Math.sin(davis.rotation)*u-Math.cos(davis.rotation)*3.48;
  const gap=davis.position[2]-terrain.ground(x,n);assert.ok(gap>=.069&&gap<.30,'Davis threshold is buried or raised too far above the approach');
 }
});
