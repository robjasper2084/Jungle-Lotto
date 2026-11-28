import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createJeffersonSidewalkSurface,type JeffersonSidewalkData,type JeffersonSidewalkSample} from './jeffersonSidewalks.ts';

type Point=[number,number];
const rectangle=(x0:number,z0:number,x1:number,z1:number):Point[]=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]];
const data=(surfaces:JeffersonSidewalkData['surfaces'],curbs:JeffersonSidewalkData['curbs']=[]):JeffersonSidewalkData=>({schema:1,topOffsetM:.22,roadOffsetM:.07,tileSizeM:320,surfaces,curbs});
const sample=(height=2):JeffersonSidewalkSample=>({height,normal:{x:0,y:1,z:0}});
const near=(actual:number,expected:number,message:string,tolerance=2e-6)=>assert.ok(Math.abs(actual-expected)<=tolerance,message+': '+actual+' ≠ '+expected);
function rayHeight(scene:T.Scene,x:number,z:number){
 scene.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(x,30,z),new T.Vector3(0,-1,0),0,50);
 return ray.intersectObjects(scene.children,true)[0];
}

test('sidewalk support follows the rendered polygon and preserves holes, gaps and source data',()=>{
 const input=data([{id:'source-polygon',sourceIds:[24],kind:'sidewalk',outer:rectangle(-20,-10,20,10),holes:[rectangle(-3,-2,3,2)]},{id:'separate-polygon',kind:'sidewalk',outer:rectangle(24,-10,28,10)}]);
 const before=JSON.stringify(input),surface=createJeffersonSidewalkSurface(input,()=>2),scene=new T.Scene();surface.addToScene(scene);
 for(const [x,z]of [[-15,-5],[-15,5],[15,-5],[15,5],[-5,0],[5,0],[25,0]]){
  const out=sample(),normal=out.normal;assert.equal(surface.sample(x,z,2,out),true);assert.equal(out.normal,normal,'sampling keeps the caller-owned normal object');
  near(out.height,2.22,'slab is15cm above road wearing surface');const hit=rayHeight(scene,x,z);assert.ok(hit);near(out.height,hit.point.y,'simulation and actual mesh intersect at the same height');near(out.normal.y,hit.face!.normal.y,'simulation uses mesh normal');
 }
 for(const [x,z]of [[0,0],[22,0],[40,0]]){const out=sample();assert.equal(surface.sample(x,z,2,out),false);assert.deepEqual(out,sample());assert.equal(rayHeight(scene,x,z),undefined,'no rendered floor bridges a hole or gap');}
 assert.equal(JSON.stringify(input),before,'preparation does not rewrite source rings or source IDs');assert.equal(surface.stats.rejectedTriangles,0);assert.equal(surface.stats.supportTriangles,surface.stats.topTriangles);
 surface.dispose();assert.equal(scene.children.length,0);
});

test('explicit ramp entries join the asphalt and raised sidewalk with the same rendered slope',()=>{
 const ramp={toe:[[0,-1],[0,1]] as const,crest:[[3,-1],[3,1]] as const};
 const surface=createJeffersonSidewalkSurface(data([{id:'curb-ramp',kind:'ramp',outer:rectangle(0,-1,3,1),ramp},{id:'landing',kind:'sidewalk',outer:rectangle(3,-1,10,1)}]),()=>2);
 const scene=new T.Scene();surface.addToScene(scene);
 for(const [x,expected]of [[0,2.07],[.75,2.1075],[1.5,2.145],[2.25,2.1825],[3,2.22],[7,2.22]]){
  const out=sample();assert.equal(surface.sample(x,.17,2,out),true);near(out.height,expected,'explicit ramp station '+x);const hit=rayHeight(scene,x,.17);assert.ok(hit);near(out.height,hit.point.y,'ramp mesh/support agreement');
  if(x>0&&x<3){near(out.normal.x,-.05/Math.hypot(1,.05),'ramp normal x');near(out.normal.y,1/Math.hypot(1,.05),'ramp normal y');}
 }
 assert.equal(surface.stats.ramps,1);surface.dispose();
});

