import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {subdivideWaterGeometry,waterSiteData,makeElmwoodWater} from './elmwood-water.ts';
import {makeElmwoodWeather} from './elmwood-weather.ts';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8'));
const site=read('site.json'),pond=read('landmark-improvements.json').pond,terrain=new ElmwoodTerrain(read('terrain.json'),site.features,read('placements.json'));
test('subdivision retains the authored water level and triangle footprint',()=>{
 const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute([0,-4.6,0,12,-4.6,0,0,-4.6,12],3));
 const result=subdivideWaterGeometry(source,3),p=result.getAttribute('position'),index=result.index!;let area=0;
 for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getY(i)+4.6)<.000001);assert.ok(p.getX(i)>=0&&p.getZ(i)>=0&&p.getX(i)+p.getZ(i)<=12.00001);}
 for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);area+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getX(c)-p.getX(a))*(p.getZ(b)-p.getZ(a)))/2;}
 assert.ok(Math.abs(area-72)<.001);assert.equal(source.getAttribute('position').count,3);assert.ok(p.count<500);
});
test('pond data distinguishes shallow shoreline from the actual lowered pond bed',()=>{
 const bank=waterSiteData(pond.ring[0][0],-pond.ring[0][1],pond.center[2],terrain,pond,false),centre=waterSiteData(pond.center[0],-pond.center[1],pond.center[2],terrain,pond,false);
 assert.equal(bank[2],0);assert.ok(centre[2]>5);assert.ok(centre[3]>.2);assert.ok(centre.every(Number.isFinite));
});
test('creek flow follows every real stream segment downstream',()=>{
 for(const f of site.features.filter((f:any)=>f.tags.waterway==='stream'))for(let i=1;i<f.points.length;i++){
 const a=f.points[i-1],b=f.points[i],d=waterSiteData((a[0]+b[0])/2,-(a[1]+b[1])/2,(a[2]+b[2])/2,terrain,pond,true),dx=b[0]-a[0],dz=-(b[1]-a[1]);
 assert.ok(d.every(Number.isFinite));assert.ok(d[0]*dx+d[1]*dz>0);assert.ok(Math.abs(Math.hypot(d[0],d[1])-1)<.00001);assert.ok(d[2]>2);
 }
});
test('water animation freezes on pause and reduced motion while quality remains selectable',()=>{
 const weather=makeElmwoodWeather(new T.Scene(),new T.PerspectiveCamera(),new T.DirectionalLight(),new T.HemisphereLight(),{toneMappingExposure:1} as T.WebGLRenderer),sun=new T.Vector3(0,1,0);
 weather.update(.5,sun,true);assert.equal(weather.uniforms.waterTime.value,.5);
 weather.update(.5,sun,true,true);assert.equal(weather.uniforms.waterTime.value,.5);
 weather.update(.5,sun,true,false,{reducedMotion:true,detail:.35});assert.equal(weather.uniforms.waterTime.value,.5);assert.equal(weather.uniforms.waterDetail.value,.35);
 const source=new T.MeshStandardMaterial({name:'Creek water',side:T.DoubleSide}),water=makeElmwoodWater(source,weather.uniforms);assert.equal(water.metalness,0);assert.equal(water.ior,1.333);assert.equal(water.side,source.side);assert.equal(water.transparent,false);
});
