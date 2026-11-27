import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  prepareJeffersonBuildingSkins,prepareJeffersonStreetKit,
  JEFFERSON_BUILDING_ASSIGNMENTS,JEFFERSON_STREET_PLACEMENTS,
} from './jeffersonAssetSkins.ts';

const fits=Object.freeze([
  Object.freeze({id:'existing-1',x:10,z:30,yaw:.4,w:12,d:14,h:10}),
  Object.freeze({id:'existing-2',x:40,z:60,yaw:-.2,w:16,d:11,h:15}),
]);
const assignment={buildingId:'existing-2',prototype:'SunsetBlock2',reviewedReference:'test-fixture-only'};
function buildingPack(){
  const scene=new T.Group();
  for(let i=1;i<=4;i++){
    const root=new T.Group();root.name='SunsetBlock'+i;
    const geometry=new T.BoxGeometry(1,1,1);geometry.translate(0,.5,0);
    root.add(new T.Mesh(geometry,new T.MeshStandardMaterial()));scene.add(root);
  }
  return scene;
}
function loaderFor(scene){let count=0;return {get count(){return count;},loadAsync:async()=>{count++;return {scene};}};}
function propPack(){
  const scene=new T.Group(),root=new T.Group();root.name='JEF_LitterBin';root.position.x=25;
  const geo=new T.BoxGeometry(.6,1,.6);geo.translate(0,.5,0);
  root.add(new T.Mesh(geo,new T.MeshStandardMaterial()));scene.add(root);return scene;
}
function propOptions(source=propPack()){
  return {
    enabled:true,placements:[{id:'test-reviewed-bin',prototype:'JEF_LitterBin',x:12,z:16,yaw:.3,reviewedReference:'fixture-only',collisionPolicy:'visual-only'}],
    loader:loaderFor(source),scene:new T.Scene(),camera:new T.PerspectiveCamera(),
    ground:{height:()=>2,land:()=>true,obstructed:()=>false},roads:[],
    warmTextures:async()=>{},warmPrograms:async()=>{},
  };
}

test('disabled and empty configurations preserve the baseline and issue no requests',async()=>{
  assert.deepEqual(JEFFERSON_BUILDING_ASSIGNMENTS,[]);assert.deepEqual(JEFFERSON_STREET_PLACEMENTS,[]);
  const loader=loaderFor(buildingPack());
  assert.equal(await prepareJeffersonBuildingSkins(fits,loader,{enabled:false,assignments:[assignment]}),undefined);
  assert.equal(await prepareJeffersonBuildingSkins(fits,loader,{enabled:true}),undefined);
  const props=propOptions();props.placements=[];
  assert.equal(await prepareJeffersonStreetKit(props),undefined);
  assert.equal(loader.count,0);assert.equal(props.loader.count,0);
});

test('selection resolves only allowlisted fitted IDs and never changes their transforms',async()=>{
  const before=JSON.stringify(fits),loader=loaderFor(buildingPack());
  const result=await prepareJeffersonBuildingSkins(fits,loader,{enabled:true,assignments:[assignment]});
  assert.deepEqual([...result.byBuildingId.keys()],['existing-2']);
  assert.equal(result.byBuildingId.get('existing-2').name,'SunsetBlock2');
  assert.equal(JSON.stringify(fits),before);assert.equal(loader.count,1);result.dispose();
});

test('missing, ambiguous, duplicate or unreviewed building IDs fail before any request',async()=>{
  const loader=loaderFor(buildingPack());
  await assert.rejects(prepareJeffersonBuildingSkins(fits,loader,{enabled:true,assignments:[{...assignment,buildingId:'missing'}]}),/0 existing fits/);
  await assert.rejects(prepareJeffersonBuildingSkins([...fits,fits[1]],loader,{enabled:true,assignments:[assignment]}),/2 existing fits/);
  await assert.rejects(prepareJeffersonBuildingSkins(fits,loader,{enabled:true,assignments:[assignment,assignment]}),/Duplicate/);
  await assert.rejects(prepareJeffersonBuildingSkins(fits,loader,{enabled:true,assignments:[{...assignment,reviewedReference:''}]}),/Unreviewed/);
  assert.equal(loader.count,0);
});

test('a metre-sized or shifted prototype cannot enter the normalized instance slot',async()=>{
  const pack=buildingPack();pack.getObjectByName('SunsetBlock2').scale.setScalar(12);
  let disposed=0;pack.getObjectByName('SunsetBlock2').children[0].geometry.addEventListener('dispose',()=>disposed++);
  await assert.rejects(prepareJeffersonBuildingSkins(fits,loaderFor(pack),{enabled:true,assignments:[assignment]}),/must be normalized/);
  assert.equal(disposed,1);
});

test('missing selected prototypes reject the entire selection and clean up owned assets',async()=>{
  const pack=buildingPack();pack.getObjectByName('SunsetBlock2').name='unexpected';
  let disposed=0;pack.children[0].children[0].material.addEventListener('dispose',()=>disposed++);
  await assert.rejects(prepareJeffersonBuildingSkins(fits,loaderFor(pack),{enabled:true,assignments:[assignment]}),/requires one SunsetBlock2/);
  assert.equal(disposed,1);
});