test('adaptive triangles follow curved bridge-approach ground without stretching long flat chords across it',()=>{
 const base=(x:number,z:number)=>2+.9*Math.sin((x+14)*.095)+.18*Math.sin(z*.2);
 const surface=createJeffersonSidewalkSurface(data([{id:'curved-approach',kind:'sidewalk',outer:rectangle(-55,-3,55,3)}]),base),scene=new T.Scene();surface.addToScene(scene);
 assert.ok(surface.stats.refinedTriangles>0);assert.ok(surface.stats.maxTerrainFitErrorM<=.015);assert.equal(surface.stats.rejectedTriangles,0);
 const edges=new Map<string,{count:number;a:Point;b:Point}>();
 for(const object of scene.children){
  const mesh=object as T.Mesh,position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index!;
  for(let i=0;i<index.count;i+=3)for(let e=0;e<3;e++){
   const a=index.getX(i+e),b=index.getX(i+(e+1)%3),ax=position.getX(a)+mesh.position.x,az=position.getZ(a)+mesh.position.z,bx=position.getX(b)+mesh.position.x,bz=position.getZ(b)+mesh.position.z;
   assert.ok(Math.hypot(ax-bx,az-bz)<=12.00001,'every final top edge obeys the12m maximum');
   const actual=(position.getY(a)+position.getY(b))/2,expected=base((ax+bx)/2,(az+bz)/2)+.22;
   assert.ok(Math.abs(actual-expected)<=.015002,'rendered midpoint fits actual base height within1.5cm');
   const ends=[[ax,position.getY(a),az],[bx,position.getY(b),bz]].map(p=>p.join(',')).sort(),key=ends.join(':');const edge=edges.get(key);
   if(edge)edge.count++;else edges.set(key,{count:1,a:[ax,az],b:[bx,bz]});
  }
 }
 for(const {count,a,b}of edges.values()){
  assert.ok(count===1||count===2,'top triangles form a non-overlapping mesh');
  if(count===1)assert.ok(a[0]===-55&&b[0]===-55||a[0]===55&&b[0]===55||a[1]===-3&&b[1]===-3||a[1]===3&&b[1]===3,'only the exterior boundary has an unpaired edge; adaptive refinement leaves no interior cracks');
 }
 for(let x=-53.2;x<54;x+=3.7){const z=.37,raw=base(x,z),out=sample(raw);assert.equal(surface.sample(x,z,raw,out),true);const hit=rayHeight(scene,x,z);assert.ok(hit);near(out.height,hit.point.y,'curved mesh/support agreement');assert.ok(Math.abs(out.height-raw-.22)<.02);}
 surface.dispose();
});

test('explicit curb runs leave the crossing gap open and never become pedestrian wall obstacles',()=>{
 const surface=createJeffersonSidewalkSurface(data([{id:'slab',kind:'sidewalk',outer:rectangle(-12,0,12,3)}],[{id:'west-curb',points:[[-12,0],[-2,0]]},{id:'east-curb',points:[[2,0],[12,0]]}]),()=>2),scene=new T.Scene();surface.addToScene(scene);scene.updateMatrixWorld(true);
 const curbs=scene.children.filter(o=>o.userData.surfaceKind==='curb');assert.ok(curbs.length>0);
 for(const x of [-7,7]){const ray=new T.Raycaster(new T.Vector3(x,2.14,-2),new T.Vector3(0,0,1),0,4);assert.equal(ray.intersectObjects(curbs).length,1,'explicit curb face is visible');}
 const gapRay=new T.Raycaster(new T.Vector3(.37,2.14,-2),new T.Vector3(0,0,1),0,4);assert.equal(gapRay.intersectObjects(curbs).length,0,'no fascia seals the source crossing gap');
 assert.equal(surface.stats.curbRuns,2);assert.equal(surface.stats.supportTriangles,surface.stats.topTriangles,'only top surfaces enter pedestrian support');surface.dispose();
});

