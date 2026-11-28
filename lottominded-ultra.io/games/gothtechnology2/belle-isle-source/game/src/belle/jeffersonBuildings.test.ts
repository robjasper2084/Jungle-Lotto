import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {ParkTerrain,inside,segment,type ParkMap,type Point} from './terrain.ts';
import {districts} from './detroitGround.ts';
import {fitStreetBuilding,streetVariantFits} from './detroitAssets.ts';
import {addJeffersonBuildings,registerJeffersonBuildingSolids,JEFFERSON_BUILDING_IDS,type JeffersonBuildingPlan} from './jeffersonBuildings.ts';

const read=(path:string)=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const map=read('../../public/belle/map.json') as ParkMap;
const originalDistrict=read('./detroitDistricts.json') as {buildings:typeof districts.buildings};
const extension=read('./jeffersonExtension.json') as {buildings:{id:string;courtyardWitnesses?:Point[]}[]};
const originalSources=JSON.stringify({map:map.buildings,district:districts.buildings});
const terrain=new ParkTerrain(map,true),scene=new T.Scene();
const originalBoxes=terrain.boxes.slice(),originalBoxValues=structuredClone(originalBoxes);
const replicas=addJeffersonBuildings(scene,terrain);
const requiredSites=[
 'detroit-89989', // Stearns, 6533 East Jefferson.
 '868842406', // Garden Court, 2900 East Jefferson.
 '114282642', // Bagley, 2921 East Jefferson.
 '955779335', // Wells, 2931 East Jefferson.
 '957898908', // Pasadena, 2170 East Jefferson.
 'jefferson-city-8423552-0', // Palms, 1001 East Jefferson; actual mapped courtyard.
];

function plan(id:string):JeffersonBuildingPlan{
 const value=replicas.plans.find(p=>p.profile.id===id);
 assert.ok(value,'Missing sourced building '+id);return value;
}
function root(id:string):T.Object3D{
 const value=scene.children.find(o=>o.userData.jeffersonId===id);
 assert.ok(value,'Missing actual scene geometry '+id);return value;
}
function visibleMeshes(object:T.Object3D):T.Mesh[]{
 const output:T.Mesh[]=[];
 object.traverseVisible(o=>{if(o instanceof T.Mesh)output.push(o);});
 return output;
}
function nearMeshes(id:string):T.Mesh[]{
 const p=plan(id);replicas.update(...p.center);return visibleMeshes(root(id));
}
function triangleCount(mesh:T.Mesh){return (mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;}
function forTriangles(mesh:T.Mesh,visit:(a:T.Vector3,b:T.Vector3,c:T.Vector3)=>void){
 const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<(index?.count??position.count);i+=3){
  a.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
  b.fromBufferAttribute(position,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
  c.fromBufferAttribute(position,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
  visit(a,b,c);
 }
}
function area(mesh:T.Mesh){let total=0;forTriangles(mesh,(a,b,c)=>{total+=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;});return total;}
function meshBounds(meshes:T.Mesh[]){
 const bounds=new T.Box3();
 for(const mesh of meshes){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));}
 return bounds;
}
function edgeDistance(point:Point,ring:Point[]){return Math.min(...ring.map((p,i)=>segment(...point,p,ring[(i+1)%ring.length]).d));}
function inFootprint(p:Point,site:JeffersonBuildingPlan,tolerance=.025){
 return (inside(...p,site.source.points)||edgeDistance(p,site.source.points)<=tolerance)&&
  !(site.source.holes??[]).some(h=>inside(...p,h)&&edgeDistance(p,h)>tolerance);
}
function downwardHit(meshes:T.Mesh[],point:Point,top:number,bottom:number){
 const ray=new T.Raycaster(new T.Vector3(point[0],top,point[1]),new T.Vector3(0,-1,0),0,top-bottom);
 return ray.intersectObjects(meshes,false)[0];
}

