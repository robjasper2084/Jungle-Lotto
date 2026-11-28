import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {districts,districtName} from './detroitGround.ts';
import {JEFFERSON_BUILDINGS,addJeffersonBuildings,planJeffersonBuildings,registerJeffersonBuildingSolids} from './jeffersonBuildings.ts';
import {jeffersonStreetDestinations,jeffersonViewOccluded,selectJeffersonTravelView,type JeffersonTravelView} from './jeffersonTravel.ts';
import {ParkTerrain,segment,type ParkMap,type Point} from './terrain.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const rectangle=(x0:number,z0:number,x1:number,z1:number):Point[]=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]];
function actualTerrain(){const terrain=new ParkTerrain(map,true);registerJeffersonBuildingSolids(terrain,planJeffersonBuildings(map,(x,z)=>terrain.height(x,z)));return terrain;}
// Build the ordinary main.ts first-person camera independently of the selector:
// actual 1.55 m on-foot eye, vertical FOV, viewport aspect and 15 m look target.
function cameraAt(terrain:ParkTerrain,view:JeffersonTravelView,aspect:number,verticalFov=60){
 const camera=new T.PerspectiveCamera(verticalFov,aspect,.08,22000);
 camera.position.set(view.x,terrain.height(view.x,view.z)+1.55,view.z);
 camera.lookAt(view.x+Math.sin(view.heading)*15,camera.position.y-Math.tan(view.pitch)*15,view.z+Math.cos(view.heading)*15);
 camera.updateMatrixWorld(true);return camera;
}

