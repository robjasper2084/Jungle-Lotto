import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const pack=resolve(import.meta.dirname,'..'),phone=resolve(pack,'../../../..');
const core=resolve(phone,'Digital_Static_RideCore'),explorer=resolve(phone,'euc-detroit-riverwalk'),swoop=resolve(pack,'swoop-source');
const R=(await import(pathToFileURL(resolve(explorer,'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs')).href)).default;await R.init();
const imported=async(root,file)=>import(pathToFileURL(resolve(root,file)).href);
const {DetroitWorld}=await imported(swoop,'src/detroit/world.ts');
const {GeoTerrain}=await imported(swoop,'src/detroit/geo-terrain.ts');
const {pointOnCut,CITY}=await imported(swoop,'src/detroit/geography.ts');
const {toLocal,MAP_ORIGIN}=await imported(swoop,'src/detroit/geo-profile.ts');
const {registerRetailShell,registerDestinationCollision,registerFreightCollisions}=await imported(swoop,'src/detroit/tagSceneryCollisions.ts');
const {ElmwoodTerrain}=await imported(explorer,'src/detroit/elmwood-terrain.ts');
const read=async(file)=>JSON.parse(await readFile(file,'utf8'));
const ground={height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false};
const products=process.argv.slice(2);if(products.some(p=>!['swoop-detroit','elmwood-explorer'].includes(p)))throw Error('Expected product: swoop-detroit or elmwood-explorer');
const selected=product=>!products.length||products.includes(product);
async function exportFixture(product,terrain,physics,lanes,transform,bounds){
  const points=lanes.flatMap(l=>[l.a,l.b]),padding=6;
  const x=Math.floor(bounds?.x??Math.min(...points.map(p=>p.x))-padding),z=Math.floor(bounds?.z??Math.min(...points.map(p=>p.z))-padding),spacing=bounds?(product==='swoop-detroit'?2:1):.5;
  const width=Math.ceil(((bounds?.maxX??Math.max(...points.map(p=>p.x))+padding)-x)/spacing)+1,height=Math.ceil(((bounds?.maxZ??Math.max(...points.map(p=>p.z))+padding)-z)/spacing)+1;
  const heights=[],walkable=new Uint8Array(Math.ceil(width*height/8));
  const valid=(p)=>{const g=terrain.sampleGround(p.x,p.z,ground,p.y);return !g.offCourse&&g.normal.y>.5&&!(terrain.waterAt?.(p.x,p.z,g.height));};
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){const p={x:x+i*spacing,y:0,z:z+j*spacing},g=terrain.sampleGround(p.x,p.z,ground);p.y=g.height;heights.push(+g.height.toFixed(4));
    if(valid(p))walkable[(j*width+i)>>3]|=1<<((j*width+i)&7);}
  // Restrict the real static physics to this arena; exclude normal traffic.
  const snapshotWorld=new R.World({x:0,y:-9.81,z:0});
  const inside=(p)=>{const xx=(p.x-transform.tx)/transform.sx,zz=p.z-transform.tz;return xx>=x-10&&xx<=x+(width-1)*spacing+10&&zz>=z-10&&zz<=z+(height-1)*spacing+10;};
  physics.forEachCollider(c=>{
    if(c.parent()?.isDynamic())return;const shape=c.shape,p=c.translation();
    const vertices=shape.vertices;
    if(vertices){let relevant=false;for(let i=0;i<vertices.length;i+=3){if(inside({x:p.x+vertices[i],z:p.z+vertices[i+2]})){relevant=true;break;}}if(!relevant)return;}
    else if(!inside(p))return;
    snapshotWorld.createCollider(new R.ColliderDesc(shape).setTranslation(p.x,p.y,p.z).setRotation(c.rotation()).setCollisionGroups(c.collisionGroups()));
  });
  snapshotWorld.step();
  const spawns=[];for(const l of lanes){const length=Math.hypot(l.b.x-l.a.x,l.b.z-l.a.z);for(let d=4;d<length-3&&spawns.length<40;d+=6){const t=d/length,p={x:l.a.x+(l.b.x-l.a.x)*t,y:0,z:l.a.z+(l.b.z-l.a.z)*t};p.y=terrain.sampleGround(p.x,p.z,ground).height;const origin={x:transform.tx+transform.sx*p.x,y:p.y+transform.ty+.8,z:p.z+transform.tz};
    if(snapshotWorld.intersectionWithShape(origin,{x:0,y:0,z:0,w:1},new R.Ball(.6)))continue;spawns.push({position:p,headingY:Math.atan2(l.b.x-l.a.x,l.b.z-l.a.z)});}}
  if(spawns.length<8)throw Error(product+' has fewer than eight clear spawn anchors');
  // Open lawns and courtyards are real hiding/escape areas, not lane violations.
  const roam=[];for(let zz=z+12;zz<z+(height-1)*spacing;zz+=24)for(let xx=x+12;xx<x+(width-1)*spacing;xx+=24){const p={x:xx,y:terrain.sampleGround(xx,zz,ground).height,z:zz};
    if(!valid(p))continue;const origin={x:transform.tx+transform.sx*p.x,y:p.y+transform.ty+.8,z:p.z+transform.tz};
    if(!snapshotWorld.intersectionWithShape(origin,{x:0,y:0,z:0,w:1},new R.Ball(.65),undefined,product==='swoop-detroit'?0xffff0002:undefined))roam.push(p);}
  const data={version:1,product,arena:product==='swoop-detroit'?'detroit-full-map':'elmwood-full-map',revision:'20261004.full-map.1',physicsVersion:'rapier-0.20.0',transform,physics:Buffer.from(snapshotWorld.takeSnapshot()).toString('base64'),grid:{x,z,spacing,width,height,heights},walkable:Buffer.from(walkable).toString('base64'),groundRays:product==='swoop-detroit',roam,lanes,spawns};
  data.hash=createHash('sha256').update(JSON.stringify(data)).digest('hex');const json=JSON.stringify(data);
  const zipped=gzipSync(json);
  for(const directory of [resolve(pack,'love-tag-server/fixtures'),resolve(swoop,'public/love-tag'),resolve(explorer,'public/love-tag')]){await mkdir(directory,{recursive:true});await writeFile(resolve(directory,product+'.json'),json);await writeFile(resolve(directory,product+'.json.gz'),zipped);}
  console.log(JSON.stringify({product,hash:data.hash,lanes:lanes.length,spawns:spawns.length,colliders:snapshotWorld.colliders.len(),bytes:Buffer.byteLength(json),bounds:[x,z,width,height]}));snapshotWorld.free();
}
if(selected('swoop-detroit')){
const detroit=new DetroitWorld();await detroit.init();const local=new GeoTerrain(detroit);
for(const kind of ['lotto','penny','studio'])registerRetailShell(detroit,kind);
for(const store of [false,true])registerDestinationCollision(detroit,store);
registerFreightCollisions(detroit);detroit.step();
const detroitLanes=[];const at=(d,u=0)=>{const m=pointOnCut(d,u),p=toLocal(m.x,0,m.z);p.y=local.sampleGround(p.x,p.z,ground).height;return p;};
for(let d=0;d<2700;d+=12)detroitLanes.push({a:at(d),b:at(Math.min(2700,d+12)),width:6});
// Real parallel Cut lanes offer two passing choices; street connections are not fabricated.
for(const r of CITY.roads)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/18);
 for(let j=0;j<n;j++){const point=t=>{const p=toLocal(a[0]+(b[0]-a[0])*t,0,a[1]+(b[1]-a[1])*t);p.y=local.sampleGround(p.x,p.z,ground).height;return p;},u=point(j/n),v=point((j+1)/n);
 if([u,v].some(p=>local.sampleGround(p.x,p.z,ground).offCourse||local.waterAt(p.x,p.z,p.y)))continue;
 detroitLanes.push({a:u,b:v,width:Math.max(2,Math.min(10,r.width))});}}