test('all accepted Jefferson sites build real finite geometry with distinct facade materials',()=>{
 const expectedMasonry:Record<string,RegExp>={
  'detroit-89989':/red brick/,'868842406':/red brick/,'114282642':/red brick/,
  '955779335':/fieldstone/,'957898908':/buff brick/,'jefferson-city-8423552-0':/limestone/,
 };
 for(const id of requiredSites){
  const p=plan(id),meshes=nearMeshes(id);
  assert.ok(meshes.length>0&&meshes.length<=14,p.profile.name+' must batch facade parts');
  for(const mesh of meshes){
   const geometry=mesh.geometry,positions=geometry.getAttribute('position');
   assert.ok(positions.count>0,p.profile.name+' has an empty mesh');
   assert.equal(mesh.matrixAutoUpdate,false);
   for(const key of ['position','normal','uv','color']){
    const attribute=geometry.getAttribute(key);assert.ok(attribute,key+' required');
    assert.equal(attribute.count,positions.count,key+' vertex count');
    assert.ok(Array.from(attribute.array).every(Number.isFinite),p.profile.name+' '+key+' must be finite');
   }
  }
  for(const finish of [expectedMasonry[id],/glazing/,/limestone/]){
   const surfaces=meshes.filter(m=>finish.test((m.material as T.Material).name));
   assert.ok(surfaces.reduce((sum,m)=>sum+area(m),0)>5,p.profile.name+' lacks substantial '+finish+' geometry');
  }
  const bounds=meshBounds(meshes);
  if(id==='jefferson-city-8423552-0')assert.ok(Math.abs(bounds.max.y-bounds.min.y-70*.3048)<.35,'Palms geometry should match the primary report overall height');
  else assert.ok(bounds.max.y-bounds.min.y>p.source.height,p.profile.name+' should replace its low generic shell');
 }
 let lights=0;scene.traverse(o=>{if(o instanceof T.Light)lights++;});assert.equal(lights,0);
});

test('apartment facade bands have one surface at each depth rather than competing thin skins',()=>{
 for(const id of ['868842406','957898908','jefferson-city-8423552-0']){
  const p=plan(id),meshes=nearMeshes(id).filter(m=>/red brick|buff brick|limestone/.test((m.material as T.Material).name));
  const step=p.profile.wallHeight/p.profile.floors;
  for(const edge of p.edges.filter(e=>e.length>4))for(const y of [step*.12,step*2.12,p.profile.wallHeight-step*.88]){
   // Probe the built faces in the thin depth range where the portrait capture
   // showed z-fighting. Projecting windows and belt courses sit outside it.
   const x=edge.a[0]+(edge.b[0]-edge.a[0])*.317,z=edge.a[1]+(edge.b[1]-edge.a[1])*.317;
   const ray=new T.Raycaster(new T.Vector3(x+edge.nx*.03,p.base+y,z+edge.nz*.03),new T.Vector3(-edge.nx,0,-edge.nz),0,.06);
   const hits=ray.intersectObjects(meshes,false),depths:number[]=[];
   for(const hit of hits)if(!depths.some(d=>Math.abs(d-hit.distance)<.002))depths.push(hit.distance);
   assert.equal(depths.length,1,p.profile.name+' has overlapping or missing facade surfaces at height '+y);
   const inner=id==='jefferson-city-8423552-0'&&(p.source.holes??[]).some(h=>inside(x+edge.nx*.15,z+edge.nz*.15,h));
   const expected=inner?/red brick/:id==='jefferson-city-8423552-0'||y<step*2||id==='868842406'&&y>p.profile.wallHeight-step?/limestone/:id==='868842406'?/red brick/:/buff brick/;
   assert.match(((hits[0].object as T.Mesh).material as T.Material).name,expected);
  }
 }
});

test('window frames retain their border without a stone face immediately behind the glazing',()=>{
 let checked=0;
 for(const id of requiredSites){
  const p=plan(id),meshes=nearMeshes(id),stone=meshes.filter(m=>/limestone/.test((m.material as T.Material).name)),panes:T.Vector3[][]=[];
  for(const mesh of meshes.filter(m=>/glazing/.test((m.material as T.Material).name)))forTriangles(mesh,(a,b,c)=>{
   // The separate 2.5 m entrance pane has an iron surround, not windowPane's
   // limestone frame. Sample actual window triangles throughout each facade.
   if(Math.abs(Math.max(a.y,b.y,c.y)-Math.min(a.y,b.y,c.y)-2.5)<.001)return;
   panes.push([a.clone(),b.clone(),c.clone()]);
  });
  const count=Math.min(32,panes.length);assert.ok(count>=16,p.profile.name+' needs representative window coverage');
  for(let i=0;i<count;i++){
   const [a,b,c]=panes[Math.floor(i*(panes.length-1)/(count-1))],center=a.clone().add(b).add(c).divideScalar(3);
   const normal=new T.Triangle(a,b,c).getNormal(new T.Vector3()),ray=new T.Raycaster(center,normal.clone().negate(),.003,.06);
   assert.equal(ray.intersectObjects(stone,false).length,0,p.profile.name+' has stone competing with glass in the 3–60 mm slice behind its pane');
   // A side-border probe must still hit the retained front ring, so deleting
   // the entire stone surround cannot make the aperture regression pass.
   const right=new T.Vector3(normal.z,0,-normal.x),xs=[a,b,c].map(v=>v.dot(right));
   const border=center.clone().addScaledVector(right,Math.max(...xs)+.04-center.dot(right));
   border.y=(Math.min(a.y,b.y,c.y)+Math.max(a.y,b.y,c.y))/2;
   ray.set(border,normal.clone().negate());assert.ok(ray.intersectObjects(stone,false).length>0,p.profile.name+' lost its visible window border');checked++;
  }
 }
 assert.ok(checked>=96,'Probe small houses, apartment facades, and the Stearns upper block');
});

