import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {inside,segment,type ParkMap,type ParkTerrain} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import {CASINO_FOOTBRIDGES} from './casinoBridgeDetail.ts';

export type CanalPiece={x:number;y:number;z:number;yaw:number;scale:number;color:number};
export const CANAL_DETAIL_LIMITS={
 smooth:{reeds:48,branches:12,range:110},
 automatic:{reeds:150,branches:42,range:195},
 high:{reeds:320,branches:88,range:290}
} as const;
const MAX_REEDS=640,MAX_BRANCHES=140;

/** Non-colliding wetland detail, on dry banks only. Decorative placement never
 * changes roads, bridges, water collision, terrain height or ride physics. */
export function planLivingCanals(map:ParkMap,terrain:Pick<ParkTerrain,'land'|'height'|'obstructed'|'bridge'|'smallBridges'>){
 const reeds:CanalPiece[]=[],branches:CanalPiece[]=[];
 const occupied=roadIndex(map.roads),beaches=map.areas.filter(a=>a.kind==='beach');
 const canalFocus=map.pois.filter(p=>/^(Sylvan|Nashua|Loop) Canal$/.test(p.name)).map(p=>({x:p.x,z:p.z}));
 const red=terrain.smallBridges.plan.parts.filter(p=>p.kind==='slab'&&CASINO_FOOTBRIDGES.has(p.id))
   .map(p=>({x:(p.a[0]+p.b[0])*.5,z:(p.a[1]+p.b[1])*.5}));
 let seed=827341;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 const beach=(x:number,z:number)=>beaches.some(a=>inside(x,z,a.points)||a.points.some((b,i)=>segment(x,z,b,a.points[(i+1)%a.points.length]).d<9));
 for(const w of map.water){
  if(w.points.length<3)continue;
  for(let i=1;i<w.points.length;i++){
   const a=w.points[i-1],b=w.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   if(len<.2)continue;
   const nx=dz/len,nz=-dx/len,count=Math.min(32,Math.ceil(len/9));
   for(let j=0;j<count;j++){
    const t=(j+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t;
    for(const side of [-1,1]){
     const offset=1.3+rand()*1.4,px=x+nx*side*offset,pz=z+nz*side*offset;
     if(!terrain.land(px,pz)||terrain.bridge(px,pz).active||beach(px,pz)||occupied(px,pz,'',2.6)||terrain.obstructed(px,pz,.55))continue;
     const redApproach=red.some(p=>(p.x-px)**2+(p.z-pz)**2<95*95);
     const woodedCanal=canalFocus.some(p=>(p.x-px)**2+(p.z-pz)**2<145*145);
     if(reeds.length<MAX_REEDS&&rand()<(redApproach?.92:woodedCanal?.80:.52)){
      const scale=woodedCanal?.83+rand()*.65:.68+rand()*.65;
      reeds.push({x:px,y:terrain.height(px,pz)+.015,z:pz,yaw:rand()*Math.PI*2,scale,
       color:new T.Color().setHSL(.19+rand()*.075,.32+rand()*.12,.25+rand()*.14).getHex()});
     }
     if(branches.length>=MAX_BRANCHES||rand()>(redApproach?.095:woodedCanal?.075:.035))continue;
     const inland=3.8+rand()*2.4,bx=x+nx*side*inland,bz=z+nz*side*inland;
     if(!terrain.land(bx,bz)||terrain.bridge(bx,bz).active||beach(bx,bz)||occupied(bx,bz,'',3.4)||terrain.obstructed(bx,bz,.9))continue;
     branches.push({x:bx,y:terrain.height(bx,bz)+.11,z:bz,yaw:rand()*Math.PI*2,scale:.62+rand()*.75,
      color:new T.Color().setHSL(.076,.17,.26+rand()*.11).getHex()});
    }
   }
  }
 }
 return {reeds,branches,redBridgeAnchors:red.length};
}

function reedGeometry(){
 const vertices:number[]=[];
 for(let i=0;i<7;i++){
  const a=i*2.4,r=.08+(i%3)*.07,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.72+(i%4)*.24;
  vertices.push(x-.034,0,z,x+.034,0,z,x*1.55,h,z*1.55);
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 g.computeVertexNormals();
 return g;
}
function fallenBranchGeometry(){
 const log=new T.CylinderGeometry(.068,.12,1.9,5,1),twig=new T.CylinderGeometry(.022,.047,.68,4,1);
 log.rotateZ(Math.PI/2);twig.rotateZ(.8);twig.translate(.47,.24,0);
 const result=mergeGeometries([log,twig])!;log.dispose();twig.dispose();
 return result;
}
export function addLivingCanals(scene:T.Scene,map:ParkMap,terrain:ParkTerrain){
 const plan=planLivingCanals(map,terrain),dummy=new T.Object3D(),tint=new T.Color(),wind={value:0};
 const reedMaterial=new T.MeshStandardMaterial({name:'Living canal reeds',color:0xffffff,side:T.DoubleSide,roughness:.96,metalness:0});
 reedMaterial.onBeforeCompile=shader=>{
  shader.uniforms.canalWind=wind;
  shader.vertexShader='uniform float canalWind;\n'+shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\ntransformed.x+=sin(canalWind*1.15+position.z*5.)*.035*position.y;');
 };
 reedMaterial.customProgramCacheKey=()=> 'canal-reed-wind-v1';
 const branchMaterial=new T.MeshStandardMaterial({name:'Fallen canal limbs',color:0xffffff,roughness:1,flatShading:true});
 const reeds=new T.InstancedMesh(reedGeometry(),reedMaterial,Math.max(1,plan.reeds.length));
 const branches=new T.InstancedMesh(fallenBranchGeometry(),branchMaterial,Math.max(1,plan.branches.length));
 for(const mesh of [reeds,branches]){mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);}
 reeds.name='Sheltered canal reeds and sedges';branches.name='Dry fallen branches along wooded canals';
 let quality:keyof typeof CANAL_DETAIL_LIMITS='automatic',lastX=Infinity,lastZ=Infinity;
 const stats={reeds:plan.reeds.length,branches:plan.branches.length,redBridgeAnchors:plan.redBridgeAnchors,visibleReeds:0,visibleBranches:0,maxDraws:2};
 function fill(mesh:T.InstancedMesh,sites:CanalPiece[],limit:number,range:number,x:number,z:number){
  const range2=range*range;
  const selected=sites.filter(p=>(p.x-x)**2+(p.z-z)**2<range2)
   .sort((a,b)=>(a.x-x)**2+(a.z-z)**2-(b.x-x)**2-(b.z-z)**2).slice(0,limit);
  mesh.count=selected.length;mesh.visible=selected.length>0;
  selected.forEach((p,i)=>{
   dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,tint.setHex(p.color));
  });
  if(selected.length){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  return selected.length;
 }
 return {stats,setQuality(v:string){quality=v==='smooth'||v==='high'?v:'automatic';lastX=Infinity;},
  update(x:number,z:number,time:number){
   wind.value=time;
   if(Math.hypot(x-lastX,z-lastZ)<7)return;
   lastX=x;lastZ=z;
   const b=CANAL_DETAIL_LIMITS[quality];
   stats.visibleReeds=fill(reeds,plan.reeds,b.reeds,b.range,x,z);
   stats.visibleBranches=fill(branches,plan.branches,b.branches,b.range,x,z);
  }
 };
}