test('source patches share materials and320m batches rather than creating a mesh for each panel',()=>{
 const patches:JeffersonSidewalkData['surfaces']=Array.from({length:100},(_,i)=>({id:'panel-'+i,kind:'sidewalk',outer:rectangle(5+i*2,5,6.9+i*2,7)}));
 const surface=createJeffersonSidewalkSurface(data([...patches,{id:'next-tile',kind:'sidewalk',outer:rectangle(330,5,335,7)}]),()=>2),scene=new T.Scene();surface.addToScene(scene);surface.addToScene(scene);
 assert.equal(scene.children.length,2);assert.equal(surface.stats.batches,2);assert.equal(surface.stats.tiles,2);assert.equal((scene.children[0] as T.Mesh).material,(scene.children[1] as T.Mesh).material);
 for(const child of scene.children){const mesh=child as T.Mesh;assert.ok(mesh.geometry.index);assert.ok(mesh.geometry.boundingSphere);assert.equal(mesh.receiveShadow,true);assert.equal(mesh.castShadow,false);assert.equal(mesh.matrixAutoUpdate,false);}
 surface.dispose();
});

test('tile-local vertices retain a narrow valid boundary at downtown world coordinates',()=>{
 const x=-2841.40994,z=1587.375,source=data([{id:'downtown-boundary-wedge',kind:'sidewalk',outer:[[x,z],[x+.00008,z],[x,z+1]]}]);
 const surface=createJeffersonSidewalkSurface(source,()=>2),scene=new T.Scene();surface.addToScene(scene);
 assert.equal(surface.stats.rejectedTriangles,0,'absolute world Float32 rounding must not collapse the valid wedge');
 const out=sample(),px=x+.00002,pz=z+.3;assert.equal(surface.sample(px,pz,2,out),true);
 const hit=rayHeight(scene,px,pz);assert.ok(hit);near(out.height,hit.point.y,'translated rendering and support use the same local vertices');
 const mesh=scene.children[0] as T.Mesh;assert.notEqual(mesh.position.x,0);assert.equal(mesh.matrixAutoUpdate,false);surface.dispose();
});

test('nonfinite queries, missing floors and another terrain level safely preserve existing support',()=>{
 const surface=createJeffersonSidewalkSurface(data([{id:'raised',kind:'sidewalk',outer:rectangle(-5,-5,5,5)}]),()=>2);
 for(const [x,z,base]of [[NaN,0,2],[0,Infinity,2],[0,0,NaN],[0,0,0],[0,0,8]]){const out=sample(4),before=structuredClone(out);assert.equal(surface.sample(x,z,base,out),false);assert.deepEqual(out,before);}
 const higher=sample(3);assert.equal(surface.sample(0,0,2,higher),false,'a local slab never lowers an already higher support');assert.equal(higher.height,3);
 surface.dispose();assert.equal(surface.sample(0,0,2,sample()),false);
 const absent=createJeffersonSidewalkSurface(data([{id:'unknown-elevation',kind:'sidewalk',outer:rectangle(-5,-5,5,5)}]),()=>NaN),scene=new T.Scene();absent.addToScene(scene);
 assert.equal(scene.children.length,0);assert.ok(absent.stats.rejectedTriangles>0);assert.equal(absent.sample(0,0,2,sample()),false);absent.dispose();
});

test('optional tactile finish remains visual and does not replace the supporting ramp',()=>{
 const ramp={toe:[[0,-1],[0,1]] as const,crest:[[3,-1],[3,1]] as const};
 const surface=createJeffersonSidewalkSurface(data([{id:'ramp',kind:'ramp',outer:rectangle(0,-1,3,1),ramp},{id:'tactile',kind:'tactile',outer:rectangle(.3,-.6,.8,.6),ramp}]),()=>2),scene=new T.Scene();surface.addToScene(scene);
 const out=sample();assert.equal(surface.sample(.5,.11,2,out),true);near(out.height,2.095,'floor remains the ramp');const hit=rayHeight(scene,.5,.11);assert.ok(hit);near(hit.point.y-out.height,.003,'only the finish has a3mm visual separation');
 assert.equal(surface.stats.tactileSurfaces,1);assert.equal(surface.stats.topTriangles-surface.stats.supportTriangles,2);surface.dispose();
});