const chunks=detroit.chunks,bounds={x:MAP_ORIGIN.x-Math.max(...chunks.map(c=>c.x))-50,maxX:MAP_ORIGIN.x-Math.min(...chunks.map(c=>c.x))+50,z:Math.min(...chunks.map(c=>c.z))-50-MAP_ORIGIN.z,maxZ:Math.max(...chunks.map(c=>c.z))+50-MAP_ORIGIN.z};
await exportFixture('swoop-detroit',local,detroit.physics,detroitLanes,{sx:-1,tx:MAP_ORIGIN.x,ty:MAP_ORIGIN.y,tz:MAP_ORIGIN.z},bounds);detroit.physics.free();
}
if(selected('elmwood-explorer')){
const grid=await read(resolve(explorer,'public/elmwood/terrain.json')),site=await read(resolve(explorer,'public/elmwood/site.json')),placements=await read(resolve(explorer,'public/elmwood/placements.json'));
const elmwood=new ElmwoodTerrain(grid,site.features,placements);await elmwood.init();
const main=site.features.find(f=>f.id==='59197492');if(!main)throw Error('Actual Creek Lane source is missing');
const pathPoints=main.points;const origin=pathPoints[Math.floor(pathPoints.length/2)],elmLanes=[];
for(const f of site.features.filter(f=>f.kind==='path'&&f.tags.bridge!=='yes'&&f.tags.highway!=='footway'))for(let i=1;i<f.points.length;i++){
  const a=f.points[i-1],b=f.points[i];
  const len=Math.hypot(a[0]-b[0],a[1]-b[1]),n=Math.ceil(len/12);for(let j=0;j<n;j++){const point=t=>({x:a[0]+(b[0]-a[0])*t,y:elmwood.height(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),z:-(a[1]+(b[1]-a[1])*t)});elmLanes.push({a:point(j/n),b:point((j+1)/n),width:3.7});}
}
await exportFixture('elmwood-explorer',elmwood,elmwood.physics,elmLanes,{sx:1,tx:0,ty:0,tz:0},{x:grid.x0,maxX:grid.x0+(grid.width-1)*grid.spacing,z:-grid.y0,maxZ:-grid.y0+(grid.height-1)*grid.spacing});elmwood.physics.free();
}