test('all six actual building destinations resolve to clear local street frontage',()=>{
 const terrain=actualTerrain(),before=JSON.stringify(terrain.boxes),roads=[...map.roads,...districts.roads],plans=planJeffersonBuildings(map,(x,z)=>terrain.height(x,z));
 assert.equal(JEFFERSON_BUILDINGS.length,6);
 for(const profile of JEFFERSON_BUILDINGS){
  const view=selectJeffersonTravelView(terrain,'jefferson-'+profile.id);assert.ok(view,profile.name+' has a safe view');
  const plan=plans.find(p=>p.profile.id===profile.id)!,sourceDistance=Math.hypot(view.x-plan.center[0],view.z-plan.center[1]);
  assert.equal(view.sourceId,profile.id);assert.ok(sourceDistance>=12&&sourceDistance<=140,profile.name+' stays within the original local bound');
  assert.ok(terrain.land(view.x,view.z));assert.equal(terrain.obstructed(view.x,view.z,1.25),false);
  const road=roads.find(r=>r.id===view.roadId)!;assert.ok(road);assert.ok(!('foot'in road&&road.foot)&&!('bridge'in road&&road.bridge));
  const distance=Math.min(...road.points.slice(1).map((p,i)=>segment(view.x,view.z,road.points[i],p).d));
  assert.ok(distance<=road.width/2+(view.surface==='sidewalk'?1.8:0)+1e-6);
  assert.ok(view.pitch<=0&&view.pitch>-.6);assert.ok(Math.abs(Math.atan2(Math.sin(view.heading-Math.atan2(view.lookX-view.x,view.lookZ-view.z)),Math.cos(view.heading-Math.atan2(view.lookX-view.x,view.lookZ-view.z))))<1e-9);
  assert.ok(Math.abs(view.pitch+Math.atan2(view.lookY-terrain.height(view.x,view.z)-1.55,view.distance))<1e-9);
 }
 assert.equal(JSON.stringify(terrain.boxes),before,'travel selection never changes collisions');
});
test('actual desktop and portrait cameras retain roofs, bases and useful street-facing facades',()=>{
 const terrain=actualTerrain(),scene=new T.Scene(),plans=addJeffersonBuildings(scene,terrain).plans;
 const partialByViewport=new Map<string,string[]>();
 for(const [device,width,height] of [['desktop',1440,900],['phone',390,844]] as const){
  const partial:string[]=[];
  for(const plan of plans){
   const label=device+' '+plan.profile.name,view=selectJeffersonTravelView(terrain,'jefferson-'+plan.profile.id,{aspect:width/height,verticalFov:60});assert.ok(view,label);
   const camera=cameraAt(terrain,view,width/height),top=plan.base+Math.max(plan.profile.wallHeight+plan.profile.roofHeight,plan.profile.rearHeight??0)+(plan.profile.kind==='bagley'||plan.profile.kind==='wells'?1.1:0);
   for(const [x,z] of plan.source.points)for(const y of [plan.base,top]){
    const point=new T.Vector3(x,y,z).project(camera);
    assert.ok(point.z>-1&&point.z<1,label+' remains in front of the camera');
    assert.ok(Math.abs(point.y)<=.920001,label+' includes the complete base/roof height');
    if(view.fullFootprint)assert.ok(Math.abs(point.x)<=.920001,label+' fits the full source perimeter');
   }
   if(!view.fullFootprint)partial.push(plan.profile.kind);
   // Actual generated facade/roof vertices include cornices, balconies, finials
   // and the tall Stearns addition, not only an idealized footprint extrusion.
   const root=scene.children.find(o=>o.userData.jeffersonId===plan.profile.id)!;
   root.traverse(object=>{if(!(object instanceof T.Mesh))return;const vertices=object.geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++){
     const point=object.localToWorld(new T.Vector3().fromBufferAttribute(vertices,i)).project(camera);
     assert.ok(Math.abs(point.y)<1,label+' actual roof/base geometry is not vertically cropped');
     if(view.fullFootprint)assert.ok(Math.abs(point.x)<1,label+' actual geometry fits horizontally');
    }
   });
   // At least one substantial street-facing wall must be visible at its own
   // mid-height, including a useful projected width. This rejects a distant
   // roof-only or edge-on view even when an abstract envelope fits the frustum.
   const ray=new T.Raycaster();let visibleWidth=0,visibleLength=0;
   for(const edge of plan.edges){
    if(edge.nx*plan.front[0]+edge.nz*plan.front[1]<.6)continue;
    const middle=new T.Vector3((edge.a[0]+edge.b[0])/2+edge.nx*.18,plan.base+plan.profile.wallHeight*.5,(edge.a[1]+edge.b[1])/2+edge.nz*.18),direction=middle.clone().sub(camera.position);
    if((view.x-middle.x)*edge.nx+(view.z-middle.z)*edge.nz<=0)continue;
    const distance=direction.length(),projected=middle.clone().project(camera);if(Math.abs(projected.x)>.96||Math.abs(projected.y)>.96)continue;
    ray.set(camera.position,direction.normalize());ray.far=distance-.3;if(ray.intersectObject(root,true).length)continue;
    const a=new T.Vector3(edge.a[0],middle.y,edge.a[1]).project(camera),b=new T.Vector3(edge.b[0],middle.y,edge.b[1]).project(camera);
    visibleWidth+=Math.abs(Math.max(-1,Math.min(1,a.x))-Math.max(-1,Math.min(1,b.x)));visibleLength+=edge.length;
   }
   assert.ok(visibleLength>=4,label+' shows a substantial real frontage');assert.ok(visibleWidth>=.2,label+' frontage occupies at least 10% of the viewport width');
  }
  partialByViewport.set(device,partial);
 }
 assert.deepEqual(partialByViewport.get('desktop'),[],'all six desktop silhouettes fit');
 assert.deepEqual(partialByViewport.get('phone'),['stearns','pasadena'],'portrait limitations are explicit; Garden Court and Palms fit completely');
});
test('Grand and Woodward are normal safe Guide viewpoints facing along Jefferson',()=>{
 const terrain=actualTerrain();
 assert.deepEqual(jeffersonStreetDestinations.map(s=>s.name),['Jefferson Avenue · East Grand Boulevard','Jefferson Avenue · Woodward downtown']);
 for(const destination of jeffersonStreetDestinations){
  const view=selectJeffersonTravelView(terrain,destination.id,{aspect:1440/900,verticalFov:60});assert.ok(view,destination.name);
  assert.deepEqual(selectJeffersonTravelView(terrain,destination.id,{aspect:390/844,verticalFov:60}),view,'street stops stay on the same Jefferson approach for both viewport shapes');
  assert.ok(view.distance>25&&view.distance<70);assert.ok(terrain.land(view.x,view.z));assert.equal(terrain.obstructed(view.x,view.z,1.25),false);
  assert.ok(Math.sin(view.heading)<-.7,'view faces west toward the intersection');
 }
});
test('building approaches use directly joined source streets without following a second hop',()=>{
 const terrain=actualTerrain(),roads=[...map.roads,...districts.roads],mainline=roads.filter(r=>/Jefferson/i.test(r.name));
 const rivard=roads.find(r=>r.id==='city-jefferson-extension-33070-0')!,destination='jefferson-jefferson-city-8423552-0',options={aspect:1440/900,verticalFov:60};
 const direct=selectJeffersonTravelView(terrain,destination,{...options,roads:[...mainline,rivard]});assert.ok(direct);assert.equal(direct.roadId,rivard.id,'Palms can use the real Rivard junction');
 const detached={...rivard,id:'city-detached-rivard-test',points:rivard.points.slice(1)},connector={...rivard,id:'city-rivard-connector-test',points:rivard.points.slice(0,2)};
 const secondHop=selectJeffersonTravelView(terrain,destination,{...options,roads:[...mainline,connector,detached]});assert.ok(secondHop);assert.notEqual(secondHop.roadId,detached.id,'a connector does not promote a second road segment into the candidate network');
 const bridge=selectJeffersonTravelView(terrain,destination,{...options,roads:[...mainline,{...rivard,bridge:true}]});assert.ok(bridge);assert.notEqual(bridge.roadId,rivard.id,'bridge segments stay excluded');
 const obstructed=terrain.obstructed.bind(terrain),join=rivard.points[0];
 assert.ok(Math.hypot(direct.x-join[0],direct.z-join[1])>2,'the standing point is outside the blocked junction fixture');
 terrain.obstructed=(x,z,radius)=>Math.hypot(x-join[0],z-join[1])<2||obstructed(x,z,radius);
 const blocked=selectJeffersonTravelView(terrain,destination,{...options,roads:[...mainline,rivard]});assert.ok(blocked);assert.notEqual(blocked.roadId,rivard.id,'the continuous road connection must also be clear');
});
test('viewport and vertical field of view affect normal travel without accepting invalid projection inputs',()=>{
 const terrain=actualTerrain(),destination='jefferson-jefferson-city-8423552-0',plan=planJeffersonBuildings(map,(x,z)=>terrain.height(x,z)).find(p=>p.profile.kind==='palms')!;
 const narrow=selectJeffersonTravelView(terrain,destination,{aspect:1440/900,verticalFov:45}),wide=selectJeffersonTravelView(terrain,destination,{aspect:1440/900,verticalFov:75});assert.ok(narrow&&wide);
 assert.ok(Math.hypot(narrow.x-plan.center[0],narrow.z-plan.center[1])>Math.hypot(wide.x-plan.center[0],wide.z-plan.center[1]),'a narrower lens needs a farther safe view');
 for(const [view,fov] of [[narrow,45],[wide,75]] as const){const camera=cameraAt(terrain,view,1440/900,fov);for(const [x,z] of plan.source.points)for(const y of [plan.base,plan.base+21.34]){const p=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,'the requested vertical FOV fits the actual Palms envelope');}}
 for(const options of [{aspect:0},{aspect:NaN},{aspect:Infinity},{verticalFov:0},{verticalFov:180},{verticalFov:NaN}])assert.equal(selectJeffersonTravelView(terrain,destination,options),undefined);
});
test('omitted sidewalks cannot provide Guide frontage positions',()=>{
 const terrain=actualTerrain(),destination='jefferson-868842406';
 const original=selectJeffersonTravelView(terrain,destination);assert.ok(original);assert.equal(original.surface,'sidewalk');
 const roads=[...map.roads,...districts.roads].map(r=>({...r,sidewalk:false}));
 const view=selectJeffersonTravelView(terrain,destination,{roads});assert.ok(view,'the clear actual carriageway still provides a local view');
 assert.equal(view.surface,'road');assert.ok(view.distance<140);
 const road=roads.find(r=>r.id===view.roadId)!;
 assert.ok(Math.min(...road.points.slice(1).map((p,i)=>segment(view.x,view.z,road.points[i],p).d))<road.width/2);
 assert.equal(terrain.obstructed(view.x,view.z,1.25),false);
});
test('downtown labels follow qualified extension land and preserve existing districts',()=>{
 const terrain=actualTerrain(),woodward=jeffersonStreetDestinations.find(s=>s.id==='jefferson-street-woodward')!;
 assert.ok(terrain.land(woodward.x,woodward.z));assert.equal(districtName(woodward.x,woodward.z),'Downtown Detroit · East Jefferson');
 const river:Point=[-3200,2220];assert.equal(terrain.land(...river),false);assert.equal(districtName(...river),undefined);
 assert.equal(districtName(-4000,2000),undefined,'unmapped land is outside the downtown label');
 assert.equal(districtName(districts.grid.x0+districts.grid.step,districts.grid.z0+districts.grid.step),'Elmwood · cemetery district');
 assert.equal(districtName(map.spawn.x,map.spawn.z),undefined,'island labeling remains unchanged');
 assert.equal(districtName(-2000,1200),'Swoop Detroit · East Side');
});
test('occlusion excludes only the exact target source ID and detects thin unrelated blockers',()=>{
 const target={id:'target',points:rectangle(10,-5,25,5)},thin={id:'neighbor',points:rectangle(5.031,-.1,5.041,.1)};
 assert.equal(jeffersonViewOccluded([0,0],[20,0],'target',[target]),false);
 assert.equal(jeffersonViewOccluded([0,0],[20,0],'jefferson-target',[target]),true,'prefixed UI ID cannot masquerade as a source ID');
 assert.equal(jeffersonViewOccluded([0,0],[20,0],'target',[target,thin]),true);
 assert.equal(jeffersonViewOccluded([0,2],[8,2],'target',[thin]),false);
 const courtyard={id:'neighbor',points:rectangle(0,-4,10,4),holes:[rectangle(1,-3,9,3)]};
 assert.equal(jeffersonViewOccluded([2,0],[8,0],'target',[courtyard]),false,'open courtyard is not filled by its bounds');
 assert.equal(jeffersonViewOccluded([-1,0],[8,0],'target',[courtyard]),true,'courtyard wall still occludes an external approach');
});
test('unrelated camera blockers and blocked terrain reject views without a far fallback',()=>{
 const terrain=actualTerrain(),destination='jefferson-868842406';
 const camera=terrain.raycastCamera,obstructed=terrain.obstructed;
 terrain.raycastCamera=()=>.1;assert.equal(selectJeffersonTravelView(terrain,destination),undefined);
 terrain.raycastCamera=camera;terrain.obstructed=()=>true;assert.equal(selectJeffersonTravelView(terrain,destination),undefined);
 terrain.obstructed=obstructed;
 assert.equal(selectJeffersonTravelView(terrain,destination,{roads:[]}),undefined);
 assert.equal(selectJeffersonTravelView(terrain,'868842406'),undefined);
 assert.equal(selectJeffersonTravelView(terrain,'jefferson-unverified-building'),undefined);
});
test('disconnected nearby road fragments cannot become Guide travel destinations',()=>{
 const terrain=actualTerrain(),profile=JEFFERSON_BUILDINGS.find(p=>p.kind==='pasadena')!,plan=planJeffersonBuildings(map,(x,z)=>terrain.height(x,z)).find(p=>p.profile.id===profile.id)!;
 const road={id:'city-disconnected-test',name:'Jefferson',width:14,points:[[plan.center[0]-40,plan.center[1]-35],[plan.center[0]+40,plan.center[1]-81]] as Point[]};
 assert.equal(selectJeffersonTravelView(terrain,'jefferson-'+profile.id,{roads:[road]}),undefined);
});
