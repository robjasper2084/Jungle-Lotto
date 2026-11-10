import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {SmallBridgePlan} from './smallBridges.ts';
import {yieldStartupTask} from './startupWork.ts';

/** Structural geometry never uses optional foliage/detail LOD. Fixed material
 * batches are frustum-culled by tile for BOTH solo and split-screen cameras. */
function* buildSmallBridges(scene:T.Scene,plan:SmallBridgePlan){
 const root=new T.Group();root.name='Mapped canal bridges and raised trail links';
 const materials={stone:new T.MeshStandardMaterial({color:0x9e9e91,roughness:.88}),iron:new T.MeshStandardMaterial({color:0x5a4a43,roughness:.7,metalness:.25}),timber:new T.MeshStandardMaterial({color:0x74634b,roughness:.92}),brick:new T.MeshStandardMaterial({color:0x9d5e43,roughness:.93})};
 materials.brick.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 bridgePos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbridgePos=position;');
  shader.fragmentShader='varying vec3 bridgePos;\n'+shader.fragmentShader.replace('#include <map_fragment>',[
   '#include <map_fragment>',
   'vec2 q=vec2(bridgePos.x*.42+bridgePos.z*.91,bridgePos.y)/vec2(.28,.09);q.x+=mod(floor(q.y),2.)*.5;',
   'vec2 e=min(fract(q),1.-fract(q));float mortar=1.-smoothstep(.025,.07+max(fwidth(q.x),fwidth(q.y)),min(e.x,e.y));',
   'float diamond=step(.80,abs(sin((bridgePos.x*.42+bridgePos.z*.91)*2.+bridgePos.y*5.)))*step(.80,abs(sin((bridgePos.x*.42+bridgePos.z*.91)*2.-bridgePos.y*5.)));',
   'diffuseColor.rgb*=mix(vec3(1.-diamond*.3),vec3(.66,.66,.61),mortar);'
  ].join('\n'));
 };materials.brick.customProgramCacheKey=()=>'inselruhe-parapet-brick-v1';
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
  if(p.style==='brick'){
   const h=p.top-p.bottom;
   box('brick',x,p.bottom+(h-.14)/2,z,.44,h-.14,len,yaw);
   box('stone',x,p.top-.07,z,.60,.14,len,yaw);
   for(const end of [p.a,p.b]){
    box('brick',end[0],p.bottom+h*.45,end[1],.5,h*.9,.48,yaw);
    box('stone',end[0],p.top-.12,end[1],.6,.24,.62,yaw);
   }
   continue;
  }
  if(['42986446','443360496','1445474347','1531391025'].includes(p.id)){
   box('stone',x,p.bottom+.28,z,.20,.56,len,yaw);
   for(const level of [.74,1.02])box('iron',x,p.bottom+level,z,.055,.055,len,yaw);
   const n=Math.max(1,Math.ceil(len/2.5));for(let i=0;i<=n;i++)box('iron',p.a[0]+dx*i/n,p.bottom+.79,p.a[1]+dz*i/n,.06,.52,.06,yaw);
   continue;
  }
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
