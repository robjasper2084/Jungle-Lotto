import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {configureVisualDistricts,clipHostSurface,resetVisualDistrictsForTest,districts,overlapReceipt} from '../src/visualDistricts.ts';
import {fromSourceMap,toSourceMap,SWOOP_MIN_SCALE,SWOOP_MAX_SCALE} from '../src/geo.ts';
import {districts as original} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/detroitGround.ts';
import {SwoopCoverage,type ParkTerrain} from '../src/terrain.ts';
import {RoadContactSurface} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/roadContactSurface.ts';

function configure(chunks=[{x:50,z:50}],added?:number[]){
  resetVisualDistrictsForTest();
  const swoopCoverage=new SwoopCoverage(chunks);
  if(added)swoopCoverage.addRideTriangles(added);
  configureVisualDistricts({sourceWorld:{chunks,buildingMeshes:[]},swoopCoverage,configureReplacedHostBuildings(){}} as unknown as ParkTerrain);
}
function rectangle(x0:number,z0:number,x1:number,z1:number){
  const xy=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],positions:number[]=[],uv:number[]=[];
  for(const [x,z]of xy){const p=fromSourceMap(x,.01*x+.02*z,z);positions.push(p.x,p.y,p.z);uv.push(x/200,z/200);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals();return geometry;
}
function area(geometry:T.BufferGeometry){
  const p=geometry.getAttribute('position'),ix=geometry.index;let sum=0;
  for(let i=0;i<(ix?.count??p.count);i+=3){const a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;sum+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a)))/2;}
  return sum;
}
function assertPlaneAttributes(geometry:T.BufferGeometry,expectedNormal:T.Vector3){
  const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal');
  assert.equal(uv.count,p.count);assert.equal(normal.count,p.count);
  for(let i=0;i<p.count;i++){
    const q=toSourceMap(p.getX(i),p.getY(i),p.getZ(i));
    assert.ok(Math.abs(q.y-(.01*q.x+.02*q.z))<.0001,'retained slope');
    assert.ok(Math.abs(uv.getX(i)-q.x/200)<.00001,'retained u');
    assert.ok(Math.abs(uv.getY(i)-q.z/200)<.00001,'retained v');
    assert.ok(new T.Vector3().fromBufferAttribute(normal,i).distanceTo(expectedNormal)<.00001,'retained surface normal');
  }
}
test('exact footprint subtraction keeps the host surface outside the source tiles',()=>{
  configure();const input=rectangle(-50,-50,150,150),before=area(input);let disposed=0;input.addEventListener('dispose',()=>disposed++);
  const result=clipHostSurface(input);
  assert.notEqual(result,input);assert.equal(disposed,1);
  assert.ok(Math.abs(area(result)/before-.75)<.00001);
  const p=result.getAttribute('position');
  for(let i=0;i<p.count;i+=3){const q=toSourceMap((p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,0,(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3);assert.ok(!(q.x>.001&&q.x<99.999&&q.z>.001&&q.z<99.999),'a retained triangle must not cover the imported tile');}
});
test('clipped road edge vertices preserve slope and original UV mapping',()=>{
  configure();const result=clipHostSurface(rectangle(-50,-50,150,150));const p=result.getAttribute('position'),uv=result.getAttribute('uv');
  for(let i=0;i<p.count;i++){const q=toSourceMap(p.getX(i),p.getY(i),p.getZ(i));assert.ok(Math.abs(q.y-(.01*q.x+.02*q.z))<.0001);assert.ok(Math.abs(uv.getX(i)-q.x/200)<.00001);assert.ok(Math.abs(uv.getY(i)-q.z/200)<.00001);}
});
test('unrelated district geometry preserves the identical original buffer object',()=>{
  configure();const geometry=rectangle(400,400,500,500);assert.equal(clipHostSurface(geometry),geometry);assert.equal(overlapReceipt.clippedMeshes,0);
});
test('actual pavement batching merges indexed clipped, unchanged and fully removed roads with contact intact',()=>{
  configure();
  const crossing=rectangle(-50,-50,150,150),remote=rectangle(400,400,500,500),covered=rectangle(20,20,80,80);
  const expectedArea=area(crossing)*.75+area(remote),expectedNormal=new T.Vector3().fromBufferAttribute(crossing.getAttribute('normal'),0);
  const clipped=clipHostSurface(crossing),unchanged=clipHostSurface(remote),empty=clipHostSurface(covered);
  assert.equal(unchanged,remote);assert.ok(clipped.index);assert.ok(empty.index);
  assert.equal(empty.index.count,0);
  for(const name of ['position','normal','uv'])assert.equal(empty.getAttribute(name).count,0,name+' survives empty indexed output');
  // detroitScene.batches retains empty parts and passes this mixed list directly
  // to Three. The CI failure occurred when the clipped part at index 2 lost its index.
  const merged=mergeGeometries([unchanged,empty,clipped]),emptyBatch=mergeGeometries([empty]);
  assert.ok(merged,'native pavement merge succeeds');assert.ok(merged.index);
  assert.ok(emptyBatch);assert.ok(emptyBatch.index);assert.equal(emptyBatch.index.count,0);
  assert.equal(merged.index.count,unchanged.index!.count+clipped.index!.count);
  assert.ok(Math.abs(area(merged)-expectedArea)/expectedArea<.00001);
  assertPlaneAttributes(merged,expectedNormal);
  const contact=new RoadContactSurface();contact.add(emptyBatch);contact.add(merged);
  const retained=fromSourceMap(-25,-.75,-25),removed=fromSourceMap(50,1.5,50);
  assert.ok(Math.abs(contact.height(retained.x,retained.z,retained.y-.07)-retained.y)<.0001,'clipped indexed pavement remains usable by native road contact');
  assert.equal(contact.height(removed.x,removed.z,removed.y-.07),removed.y-.07,'removed overlap contributes no wearing surface');
  for(const geometry of [clipped,unchanged,empty,merged,emptyBatch])geometry.dispose();
});
test('nonindexed geometry remains nonindexed through clipping, empty results and native merging',()=>{
  configure();
  const crossing=rectangle(-50,-50,150,150).toNonIndexed(),remote=rectangle(400,400,500,500).toNonIndexed(),covered=rectangle(20,20,80,80).toNonIndexed();
  const expectedArea=area(crossing)*.75+area(remote),expectedNormal=new T.Vector3().fromBufferAttribute(crossing.getAttribute('normal'),0);
  const clipped=clipHostSurface(crossing),unchanged=clipHostSurface(remote),empty=clipHostSurface(covered);
  for(const geometry of [clipped,unchanged,empty])assert.equal(geometry.index,null);
  for(const name of ['position','normal','uv'])assert.equal(empty.getAttribute(name).count,0,name+' survives empty nonindexed output');
  const merged=mergeGeometries([unchanged,empty,clipped]);assert.ok(merged);assert.equal(merged.index,null);
  assert.ok(Math.abs(area(merged)-expectedArea)/expectedArea<.00001);
  assertPlaneAttributes(merged,expectedNormal);
  for(const geometry of [clipped,unchanged,empty,merged])geometry.dispose();
});
test('a gap between two imported tiles remains real host ground',()=>{
  configure([{x:50,z:50},{x:250,z:50}]);const geometry=rectangle(110,10,190,90);const result=clipHostSurface(geometry);assert.equal(result,geometry);assert.ok(area(result)>6300*SWOOP_MIN_SCALE*SWOOP_MAX_SCALE);
});
test('late-added source floors clip their actual triangular footprint without widening it',()=>{
  configure([{x:50,z:50}],[200,0,0,300,0,0,200,0,100]);
  const input=rectangle(200,0,300,100),before=area(input),result=clipHostSurface(input);
  assert.notEqual(result,input);assert.ok(Math.abs(area(result)/before-.5)<.00001);
  assert.equal(overlapReceipt.sourceFootprintInputs,2);
});
test('the preview data does not mutate production geography',()=>{
  const originalGreenway=original.greenway,originalBridges=original.bridges,originalBuildings=original.buildings;configure();
  assert.notEqual(districts,original);assert.equal(districts.greenway.length,0);assert.equal(districts.bridges.length,0);
  assert.equal(original.greenway,originalGreenway);assert.equal(original.bridges,originalBridges);assert.equal(original.buildings,originalBuildings);assert.ok(original.greenway.length>100);assert.equal(original.bridges.length,11);
  resetVisualDistrictsForTest();
});
