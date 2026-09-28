import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chooseElmwoodSpawn,makeElmwoodCurbs,curbContains,ELMWOOD_YOUNG} from './elmwood-details.ts';
import {stepBird,type BirdState} from './elmwood-wildlife.ts';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8'));
const site=read('site.json'),terrain=new ElmwoodTerrain(read('terrain.json'),site.features,read('placements.json'));
test('rider starts away from dead ends and follows one-way drives',()=>{
 const feature={id:'drive',kind:'path',points:[[0,0],[0,40]],tags:{}},segments=[{a:[0,0],b:[0,40],feature}];
 const spawn=chooseElmwoodSpawn(segments,0,39,{x:0,z:-1});assert.ok(Math.cos(spawn.heading)>.9,'Face back down the lane at its closed end');
 feature.tags={oneway:'yes'};const oneWay=chooseElmwoodSpawn(segments,0,20,{x:0,z:1});assert.ok(Math.cos(oneWay.heading)<-.9,'Respect one-way path orientation');
});
test('starts near the gatehouse and chapel are on a lane with room ahead',()=>{
 for(const p of [[0,0],[-61.94,331.29],[-21.7,203]]){const s=chooseElmwoodSpawn(terrain.segments,p[0],p[1],{x:0,z:-1});assert.ok(terrain.nearest(s.x,s.north).distance<.01);assert.ok(terrain.nearest(s.x+Math.sin(s.heading)*1.2,s.north-Math.cos(s.heading)*1.2).distance<.2);}
});
test('curbs are limited to office and chapel, outside riding centre and have matching terrain height',()=>{
 const curbs=makeElmwoodCurbs(site.features);assert.ok(curbs.length>30);
 for(const c of curbs){assert.ok(Math.hypot(c.x,c.north)<89||Math.hypot(c.x+61.94,c.north-331.29)<36);assert.ok(terrain.nearest(c.x,c.north).distance>=2);assert.ok(curbContains(c,c.x,c.north));assert.ok(Math.abs(terrain.height(c.x,c.north)-terrain.ground(c.x,c.north)-.155)<.001);}
});
test('Young memorial follows the recorded grave GPS and keeps lanes and estimated scenery clear',()=>{
 assert.ok(Math.hypot(ELMWOOD_YOUNG.x-(-153.6357916),ELMWOOD_YOUNG.north-468.1875938)<.01,'WGS84 grave pin projected into the site frame');
 assert.ok(terrain.nearest(ELMWOOD_YOUNG.x,ELMWOOD_YOUNG.north).distance>3.5,'Memorial stays outside the riding lane');
 for(const p of terrain.placements.filter(p=>p.layer!=='mapped'))assert.ok(Math.hypot(p.position[0]-ELMWOOD_YOUNG.x,p.position[1]-ELMWOOD_YOUNG.north)>4);
});
const ring=[[-4,-4],[4,-4],[4,4],[-4,4]];
function bird():BirdState{return{x:6,north:0,homeX:6,homeNorth:0,heading:-Math.PI/2,phase:0,age:0,cooldown:0,mode:'roam',kind:'goose',speed:0,swimming:false};}
test('birds approach a passing rider, stop chasing, and return home',()=>{
 const b=bird(),r={x:11,north:0,active:true};let t=0;stepBird(b,.05,t,r,ring);assert.equal(b.mode,'chase');
 for(let i=0;i<100;i++){t+=.05;stepBird(b,.05,t,r,ring);}assert.ok(b.x>7,'Bird pursues rider');
 for(let i=0;i<65;i++){t+=.05;stepBird(b,.05,t,r,ring);}assert.notEqual(b.mode,'chase');assert.ok(b.cooldown>0);
 for(let i=0;i<200;i++){t+=.05;stepBird(b,.05,t,{...r,active:false},ring);}assert.equal(b.mode,'roam');assert.ok(Math.hypot(b.x-b.homeX,b.north-b.homeNorth)<3);
});
test('swimming birds use the pond boundary and inactive riders do not trigger pursuit',()=>{
 const b=bird();b.x=b.homeX=0;b.north=b.homeNorth=0;stepBird(b,.05,0,{x:0,north:1,active:false},ring);assert.equal(b.swimming,true);assert.equal(b.mode,'roam');
 b.kind='duck';stepBird(b,.05,.05,{x:0,north:1,active:true},ring);assert.equal(b.mode,'chase');
});
