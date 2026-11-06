import * as T from 'three';
import {SHORE_BUDGETS,environmentQuality,type EnvironmentQuality} from './environmentDetail.ts';

export type ShoreInstance={x:number;y:number;z:number;yaw:number;sx:number;sy:number;sz:number;color:number};

/** Shared low-poly blades: opaque geometry, with neither alpha cards nor wind. */
export function bankGrassGeometry(){
 const vertices:number[]=[];
 for(let i=0;i<7;i++){
  const a=i*2.4,r=.1+(i%3)*.045,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.65+(i%4)*.1;
  vertices.push(x-.022,0,z,x+.022,0,z,x*1.8,h,z*1.8);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}

/** One bounded instanced draw per detail kind. Geometry settles into the bank
 * over the outer third of the range, before it leaves the selection pool. */
export function createShoreDetailPool(scene:T.Scene,geometry:T.BufferGeometry,material:T.MeshStandardMaterial,instances:ShoreInstance[],kind:'rocks'|'plants',name:string){
 const viewer={value:new T.Vector2()},range={value:1},oldCompile=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  oldCompile(shader,renderer);shader.uniforms.shoreViewer=viewer;shader.uniforms.shoreRange=range;
  shader.vertexShader='uniform vec2 shoreViewer;uniform float shoreRange;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   #ifdef USE_INSTANCING
    vec3 shoreCentre=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
    float shoreScale=1.-smoothstep(shoreRange*.68,shoreRange,length(shoreCentre.xz-shoreViewer));
    transformed*=shoreScale;
   #endif
  `);
 };material.customProgramCacheKey=()=>oldKey+'-shore-distance-settle-v1';
 const capacity=SHORE_BUDGETS.high[kind],mesh=new T.InstancedMesh(geometry,material,capacity),dummy=new T.Object3D(),tint=new T.Color();
 mesh.name=name;mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.receiveShadow=kind==='rocks';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
 let quality:EnvironmentQuality='automatic',lastX=Infinity,lastZ=Infinity,selected=new Set<number>();
 const stats={total:instances.length,visible:0,limit:0,range:0,maxDraws:1};
 function budget(){const b=SHORE_BUDGETS[quality];stats.limit=b[kind];stats.range=kind==='rocks'?b.rockRange:b.plantRange;range.value=stats.range;}
 budget();
 return {stats,
  setQuality(value:string){quality=environmentQuality(value);budget();lastX=Infinity;},
  update(x:number,z:number){
   viewer.value.set(x,z);
   if(Math.hypot(x-lastX,z-lastZ)<8)return;
   lastX=x;lastZ=z;
   // Keep a fully faded guard band, plus a small preference for existing
   // selections, so crossing a pool boundary does not flicker nearby details.
   const limit=(stats.range+20)**2,candidates:{index:number;score:number}[]=[];
   for(let index=0;index<instances.length;index++){
    const item=instances[index],d=(item.x-x)**2+(item.z-z)**2;
    if(d<limit)candidates.push({index,score:Math.sqrt(d)-(selected.has(index)?12:0)});
   }
   candidates.sort((a,b)=>a.score-b.score||a.index-b.index);candidates.length=Math.min(candidates.length,stats.limit);
   selected=new Set(candidates.map(c=>c.index));mesh.count=candidates.length;mesh.visible=mesh.count>0;stats.visible=mesh.count;
   candidates.forEach(({index},slot)=>{
    const item=instances[index];dummy.position.set(item.x,item.y,item.z);dummy.rotation.set(0,item.yaw,0);dummy.scale.set(item.sx,item.sy,item.sz);dummy.updateMatrix();
    mesh.setMatrixAt(slot,dummy.matrix);mesh.setColorAt(slot,tint.setHex(item.color));
   });
   mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor){mesh.instanceColor.setUsage(T.DynamicDrawUsage);mesh.instanceColor.needsUpdate=true;}
  }
 };
}
