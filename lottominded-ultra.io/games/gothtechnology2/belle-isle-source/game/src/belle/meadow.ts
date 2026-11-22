import {REFERENCE_STYLE} from './sunsetReferencePolicy.ts';
import * as T from 'three';
import {uploadInstancePrefix} from './instanceUpload.ts';
import {loadStartupBytes} from './startupAssets.ts';
import {meadowBudget,meadowRandom,type MeadowPlan} from './meadowPlan.ts';

/** Stream a fixed pool of real blade geometry around the rider; no runtime map scans. */
export async function addMeadow(scene:T.Scene){
 const bytes=await loadStartupBytes('./belle/nature/meadow.json');
 const plan=JSON.parse(new TextDecoder().decode(bytes)) as MeadowPlan,cells=new Map(plan.cells.map(c=>[c[0]*65536+c[1],c]));
 const positions:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[];
 // Narrow curved ribbons, with varied bends and visible grass tips instead of flat cards.
 for(let blade=0;blade<14;blade++){
  const angle=meadowRandom(blade,17)*Math.PI*2,reach=meadowRandom(blade,31)*.42;
  const x=Math.sin(angle)*reach,z=Math.cos(angle)*reach,h=.65+meadowRandom(blade,42)*.35;
  const width=.016+meadowRandom(blade,54)*.024,bend=.08+meadowRandom(blade,69)*.16,base=positions.length/3;
  for(let level=0;level<3;level++){
   const t=level*.5,w=width*(1-t*.94),curve=bend*t*t;
   for(const side of [-1,1]){positions.push(x+Math.sin(angle)*curve+Math.cos(angle)*w*side,h*t,z+Math.cos(angle)*curve-Math.sin(angle)*w*side);normals.push(Math.sin(angle)*.28,.92,Math.cos(angle)*.28);const shade=.44+t*.56;colors.push(shade*.85,shade,shade*.63);}
  }
  indices.push(base,base+2,base+1,base+1,base+2,base+3,base+2,base+4,base+3,base+3,base+4,base+5);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
 const material=new T.MeshStandardMaterial({name:'Meadow grass blades',color:0x9aa879,vertexColors:true,roughness:.94,side:T.DoubleSide});
 const clock={value:0},rider={value:new T.Vector3()},range={value:38};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{meadowClock:clock,meadowRider:rider,meadowRange:range});
  // Both faces use the upward blade normal: card backs must not turn black.
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nnormal *= faceDirection;\n#endif');
  shader.vertexShader='uniform float meadowClock;uniform vec3 meadowRider;uniform float meadowRange;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec3 meadowOrigin=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 float meadowDistance=length(meadowOrigin.xz-meadowRider.xz);
 float meadowFade=1.-smoothstep(meadowRange*.72,meadowRange,meadowDistance);
 float meadowTip=position.y*position.y;
 float meadowWind=sin(meadowClock*1.7+meadowOrigin.x*.17+meadowOrigin.z*.11)*.075+sin(meadowClock*2.8+meadowOrigin.z*.43)*.025;
 float meadowBend=(1.-smoothstep(.35,2.,meadowDistance))*(1.-smoothstep(1.8,3.,abs(meadowRider.y-meadowOrigin.y)));
 vec2 meadowAway=(meadowOrigin.xz-meadowRider.xz)/max(meadowDistance,.1);
 transformed.xz+=vec2(meadowWind,meadowWind*.42)*meadowTip+meadowAway*.38*meadowBend*meadowTip;
 transformed.y*=meadowFade*(1.-meadowBend*.55);`);
 };
 material.customProgramCacheKey=()=> 'meadow-blades-v1';
 // A single island-wide draw sends every selected blade through the vertex
 // shader, even when its entire cell is behind the camera. Three can cull a
 // tile separately for each camera, including reflections and split views.
 const cellsPerTile=3,maxPerCell=124,tiles:T.InstancedMesh[]=[];
 function allocateTile(){
  const mesh=new T.InstancedMesh(geometry,material,cellsPerTile*cellsPerTile*maxPerCell);
  mesh.name='Living meadow grass';mesh.count=0;mesh.receiveShadow=true;
  mesh.setColorAt(0,new T.Color(0xffffff));mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.instanceColor!.setUsage(T.DynamicDrawUsage);mesh.boundingBox=new T.Box3();mesh.boundingSphere=new T.Sphere();
  tiles.push(mesh);scene.add(mesh);return mesh;
 }
 allocateTile(); // Include this material and its instance colours in initial shader preparation.
 const tileForCell=new Map<number,T.InstancedMesh>();
 const cellMin=new T.Vector3(),cellMax=new T.Vector3();
 const dummy=new T.Object3D(),color=new T.Color();let quality:keyof typeof meadowBudget='automatic',lastX=Infinity,lastZ=Infinity;
 let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const motion=document.getElementById('motion') as HTMLInputElement|null;motion?.addEventListener('change',()=>reduced=motion.checked);
 const stats={cells:plan.cells.length,tufts:0,trianglesPerTuft:56};
 function update(time:number,x:number,z:number,y=2){
  clock.value=reduced?0:time;rider.value.set(x,y,z);const budget=meadowBudget[quality];
  if(Math.hypot(x-lastX,z-lastZ)<3)return;lastX=x;lastZ=z;
  const ix=Math.round(x/plan.cellSize),iz=Math.round(z/plan.cellSize),r=Math.ceil(budget.radius/plan.cellSize)+1;
  const nearby=[];for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){const cell=cells.get((ix+dx)*65536+iz+dz);if(cell&&Math.hypot(cell[0]*plan.cellSize-x,cell[1]*plan.cellSize-z)<budget.radius+plan.cellSize)nearby.push(cell);}
  nearby.sort((a,b)=>(a[0]*plan.cellSize-x)**2+(a[1]*plan.cellSize-z)**2-((b[0]*plan.cellSize-x)**2+(b[1]*plan.cellSize-z)**2));
  tileForCell.clear();
  for(const mesh of tiles){mesh.count=0;mesh.boundingBox!.makeEmpty();}
  let count=0,edge=budget.radius;for(const cell of nearby){
   if(count>=budget.tufts){edge=Math.min(budget.radius,Math.hypot(cell[0]*plan.cellSize-x,cell[1]*plan.cellSize-z)-plan.cellSize*.75);break;}
   const [cx,cz,ground,zone]=cell,number=zone===2?70:zone===0?96:124;
   const key=Math.floor(cx/cellsPerTile)*65536+Math.floor(cz/cellsPerTile);
   let mesh=tileForCell.get(key);
   if(!mesh){mesh=tiles[tileForCell.size]??allocateTile();tileForCell.set(key,mesh);}
   // Two metres beyond each seed cell covers the tuft radius, 1.3x
   // instance scale, curved tips, wind and maximum rider displacement.
   const half=plan.cellSize*.5+2;
   mesh.boundingBox!.expandByPoint(cellMin.set(cx*plan.cellSize-half,ground-1,cz*plan.cellSize-half));
   mesh.boundingBox!.expandByPoint(cellMax.set(cx*plan.cellSize+half,ground+1,cz*plan.cellSize+half));
   for(let i=0;i<number&&count<budget.tufts;i++){
    const px=(cx+meadowRandom(cx,cz,i*5)-.5)*plan.cellSize,pz=(cz+meadowRandom(cx,cz,i*5+1)-.5)*plan.cellSize;
    if(Math.hypot(px-x,pz-z)>budget.radius)continue;
    const patch=.5+.5*Math.sin(px*.15+Math.cos(pz*.13));
    const h=zone===0?.13+meadowRandom(cx,cz,i*5+2)*.25:zone===2?.22+meadowRandom(cx,cz,i*5+2)*.34:.28+meadowRandom(cx,cz,i*5+2)*.50;
    dummy.position.set(px,ground-.018,pz);dummy.rotation.set(0,meadowRandom(cx,cz,i*5+3)*Math.PI*2,0);dummy.scale.set(.85+patch*.45,h*(.78+patch*.22)*(REFERENCE_STYLE?(zone===2?.80:.45+patch*.20):1),.85+patch*.45);dummy.updateMatrix();mesh.setMatrixAt(mesh.count,dummy.matrix);
    color.setHSL(.20+meadowRandom(cx,cz,i*5+4)*.035,.18+patch*.13,.61+meadowRandom(cx,cz,i*5+2)*.22);mesh.setColorAt(mesh.count,color);mesh.count++;count++;
   }
  }
  range.value=Math.max(12,edge);stats.tufts=count;
  for(const mesh of tiles){
   mesh.visible=mesh.count>0;
   if(!mesh.visible)continue;
   mesh.boundingBox!.getBoundingSphere(mesh.boundingSphere!);
   uploadInstancePrefix(mesh.instanceMatrix,mesh.count);uploadInstancePrefix(mesh.instanceColor,mesh.count);
  }
 }
 return{stats,update,setQuality(value:string){quality=value in meadowBudget?value as keyof typeof meadowBudget:'automatic';lastX=Infinity;}};
}
