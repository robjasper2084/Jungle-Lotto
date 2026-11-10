import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ParkMap} from './terrain.ts';

/** Street View references recorded in research/pond-buildings-20261110.md.
 * Dimensions follow the mapped footprints; unsurveyed heights remain estimates.
 * No Google imagery is redistributed as a texture. */
export const POND_SERVICE_IDS=new Set(['507125652','507125653','507125655']);
export const GROWING_HOUSE_BAYS=Object.freeze([
 [0,0,11.7,36.8],[13.5,15.2,7,14.3],[21.7,0,11.7,29.5],
 [.2,43,11.1,36.5],[11.3,43,11.1,36.5],[22.4,43,11.1,36.5],[35.4,44.9,11.6,34.1],
]);
export function addPondServiceBuildings(scene:T.Scene,map:ParkMap){
 const root=new T.Group();root.name='Inselruhe growing houses and service courtyard';
 const mats={
  glass:new T.MeshStandardMaterial({name:'Growing house glass',color:0xacc2bd,roughness:.24,metalness:.25,transparent:true,opacity:.43,depthWrite:false,side:T.DoubleSide}),
  frame:new T.MeshStandardMaterial({name:'Weathered ivory greenhouse frames',color:0xc2c5b6,roughness:.66,metalness:.18}),
  stone:new T.MeshStandardMaterial({name:'Growing house masonry plinth',color:0x8b8875,roughness:.94}),
  brick:new T.MeshStandardMaterial({name:'Service courtyard red brick',color:0x795348,roughness:.91}),
  roof:new T.MeshStandardMaterial({name:'Annex weathered pitched roof',color:0x555449,roughness:.96}),
  trim:new T.MeshStandardMaterial({name:'Service courtyard stone trim',color:0xa0987c,roughness:.86}),
  door:new T.MeshStandardMaterial({name:'Service doors',color:0x707b79,roughness:.68,metalness:.12}),
  dark:new T.MeshStandardMaterial({name:'Service window recesses',color:0x293937,roughness:.4}),
  soil:new T.MeshStandardMaterial({name:'Growing house benches',color:0x554b36,roughness:1}),
  leaf:new T.MeshStandardMaterial({name:'Growing house planting',color:0x4a6131,roughness:.88}),
  pot:new T.MeshStandardMaterial({name:'Inselruhe terracotta planters',color:0x9b4e33,roughness:.9}),
 };
 // Physical-scale, antialiased masonry detail; no additional texture downloads.
 for(const [kind,size]of [['brick',[.24,.075]],['roof',[.28,.24]]] as const){
  const material=mats[kind];
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec2 serviceUV;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nserviceUV=uv;');
   shader.fragmentShader='varying vec2 serviceUV;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec2 cells=serviceUV/vec2(${size[0]},${size[1]});cells.x+=mod(floor(cells.y),2.)*.5;
    vec2 edge=min(fract(cells),1.-fract(cells));
    float aa=max(fwidth(cells.x),fwidth(cells.y));
    float joint=1.-smoothstep(.018,.045+aa,min(edge.x,edge.y));
    float variation=fract(sin(dot(floor(cells),vec2(17.17,41.33)))*43758.5453);
    diffuseColor.rgb*=mix(mix(.85,1.12,variation),${kind==='brick'?'.72':'.56'},joint);
   `);
  };material.customProgramCacheKey=()=>kind+'-pond-service-masonry-v1';
 }
 type Mat=keyof typeof mats;
 const batches=new Map<Mat,T.BufferGeometry[]>();let pieces=0;
 let ox=1391.48,oz=1102.51,ux=.908,uz=-.419,vx=.419,vz=.908;
 function frame(x:number,z:number,dx:number,dz:number){ox=x;oz=z;const l=Math.hypot(dx,dz);ux=dx/l;uz=dz/l;vx=-uz;vz=ux;}
 function add(g:T.BufferGeometry,m:Mat){const a=g.index?g.toNonIndexed():g;if(a!==g)g.dispose();const p=a.attributes.position,n=a.attributes.normal;if(!a.attributes.uv)a.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.count*2),2));for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(m==='brick'||m==='roof'){const uv=a.attributes.uv;uv.setXY(i,n&&Math.abs(n.getX(i))>.5?z:x,n&&Math.abs(n.getY(i))>.5?z:p.getY(i));}p.setXYZ(i,ox+ux*x+vx*z,p.getY(i),oz+uz*x+vz*z);if(n){const nx=n.getX(i),nz=n.getZ(i);n.setXYZ(i,ux*nx+vx*nz,n.getY(i),uz*nx+vz*nz);}}if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(a);pieces++;}
 function box(m:Mat,x:number,y:number,z:number,w:number,h:number,d:number){const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m);}
 function poly(m:Mat,pts:number[][],indices:number[]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts.flat(),3));g.setIndex(indices);g.computeVertexNormals();add(g,m);}
 function beam(m:Mat,a:T.Vector3,b:T.Vector3,r=.04){const g=new T.CylinderGeometry(r,r,a.distanceTo(b),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,m);}
 function greenhouse(x:number,z:number,w:number,l:number){
  const base=2.48,eave=4.30,ridge=5.66;
  for(const side of [-1,1]){const xx=x+w/2+side*w/2;box('stone',xx,2.24,z+l/2,.32,.48,l);box('glass',xx,3.39,z+l/2,.025,1.82,l);box('frame',xx,eave,z+l/2,.11,.11,l);
   poly('glass',[[xx,eave,z],[xx,eave,z+l],[x+w/2,ridge,z+l],[x+w/2,ridge,z]],[0,1,2,0,2,3]);
   const bays=Math.ceil(l/1.35);for(let i=0;i<=bays;i++){const zz=z+l*i/bays;box('frame',xx,(base+eave)/2,zz,.065,eave-base,.07);beam('frame',new T.Vector3(xx,eave,zz),new T.Vector3(x+w/2,ridge,zz),.035);}
   for(const t of [.34,.68])box('frame',xx+(x+w/2-xx)*t,eave+(ridge-eave)*t,z+l/2,.055,.055,l);
   box('frame',xx,3.42,z+l/2,.075,.06,l);
  }
  box('frame',x+w/2,ridge,z+l/2,.12,.10,l);
  for(const zz of [z,z+l]){box('stone',x+w/2,2.24,zz,w,.48,.32);box('glass',x+w/2,3.39,zz,w,1.82,.025);poly('glass',[[x,eave,zz],[x+w,eave,zz],[x+w/2,ridge,zz]],[0,1,2]);
   for(let i=0;i<=Math.ceil(w/1.35);i++){const xx=x+w*i/Math.ceil(w/1.35),top=eave+(ridge-eave)*(1-Math.abs(xx-x-w/2)/(w/2));box('frame',xx,(base+top)/2,zz,.065,top-base,.075);}
   box('frame',x+w/2,eave,zz,w,.07,.07);
  }
  // Benches and modest planting make the glass read as a growing house, not an opaque office.
  for(const xx of [x+w*.24,x+w*.76]){box('soil',xx,2.92,z+l/2,w*.23,.16,l-2);for(let i=1;i<l-1;i+=2){const g=new T.SphereGeometry(.36,5,3);g.scale(1,.65,1.7);g.translate(xx,3.18,z+i);add(g,'leaf');}}
 }
 const nursery=map.buildings.find(b=>b.id==='507125652');
 if(nursery){frame(1391.48,1102.51,.908,-.419);for(const [x,z,w,l]of GROWING_HOUSE_BAYS)greenhouse(x,z,w,l);
  // Low linking passage and solid headhouse behind the street-facing glass ranges.
  box('stone',31.45,2.22,34,41.3,.44,8.1);box('glass',31.45,3.38,34,41.3,1.88,8.1);box('frame',31.45,4.36,34,41.5,.12,8.3);
  for(let x=11;x<52;x+=1.4)for(const z of [29.9,38])box('frame',x,3.38,z,.075,1.88,.08);
  box('brick',51.1,3.55,15.6,35.4,3.1,28.6);
  poly('roof',[[33.3,5.1,1.3],[68.9,5.1,1.3],[65.5,6.9,15.6],[36.7,6.9,15.6],[33.3,5.1,29.9],[68.9,5.1,29.9]],[0,3,2,0,2,1,4,5,2,4,2,3,0,4,3,1,2,5]);
  // Upright doors at the central street opening, with pale frames and low stone landing.
  box('frame',10.9,3.63,40,2.3,2.3,.12);box('glass',10.9,3.63,39.91,2.10,2.1,.045);box('frame',10.9,3.63,39.86,.08,2.1,.05);box('stone',10.9,2.13,41.2,3,.26,2.2);
  for(const z of [4,18,32,50,66,77]){const g=new T.CylinderGeometry(.55,.39,.78,8);g.translate(-1.1,2.39,z);add(g,'pot');const shrub=new T.SphereGeometry(.62,6,4);shrub.scale(.8,1.3,.8);shrub.translate(-1.1,3.2,z);add(shrub,'leaf');}
 }
 const garage=map.buildings.find(b=>b.id==='507125653');
 if(garage){const [p,q]=garage.points;frame(p[0],p[1],q[0]-p[0],q[1]-p[1]);const w=Math.hypot(q[0]-p[0],q[1]-p[1]),l=Math.hypot(garage.points[2][0]-q[0],garage.points[2][1]-q[1]);
  box('brick',w/2,4.9,l/2,w,5.8,l);box('roof',w/2,7.76,l/2,w+.05,.15,l+.05);
  // Four recessed garage/workshop bays and proud brick piers from the supplied courtyard panorama.
  for(let i=0;i<4;i++){const z=(i+.5)*l/4;box('trim',-.045,4.65,z,.11,4.5,5.5);box(i%2?'dark':'door',-.12,4.58,z,.09,4.24,5.24);
   if(i%2)for(let a=0;a<5;a++)box('trim',-.18,4.58,z-2.1+a*1.05,.04,4.24,.06);
   else for(let y=2.7;y<6.6;y+=.35)box('trim',-.18,y,z,.04,.025,5.24);
  }
  for(let i=0;i<=4;i++){const z=l*i/4;box('brick',-.17,5,z,.5,6,.7);box('trim',-.17,8.03,z,.66,.16,.85);}box('trim',-.12,7.56,l/2,.24,.18,l);
 }
 const annex=map.buildings.find(b=>b.id==='507125655');
 if(annex){const [p,q]=annex.points;frame(p[0],p[1],q[0]-p[0],q[1]-p[1]);const w=Math.hypot(q[0]-p[0],q[1]-p[1]),l=Math.hypot(annex.points[2][0]-q[0],annex.points[2][1]-q[1]);
  box('brick',w/2,3.55,l/2,w,3.1,l);box('stone',w/2,2.2,l/2,w+.15,.4,l+.15);
  poly('roof',[[-.35,5.1,-.35],[w+.35,5.1,-.35],[w*.8,6.65,l/2],[w*.2,6.65,l/2],[-.35,5.1,l+.35],[w+.35,5.1,l+.35]],[0,3,2,0,2,1,4,5,2,4,2,3,0,4,3,1,2,5]);
  for(const z of [-.035,l+.035])for(let i=0;i<5;i++){const x=(i+.5)*w/5;box('trim',x,3.72,z,1.9,1.5,.14);box('dark',x,3.72,z+(z<0?-.09:.09),1.68,1.28,.055);box('trim',x,3.72,z+(z<0?-.13:.13),.055,1.28,.055);}
  box('trim',w/2,3.2,l+.08,1.65,2.4,.16);box('door',w/2,3.18,l+.2,1.4,2.3,.06);
  poly('trim',[[w/2-1.7,5.12,l+.2],[w/2+1.7,5.12,l+.2],[w/2,6.15,l+.2]],[0,1,2]);
 }
 let triangles=0;for(const [kind,gs]of batches){const g=mergeGeometries(gs)!;gs.forEach(x=>x.dispose());g.computeBoundingBox();g.computeBoundingSphere();const mesh=new T.Mesh(g,mats[kind]);mesh.name='Pond service buildings · '+mats[kind].name;mesh.castShadow=kind!=='glass';mesh.receiveShadow=true;root.add(mesh);triangles+=g.attributes.position.count/3;}
 scene.add(root);return{root,stats:{buildings:[...POND_SERVICE_IDS].filter(id=>map.buildings.some(b=>b.id===id)).length,growingHouses:nursery?GROWING_HOUSE_BAYS.length:0,batches:batches.size,pieces,triangles},dispose(){root.removeFromParent();root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});Object.values(mats).forEach(m=>m.dispose());}};
}
