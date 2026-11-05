import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCutMurals,CUT_MURALS,SUPPLIED_CUT_MURALS,muralBacking} from './cutMurals.ts';
import {trailPaintSites,trailPaintGeometry} from './trailPaint.ts';
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
  const result=await buildCutMurals(world,()=>group);assert.equal(result.walls,13);assert.equal(result.ceilings,0);
  assert.ok(!group.children.some(o=>/painted.*underside|underside.*stringers/.test(o.name)),'graffiti remains on a bridge ceiling or beam');
  assert.equal(new Set(SUPPLIED_CUT_MURALS.map(s=>s.bridge)).size,5);
  for(const site of SUPPLIED_CUT_MURALS){
   assert.ok(!CUT_MURALS.some(s=>s.bridge===site.bridge));
   const mesh=group.children.find(o=>o.name.startsWith(site.title+' / supplied game mural')) as T.Mesh;assert.ok(mesh);
   const placement=muralBacking(site,true)!;
   const points=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv'),a=new T.Vector3().fromBufferAttribute(points,0),b=new T.Vector3().fromBufferAttribute(points,1),d=new T.Vector3().fromBufferAttribute(points,3);
   assert.ok(Math.abs(a.distanceTo(b)-placement.width)<.0001,'paint leaves bare wall borders');
   assert.ok(Math.abs(a.distanceTo(d)-(placement.roof-placement.base))<.0001,'paint stops above the floor or below the roof');
   assert.ok(Math.abs(a.distanceTo(b)/a.distanceTo(d)/(uv.getX(1)-uv.getX(0))*(uv.getY(3)-uv.getY(0))-site.aspect)<.0001,'cover crop stretches the art');
   assert.ok(uv.getX(0)<uv.getX(1),'lettering is mirrored from the trail');
   const normal=new T.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('normal'),0),inward=new T.Vector3().setFromMatrixColumn(placement.f.matrix,0).multiplyScalar(-site.side);
   assert.ok(normal.dot(inward)>.99,'paint faces away from the trail');
   assert.equal((mesh.material as T.MeshStandardMaterial).userData.finish,'spray paint on concrete');
  }
  for(const s of solids)for(const x of [-s.hx,s.hx])for(const z of [-s.hz,s.hz]){const yaw=s.yaw??0,q=cutCoords(s.x+Math.cos(yaw)*x+Math.sin(yaw)*z,s.z-Math.sin(yaw)*x+Math.cos(yaw)*z);assert.ok(Math.abs(q.u)>cutWidth(q.d)/2+1,'mural obstructs the trail');}
 }finally{T.TextureLoader.prototype.loadAsync=original;}
});

test('lane paint stays above the same greenway triangles through grades and every tile boundary',async()=>{
 const world=new (await import('./world.ts')).DetroitWorld(),sites=trailPaintSites();let probes=0;
 for(const site of sites){const p=cutPoint(site.at,site.offset),parts=trailPaintGeometry(world.chunks,site.type==='bike'?1.12:.68,1.65,p.x,p.z,p.heading+(site.reverse?Math.PI:0));assert.ok(parts.length>0,'missing symbol at '+site.at);
  for(const part of parts){const a=part.geometry.attributes.position;for(let i=0;i<a.count;i+=3){const x=(a.getX(i)+a.getX(i+1)+a.getX(i+2))/3,z=(a.getZ(i)+a.getZ(i+1)+a.getZ(i+2))/3,y=(a.getY(i)+a.getY(i+1)+a.getY(i+2))/3;
   const terrain=part.chunk,mesh=new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(terrain.vertices,3)).setIndex(new T.BufferAttribute(terrain.indices,1)),new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(x,100,z),new T.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert.ok(hit);assert.ok(Math.abs(y-hit.point.y-.083)<.0001,'paint buried under road at '+site.at);mesh.geometry.dispose();(mesh.material as T.Material).dispose();probes++;}part.geometry.dispose();}
 }
 assert.ok(probes>200);
});