test('street details stay off-scene through both warmups and remove review-spread translation',async()=>{
  const options=propOptions(),events=[];
  options.warmTextures=async group=>{assert.equal(options.scene.children.length,0);events.push('textures');};
  options.warmPrograms=async group=>{assert.equal(options.scene.children.length,0);events.push('programs');};
  const result=await prepareJeffersonStreetKit(options);
  assert.deepEqual(events,['textures','programs']);assert.equal(options.scene.children.length,0);
  assert.deepEqual(result.group.children[0].position.toArray(),[12,2,16]);
  assert.deepEqual(result.group.children[0].children[0].position.toArray(),[0,0,0]);
  result.publish();result.publish();assert.equal(options.scene.children.length,1);
  result.dispose();result.dispose();assert.equal(options.scene.children.length,0);
  assert.throws(()=>result.publish(),/disposed/);
});

test('a failed warmup publishes nothing and disposes the new source exactly once',async()=>{
  const source=propPack(),options=propOptions(source);let disposed=0;
  source.children[0].children[0].geometry.addEventListener('dispose',()=>disposed++);
  options.warmPrograms=async()=>{throw Error('fixture shader warmup failure');};
  await assert.rejects(prepareJeffersonStreetKit(options),/fixture shader warmup failure/);
  assert.equal(options.scene.children.length,0);assert.equal(disposed,1);
});

test('road/path and existing-obstacle clearance reject props before warming or publication',async()=>{
  const options=propOptions();let warms=0;options.warmTextures=async()=>{warms++;};
  options.roads=[{width:6,points:[[0,16],[24,16]]}];
  await assert.rejects(prepareJeffersonStreetKit(options),/road\/path clearance/);
  assert.equal(warms,0);assert.equal(options.scene.children.length,0);
  const blocked=propOptions();blocked.ground.obstructed=()=>true;
  await assert.rejects(prepareJeffersonStreetKit(blocked),/existing obstacle/);
});

const adaptedFit={id:'detroit-38139',x:100,z:200,yaw:.3,w:20,d:14,h:6.8};
const adaptedAssignment={buildingId:'detroit-38139',prototype:'JEF_detroit_38139',yawOffset:0,reviewedReference:'geometry-fixture-only'};
function adaptedFixture(){
  const source=new T.Group(),root=new T.Group();root.name='JEF_detroit_38139';
  root.userData={jeffersonBuildingId:adaptedFit.id,jeffersonFit:{...adaptedFit}};
  const geometry=new T.BoxGeometry(1,1,1);geometry.translate(0,.5,0);
  root.add(new T.Mesh(geometry,new T.MeshStandardMaterial()));source.add(root);
  const transform=new T.Matrix4().makeRotationY(adaptedFit.yaw).scale(new T.Vector3(adaptedFit.w,1,adaptedFit.d));
  transform.setPosition(adaptedFit.x,0,adaptedFit.z);
  const points=[[-.51,-.51],[.51,-.51],[.51,.51],[-.51,.51]].map(([x,z])=>{const p=new T.Vector3(x,0,z).applyMatrix4(transform);return [p.x,p.z];});
  const options={enabled:true,assignments:[adaptedAssignment],footprints:[{id:adaptedFit.id,points}]};
  return {source,root,options};
}

test('assigned geometry is accepted only for its unchanged target and footprint',async()=>{
  const {source,options}=adaptedFixture();
  const original=JSON.stringify({fit:adaptedFit,points:options.footprints});
  const result=await prepareJeffersonBuildingSkins([adaptedFit],loaderFor(source),options);
  assert.equal(result.byBuildingId.get(adaptedFit.id).name,'JEF_detroit_38139');
  assert.equal(JSON.stringify({fit:adaptedFit,points:options.footprints}),original);
  result.dispose();
});

test('stale fit dimensions and a wrongly rotated assigned root fail closed',async()=>{
  const first=adaptedFixture();
  await assert.rejects(prepareJeffersonBuildingSkins([{...adaptedFit,w:21}],loaderFor(first.source),first.options),/stale w fit/);
  const second=adaptedFixture();second.options.assignments=[{...adaptedAssignment,yawOffset:Math.PI}];
  await assert.rejects(prepareJeffersonBuildingSkins([adaptedFit],loaderFor(second.source),second.options),/different building or yaw/);
});

test('rectangular bounds alone cannot approve a vertex in a missing footprint corner',async()=>{
  const {source,options}=adaptedFixture();
  // Remove one actual footprint corner while keeping identical overall extents.
  const ring=options.footprints[0].points;
  const a=ring[1],b=ring[2],c=ring[3];
  ring.splice(2,1,[(a[0]+b[0])/2,(a[1]+b[1])/2],[(c[0]+b[0])/2,(c[1]+b[1])/2]);
  await assert.rejects(prepareJeffersonBuildingSkins([adaptedFit],loaderFor(source),options),/vertex outside/);
});

test('an adapted root cannot be reused for a second building through the prototype cache',async()=>{
  const {source,options}=adaptedFixture(),other={...adaptedFit,id:'886253052'};
  options.assignments=[adaptedAssignment,{...adaptedAssignment,buildingId:other.id}];
  options.footprints.push({...options.footprints[0],id:other.id});
  await assert.rejects(prepareJeffersonBuildingSkins([adaptedFit,other],loaderFor(source),options),/different building or yaw/);
});