test('the retained entrance glazing has no window surrounds or facade bands crossing its opening',()=>{
 for(const id of requiredSites){
  const p=plan(id),meshes=nearMeshes(id),door:T.Vector3[][]=[];
  const isDoor=(a:T.Vector3,b:T.Vector3,c:T.Vector3)=>
   Math.abs(Math.min(a.y,b.y,c.y)-(p.base+.25))<.001&&Math.abs(Math.max(a.y,b.y,c.y)-(p.base+2.75))<.001;
  // Locate the existing 2.5 m-high entrance pane in the built glazing batch.
  // Geometry, not the facade generator's edge/slot selection, defines the probe.
  for(const mesh of meshes.filter(m=>/glazing/.test((m.material as T.Material).name)))forTriangles(mesh,(a,b,c)=>{
   if(isDoor(a,b,c))door.push([a.clone(),b.clone(),c.clone()]);
  });
  // Wells' curved source frontage has no separate entrance pane in the
  // existing model. Preserve that placement decision rather than inventing one.
  if(!door.length&&id==='955779335')continue;
  assert.equal(door.length,2,p.profile.name+' must retain its original entrance pane');
  const center=door.flat().reduce((sum,v)=>sum.add(v),new T.Vector3()).divideScalar(6);
  const normal=new T.Triangle(...door[0] as [T.Vector3,T.Vector3,T.Vector3]).getNormal(new T.Vector3());
  const along=new T.Vector3(normal.z,0,-normal.x);
  const local=(v:T.Vector3)=>{const offset=v.clone().sub(center);return new T.Vector3(offset.dot(along),offset.y,offset.dot(normal));};
  // The slab covers the retained 2 m-wide frame opening, its low base band,
  // and projecting window sills. The underlying facade plane stays behind it.
  const opening=new T.Box3(new T.Vector3(-.98,-1.37,-.17),new T.Vector3(.98,1.37,.2));
  for(const mesh of meshes.filter(m=>/limestone|glazing/.test((m.material as T.Material).name)))forTriangles(mesh,(a,b,c)=>{
   if(/glazing/.test((mesh.material as T.Material).name)&&isDoor(a,b,c))return;
   assert.ok(!opening.intersectsTriangle(new T.Triangle(local(a),local(b),local(c))),
    p.profile.name+' has a window or projecting stone band crossing the retained doorway');
  });
 }
});

test('Wells has a substantial pitched roof, and clipped house roofs stay on their actual outlines',()=>{
 for(const id of ['955779335','114282642']){
  const p=plan(id),meshes=nearMeshes(id),roof=meshes.filter(m=>/roof/.test((m.material as T.Material).name));
  let pitchedArea=0,highest=-Infinity;
  for(const mesh of roof)forTriangles(mesh,(a,b,c)=>{
   const cross=b.clone().sub(a).cross(c.clone().sub(a)),triangleArea=cross.length()/2;
   if(triangleArea<1e-8)return;
   highest=Math.max(highest,a.y,b.y,c.y);
   const normalY=Math.abs(cross.normalize().y),middle=a.clone().add(b).add(c).divideScalar(3);
   if(middle.y>p.base+p.profile.wallHeight+.5&&normalY>.05&&normalY<.95)pitchedArea+=triangleArea;
   for(const vertex of [a,b,c,middle])assert.ok(inFootprint([vertex.x,vertex.z],p),p.profile.name+' roof crosses the mapped footprint');
  });
  assert.ok(pitchedArea>20,p.profile.name+' roof must contain pitched surfaces, not only a flat cap');
  assert.ok(highest>p.base+p.profile.wallHeight+2,p.profile.name+' lost its raised roof silhouette');
  // A clipped roof cannot leave unclipped masonry gable triangles extending
  // over the neighbouring sidewalk or yard.
  for(const mesh of meshes.filter(m=>/fieldstone|red brick/.test((m.material as T.Material).name)))forTriangles(mesh,(a,b,c)=>{
   if(Math.min(a.y,b.y,c.y)<p.base+p.profile.wallHeight+.05)return;
   for(const v of [a,b,c])assert.ok(inFootprint([v.x,v.z],p),p.profile.name+' raised masonry leaves its source footprint');
  });
 }
});

