import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drapeStreet,drapeJunction,streetSurfaceLift,streetFootprint,streetVertexNormal} from './street-geometry.ts';
import {terrainChunks} from './world.ts';
import type {TerrainChunk} from './world.ts';
import {CITY} from './geography.ts';
const chunks=terrainChunks();

test('all mapped road and sidewalk footprints remain convex at short bends',()=>{
 let checked=0;
 for(const road of CITY.roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i];if(Math.hypot(b[0]-a[0],b[1]-a[1])<.2)continue;
  for(const [half,offset] of [[road.width/2,0],[1.4,road.width/2+1.55],[1.4,-road.width/2-1.55]]){
   const p=streetFootprint({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half,offset,lift:0,joinA:streetVertexNormal(road.points,i-1),joinB:streetVertexNormal(road.points,i)});
   for(let j=0;j<p.length;j++){
    const v=p[j],q=p[(j+1)%p.length],w=p[(j+2)%p.length];
    assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.z));
    assert.ok((q.x-v.x)*(w.z-q.z)-(q.z-v.z)*(w.x-q.x)>=-1e-7,`${road.name} ${road.id} segment ${i} folded corner`);
   }
   checked++;
  }
 }
 assert.ok(checked>10000);
});

test('Atwater hairpin trims its folded inner edge instead of emitting reverse triangles',()=>{
 const road=CITY.roads.find(r=>r.id==='8740420')!,i=road.points.findIndex(p=>p[0]===.55&&p[1]===101.03);
 assert.ok(i>0);
 const a=road.points[i-1],b=road.points[i];
 const tile:TerrainChunk={x:50,z:150,vertices:new Float32Array([0,0,100,100,0,100,0,0,200,100,0,200]),indices:new Uint32Array([0,2,1,1,2,3]),surfaces:['grass','grass']};
 const result=drapeStreet({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half:road.width/2,offset:0,lift:.035,joinA:streetVertexNormal(road.points,i-1),joinB:streetVertexNormal(road.points,i)},[tile],()=>0);
 assert.ok(result.length);
 for(const {positions:p} of result)for(let j=0;j<p.length;j+=9)assert.ok((p[j+5]-p[j+2])*(p[j+6]-p[j])-(p[j+3]-p[j])*(p[j+8]-p[j+2])>0,'no inverted road faces');
});
test('the greenway remains asphalt through overlapping concrete pedestrian crossings',()=>{
 const cut=streetSurfaceLift({kind:'cycleway',name:'Dequindre Cut Greenway'});
 assert.ok(cut-streetSurfaceLift({kind:'footway'})>=.014,'separate depth keeps a concrete corner from cutting across the trail');
 assert.ok(cut<.08,'the crossing stays a small rideable seam');
});
const area=(p:number[])=>{let sum=0;for(let i=0;i<p.length;i+=9)sum+=Math.abs((p[i+3]-p[i])*(p[i+8]-p[i+2])-(p[i+5]-p[i+2])*(p[i+6]-p[i]))/2;return sum;};
test('curb ramp stays local to the crossing instead of stretching across a long sidewalk',()=>{
 const tile:TerrainChunk={x:50,z:50,vertices:new Float32Array([0,0,0,100,0,0,0,0,100,100,0,100]),indices:new Uint32Array([0,2,1,1,2,3]),surfaces:['grass','grass']};
 const rise=(x:number)=>.15*Math.min(1,Math.max(0,(Math.abs(x-50)-2)/1.2));
 const result=drapeStreet({a:{x:5,z:40},b:{x:95,z:40},half:1.4,offset:0,lift:.035,maxSpan:1.2},[tile],x=>rise(x));
 assert.ok(Math.abs(result.reduce((sum,r)=>sum+area(r.positions),0)-90*2.8)<1e-5,'continuous sidewalk area');
 for(const {positions:p} of result)for(let i=0;i<p.length;i+=9){
  const xs=[p[i],p[i+3],p[i+6]],ys=[p[i+1],p[i+4],p[i+7]];if(Math.max(...ys)-Math.min(...ys)>.004)assert.ok(Math.max(...xs)-Math.min(...xs)<=1.201);
  for(let k=0;k<3;k++){const x=p[i+k*3],y=p[i+k*3+1];assert.ok(Math.abs(y-rise(x)-.035)<1e-6);if(Math.abs(x-50)>3.3)assert.ok(y>.184);if(Math.abs(x-50)<2)assert.ok(y<.036);}
 }
});
test('overlapping road and walking surfaces have stable separated depth with a small rideable seam',()=>{
 const tile:TerrainChunk={x:50,z:50,vertices:new Float32Array([0,0,0,100,0,0,0,0,100,100,0,100]),indices:new Uint32Array([0,2,1,1,2,3]),surfaces:['grass','grass']};
 const ribbon={a:{x:5,z:50},b:{x:95,z:50},half:4,offset:0};
 const surfaces=['unclassified','cycleway','footway'].map(kind=>drapeStreet({...ribbon,lift:streetSurfaceLift({kind})},[tile],()=>0)[0].positions);
 const heights=surfaces.map(p=>p.filter((_,i)=>i%3===1));
 for(let i=1;i<heights.length;i++){const rise=heights[i][0]-heights[i-1][0];assert.ok(rise>=.004&&rise<.03);assert.ok(heights[i].every(y=>y===heights[i][0]));}
});
test('curved street joins fill the outside wedge between rectangular segments',()=>{
  const tile:TerrainChunk={x:50,z:50,vertices:new Float32Array([0,0,0,100,0,0,0,0,100,100,0,100]),indices:new Uint32Array([0,2,1,1,2,3]),surfaces:['grass','grass']};
  const positions=drapeJunction(50,40,4,[tile],(_x,_z,y)=>y,.035)[0].positions;
  const point={x:51,z:37};let covered=false;
  for(let i=0;i<positions.length;i+=9){
    const signs=[0,1,2].map(k=>{const a=i+k*3,b=i+((k+1)%3)*3;return (positions[b]-positions[a])*(point.z-positions[a+2])-(positions[b+2]-positions[a+2])*(point.x-positions[a]);});
    if(signs.every(s=>s<=1e-6)||signs.every(s=>s>=-1e-6))covered=true;
  }
  assert.ok(covered);assert.ok(area(positions)>48&&area(positions)<51);
});
test('a road whose midpoint is outside the terrain still reaches every intersected tile',()=>{
  const tile=(x:number):TerrainChunk=>({x:x+50,z:50,vertices:new Float32Array([x,0,0,x+100,0,0,x,0,100,x+100,0,100]),indices:new Uint32Array([0,2,1,1,2,3]),surfaces:['grass','grass']});
  const result=drapeStreet({a:{x:-500,z:50},b:{x:200,z:50},half:4,offset:0,lift:.035},[tile(0),tile(100)],()=>0);
  assert.equal(result.length,2);assert.ok(Math.abs(result.reduce((n,r)=>n+area(r.positions),0)-1600)<.0001);
  for(const r of result)for(let i=0;i<r.positions.length;i+=3){assert.ok(r.positions[i]>=r.chunk.x-50-1e-5&&r.positions[i]<=r.chunk.x+50+1e-5);}
});
test('streets follow the rendered coarse terrain exactly with upward-facing asphalt',()=>{
  const chunk:TerrainChunk={x:50,z:50,vertices:new Float32Array([0,0,0,100,2,0,0,3,100,100,0,100]),indices:new Uint32Array([0,2,1,1,2,3]),surfaces:['grass','grass']};
  const result=drapeStreet({a:{x:10,z:20},b:{x:90,z:80},half:5,offset:0,lift:.035},[chunk],()=>0);
  for(const {positions:p} of result)for(let i=0;i<p.length;i+=9){
    const cross=(p[i+5]-p[i+2])*(p[i+6]-p[i])-(p[i+3]-p[i])*(p[i+8]-p[i+2]);assert.ok(cross>0);
    const x=(p[i]+p[i+3]+p[i+6])/3,z=(p[i+2]+p[i+5]+p[i+8])/3,y=(p[i+1]+p[i+4]+p[i+7])/3;
    const ground=x+z<=100?.02*x+.03*z:5-.03*x-.02*z;
    assert.ok(Math.abs(y-ground-.035)<1e-6,'asphalt must not disappear under the ground');
  }
});
test('mapped Lafayette, Larned, Franklin and Antietam street sections survive boundary clipping',()=>{
  for(const name of ['East Lafayette Street','East Larned Street','Franklin Street','Antietam Avenue']){
    let recovered=0;
    for(const r of CITY.roads.filter(r=>r.name===name))for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
      if(chunks.some(c=>Math.abs(c.x-x)<60&&Math.abs(c.z-z)<60))continue;
      const result=drapeStreet({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half:r.width/2,offset:0,lift:.035},chunks,(_x,_z,y)=>y);
      recovered+=result.reduce((n,r)=>n+area(r.positions),0);
    }
    assert.ok(recovered>10,`${name}: expected real mapped sections previously culled at their midpoint`);
  }
});
