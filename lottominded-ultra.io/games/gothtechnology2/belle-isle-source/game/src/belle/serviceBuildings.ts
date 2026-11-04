import * as T from 'three';
import {CUSTOM_ARCHITECTURE_IDS} from './referenceSites.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {inside,segment,type ParkMap} from './terrain.ts';

/** Secondary buildings retain mapped footprints/heights. Facade treatments are
 * approximate until measured elevation photography is available. */
export function addServiceBuildings(scene:T.Scene,map:ParkMap,night={value:0}){
 const custom=new Set(map.landmarks.map(l=>l.id)),beachIds=new Set(['368854145','927879992','509325790','509325814']);
 const brick=new T.MeshStandardMaterial({color:0xb29e7f,roughness:.94});
 brick.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 facadeUV;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfacadeUV=uv;');
  shader.fragmentShader='varying vec2 facadeUV;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 b=facadeUV/vec2(.34,.105);b.x+=mod(floor(b.y),2.)*.5;
   vec2 cell=floor(b),edge=min(fract(b),1.-fract(b));
   float width=max(fwidth(b.x),fwidth(b.y));
   float mortar=1.-smoothstep(.025,.055+width,min(edge.x,edge.y));
   float brickTone=fract(sin(dot(cell,vec2(15.27,37.69)))*43758.5453);
   float weather=.94+.05*sin(facadeUV.x*.42+sin(facadeUV.y*1.7));
   diffuseColor.rgb*=mix(mix(vec3(.71,.65,.53),vec3(1.03,.95,.79),brickTone),vec3(.66,.65,.59),mortar)*weather;
  `);
 };brick.customProgramCacheKey=()=>'mapped-weathered-brick-v1';
 const tower=brick.clone();tower.name='Mainland masonry and recessed windows';
 tower.onBeforeCompile=(shader,renderer)=>{brick.onBeforeCompile(shader,renderer);shader.uniforms.facadeNight=night;
  shader.fragmentShader='uniform float facadeNight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 bay=facadeUV/vec2(2.8,3.3),bayCell=floor(bay),q=fract(bay);
   vec2 feather=max(fwidth(bay),vec2(.004));
   float windowMask=smoothstep(.18-feather.x,.18+feather.x,q.x)*(1.-smoothstep(.78-feather.x,.78+feather.x,q.x))*smoothstep(.24-feather.y,.24+feather.y,q.y)*(1.-smoothstep(.82-feather.y,.82+feather.y,q.y))*step(2.3,facadeUV.y);
   float floorBand=1.-smoothstep(.012,.012+feather.y,min(q.y,1.-q.y));
   diffuseColor.rgb=mix(diffuseColor.rgb*(1.-floorBand*.2),vec3(.085,.12,.14),windowMask);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float occupied=step(.74,fract(sin(dot(bayCell,vec2(53.17,127.31)))*43758.54));
   totalEmissiveRadiance+=vec3(.68,.43,.21)*windowMask*occupied*facadeNight*.65;
  `);
 };tower.customProgramCacheKey=()=>'mapped-tower-facades-v1';
 const roof=new T.MeshStandardMaterial({color:0x363a36,roughness:.98}),stone=new T.MeshStandardMaterial({color:0xaeaa96,roughness:.85}),metal=new T.MeshStandardMaterial({color:0x354b4c,metalness:.3,roughness:.5}),glass=new T.MeshStandardMaterial({color:0x273e42,metalness:.4,roughness:.23});
 const groups=new Map<T.Material,T.BufferGeometry[]>();
 const add=(g:T.BufferGeometry,m:T.Material)=>{if(!groups.has(m))groups.set(m,[]);groups.get(m)!.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,yaw:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.rotateY(yaw);g.translate(x,y,z);add(g,m);};
 for(const b of map.buildings){
  if(b.id==='513165063'||custom.has(b.id)||CUSTOM_ARCHITECTURE_IDS.has(b.id)||map.dossin?.ids.includes(b.id))continue;
  const facility=map.facilities?.sites.find(s=>s.id===b.id);if(facility?.kind==='shelter')continue;
  const detailed=beachIds.has(b.id)||!!facility,edges=b.points.slice(1).map((q,i)=>{const p=b.points[i],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz),x=(p[0]+q[0])/2,z=(p[1]+q[1])/2;let nx=dz/length,nz=-dx/length;if(inside(x+nx*.1,z+nz*.1,b.points)){nx=-nx;nz=-nz;}return{p,q,x,z,dx,dz,length,nx,nz,yaw:-Math.atan2(dz,dx)};}).filter(e=>e.length>.1);
  const entrance=detailed?edges.filter(e=>e.length>5).sort((a,b)=>{const near=(e:typeof a)=>Math.min(...map.roads.filter(r=>r.foot).flatMap(r=>r.points.slice(1).map((p,i)=>segment(e.x,e.z,r.points[i],p).d)));return near(a)-near(b);})[0]:undefined;
  for(const e of edges){
   const g=new T.PlaneGeometry(e.length,b.height),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*e.length,uv.getY(i)*b.height);
   // Plane front points +Z; select its facing from the mapped polygon interior.
   g.rotateY(Math.atan2(e.nx,e.nz));g.translate(e.x,2+b.height/2,e.z);add(g,b.height>12?tower:brick);
   if(!detailed)continue;
   for(const [y,h,depth]of [[2.18,.36,.16],[2+b.height,.26,.22]])box(e.x+e.nx*.04,y,e.z+e.nz*.04,e.length+.1,h,depth,e.yaw,stone);
   const bays=Math.max(1,Math.floor(e.length/4.3));
   for(let i=0;i<bays;i++){
    const t=(i+.5)/bays,x=e.p[0]+e.dx*t+e.nx*.055,z=e.p[1]+e.dz*t+e.nz*.055;
    const door=e===entrance&&i===Math.floor(bays/2);if(e.length<4)continue;
    const ww=door?1.65:Math.min(2.4,e.length/bays*.65),hh=door?2.35:1.15,yy=door?3.175:4.15;
    box(x,yy,z,ww+.16,hh+.16,.09,e.yaw,stone);box(x+e.nx*.07,yy,z+e.nz*.07,ww,hh,.06,e.yaw,glass);
    box(x+e.nx*.12,yy,z+e.nz*.12,.06,hh,.05,e.yaw,metal);
    if(door)box(x+e.nx*.52,4.55,z+e.nz*.52,ww+.65,.14,1.2,e.yaw,metal);
   }
  }
  const shape=new T.Shape(b.points.map(p=>new T.Vector2(p[0],-p[1]))),top=new T.ShapeGeometry(shape);top.rotateX(-Math.PI/2);top.translate(0,2+b.height+.14,0);add(top,roof);
 }
 for(const [material,gs]of groups){if(!gs.length)continue;const g=mergeGeometries(gs)!;gs.forEach(x=>x.dispose());const mesh=new T.Mesh(g,material);mesh.name='Mapped secondary buildings · '+(material===brick?'masonry':material===roof?'roofs':'beach-house facade detail');mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
}