test('Wells broad forward bay has visible glazing on both wall stories',()=>{
 const p=plan('955779335'),meshes=nearMeshes(p.profile.id),arc=p.source.points.slice(26,35),areas=[0,0];
 const lengths=arc.slice(1).map((q,i)=>Math.hypot(q[0]-arc[i][0],q[1]-arc[i][1])),length=lengths.reduce((a,b)=>a+b,0);
 for(const mesh of meshes.filter(m=>/glazing/.test((m.material as T.Material).name)))forTriangles(mesh,(a,b,c)=>{
  const center=a.clone().add(b).add(c).divideScalar(3);let nearest=Infinity,along=0,offset=0;
  for(let i=1;i<arc.length;i++){
   const hit=segment(center.x,center.z,arc[i-1],arc[i]);
   if(hit.d<nearest){nearest=hit.d;along=offset+hit.t*lengths[i-1];}offset+=lengths[i-1];
  }
  // Restrict to the middle of the independently identified curved source arc,
  // so windows on adjacent straight walls cannot satisfy this regression.
  if(nearest>.35||along<.8||along>length-.8||center.y>p.base+p.profile.wallHeight)return;
  const normal=new T.Triangle(a,b,c).getNormal(new T.Vector3()),ray=new T.Raycaster(center.clone().addScaledVector(normal,.4),normal.clone().negate(),0,.8);
  const visible=ray.intersectObjects(meshes,false)[0];
  assert.ok(visible&&/glazing/.test(((visible.object as T.Mesh).material as T.Material).name),'Curved-bay glazing is hidden inside its mapped wall');
  const floor=center.y<p.base+p.profile.wallHeight/2?0:1;
  areas[floor]+=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
 });
 for(const [floor,area]of areas.entries())assert.ok(area>3,'Photographed broad Wells bay has no substantial visible windows on story '+(floor+1));
});

test('Wells presents tiled hip slopes to the street instead of a tall stone roof closure',()=>{
 const id='955779335',p=plan(id),eave=p.base+p.profile.wallHeight;
 // The broad front bay (source vertices26..34) is below a tiled end slope in
 // the reference photograph. Probe the rendered upper silhouette from the
 // street, including its far representation, rather than testing helper data.
 for(const distance of [0,2500]){
  replicas.update(p.center[0]+distance,p.center[1]);const meshes=visibleMeshes(root(id));let roofHits=0,blocked=0;
  for(const u of [-3,-2,-1,0,1,2])for(const rise of [.8,1.6,2.4,3.2]){
   const v=p.v1+4,origin=new T.Vector3(p.center[0]+p.right[0]*u+p.front[0]*v,eave+rise,p.center[1]+p.right[1]*u+p.front[1]*v);
   const ray=new T.Raycaster(origin,new T.Vector3(-p.front[0],0,-p.front[1]),0,24),hit=ray.intersectObjects(meshes,false)[0];
   if(!hit)continue;
   const material=(hit.object as T.Mesh).material as T.Material;
   if(/roof/.test(material.name)&&Math.abs(hit.face?.normal.y??0)>.15)roofHits++;
   else if(/fieldstone/.test(material.name))blocked++;
  }
  assert.ok(roofHits>=18,'Wells street roof must expose broad pitched tile surfaces at '+distance+'m; found '+roofHits);
  assert.ok(blocked<=4,'Wells street roof is hidden by a tall stone closure at '+distance+'m; found '+blocked);
  // Independent circle-fit witness in source lobe13..25: the photographed
  // conical turret must sit on this bay rather than the broad front bay.
  const roof=meshes.filter(m=>/roof/.test((m.material as T.Material).name));
  for(const offset of [-.45,0,.45]){
   const witness:Point=[-1421.91535+p.right[0]*offset,745.08169+p.right[1]*offset];
   const hit=downwardHit(roof,witness,eave+15,eave+2);
   assert.ok(hit,'Wells small mapped turret has no raised roof cap at '+distance+'m');
  }
 }
});

