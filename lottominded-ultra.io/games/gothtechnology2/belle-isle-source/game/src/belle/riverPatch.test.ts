import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {riverFarRing,RIVER_PATCH_SIZE,RIVER_PATCH_SEGMENTS} from './riverPatch.ts';
import {sunDirection,DEFAULT_SKY} from './skyModel.ts';
const at=(positions:number[],i:number)=>positions.slice(i*3,i*3+3);
test('river far ring has bounded finite buffers and upward faces',()=>{
 const g=riverFarRing();assert.equal(g.positions.length,3072);assert.equal(g.indices.length,3072);assert.equal(g.uv.length,2048);
 assert(g.positions.every(Number.isFinite)&&g.uv.every(Number.isFinite));
 let area=0;
 for(let i=0;i<g.indices.length;i+=3){const [a,b,c]=g.indices.slice(i,i+3).map(n=>at(g.positions,n));const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);assert(up>0);area+=up/2;}
 assert.equal(area,18000*18000-400*400);
});
test('every inner boundary vertex matches the unmodified 128-segment near grid',()=>{
 const {positions}=riverFarRing(),actual=new Set<string>(),expected=new Set<string>();
 for(let i=0;i<512;i++){const [x,y,z]=at(positions,i);assert.equal(y,0);actual.add(x+','+z);}
 for(let i=0;i<=128;i++){const v=-200+i*400/128;for(const p of [[v,-200],[200,v],[v,200],[-200,v]])expected.add(p.join(','));}
 assert.deepEqual(actual,expected);assert.equal(RIVER_PATCH_SIZE,400);assert.equal(RIVER_PATCH_SEGMENTS,128);
});
test('ring has no internal cracks, duplicate faces or center-covering triangles',()=>{
 const g=riverFarRing(),edges=new Map<string,number>(),faces=new Set<string>();
 for(let i=0;i<g.indices.length;i+=3){const triangle=g.indices.slice(i,i+3);const key=[...triangle].sort((a,b)=>a-b).join(',');assert(!faces.has(key));faces.add(key);
  const points=triangle.map(n=>at(g.positions,n));assert(points.every(p=>p[0]<=-200)||points.every(p=>p[0]>=200)||points.every(p=>p[2]<=-200)||points.every(p=>p[2]>=200));
  for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],k=Math.min(a,b)+','+Math.max(a,b);edges.set(k,(edges.get(k)||0)+1);}
 }
 let inner=0,outer=0;for(const [key,count] of edges){assert(count===1||count===2);if(count===1){const [a,b]=key.split(',').map(Number);if(a<512&&b<512)inner++;else if(a>=512&&b>=512)outer++;else assert.fail('An unpaired radial edge would create a crack');}}
 assert.equal(inner,512);assert.equal(outer,512);
});
test('invalid or oversized ring dimensions fail before geometry loops',()=>{
 for(const args of [[Infinity,128,9000],[0,128,9000],[400,0,9000],[400,1.5,9000],[400,257,9000],[400,128,200],[400,128,Infinity]])assert.throws(()=>riverFarRing(...args as [number,number,number]));
});
test('shipping river uses connected geometry with no fragment cut or added texture samples',async()=>{
 const source=await readFile(new URL('./water.ts',import.meta.url),'utf8');
 assert.match(source,/riverFarRing\(\)/);assert.match(source,/far\.position\.copy\(near\.position\)/);
 assert.match(source,/PlaneGeometry\(RIVER_PATCH_SIZE,RIVER_PATCH_SIZE,RIVER_PATCH_SEGMENTS,RIVER_PATCH_SEGMENTS\)/);
 assert.doesNotMatch(source,/discard\s*;/);assert.equal((source.match(/texture2D\(/g)||[]).length,5);
 assert.match(source,/smoothstep\(165\.,195\./);assert.match(source,/smoothstep\(35\.,220\.,viewDistance\)/);
});
test('art-directed low sun aligns near the skyline while retaining the day and night arc',()=>{
 const [x,y,z]=sunDirection(17.6),direction=[-3127-114,1983-1373],length=Math.hypot(...direction);
 const cosine=(x*direction[0]+z*direction[1])/(Math.hypot(x,z)*length);
 assert(cosine>Math.cos(5*Math.PI/180));assert(y>0&&y<.15);
 assert(sunDirection(7)[0]>0);assert(sunDirection(12)[1]>.9);assert(sunDirection(0)[1]<-.9);
 for(let h=0;h<=24;h+=.025){const v=sunDirection(h);assert(v.every(Number.isFinite));assert(Math.abs(Math.hypot(...v)-1)<1e-12);}
 assert.deepEqual(sunDirection(24),sunDirection(0));assert.deepEqual(DEFAULT_SKY,{hour:16.7,cycle:true,dayMinutes:20,clouds:'changing'});
});
