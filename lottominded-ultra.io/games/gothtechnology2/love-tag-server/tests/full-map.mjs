import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
import {TagTerrain,TagMatch,neutralCommand} from '@digital-static/ridecore/tag';
const evidence=[];
for(const product of ['swoop-detroit','elmwood-explorer']){
 const f=JSON.parse(await readFile(new URL('../fixtures/'+product+'.json',import.meta.url),'utf8')),begin=performance.now(),terrain=await TagTerrain.create(f);
 assert(f.walkable&&f.navigation&&f.roam.length>100);const g=f.grid,w=(g.width-1)*g.spacing,h=(g.height-1)*g.spacing;
 assert(w>(product==='swoop-detroit'?3000:790)&&h>(product==='swoop-detroit'?2000:1000));
 const open=f.roam.filter(p=>terrain.legal(p)&&terrain.nearest(p).distance>6),far=open.sort((a,b)=>Math.hypot(b.x-f.spawns[0].position.x,b.z-f.spawns[0].position.z)-Math.hypot(a.x-f.spawns[0].position.x,a.z-f.spawns[0].position.z));
 assert(far.length>20,'Open ground must be legal away from roads');
 let drive;
 for(const spot of far){for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const ahead={x:spot.x+Math.sin(heading)*8,y:spot.y,z:spot.z+Math.cos(heading)*8};
  if(!terrain.legal(ahead)||terrain.raycastObstacle({...spot,y:spot.y+.8},{x:Math.sin(heading),y:0,z:Math.cos(heading)},8,.5)!==null)continue;
  const match=new TagMatch({...f,spawns:[f.spawns[0],{position:spot,headingY:heading}]},terrain,'classic');match.addActor('it','It');const a=match.addActor('runner','Runner');match.start('map-check');
  let seq=0;for(let n=0;n<9*60;n++){match.command('runner',{...neutralCommand(match.round,++seq,match.tick),throttle:n>180?1:0});match.step();}
  const p=a.controller.poseValue;if(Math.hypot(p.x-spot.x,p.z-spot.z)>5&&!a.resets&&terrain.legal(p)){drive={start:spot,end:{x:p.x,y:p.y,z:p.z},metres:Math.hypot(p.x-spot.x,p.z-spot.z),distanceFromOriginalSpawn:Math.hypot(spot.x-f.spawns[0].position.x,spot.z-f.spawns[0].position.z)};break;}
 }if(drive)break;}
 assert(drive,'Actual human commands must move on distant open ground without reset');
 assert.equal(terrain.legal({x:g.x-10,y:0,z:g.z}),false);
 // Each launch seat is independently clear and close enough for actual heart play.
 assert.equal(f.spawns.length,8);for(let i=0;i<8;i++){const p=f.spawns[i].position;assert(terrain.legal(p));assert.equal(terrain.raycastObstacle({...p,y:p.y+.65},{x:0,y:1,z:0},1,.6),null);for(let j=0;j<i;j++)assert(Math.hypot(p.x-f.spawns[j].position.x,p.z-f.spawns[j].position.z)>=1.9);}
 const first=f.spawns[0].position,second=f.spawns[1].position;assert(Math.hypot(first.x-second.x,first.z-second.z)<24);
 const bits=Buffer.from(f.walkable,'base64');let excluded;for(let n=0;n<g.width*g.height;n++){if(!(bits[n>>3]&(1<<(n&7)))){const p={x:g.x+(n%g.width)*g.spacing,y:g.heights[n],z:g.z+Math.floor(n/g.width)*g.spacing};assert.equal(terrain.legal(p),false);excluded=p;break;}}assert(excluded,'Actual unsupported/water samples stay closed');
 let cover;terrain.physics.forEachCollider(c=>{if(cover||(f.groundRays&&(c.collisionGroups()>>>16&2)===0))return;const p=c.translation(),t=f.transform;let he=c.shape.halfExtents,centre={...p};
  if(!he&&c.shape.vertices){const v=c.shape.vertices;let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<v.length;i++) {const axis=i%3;min[axis]=Math.min(min[axis],v[i]);max[axis]=Math.max(max[axis],v[i]);}he={x:(max[0]-min[0])/2,y:(max[1]-min[1])/2,z:(max[2]-min[2])/2};centre={x:p.x+(max[0]+min[0])/2,y:p.y+(max[1]+min[1])/2,z:p.z+(max[2]+min[2])/2};}if(!he)return;
  if(he.y<1||he.x>20||he.z>20)return;const x=(centre.x-t.tx)/t.sx,z=centre.z-t.tz,a={x:x-he.x-1.5,y:0,z},b={x:x+he.x+1.5,y:0,z};a.y=terrain.sampleGround(a.x,a.z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false}).height+1.05;b.y=terrain.sampleGround(b.x,b.z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false}).height+1.05;
  if(!terrain.legal({...a,y:a.y-1.05})||!terrain.legal({...b,y:b.y-1.05}))return;const d={x:b.x-a.x,y:b.y-a.y,z:0},length=Math.hypot(d.x,d.y);const hit=terrain.raycastObstacle(a,d,length,.14);if(hit!==null&&hit>.3&&hit<length-.8&&terrain.raycastObstacle(a,{x:0,y:1,z:0},.2,.3)===null&&terrain.raycastObstacle(b,{x:0,y:1,z:0},.2,.3)===null)cover={from:a,to:b,obstructionMetres:hit};});
 assert(cover,'Actual source scenery must obstruct heart-sized sweeps');
 evidence.push({product,hash:f.hash,boundsMetres:[w,h],openGroundAnchors:open.length,spawnSeparation:Math.hypot(first.x-second.x,first.z-second.z),excluded,drive,cover,loadAndCheckMs:performance.now()-begin,kind:'actual fixture/controller checks; no browser teleport or whole-map human coverage claim'});terrain.dispose();console.log(JSON.stringify(evidence.at(-1)));
}
await writeFile(new URL('../../docs/love-tag/evidence/full-map-20261004.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),evidence},null,2));
