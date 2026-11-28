/** Export the actual current Jefferson meshes for a clearly labelled offline
 * model preview. This is not a game renderer or a replacement for in-game QA.
 * Usage: node --experimental-strip-types scripts/jefferson-model-preview.mjs garden /absolute/output
 */
import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ParkTerrain} from '../src/belle/terrain.ts';
import {districts} from '../src/belle/detroitGround.ts';
import {addJeffersonBuildings} from '../src/belle/jeffersonBuildings.ts';
import {createJeffersonSignals} from '../src/belle/jeffersonSignals.ts';
const selection=process.argv[2]??'garden';
if(!['garden','stearns','palms'].includes(selection))throw Error('Select garden, stearns, or palms');
const out=process.argv[3]?resolve(process.argv[3]):resolve(import.meta.dirname,'../output/jefferson-model-preview');mkdirSync(out,{recursive:true});
const map=JSON.parse(readFileSync(new URL('../public/belle/map.json',import.meta.url),'utf8')),terrain=new ParkTerrain(map,true),scene=new T.Scene();
const replicas=addJeffersonBuildings(scene,terrain),signals=createJeffersonSignals(scene,terrain);
const ids=new Set(selection==='stearns'?['detroit-89989']:selection==='palms'?['jefferson-city-8423552-0']:['868842406','114282642','955779335']);
const main=replicas.plans.find(p=>p.profile.id===[...ids][0]);if(!main)throw Error('Missing selected model');
const origin=main.center,center=selection==='garden'?[-1437,807]:main.center;
replicas.update(...center);signals.update(0,...center);
for(const r of scene.children){if(r.userData.jeffersonId&&!ids.has(r.userData.jeffersonId))r.visible=false;if(r.name==='Jefferson mapped traffic signals')for(const g of r.children)g.visible=g.userData.cityObjectId===(selection==='stearns'?214:selection==='palms'?419:417);}
const asphalt=new T.MeshStandardMaterial({name:'Preview mapped asphalt',color:0x444747,roughness:.95}),edge=new T.MeshStandardMaterial({name:'Preview road edge',color:0xb6b2a5,roughness:.95});
const roads=[...map.roads,...districts.roads].filter(r=>!r.foot&&!r.bridge&&r.points.some(p=>Math.hypot(p[0]-center[0],p[1]-center[1])<220));
for(const extra of [5,0]){
 const quads=[];
 for(const r of roads)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.01)continue;const half=(r.width+extra)/2,nx=-dz/l*half,nz=dx/l*half;
  const ring=[[a[0]-nx,a[1]-nz],[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]];quads.push([ring]);
 }
 const union=polygonClipping.union(...quads);
 for(const [outer,...holes] of union){const shape=new T.Shape(outer.map(([x,z])=>new T.Vector2(x,-z)));for(const h of holes)shape.holes.push(new T.Path(h.map(([x,z])=>new T.Vector2(x,-z))));const geo=new T.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);geo.translate(0,2+(extra?0:.02),0);const mesh=new T.Mesh(geo,extra?edge:asphalt);mesh.name=extra?'Mapped road-edge preview context':'Mapped road preview context';scene.add(mesh);}
}
scene.updateMatrixWorld(true);const meshes=[],m4=new T.Matrix4(),v=new T.Vector3(),icolor=new T.Color();
scene.traverseVisible(o=>{
 if(!(o instanceof T.Mesh))return;
 const g=o.geometry,p=g.getAttribute('position'),a=g.getAttribute('color'),uv=g.getAttribute('uv'),material=Array.isArray(o.material)?o.material[0]:o.material;
 for(let n=0;n<(o instanceof T.InstancedMesh?o.count:1);n++){
  m4.copy(o.matrixWorld);icolor.setRGB(1,1,1);if(o instanceof T.InstancedMesh){o.getMatrixAt(n,m4);m4.premultiply(o.matrixWorld);if(o.instanceColor)o.getColorAt(n,icolor);}
  const positions=[],colors=[];
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m4);positions.push(v.x-origin[0],-(v.z-origin[1]),v.y);colors.push((a?a.getX(i):1)*icolor.r,(a?a.getY(i):1)*icolor.g,(a?a.getZ(i):1)*icolor.b,1);}
  // Cycles renders both faces intrinsically. Remove identical reversed copies
  // used by the game's backface-culling renderer, preserving their surface.
  const source=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i),indices=[],seen=new Set();
  for(let i=0;i<source.length;i+=3){const tri=source.slice(i,i+3),key=tri.map(k=>positions.slice(k*3,k*3+3).map(v=>v.toFixed(5)).join(',')).sort().join('|');if(seen.has(key))continue;seen.add(key);indices.push(...tri);}
  meshes.push({name:o.name,positions,indices,colors,uv:uv?Array.from(uv.array):null,material:{name:material.name,color:material.color.toArray(),roughness:material.roughness??.8,metalness:material.metalness??0,emission:material instanceof T.MeshBasicMaterial}});
 }
});
const camera=(point,y)=>[point[0]-origin[0],-(point[1]-origin[1]),y],p=main;
const cameras=selection==='garden'?[
 {name:'garden-court-preview',title:'GARDEN COURT · JEFFERSON / JOSEPH CAMPAU',position:camera([p.center[0]+p.front[0]*158+p.right[0]*108,p.center[1]+p.front[1]*158+p.right[1]*108],80),target:camera([-1434,817],12),lens:35},
 {name:'bagley-wells-preview',title:'BAGLEY & WELLS HOUSES · EAST JEFFERSON',position:camera([-1365,795],37),target:camera([-1442,748],8),lens:40}
]:selection==='stearns'?[
 {name:'stearns-grand-preview',title:'STEARNS / LOFTS AT RIVERTOWN · EAST JEFFERSON',position:camera([p.center[0]+p.front[0]*160+p.right[0]*100,p.center[1]+p.front[1]*160+p.right[1]*100],74),target:camera(p.center,13),lens:35}
]:[
 {name:'palms-preview',title:'THE PALMS · EAST JEFFERSON / RIVARD',position:camera([p.center[0]+p.front[0]*87+p.right[0]*64,p.center[1]+p.front[1]*87+p.right[1]*64],43),target:camera(p.center,10),lens:40}
];
writeFileSync(out+'/'+selection+'-scene.json',JSON.stringify({origin,meshes,cameras,conversionNotes:'Actual Three geometry; y-up to z-up; equivalent reversed triangles deduplicated for Cycles; source road strips unioned as preview context; game shader/lighting not captured',stats:replicas.stats}));
console.log(JSON.stringify({file:out+'/'+selection+'-scene.json',meshes:meshes.length,selection}));