test('Wells hip slopes meet the mapped eaves without tall perimeter walls',()=>{
 const p=plan('955779335'),roof=nearMeshes(p.profile.id).filter(m=>/roof/.test((m.material as T.Material).name));
 const lowEdges=new Set(p.source.points.slice(3,12)),eave=p.base+p.profile.wallHeight;let checked=0;
 for(const edge of p.edges){
  if(lowEdges.has(edge.a)||edge.length<.1)continue;
  for(const t of [.25,.5,.75]){
   const q:Point=[edge.a[0]+(edge.b[0]-edge.a[0])*t-edge.nx*.035,edge.a[1]+(edge.b[1]-edge.a[1])*t-edge.nz*.035];
   const hit=downwardHit(roof,q,eave+20,eave-.1);assert.ok(hit,'Missing Wells roof at a mapped main-body eave');
   assert.ok(hit.point.y<eave+.3,'Wells roof requires a tall cut wall at a mapped eave');checked++;
  }
 }
 assert.ok(checked>60,'Exercise curved and straight source eaves around the whole main body');
});

test('clipping Bagley roofs closes elevated cut edges down to the mapped walls',()=>{
 const ray=new T.Raycaster();let checked=0;
 for(const id of ['114282642']){
  const p=plan(id),meshes=nearMeshes(id),roof=meshes.filter(m=>/roof/.test((m.material as T.Material).name));
  for(const edge of p.edges){
   if(edge.length<.8)continue;
   for(const t of [.25,.5,.75]){
    const x=edge.a[0]+(edge.b[0]-edge.a[0])*t,z=edge.a[1]+(edge.b[1]-edge.a[1])*t;
    const eave=p.base+p.profile.wallHeight;
    // Probe just inside the real outline so float32 edge ambiguity cannot
    // masquerade as a missing roof. A raised roof at this boundary requires
    // a closing face; a flat eave does not.
    const hit=downwardHit(roof,[x-edge.nx*.035,z-edge.nz*.035],eave+20,eave+.1);
    if(!hit||hit.point.y<eave+.6)continue;
    checked++;
    const y=(hit.point.y+eave)/2;
    ray.set(new T.Vector3(x+edge.nx,y,z+edge.nz),new T.Vector3(-edge.nx,0,-edge.nz));ray.near=0;ray.far=1.2;
    assert.ok(ray.intersectObjects(meshes,false).length>0,
     p.profile.name+' has an open attic cut at '+[x,y,z].map(v=>v.toFixed(2)).join(','));
   }
  }
 }
 assert.ok(checked>=10,'Exercise actual elevated cuts around the irregular Bagley footprint');
});

test('the Stearns upper addition has a broad supported roof at both detail levels',()=>{
 const id='detroit-89989',p=plan(id),coverage:number[]=[];
 const xs=p.source.points.map(q=>q[0]),zs=p.source.points.map(q=>q[1]);
 // Both the primary architectural record and the georeferenced aerial show
 // a substantial upper industrial block. Height alone would also accept the
 // earlier erroneous thin shaft, so sample the actual high roof footprint.
 const minimumHeight=p.base+p.profile.wallHeight+p.profile.roofHeight+2;
 for(const distance of [0,2500]){
  replicas.update(p.center[0]+distance,p.center[1]);const meshes=visibleMeshes(root(id));let hits=0;
  for(let x=Math.min(...xs)+1;x<Math.max(...xs);x+=2)for(let z=Math.min(...zs)+1;z<Math.max(...zs);z+=2){
   const q:Point=[x,z];if(!inFootprint(q,p)||edgeDistance(q,p.source.points)<.5)continue;
   if(downwardHit(meshes,q,p.base+60,minimumHeight))hits++;
  }
  const area=hits*4;coverage.push(area);
  assert.ok(area>250,'Stearns upper addition collapsed to a narrow tower at '+distance+'m ('+area+'m² sampled)');
 }
 assert.ok(Math.abs(coverage[0]-coverage[1])<20,'The broad raised block must survive distant rendering');
});

