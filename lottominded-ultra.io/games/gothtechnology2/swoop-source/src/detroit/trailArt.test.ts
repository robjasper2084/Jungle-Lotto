import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCutMurals} from './cutMurals.ts';
import {trailPaintSites} from './trailPaint.ts';
import {DETROIT_FIELD_SIGN} from './routeArt.ts';
import {cutPoint,cutCoords,surfaceAt,type DetroitWorld,type Solid} from './world.ts';
import {roadAt} from './geography.ts';
import {cutWidth} from './geo-profile.ts';

test('field artwork stands on grass clear of the street across its full width',()=>{
 const s=DETROIT_FIELD_SIGN;
 for(let d=-s.width/2;d<=s.width/2;d+=.5){const p=cutPoint(s.at+d,s.offset);assert.equal(surfaceAt(p.x,p.z),'grass');assert.ok(!roadAt(p.x,p.z));}
});
test('pavement symbols fit inside the path and bicycle icons clear its centreline',()=>{
 const sites=trailPaintSites();assert.ok(sites.length>60);
 for(const s of sites){const half=s.type==='bike'?.56:s.type==='walk'?.4:.34;assert.ok(Math.abs(s.offset)+half<cutWidth(s.at)/2-.1);if(s.type==='bike')assert.ok(Math.abs(s.offset)-half>.1);}
});
test('eight source murals and two ceilings load with solid walls outside the riding corridor',async()=>{
 const original=T.TextureLoader.prototype.loadAsync;T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
 try{
  const solids:Solid[]=[],world={solids,addBox:()=>{}} as unknown as DetroitWorld,group=new T.Group();
  const result=await buildCutMurals(world,()=>group);assert.equal(result.walls,8);assert.equal(result.ceilings,2);
  for(const s of solids)for(const x of [-s.hx,s.hx])for(const z of [-s.hz,s.hz]){const yaw=s.yaw??0,q=cutCoords(s.x+Math.cos(yaw)*x+Math.sin(yaw)*z,s.z-Math.sin(yaw)*x+Math.cos(yaw)*z);assert.ok(Math.abs(q.u)>cutWidth(q.d)/2+1,'mural obstructs the trail');}
 }finally{T.TextureLoader.prototype.loadAsync=original;}
});
