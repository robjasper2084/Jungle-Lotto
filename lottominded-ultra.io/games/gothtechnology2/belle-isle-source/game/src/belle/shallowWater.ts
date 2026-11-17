import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {inside,type ParkMap,type Point} from './terrain.ts';
import {KOI_POND_ID} from './waterFeatures.ts';

export const SHALLOW_LIMITS={smooth:{stones:0,range:0},automatic:{stones:32,range:190},high:{stones:80,range:320}} as const;
export type ShoalStone={x:number;y:number;z:number;size:number;yaw:number};
function koi(map:ParkMap,w:ParkMap['water'][number]){
 return !!map.waterSources?.some(s=>s.id===KOI_POND_ID)&&inside(1336,1149,w.points);
}
const wet=(w:ParkMap['water'][number],x:number,z:number)=>
 inside(x,z,w.points)&&!w.holes.some(h=>inside(x,z,h));

/** Art-directed lagoon shoals. No road, terrain height or collision changes. */
export function planShallows(map:ParkMap){
 const points:number[]=[],uv:number[]=[],index:number[]=[],stones:ShoalStone[]=[];
 let seed=1771,along=0,edges=0;
 const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 for(const w of map.water){
  if(koi(map,w))continue;
  for(const ring of [w.points,...w.holes])for(let i=0;i<ring.length&&edges<2100;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(length<.2||length>150)continue;
   const nx=dz/length,nz=-dx/length,n=Math.ceil(length/7);
   for(let j=0;j<n&&edges<2100;j++){
    const t=(j+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t;
    const side=wet(w,x+nx*2,z+nz*2)?1:wet(w,x-nx*2,z-nz*2)?-1:0;
    if(!side)continue;
    const s=points.length/3,ox=nx*side,oz=nz*side;
    for(const [u,v] of [[j/n,0],[(j+1)/n,0],[j/n,1],[(j+1)/n,1]]){
     const at=u*length,off=v?6.2:.12;
     points.push(a[0]+dx*u+ox*off,1.065,a[1]+dz*u+oz*off);
     uv.push(along+at,v);
    }
    index.push(s,s+1,s+2,s+1,s+3,s+2);edges++;
    if(stones.length<115&&rand()<.12){
     const bx=x+ox*(1.8+rand()*3),bz=z+oz*(1.8+rand()*3);
     if(wet(w,bx,bz))stones.push({x:bx,y:.67+rand()*.19,z:bz,size:.18+rand()*.41,yaw:rand()*Math.PI*2});
    }
   }
   along+=length;
  }
 }
 return{points,uv,index,stones,edges};
}
export function addShallowWater(scene:T.Scene,map:ParkMap,polygon:(points:Point[],y:number,holes?:Point[][])=>T.BufferGeometry){
 const plan=planShallows(map),beds=map.water.filter(w=>!koi(map,w)).map(w=>polygon(w.points,.22,w.holes));
 const bed=new T.Mesh(beds.length?mergeGeometries(beds)!:new T.BufferGeometry(),
  new T.MeshStandardMaterial({name:'Lagoon sediment visible beneath water',color:0x77755e,roughness:.96,side:T.DoubleSide}));
 beds.forEach(g=>g.dispose());bed.name='Submerged lagoon sediment bed';scene.add(bed);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(plan.points,3));g.setAttribute('uv',new T.Float32BufferAttribute(plan.uv,2));g.setIndex(plan.index);
 const time={value:0};
 const edge=new T.Mesh(g,new T.ShaderMaterial({uniforms:{time},transparent:true,depthWrite:false,side:T.DoubleSide,
  vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform float time;varying vec2 v;void main(){float shore=1.-smoothstep(0.,1.,v.y);float rip=sin(v.x*.48-time*.9)*sin(v.x*.19+time*.5);float alpha=(.09+.11*shore)*(.84+.16*rip);gl_FragColor=vec4(mix(vec3(.085,.22,.23),vec3(.27,.43,.36),shore),alpha);'+'\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
 }));edge.name='Lagoon shallow-depth and ripple gradient';edge.renderOrder=3;scene.add(edge);
 const rock=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),
  new T.MeshStandardMaterial({name:'Submerged limestone stones',color:0x7b7d74,roughness:.78,flatShading:true}),Math.max(1,plan.stones.length));
 rock.name='Visible submerged lagoon stones';rock.count=0;rock.visible=false;rock.castShadow=false;scene.add(rock);
 const dummy=new T.Object3D();let quality:keyof typeof SHALLOW_LIMITS='automatic',lastX=Infinity,lastZ=Infinity;
 const stats={edges:plan.edges,stones:plan.stones.length,visibleStones:0,maxDraws:3};
 return{stats,
  setQuality(q:string){quality=q==='smooth'||q==='high'?q:'automatic';bed.visible=edge.visible=quality!=='smooth';lastX=Infinity;},
  update(x:number,z:number,t:number){
   time.value=t;if(Math.hypot(x-lastX,z-lastZ)<8)return;lastX=x;lastZ=z;
   const budget=SHALLOW_LIMITS[quality],maxD=budget.range*budget.range;
   const near=plan.stones.filter(p=>(p.x-x)**2+(p.z-z)**2<maxD).sort((a,b)=>
    (a.x-x)**2+(a.z-z)**2-(b.x-x)**2-(b.z-z)**2).slice(0,budget.stones);
   rock.count=near.length;rock.visible=near.length>0;stats.visibleStones=near.length;
   near.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);
    dummy.scale.set(p.size,p.size*.73,p.size);dummy.updateMatrix();rock.setMatrixAt(i,dummy.matrix);});
   if(near.length)rock.instanceMatrix.needsUpdate=true;
  }
 };
}