test('Wells keeps the photographed curved side wing low and flat at both detail levels',()=>{
 const id='955779335',p=plan(id),wing=p.source.points.slice(3,13);
 // Independent interior witnesses in the broad side lobe identified from the
 // photograph/source outline, not values exported by the mesh generator.
 const witnesses:Point[]=[[-1425,733],[-1424,735],[-1423,737]];
 const heights:number[][]=[];
 for(const point of witnesses){
  assert.ok(inside(...point,wing)&&edgeDistance(point,wing)>.5,'Witness must lie safely inside the photographed low wing');
 }
 for(const distance of [0,2500]){
  replicas.update(p.center[0]+distance,p.center[1]);const meshes=visibleMeshes(root(id)),level:number[]=[];
  for(const point of witnesses){
   const hit=downwardHit(meshes,point,p.base+40,p.base+.5);assert.ok(hit,'Missing curved wing roof at '+distance+'m');
   assert.ok(hit.point.y>p.base+2,'Curved wing must retain a usable one-story volume');
   assert.ok(hit.point.y<p.base+p.profile.wallHeight-2,'Main pitched roof or two-story shell still covers the low wing');
   level.push(hit.point.y);
  }
  assert.ok(Math.max(...level)-Math.min(...level)<.15,'The pictured curved wing has a flat roof');heights.push(level);
 }
 for(let i=0;i<witnesses.length;i++)assert.ok(Math.abs(heights[0][i]-heights[1][i])<.15,'Distant massing raises the low wing');
});

test('building construction preserves all source rings and the complete original collision prefix',()=>{
 assert.equal(JSON.stringify({map:map.buildings,district:districts.buildings}),originalSources);
 assert.ok(terrain.boxes.length>originalBoxes.length,'Taller replicas need additional vertical collision');
 for(let i=0;i<originalBoxes.length;i++){
  assert.equal(terrain.boxes[i],originalBoxes[i],'Original collider identity/order changed at '+i);
  assert.deepEqual(terrain.boxes[i],originalBoxValues[i],'Original collider content changed at '+i);
 }
 for(const p of replicas.plans){
  const source=districts.buildings.find(b=>b.id===p.profile.id)??map.buildings.find(b=>b.id===p.profile.id);
  assert.equal(p.source,source);assert.equal(p.source.points,source!.points);
 }
 for(const box of terrain.boxes.slice(originalBoxes.length)){
  const old=originalBoxes.find(b=>b.points===box.points);assert.ok(old,'Added a new horizontal collision ring');
  for(const key of ['minX','maxX','minZ','maxZ'] as const)assert.equal(box[key],old[key]);
  assert.ok((box.base??2)>=(old.base??2)+old.height-.001,'New envelope overlaps/replaces old vertical bounds');
  assert.ok(Number.isFinite(box.height)&&box.height>0);
 }
 const count=terrain.boxes.length;
 assert.equal(registerJeffersonBuildingSolids(terrain,replicas.plans),0,'Registration should be idempotent');
 assert.equal(terrain.boxes.length,count);
});

test('Palms courtyard stays open to the sky and to collision at both detail levels',()=>{
 const id='jefferson-city-8423552-0',p=plan(id),holes=p.source.holes??[];
 assert.ok(holes.length>0,'The real Palms outline must retain its courtyard hole');
 const witnesses=extension.buildings.find(b=>b.id===id)?.courtyardWitnesses??[];
 assert.ok(witnesses.length>0,'Use independently generated witnesses from the real footprint');
 for(const point of witnesses){
  assert.ok(holes.some(h=>inside(...point,h)&&edgeDistance(point,h)>.25),'Witness must be safely inside mapped courtyard');
  assert.equal(terrain.obstructed(...point,.1),false,'Courtyard is blocked by a broad footprint collider');
  assert.equal(terrain.raycastCamera({x:point[0],y:p.base+60,z:point[1]},{x:0,y:-1,z:0},58,.1),null,'Upper envelope seals courtyard');
  for(const distance of [0,2500]){
   replicas.update(p.center[0]+distance,p.center[1]);
   assert.equal(downwardHit(visibleMeshes(root(id)),point,p.base+60,p.base+.3),undefined,'A roof or distant cap seals courtyard at '+distance+'m');
  }
 }
});

