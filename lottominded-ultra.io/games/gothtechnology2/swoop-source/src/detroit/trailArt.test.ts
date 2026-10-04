import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCutMurals,CUT_MURALS,SUPPLIED_CUT_MURALS} from './cutMurals.ts';
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
test('all original murals plus five blank-span additions keep solid walls outside the riding corridor',async()=>{
 const original=T.TextureLoader.prototype.loadAsync;T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
 try{
  const solids:Solid[]=[],world={solids,addBox:()=>{}} as unknown as DetroitWorld,group=new T.Group();
  const result=await buildCutMurals(world,()=>group);assert.equal(result.walls,13);assert.equal(result.ceilings,2);
  assert.equal(new Set(SUPPLIED_CUT_MURALS.map(s=>s.bridge)).size,5);
  for(const site of SUPPLIED_CUT_MURALS){assert.ok(!CUT_MURALS.some(s=>s.bridge===site.bridge));const mesh=group.children.find(o=>o.name.startsWith(site.title)) as T.Mesh;assert.ok(mesh);const points=mesh.geometry.getAttribute('position'),a=new T.Vector3().fromBufferAttribute(points,0),b=new T.Vector3().fromBufferAttribute(points,1),d=new T.Vector3().fromBufferAttribute(points,3);assert.ok(Math.abs(a.distanceTo(b)/a.distanceTo(d)-site.aspect)<.0001,'supplied art is stretched');}
  for(const s of solids)for(const x of [-s.hx,s.hx])for(const z of [-s.hz,s.hz]){const yaw=s.yaw??0,q=cutCoords(s.x+Math.cos(yaw)*x+Math.sin(yaw)*z,s.z-Math.sin(yaw)*x+Math.cos(yaw)*z);assert.ok(Math.abs(q.u)>cutWidth(q.d)/2+1,'mural obstructs the trail');}
 }finally{T.TextureLoader.prototype.loadAsync=original;}
});
