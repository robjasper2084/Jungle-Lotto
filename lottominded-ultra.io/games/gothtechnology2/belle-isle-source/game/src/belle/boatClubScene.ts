import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BOAT_CLUB,CLUB_PIERS,clubWorld} from './boatClubPlan.ts';
import type {ParkTerrain} from './terrain.ts';

/** Original geometry interpreted from Google Maps Nov 2025 exterior photos and
 * July 2022 Street View. The mapped footprint is retained; dimensions above
 * ground and the two visitor berths are game interpretations, not a survey. */
export function addBoatClub(scene:T.Scene,terrain:ParkTerrain,night:{value:number}){
 const root=new T.Group();root.name='Detroit Boat Club · reference exterior';root.position.set(BOAT_CLUB.x,0,BOAT_CLUB.z);root.rotation.y=BOAT_CLUB.heading;
 const mat=(name:string,color:number,roughness=.85)=>new T.MeshStandardMaterial({name,color,roughness});
 const plaster=mat('Boat Club weathered ivory stucco',0xc5c1b2),trim=mat('Boat Club cream masonry trim',0xd7d4c8),roof=mat('Boat Club aged terracotta roof',0x854937),frame=mat('Boat Club painted window frames',0x858d88),glass=mat('Boat Club recessed glazing',0x273d42,.34),dark=mat('Boat Club boat storage openings',0x182222),brick=mat('Boat Club exposed brick',0x885c48),deck=mat('Boat Club dock timber',0x81796b),metal=mat('Boat Club dock iron',0x394448,.6);
 const groups=new Map<T.Material,T.BufferGeometry[]>();
 function add(g:T.BufferGeometry,m:T.Material){const a=groups.get(m)||[];if(!groups.has(m))groups.set(m,a);a.push(g);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material){add(new T.BoxGeometry(w,h,d).translate(x,y,z),m);}
 function line(a:number[],b:number[],r:number,m:T.Material){const av=new T.Vector3(...a),bv=new T.Vector3(...b),g=new T.CylinderGeometry(r,r,av.distanceTo(bv),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),bv.clone().sub(av).normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(g,m);}
 function hip(x:number,z:number,w:number,d:number,y:number,rise:number){const p=[x-w/2,y,z-d/2,x+w/2,y,z-d/2,x+w/2,y,z+d/2,x-w/2,y,z+d/2,x-w*.32,y+rise,z,x+w*.32,y+rise,z];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]);g.computeVertexNormals();add(g,roof);box(x,y-.15,z,w,.3,d,trim);}
 function arch(x:number,z:number,bottom:number,w:number,h:number,side:number,open=false){
  const r=w/2,spring=bottom+h-r,shape=new T.Shape();shape.moveTo(-r,bottom);shape.lineTo(r,bottom);shape.lineTo(r,spring);shape.absarc(0,spring,r,0,Math.PI,false);shape.closePath();const g=new T.ShapeGeometry(shape,12);if(side<0)g.rotateY(Math.PI);g.translate(x,0,z);add(g,open?dark:glass);
  // A full semicircular archivolt and narrow jambs, without rectangular glazing
  // spilling above the arch. Both elevations retain their real rhythm.
  const ring=new T.RingGeometry(r,r+.16,16,1,0,Math.PI);if(side<0)ring.rotateY(Math.PI);ring.translate(x,spring,z+side*.035);add(ring,trim);
  for(const sx of [-1,1])box(x+sx*(r+.08),(bottom+spring)/2,z,w*.035,spring-bottom,.22,trim);
  if(!open){box(x,(bottom+spring)/2,z+side*.07,.065,spring-bottom,.075,frame);box(x,spring-.15,z+side*.07,w,.06,.075,frame);box(x,bottom+.9,z+side*.07,w,.06,.075,frame);}
 }
 function window(x:number,z:number,y:number,w:number,h:number,side:number){box(x,y,z,w+.18,h+.18,.10,trim);box(x,y,z+side*.07,w,h,.08,glass);box(x,y,z+side*.12,.065,h,.06,frame);box(x,y-h*.08,z+side*.12,w,.06,.06,frame);}
 function railing(x:number,z:number,y:number,w:number){box(x,y+.92,z,w,.12,.16,trim);box(x,y+.12,z,w,.1,.15,trim);for(let a=-w/2;a<=w/2;a+=.45)box(x+a,y+.53,z,.08,.75,.09,trim);}
 function stairs(x:number,z:number,side:number,width:number,top=4.25){for(let i=0;i<17;i++){const h=top*(i+1)/17;box(x,h/2+.55,z+side*(3.8-i*.23),width,h,.28,trim);}for(const dx of [-width/2,width/2])line([x+dx,1.5,z+side*3.8],[x+dx,top+1.35,z],.045,frame);}
 // A continuous quay connects the building to the water instead of a floating slab.
 box(-3,.95,-7.9,62,2.0,44.2,plaster);box(-3,1.95,-7.9,62,.10,44.2,trim);
 box(0,2.85,0,54.4,3.3,24.8,plaster);
 box(0,6.55,0,53.5,4.1,20.5,plaster);
 // Tall west hall and lower east ballroom: the stepped silhouette is essential.
 box(-12.3,10.7,0,28.5,4.2,21.5,plaster);box(14.2,9.1,0,25,1.05,21.5,plaster);
 hip(-12.3,0,30.5,24,12.8,2.2);hip(14.2,0,27,24,9.65,2.1);
 for(const side of [-1,1]){
  const z=side*12.65;box(0,4.45,z,54.8,.28,3.3,trim);
  // Closed arched bays with a deep, columned terrace at the low wing.
  for(let i=0;i<12;i++){const x=-24.5+i*4.45;arch(x,side*10.32,4.72,2.5,3.5,side,i>=9);box(x,8.65,z,4.42,.65,.5,plaster);}
  railing(-12,z+side*1.5,4.55,29);railing(15,z+side*1.5,4.55,23);
  for(let i=0;i<13;i++)box(-26.7+i*4.45,6.55,z,.42,4.0,.45,trim);
  for(const x of [-23,-18,-13,-8,-3])window(x,side*10.80,10.65,2.1,2.0,side);
  for(const x of [-23,-15,-7,2,10,18,25]){box(x,2.5,side*12.43,3.2,2.75,.08,dark);box(x,3.93,side*12.5,3.5,.25,.15,trim);}
  stairs(7,side*14.3,side,2.8);
  // Shallow rafters above the river veranda.
  for(let i=0;i<15;i++)box(-26+i*3.7,8.88,side*12.0,.13,.16,4.4,frame);
 }
 // The short elevations also have glazed bays and wraparound verandas.
 // Rotate newly authored facade geometry as a group to retain outward normals.
 for(const side of [-1,1]){
  const counts=new Map([...groups].map(([m,g])=>[m,g.length]));
  for(const z of [-8,-4,0,4,8])arch(z,26.81,4.72,2.4,3.5,1);
  if(side<0)for(const z of [-7.5,-2.5,2.5,7.5])window(z,26.62,10.65,2.1,2,1);
  for(const z of [-8,-2.7,2.7,8])box(z,2.5,27.25,3.2,2.75,.08,dark);
  railing(0,28.3,4.55,24);
  for(const [m,gs]of groups)for(let i=counts.get(m)||0;i<gs.length;i++)gs[i].rotateY(side*Math.PI/2);
  box(side*27.4,4.45,0,2.3,.28,25.2,trim);
  for(const z of [-10,-5,0,5,10])box(side*27.7,6.55,z,.42,4,.42,trim);
 }
 // Square lookout sits on the river side, offset toward the high hall.
 box(-10,9.5,7.8,5.2,17.2,5.9,plaster);box(-10,18.25,7.8,6.4,.28,7.0,trim);hip(-10,7.8,6.8,7.4,18.45,.85);
 for(const side of [-1,1]){window(-10,7.8+side*3,16.9,3.2,1.45,side);for(const y of [6.2,10,13])window(-10,7.8+side*3,y,.8,1.25,side);}
 line([-10,19.2,7.8],[-10,25,7.8],.035,metal);
 // Landward central parapet and blue-green covered entry seen in Street View.
 box(2,9.8,-10.85,7.2,3.5,.5,plaster);box(2,11.62,-10.85,7.5,.22,.8,trim);
 window(.5,-11.16,9.5,1.25,1.6,-1);window(3.5,-11.16,9.5,1.25,1.6,-1);
 box(2,7.25,-13.1,8.2,.22,4.4,frame);stairs(2,-15.4,-1,3.4,5.6);
 box(-24,14.4,-2,1,4.5,1.2,brick);
 // Restrained patch loss on the actual outer walls; never copied photo textures.
 for(const side of [-1,1])for(let i=0;i<40;i++){const x=-26+(i*7.71)%52,y=1.5+(i*1.31)%2.3;box(x,y,side*12.46,.15+(i%4)*.16,.12+(i%5)*.09,.025,brick);}
 for(let i=0;i<18;i++){const y=2+i*.82;box(-12.62,y,7.1+(i%3)*.6,.025,.3+(i%4)*.18,.3,brick);}
 for(const p of CLUB_PIERS){
  box(p.u,.7,p.v,p.width,.3,p.length,deck);
  for(let i=0;i<5;i++)box(p.u,1.85-i*.22,14.35+i*.3,p.width,.22,.32,trim);
  for(let v=p.v-p.length/2;v<=p.v+p.length/2;v+=.23)box(p.u,.865,v,p.width,.035,.025,metal);
  for(const side of [-1,1])for(const v of [14,22,30]){box(p.u+side*.85,.15,v,.24,2.0,.24,deck);box(p.u+side*.65,.95,v,.35,.10,.13,metal);}
 }
 // Small warm lamps and window glow respond to the same global night uniform.
 const lamp=new T.MeshStandardMaterial({name:'Boat Club warm lamps',color:0xffe3a7,emissive:0xffce80,emissiveIntensity:0,toneMapped:false});
 lamp.onBeforeCompile=shader=>{shader.uniforms.clubNight=night;shader.fragmentShader='uniform float clubNight;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=vec3(1.,.67,.3)*clubNight*2.;');};lamp.customProgramCacheKey=()=>'boat-club-lamps-v1';
 for(const u of [-23,23])for(const v of [14,30]){box(u,1.5,v,.08,1.4,.08,metal);box(u,2.15,v,.22,.25,.22,lamp);}
 for(const [m,gs]of groups){const g=mergeGeometries(gs)!;gs.forEach(v=>v.dispose());g.computeBoundingSphere();const mesh=new T.Mesh(g,m);mesh.name=BOAT_CLUB.id+'_BoatClub_'+m.name;mesh.castShadow=m!==lamp;mesh.receiveShadow=true;root.add(mesh);}
 scene.add(root);
 const tower=[[-12.6,4.85],[-7.4,4.85],[-7.4,10.75],[-12.6,10.75],[-12.6,4.85]].map(([u,v])=>{const p=clubWorld(u,v);return[p.x,p.z] as [number,number];});
 terrain.boxes.push({minX:Math.min(...tower.map(p=>p[0])),maxX:Math.max(...tower.map(p=>p[0])),minZ:Math.min(...tower.map(p=>p[1])),maxZ:Math.max(...tower.map(p=>p[1])),height:17.4,points:tower});
 return root;
}
