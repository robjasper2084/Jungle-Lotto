import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {SmallBridgePlan} from './smallBridges.ts';
import {yieldStartupTask} from './startupWork.ts';

/** Structural geometry never uses optional foliage/detail LOD. Fixed material
 * batches are frustum-culled by tile for BOTH solo and split-screen cameras. */
function* buildSmallBridges(scene:T.Scene,plan:SmallBridgePlan){
 const root=new T.Group();root.name='Mapped canal bridges and raised trail links';
 const materials={stone:new T.MeshStandardMaterial({color:0x9e9e91,roughness:.88}),iron:new T.MeshStandardMaterial({color:0x5a4a43,roughness:.7,metalness:.25}),timber:new T.MeshStandardMaterial({color:0x74634b,roughness:.92})};
 const batches=new Map<string,{kind:keyof typeof materials;geometry:T.BufferGeometry[]}>();let boxes=0;
 function box(kind:keyof typeof materials,x:number,y:number,z:number,w:number,h:number,l:number,yaw:number){
  if(![x,y,z,w,h,l,yaw].every(Number.isFinite)||Math.min(w,h,l)<=0)throw Error('Invalid small-bridge geometry');
  const key=Math.floor(x/256)+','+Math.floor(z/256)+','+kind;if(!batches.has(key))batches.set(key,{kind,geometry:[]});
  const g=new T.BoxGeometry(w,h,l);g.rotateY(yaw);g.translate(x,y,z);batches.get(key)!.geometry.push(g);boxes++;
 }
 let partIndex=0;for(const p of plan.parts){
  if(partIndex++%8===0)yield;
  const dx=p.b[0]-p.a[0],dz=p.b[1]-p.a[1],len=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),x=(p.a[0]+p.b[0])/2,z=(p.a[1]+p.b[1])/2;
  if(p.kind==='slab'){box(p.style==='timber'?'timber':'stone',x,(p.bottom+p.top)/2,z,p.width,p.top-p.bottom,len,yaw);continue;}
  const kind=p.style==='timber'?'timber':p.style==='concrete'?'stone':'iron',height=p.top-p.bottom;
  // Open railings retain the canal view, with deck-edge curbs and capped posts.
  box(kind,x,p.bottom+.10,z,.12,.20,len,yaw);
  for(const level of [.5,.97])box(kind,x,p.bottom+height*level,z,.10,.075,len,yaw);
  const count=Math.max(1,Math.ceil(len/2.5));for(let i=0;i<=count;i++)box(kind,p.a[0]+dx*i/count,p.bottom+height/2,p.a[1]+dz*i/count,.12,height,.12,yaw);
 }
 let triangles=0;for(const [key,batch]of batches){
  yield;
  const g=mergeGeometries(batch.geometry);batch.geometry.forEach(x=>x.dispose());if(!g)throw Error('Bridge batch failed');g.computeBoundingBox();g.computeBoundingSphere();
  const mesh=new T.Mesh(g,materials[batch.kind]);mesh.name='Canal bridge structure '+key;mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);triangles+=(g.index?.count??g.attributes.position.count)/3;
 }
 scene.add(root);
 return {root,stats:{mappedLinks:plan.links.length,railSegments:plan.parts.filter(p=>p.kind==='rail').length,batches:batches.size,boxes,triangles},dispose(){root.removeFromParent();root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});for(const m of Object.values(materials))m.dispose();}};
}

/** Synchronous adapter retained for deterministic CPU geometry fixtures. */
export function addSmallBridges(scene:T.Scene,plan:SmallBridgePlan){
 const work=buildSmallBridges(scene,plan);let next=work.next();while(!next.done)next=work.next();return next.value;
}
/** Gameplay boot slices construction, but adds the complete structure atomically. */
export async function addSmallBridgesStaged(scene:T.Scene,plan:SmallBridgePlan,yieldTask=yieldStartupTask){
 const work=buildSmallBridges(scene,plan);let begin=performance.now(),next=work.next();
 while(!next.done){if(performance.now()-begin>=4){await yieldTask();begin=performance.now();}next=work.next();}
 return next.value;
}
