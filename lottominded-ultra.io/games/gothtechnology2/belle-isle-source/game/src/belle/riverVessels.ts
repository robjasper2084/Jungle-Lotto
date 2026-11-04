import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {VesselKind} from './riverTrafficPlan.ts';
/** Original lightweight silhouettes, with geometry merged by finish. No image downloads. */
export function vesselModel(kind:VesselKind,length:number,width:number){
 const group=new T.Group(),parts:T.BufferGeometry[][]=Array.from({length:5},()=>[]);
 const palettes:Record<VesselKind,number[]>={freighter:[0x773b2b,0xdddaca,0x263b43,0x8d8c76,0x263232],tanker:[0x245666,0xe2e2d9,0x263941,0xa1aaa5,0x252b2c],excursion:[0xe7e1cf,0xf1eee1,0x25383b,0xba4032,0x393d38],fishing:[0xc4c5ba,0xe8e4d9,0x213b42,0x788174,0x282e2b]};
 function add(geo:T.BufferGeometry,color:number,x=0,y=0,z=0,rx=0,ry=0,rz=0){geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));if(geo.index){const expanded=geo.toNonIndexed();geo.dispose();parts[color].push(expanded);}else parts[color].push(geo);}
 const box=(x:number,y:number,z:number,w:number,h:number,l:number,c:number)=>add(new T.BoxGeometry(w,h,l),c,x,y,z);
 const small=kind==='fishing',deck=small?.75:kind==='excursion'?2.2:4.2;
 const outline=[[-.42,-.5],[.42,-.5],[.5,-.36],[.5,.30],[.34,.44],[0,.5],[-.34,.44],[-.5,.30],[-.5,-.36]];
 const hull=new T.Shape(outline.map(([x,z])=>new T.Vector2(x*width,z*length)));const hullGeo=new T.ExtrudeGeometry(hull,{depth:deck+1,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:small?.15:1,bevelThickness:small?.3:1});hullGeo.rotateX(Math.PI/2);hullGeo.translate(0,deck,0);add(hullGeo,0);
 box(0,deck+.12,0,width*.81,.24,length*.84,3);
 function rail(y:number,z:number,l:number,w=width*.88){for(const side of[-1,1]){box(side*w/2,y,z,.10,.10,l,1);for(let zz=z-l/2;zz<z+l/2;zz+=small?.8:3)box(side*w/2,y-.45,zz,.09,.9,.09,1);}}
 if(kind==='freighter'||kind==='tanker'){
  const cabinZ=-length*.32;box(0,deck+4,cabinZ,width*.78,8,length*.13,1);box(0,deck+9,cabinZ+1,width*.94,2.7,length*.11,1);box(0,deck+9.3,cabinZ+length*.056,width*.83,1.3,.12,2);
  for(const side of[-1,1])box(side*width*.475,deck+9.3,cabinZ,.12,1.3,length*.075,2);
  box(0,deck+11,cabinZ,width,0.5,length*.14,3);box(0,deck+15,cabinZ-4,3,8,4,0);box(0,deck+19,cabinZ-4,3.1,1,4.1,4);
  if(kind==='freighter'){for(let z=-length*.17;z<length*.36;z+=13){box(0,deck+.4,z,width*.76,.7,10,3);box(0,deck+.85,z,width*.7,.12,9,4);}box(0,deck+1,length*.39,width*.64,2,length*.075,1);}
  else {for(const x of[-width*.22,width*.22])for(let z=-length*.15;z<length*.36;z+=12){add(new T.CylinderGeometry(3.2,3.2,9,12).rotateX(Math.PI/2),3,x,deck+2,z);}box(0,deck+4,length*.08,.8,.5,length*.55,0);}
  rail(deck+1.3,0,length*.78);
  box(0,deck+16,cabinZ+3,.25,10,.25,3);box(0,deck+20,cabinZ+3,7,.2,.2,1);
 }else if(kind==='excursion'){
  for(let level=0;level<3;level++){const y=deck+level*2.8;box(0,y+.1,-1,width,.25,length*.79,1);box(0,y+1.3,-3,width*.61,2.3,length*.68,1);for(let z=-length*.31;z<length*.30;z+=2.6){for(const side of[-1,1]){box(side*width*.31,y+1.4,z,.10,1.3,1.5,2);box(side*width*.47,y+1.4,z,.12,2.6,.12,1);}}rail(y+1.2,-1,length*.77);}
  box(0,deck+8.5,-1,width*1.06,.4,length*.82,1);box(0,deck+9.6,length*.24,5.5,2.1,6,1);box(0,deck+9.7,length*.29,4.6,1,.12,2);
  add(new T.CylinderGeometry(1.1,1.4,6,14),3,0,deck+11,-8);add(new T.CylinderGeometry(1.13,1.13,1,14),4,0,deck+14,-8);
  box(0,deck+11,length*.36,.15,8,.15,3);box(0,deck+12,length*.36,4,.12,.12,1);
 }else{
  box(0,deck+.4,-length*.22,width*.7,.5,1,1);box(0,deck+.8,.2,width*.55,.8,1.2,1);box(0,deck+1.4,.5,width*.55,.6,.08,2);box(0,deck+2,.1,width*.86,.12,2.2,3);for(const x of[-width*.35,width*.35])box(x,deck+1,.1,.05,2,.05,4);box(0,.45,-length*.52,.5,1,.4,4);
  for(const x of[-.6,.6])add(new T.CylinderGeometry(.018,.028,2,5),4,x,1.4,-1.8,-.5,0,x*.5);
 }
 const fade={value:1},night={value:0};
 for(let i=0;i<parts.length;i++){if(!parts[i].length)continue;const g=mergeGeometries(parts[i]);parts[i].forEach(p=>p.dispose());if(!g)continue;g.computeBoundingSphere();const m=new T.MeshStandardMaterial({color:palettes[kind][i],roughness:.64,metalness:.17});m.name='River vessel finish';m.onBeforeCompile=shader=>{shader.uniforms.vesselFade=fade;shader.fragmentShader='uniform float vesselFade;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nif(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>vesselFade)discard;');};m.customProgramCacheKey=()=>'river-vessel-fade';group.add(new T.Mesh(g,m));}
 // Red port, green starboard and warm mast lamps remain visible after sundown.
 const lightsGeo:T.BufferGeometry[]=[];for(const [x,z,color] of[[-width*.45,length*.15,0xff4a34],[width*.45,length*.15,0x68e5a6],[0,-length*.3,0xffedb6]]){const g=new T.SphereGeometry(small?.09:.38,6,4);g.translate(x,small?2.1:deck+10,z);const c=new T.Color(color),colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));lightsGeo.push(g);}
 const lamps=new T.Mesh(mergeGeometries(lightsGeo)!,new T.MeshBasicMaterial({vertexColors:true,toneMapped:false}));lightsGeo.forEach(g=>g.dispose());group.add(lamps);
 return {group,fade,night,lamps};
}
