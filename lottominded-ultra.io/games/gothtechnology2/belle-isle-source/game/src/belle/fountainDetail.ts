import {FOUNTAIN_COLOR_UNIFORMS,type createFountainLighting} from './fountainLighting.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ParkMap} from './terrain.ts';
import type {Flow} from './waterFeatures.ts';
import {scottLayout,cascadePoint,cascadeLevel,CASCADE_STEPS,CASCADE_START,CASCADE_RUN,CASCADE_SIDE,CASCADE_WIDTH,SCOTT_AUTHORED} from './fountainLayout.ts';

/** Reference-guided Scott terraces and fixed architectural uplights, shared across all viewing distances. */
export function addScottDetails(scene:T.Scene,map:ParkMap,architecture:T.Object3D,night:{value:number},time:{value:number},lighting:ReturnType<typeof createFountainLighting>){
 const p=scottLayout(map),geometries:T.BufferGeometry[]=[],pools:T.BufferGeometry[]=[],flows:Flow[]=[];
 const marble=new T.MeshStandardMaterial({name:'Scott cascade carved pale stone',color:0xddd9c8,roughness:.65});
 function dress(original:T.MeshStandardMaterial){const material=original.clone(),base=original.onBeforeCompile;material.onBeforeCompile=(shader,r)=>{base(shader,r);Object.assign(shader.uniforms,{...lighting.uniforms,fountainNight:night,fountainCentre:{value:new T.Vector2(p.x,p.z)}});
 shader.vertexShader='varying vec3 fountainWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfountainWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
 shader.fragmentShader=FOUNTAIN_COLOR_UNIFORMS+'uniform float fountainNight;uniform vec2 fountainCentre;varying vec3 fountainWorld;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float vein=sin(fountainWorld.x*2.2+fountainWorld.y*4.+sin(fountainWorld.z*1.7));
 diffuseColor.rgb*=.97+.03*vein;
 `);shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
 vec2 fp=fountainWorld.xz-fountainCentre;float fr=length(fp),fa=atan(fp.x,fp.y);
 float fixture=pow(.5+.5*cos(fa*8.),8.);
 vec3 amber=fountainPrimary,rose=fountainSecondary;
 vec3 wash=mix(amber,rose,.5+.5*sin(fa*2.+.9));
 float band=exp(-abs(fountainWorld.y-3.3)*.65)+.8*exp(-abs(fountainWorld.y-6.9)*1.1)+.65*exp(-abs(fountainWorld.y-10.1)*1.3);
 float strength=(.16+fixture*.65)*band;
 if(fr>20.){wash=mix(amber,rose,.35+.35*sin(fr*.28));strength=.28+.30*pow(.5+.5*cos(fr*.84),6.);}
 totalEmissiveRadiance+=wash*strength*fountainNight;
 `);};material.customProgramCacheKey=()=>original.uuid+'-scott-carved-uplight-cycle-v2';return material;}
 const dressed=dress(marble),clones=new Map<T.Material,T.Material>();
 architecture.traverse(o=>{if(!(o instanceof T.Mesh)||!o.name.startsWith('9146545_'))return;
  o.position.x=p.x+(o.position.x-SCOTT_AUTHORED.x)*p.scale;o.position.z=p.z+(o.position.z-SCOTT_AUTHORED.z)*p.scale;o.scale.x*=p.scale;o.scale.z*=p.scale;
  if(/marble|granite/i.test(o.name)){const list=Array.isArray(o.material)?o.material:[o.material];o.material=list.map(m=>{if(!(m instanceof T.MeshStandardMaterial))return m;let n=clones.get(m);if(!n){n=dress(m);clones.set(m,n);}return n;});if(o.material.length===1)o.material=o.material[0];}
 });
 function transform(g:T.BufferGeometry,x:number,y:number,z:number){g.rotateY(p.yaw);const pt=cascadePoint(p,x+CASCADE_SIDE,z);g.translate(pt[0],y,pt[1]);return g;}
 function box(x:number,y:number,z:number,w:number,h:number,l:number){geometries.push(transform(new T.BoxGeometry(w,h,l),x,y,z));}
 function pool(x:number,y:number,z:number,w:number,l:number){pools.push(transform(new T.PlaneGeometry(w,l).rotateX(-Math.PI/2),x,y,z));}
 function jet(side:number,along:number,level:number){const a=cascadePoint(p,side+CASCADE_SIDE,along);flows.push({from:[a[0]-p.x,level-2,a[1]-p.z],to:[a[0]-p.x+.16,level-2,a[1]-p.z+.1],rise:1.5,radius:.022,seconds:1.1});}
 // Six stepped catch basins, divided side channels, shell bowls and paired stairs.
 for(let i=0;i<CASCADE_STEPS;i++){const start=CASCADE_START+i*CASCADE_RUN,z=start+CASCADE_RUN/2,y=cascadeLevel(i),next=i===5?1.05:cascadeLevel(i+1);
  box(0,(.8+y)/2-.09,z,CASCADE_WIDTH,y-.8+.18,CASCADE_RUN);pool(0,y+.015,z,CASCADE_WIDTH-.6,CASCADE_RUN-.18);
  for(const x of [-13,13])box(x,y+.13,z,.4,.4,CASCADE_RUN+.1);
  for(const x of [-4.5,4.5])box(x,y+.12,z,.24,.32,CASCADE_RUN+.1);
  box(0,y+.04,start+CASCADE_RUN-.1,CASCADE_WIDTH,.18,.20);
  for(const side of [-1,1]){for(let j=0;j<2;j++){const h=y+.25-j*.13;box(side*14.6,(.8+h)/2,start+j*CASCADE_RUN/2+CASCADE_RUN/4,2.7,h-.8,CASCADE_RUN/2);}box(side*16.15,y+.3,z,.35,.65,CASCADE_RUN+.1);
   const shell=new T.SphereGeometry(1,24,10,0,Math.PI*2,Math.PI*.5,Math.PI*.5);shell.scale(1.15,.27,.86);geometries.push(transform(shell,side*8.4,y+.24,z));pool(side*8.4,y+.20,z,1.4,1.0);jet(side*8.4,z,y+.21);
   const pillar=new T.CylinderGeometry(.25,.3,.8,12);geometries.push(transform(pillar,side*16.15,y+.35,start));}
  for(let j=0;j<34;j++){const x=-12.7+j*(25.4/33),a=cascadePoint(p,x+CASCADE_SIDE,start+CASCADE_RUN),b=cascadePoint(p,x+CASCADE_SIDE,start+CASCADE_RUN+.18);flows.push({from:[a[0]-p.x,y-2,a[1]-p.z],to:[b[0]-p.x,next-2,b[1]-p.z],rise:.015,radius:.025,seconds:.55});}
 }
 // Stone upper lip and open black safety rail like the supplied cascade views.
 box(0,2.8,CASCADE_START-.15,32.7,.25,.45);
 const rails:T.BufferGeometry[]=[];for(const x of [-15.8,-8,0,8,15.8])rails.push(transform(new T.CylinderGeometry(.045,.045,.95,8),x,3.30,CASCADE_START-.5));rails.push(transform(new T.BoxGeometry(32,.06,.06),0,3.76,CASCADE_START-.5));
 const rail=new T.Mesh(mergeGeometries(rails)!,new T.MeshStandardMaterial({color:0x202825,roughness:.5,metalness:.55}));rail.name='Scott cascade safety railing';scene.add(rail);rails.forEach(g=>g.dispose());
 const stone=new T.Mesh(mergeGeometries(geometries)!,dressed);stone.name='Scott stepped cascades · shell bowls and paired stairs';stone.receiveShadow=stone.castShadow=true;scene.add(stone);geometries.forEach(g=>g.dispose());
 const water=new T.Mesh(mergeGeometries(pools)!,new T.MeshStandardMaterial());water.name='Scott cascade catch basins';scene.add(water);pools.forEach(g=>g.dispose());
 // Underwater fixtures have a finite halo; they stay on at night even from the opposite pool bank.
 const lamps:T.BufferGeometry[]=[];for(let i=0;i<16;i++){const a=i*Math.PI/8,g=new T.CircleGeometry(.12,12).rotateX(-Math.PI/2);g.translate(p.x+Math.sin(a)*(p.radius-1),2.43,p.z+Math.cos(a)*(p.radius-1));lamps.push(g);}
 const emit=new T.MeshBasicMaterial({color:0xffa149,toneMapped:false,transparent:true,opacity:0});const lampMesh=new T.Mesh(mergeGeometries(lamps)!,emit);lampMesh.name='Scott underwater LED fixtures';scene.add(lampMesh);lamps.forEach(g=>g.dispose());
 return {water,flows,layout:p,update(){emit.opacity=night.value*.85;emit.color.copy(lighting.primary.value);}};
}
