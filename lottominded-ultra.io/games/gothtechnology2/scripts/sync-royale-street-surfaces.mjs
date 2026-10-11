import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {TagTerrain} from '../ride-core/src/tag/fixture.ts';
import R from '../ride-core/node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs';
import {billboardPlacement} from '../swoop-source/src/detroit/routeArt.ts';

// Extend the existing snapshot, retaining building retirement handles and props.
// These are the exact cached triangles consumed by city-render.ts, not a second road model.
const root=resolve(import.meta.dirname,'..'),assets=resolve(root,'swoop-source/public');
const evidence=resolve(root,'docs/combat/evidence/street-surfaces-20261011');
const optimized=process.argv.includes('--optimized');
const meta=JSON.parse(await readFile(optimized?resolve(evidence,'collision.json'):resolve(assets,'exports/street-life/street-surfaces.json'),'utf8'));
const bytes=await readFile(resolve(assets,'exports/street-life/street-surfaces.bin.gz'));
const revision=meta.revision+'-'+createHash('sha256').update(bytes).digest('hex')+(optimized?'-planar-1':'');
const fixturePath=resolve(assets,'love-tag/swoop-detroit.json.gz');
const f=JSON.parse(gunzipSync(await readFile(optimized?resolve(evidence,'before.json.gz'):fixturePath)));
if(f.streetSurfaceRevision===revision){console.log('Street collision snapshot already synchronized');process.exit(0);}
if(f.streetSurfaceRevision)throw Error('Rebase street surfaces from the recorded pre-street snapshot before replacing them.');
const raw=optimized?await readFile(resolve(evidence,'collision.bin')):gunzipSync(bytes),positions=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4);
if(positions.length!==meta.values)throw Error('Street cache length mismatch');
const terrain=await TagTerrain.create(f),t=f.transform;let surfaces=0,foundations=0;
function indexed(data){const vertices=[],indices=[],seen=new Map();for(let i=0;i<data.length;i+=3){const key=data[i]+','+data[i+1]+','+data[i+2];let n=seen.get(key);if(n===undefined){n=vertices.length/3;seen.set(key,n);vertices.push(data[i],data[i+1],data[i+2]);}indices.push(n);}return[new Float32Array(vertices),new Uint32Array(indices)];}
await mkdir(evidence,{recursive:true});
if(!optimized)await writeFile(resolve(evidence,'before.json.gz'),await readFile(fixturePath));
for(const tile of meta.tiles){
 if(['yellow','white','seam'].includes(tile.material))continue;
 const vertices=positions.slice(tile.offset,tile.offset+tile.count),base=[],deck=[];
 for(let i=0;i<vertices.length;i+=9){
  const x=(vertices[i]+vertices[i+3]+vertices[i+6])/3,z=(vertices[i+2]+vertices[i+5]+vertices[i+8])/3,y=(vertices[i+1]+vertices[i+4]+vertices[i+7])/3;
  const hit=terrain.physics.castRay(new R.Ray({x,y:60,z},{x:0,y:-1,z:0}),100,true,undefined,0xffff0001);
  const floor=hit?60-hit.timeOfImpact:-Infinity;
  // Only near-ground paving can become foundation. Elevated bridge decks stay
  // on the reference-height layer, preserving travel underneath the bridge.
  const bin=y>=floor-.08&&y-floor<1.25?base:deck;
  for(let j=0;j<9;j++)bin.push(vertices[i+j]);
 }
 for(const [data,group] of [[base,0x0001ffff],[deck,0x0004ffff]])if(data.length){
  terrain.physics.createCollider(R.ColliderDesc.trimesh(...indexed(data)).setCollisionGroups(group));
  surfaces++;if(group===0x0001ffff)foundations+=data.length/9;
 }
}
terrain.physics.step();
// Match the newly authored trail billboard in authoritative collision checks.
f.staticBoxes??=[];
for(const s of billboardPlacement(2300,-8.5).solids)f.staticBoxes.push({...s,yaw:s.yaw??0});
const ground={height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false};
const project=p=>{terrain.sampleGround(p.x,p.z,ground,p.y);p.y=ground.height;};
for(const p of f.navigation.nodes)project(p);for(const p of f.roam??[])project(p);for(const s of f.spawns)project(s.position);for(const lane of f.lanes){project(lane.a);project(lane.b);}
const checks=[[-98.43,-1287.61],[-115.56,-208.876],[-73.74,27.265]].map(([x,z])=>{terrain.sampleGround((x-t.tx)/t.sx,z-t.tz,ground);return{x,z,height:ground.height+t.ty};});
// The first point is on the Atwater ribbon. The other two are adjacent terrain,
// which must retain its existing grade rather than being flattened to heightAt.
if(Math.abs(checks[0].height-.055)>.01)throw Error('Atwater street support regression: '+JSON.stringify(checks));
f.physics=Buffer.from(terrain.physics.takeSnapshot()).toString('base64');terrain.dispose();f.streetSurfaceRevision=revision;f.revision='20261011.shared-street-support';delete f.hash;f.hash=createHash('sha256').update(JSON.stringify(f)).digest('hex');
const json=JSON.stringify(f),zip=gzipSync(json);
for(const dir of ['swoop-source/public/love-tag','elmwood-source/public/love-tag','love-tag-server/fixtures']){await writeFile(resolve(root,dir,'swoop-detroit.json'),json);await writeFile(resolve(root,dir,'swoop-detroit.json.gz'),zip);}
const report={revision,hash:f.hash,surfaces,foundations,checks,gzipBytes:zip.length};await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
