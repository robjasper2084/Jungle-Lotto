import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stepBird,type BirdState} from './elmwood-wildlife.ts';
const ring=[[-4,-4],[4,-4],[4,4],[-4,4]];
const bird=():BirdState=>({x:6,north:0,homeX:6,homeNorth:0,heading:Math.PI/2,phase:0,age:0,cooldown:0,mode:'roam',kind:'goose',speed:0,swimming:false});
test('goose accelerates smoothly and stride tracks actual travel, not wall time',()=>{
 const b=bird(),r={x:11,north:0,active:true};let distance=0;
 for(let i=0;i<90;i++){const x=b.x,n=b.north,speed=b.speed;stepBird(b,1/60,i/60,r,ring);distance+=Math.hypot(b.x-x,b.north-n);assert.ok(Math.abs(b.speed-speed)<.2);assert.ok(b.speed<=2.6);}
 assert.ok(Math.abs((b.stride??0)-distance/.38*Math.PI*2)<1e-7);
});
test('water transitions blend instead of snapping, and zero time cannot move wildlife',()=>{
 const b=bird();b.x=0;b.homeX=0;b.waterBlend=0;const r={x:50,north:0,active:false};stepBird(b,1/60,0,r,ring);
 assert.ok(b.waterBlend>0&&b.waterBlend<.1);const x=b.x,n=b.north,stride=b.stride;
 stepBird(b,0,0,r,ring);assert.equal(b.x,x);assert.equal(b.north,n);assert.equal(b.stride,stride);
});
test('goose and car assets have real-world dimensions and both requested car placements',()=>{
 const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8'));
 const assets=read('asset-manifest.json'),goose=assets.find((a:any)=>a.id==='canada-goose'),car=assets.find((a:any)=>a.id==='chrysler-300s-2018');
 assert.ok(goose.dimensionsM[2]>.8&&goose.dimensionsM[2]<.9);assert.ok(goose.dimensionsM[1]<1.1);
 assert.ok(Math.abs(car.dimensionsM[1]-5.044)<.002);assert.ok(Math.abs(car.dimensionsM[2]-1.492)<.002);assert.equal(car.wheelbaseM,3.052);
 const ps=read('placements.json'),cars=ps.filter((p:any)=>p.asset===car.id);assert.equal(cars.length,2);assert.ok(cars.some((p:any)=>p.addition.endsWith('lane')));assert.ok(cars.some((p:any)=>p.addition.endsWith('gatehouse')));
 const hammond=ps.find((p:any)=>p.asset==='hammond-bank-vault');assert.equal(hammond.bankVaultRepair,true);assert.ok(hammond.footprint[1]>9);
});