test('Garden Court recesses remain empty above ground rather than receiving a bounding-box roof',()=>{
 const id='868842406',p=plan(id),meshes=nearMeshes(id),bounds=meshBounds(meshes),witnesses:Point[]=[];
 for(let x=bounds.min.x+3;x<bounds.max.x-3;x+=2)for(let z=bounds.min.z+3;z<bounds.max.z-3;z+=2){
  const q:Point=[x,z];if(!inside(x,z,p.source.points)&&edgeDistance(q,p.source.points)>2)witnesses.push(q);
 }
 assert.ok(witnesses.length>0,'Real concave Garden Court outline should expose open recesses');
 for(const q of witnesses){
  assert.equal(downwardHit(meshes,q,p.base+60,p.base+.5),undefined,'Roof spans an unmapped court');
  for(const box of terrain.boxes.slice(originalBoxes.length).filter(b=>b.points===p.source.points))assert.ok(!inside(...q,box.points!));
 }
});

test('each replaced building retains a cheaper distant silhouette with the same upper profile',()=>{
 for(const id of requiredSites){
  const p=plan(id),near=nearMeshes(id),nearBounds=meshBounds(near),nearTriangles=near.reduce((n,m)=>n+triangleCount(m),0);
  replicas.update(p.center[0]+2500,p.center[1]);
  const far=visibleMeshes(root(id)),farBounds=meshBounds(far),farTriangles=far.reduce((n,m)=>n+triangleCount(m),0);
  assert.ok(far.length>0,p.profile.name+' disappears from the mainland skyline');
  assert.ok(farTriangles<nearTriangles*.5,p.profile.name+' far representation retains too much facade detail');
  assert.ok(Math.abs(farBounds.max.y-nearBounds.max.y)<.1,p.profile.name+' loses its roof/tower profile at distance');
  assert.ok(farBounds.max.y-farBounds.min.y>=nearBounds.max.y-nearBounds.min.y-.1,p.profile.name+' distant massing is shorter than its replica');
  assert.equal(root(id).visible,true);
 }
});

test('facade batching and silhouette geometry stay within a modest static allocation budget',()=>{
 let triangles=0,meshes=0,bytes=0;
 scene.traverse(o=>{
  if(!(o instanceof T.Mesh))return;meshes++;triangles+=triangleCount(o);
  const geometry=o.geometry as T.BufferGeometry;
  for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;
 });
 assert.ok(triangles<250000,'Six landmark replicas should not consume a full detailed city mesh budget');
 assert.ok(meshes<=requiredSites.length*22,'Repeated windows must be merged rather than individual draw objects');
 assert.ok(bytes<40*1024*1024,'Uncompressed landmark attributes exceed40MiB');
 assert.equal(triangles,replicas.stats.triangles+replicas.stats.distantTriangles,'Reported geometry budget must include distant copies');
});

test('excluding Jefferson replicas never shifts unrelated Sunset building variants',()=>{
 const fits=originalDistrict.buildings.map(fitStreetBuilding).filter((f):f is NonNullable<typeof f>=>!!f);
 const selected=fits.filter(f=>JEFFERSON_BUILDING_IDS.has(f.id));assert.ok(selected.length>0,'Exercise a real excluded fit slot');
 const baseline=new Map<string,number>();
 for(let variant=0;variant<4;variant++)for(const fit of streetVariantFits(fits,variant))baseline.set(fit.id,variant);
 const retained=new Set<string>();
 for(let variant=0;variant<4;variant++){
  const filtered=streetVariantFits(fits,variant,JEFFERSON_BUILDING_IDS);
  assert.deepEqual(filtered,streetVariantFits(fits,variant).filter(f=>!JEFFERSON_BUILDING_IDS.has(f.id)));
  for(const fit of filtered){assert.equal(baseline.get(fit.id),variant);assert.ok(!JEFFERSON_BUILDING_IDS.has(fit.id));assert.ok(!retained.has(fit.id));retained.add(fit.id);}
 }
 assert.equal(retained.size,fits.length-selected.length);
 // Appending real downtown footprints must also leave the existing fit prefix
 // in place, so selection remains stable after the extension is integrated.
 const runtimeFits=districts.buildings.filter(b=>!b.holes?.length).map(fitStreetBuilding).filter((f):f is NonNullable<typeof f>=>!!f);
 assert.deepEqual(runtimeFits.slice(0,fits.length),fits);
});
