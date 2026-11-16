import * as T from 'three';
import {inside,segment,type ParkMap,type Point,type ParkTerrain} from './terrain.ts';

/** Two PBR draw submissions at most; overlays hug the authored geometric banks
 * without moving the terrain surface or the shoreline collision boundary.
 * Man-made waterfront seawalls are deliberately not buried under sediment.
 */
export const SHORE_STRATA_MAX_EDGES=4600;
export type ShoreStrataStats={edges:number;triangles:number;sandyEdges:number;lagoonEdges:number};
type Band='river'|'lagoon';
type Strip={positions:number[];colors:number[];uv:number[];indices:number[];stats:ShoreStrataStats};
const offsets={river:[.08,.72,1.58,2.55,3.65],lagoon:[.03,.22,.49,.76,1.04]} as const;
function lerp(a:number,b:number,t:number){return a+(b-a)*t;}
function pushEdge(out:Strip,a:Point,b:Point,nx:number,nz:number,top:number,kind:Band,sandy:boolean,along:number){
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]),bankWidth=kind==='river'?4:1.2,level=kind==='river'?-.1:.92;
 const chosen=offsets[kind],base=out.positions.length/3;
 for(const [x,z,u] of [[a[0],a[1],along],[b[0],b[1],along+length]]){
  for(const off of chosen){
   // Use the same linear bank grade as the river/lagoon meshes, with a tiny
   // uplift to prevent Z fighting. No visual change to physical ground height.
   const y=lerp(top,level,off/bankWidth)+.019;
   out.positions.push(x+nx*off,y,z+nz*off);
   const wet=off/bankWidth,marsh=kind==='lagoon';
   const dry=sandy?[.69,.60,.43]:marsh?[.44,.42,.30]:[.41,.39,.29];
   const mud=sandy?[.35,.34,.27]:marsh?[.27,.29,.24]:[.29,.31,.26];
   const blend=Math.min(1,Math.max(0,(wet-.23)/.7));
   out.colors.push(lerp(dry[0],mud[0],blend),lerp(dry[1],mud[1],blend),lerp(dry[2],mud[2],blend));
   out.uv.push(u*.15,wet);
  }
 }
 const w=chosen.length;
 for(let j=0;j<w-1;j++){const i=base+j,k=i+w;out.indices.push(i,k,i+1,k,k+1,i+1);}
 out.stats.edges++;out.stats.triangles+=(w-1)*2;
 if(sandy)out.stats.sandyEdges++;
 if(kind==='lagoon')out.stats.lagoonEdges++;
}
function ringPoints(p:Point[]):Point[]{
 if(p.length>2&&p[0][0]===p[p.length-1][0]&&p[0][1]===p[p.length-1][1])return p.slice(0,-1);
 return p;
}
export function buildShoreStrata(map:ParkMap,terrain:Pick<ParkTerrain,'height'|'land'|'bridge'>){
 const out:Strip={positions:[],colors:[],uv:[],indices:[],stats:{edges:0,triangles:0,sandyEdges:0,lagoonEdges:0}};
 const beaches=map.areas.filter(a=>a.kind==='beach'),formals=(map.waterSources||[]).filter(w=>/model yacht basin|koi/i.test(w.name));
 const sandy=(x:number,z:number)=>beaches.some(a=>inside(x,z,a.points)||a.points.slice(1).some((b,i)=>segment(x,z,a.points[i],b).d<7));
 const addRing=(ring:Point[],kind:Band,wetTest:(x:number,z:number)=>boolean)=>{
  const points=ringPoints(ring);if(points.length<3)return;
  let along=0;
  for(let i=0;i<points.length;i++){
   if(out.stats.edges>=SHORE_STRATA_MAX_EDGES)return;
   const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(length<.25||length>150){along+=length;continue;}
   const x=(a[0]+b[0])*.5,z=(a[1]+b[1])*.5,top=kind==='river'?terrain.height(x,z):2.005;
   if(!Number.isFinite(top)||terrain.bridge(x,z).active){along+=length;continue;}
   if(kind==='lagoon'&&formals.some(w=>w.points.slice(1).some((v,j)=>segment(x,z,w.points[j],v).d<1.5))){along+=length;continue;}
   // Segment normal points waterward, whether ring winding is CW or CCW.
   let nx=dz/length,nz=-dx/length;
   if(!wetTest(x+nx*.25,z+nz*.25)){nx=-nx;nz=-nz;}
   if(!wetTest(x+nx*.25,z+nz*.25)){along+=length;continue;}
   const landX=x-nx*.6,landZ=z-nz*.6;
   if(!terrain.land(landX,landZ)){along+=length;continue;}
   const steps=Math.max(1,Math.ceil(length/6));
   for(let j=0;j<steps&&out.stats.edges<SHORE_STRATA_MAX_EDGES;j++){
    const t0=j/steps,t1=(j+1)/steps;
    pushEdge(out,[lerp(a[0],b[0],t0),lerp(a[1],b[1],t0)],[lerp(a[0],b[0],t1),lerp(a[1],b[1],t1)],nx,nz,top,kind,sandy(x,z),along+length*t0);
   }
   along+=length;
  }
 };
 // Outer island and natural outlying island shore slopes, not seawalls.
 for(const ring of [map.island,...(map.outerIslets||[]).map(i=>i.points)]){
  addRing(ring,'river',(x,z)=>!inside(x,z,ringPoints(ring)));
 }
 // Lagoons and canal banks: include mapped islands within lagoons.
 for(const water of map.water){
  const isWet=(x:number,z:number)=>inside(x,z,water.points)&&!water.holes.some(h=>inside(x,z,h));
  for(const ring of [water.points,...water.holes])addRing(ring,'lagoon',isWet);
 }
 return out;
}
export function addShoreStrata(scene:T.Scene,map:ParkMap,terrain:ParkTerrain){
 const data=buildShoreStrata(map,terrain),g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));
 g.setAttribute('color',new T.Float32BufferAttribute(data.colors,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));g.setIndex(data.indices);g.computeVertexNormals();
 const material=new T.MeshStandardMaterial({name:'Mapped shoreline sediment strata',color:0xffffff,roughness:.92,metalness:0,vertexColors:true,side:T.DoubleSide});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 sedimentUV;varying vec2 sedimentXZ;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nsedimentXZ=(modelMatrix*vec4(transformed,1.)).xz;sedimentUV=uv;');
  shader.fragmentShader='varying vec2 sedimentUV;varying vec2 sedimentXZ;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   // Muted mineral banding, dissolved sediment and fine shoreline granules.
   float s=.5+.25*sin(sedimentXZ.x*1.43+sin(sedimentXZ.y*.41))+.25*sin(sedimentXZ.y*2.27);
   float pebble=fract(sin(dot(floor(sedimentXZ*9.),vec2(12.9898,78.233)))*43758.54);
   float aa=1.-smoothstep(.3,1.7,length(fwidth(sedimentXZ))*9.);
   diffuseColor.rgb*=.92+.13*s+(pebble-.5)*.065*aa;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float damp=smoothstep(.42,.93,sedimentUV.y);
    roughnessFactor=mix(roughnessFactor,.64,damp*.55);
  `);
 };
 material.customProgramCacheKey=()=> 'shore-sediment-strata-v1';
 const mesh=new T.Mesh(g,material);mesh.name='Mapped river and lagoon sediment bands';mesh.castShadow=false;mesh.receiveShadow=true;scene.add(mesh);
 return {stats:data.stats};
}
