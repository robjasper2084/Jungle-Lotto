import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {planStreetLights,type StreetLamp} from './streetLightPlan.ts';

export function addStreetLighting(scene:T.Scene,map:ParkMap){
 const plan=planStreetLights(map),terrain=new ParkTerrain(map),night={value:0};
 const metal=new T.MeshStandardMaterial({color:0x303d3e,roughness:.42,metalness:.65});
 const globeMaterial=new T.MeshBasicMaterial({color:0xffddb0,toneMapped:false});
 const group=new T.Group();group.name='Roadside and visitor path lighting';scene.add(group);
 // Large static cells retain every lamp and its persistent light pool while
 // bounding draw submissions across four cameras. Small cells were CPU-heavy.
 const cells=new Map<string,StreetLamp[]>();
 for(const lamp of plan){const key=Math.floor(lamp.x/2048)+','+Math.floor(lamp.z/2048);let cell=cells.get(key);if(!cell){cell=[];cells.set(key,cell);}cell.push(lamp);}
 const shapes=[new T.CylinderGeometry(.075,.13,1,6),new T.CylinderGeometry(.22,.26,.22,6),new T.BoxGeometry(1,1,1),new T.BoxGeometry(.58,.18,.95),new T.SphereGeometry(1,6,4)];
 const poolMaterial=new T.ShaderMaterial({uniforms:{night},transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform float night;void main(){float d=length((p-.5)*2.);float a=pow(max(0.,1.-d*d),3.)*.15*night;gl_FragColor=vec4(.95,.72,.43,a);}'});
 const nightMeshes:T.Object3D[]=[],heads:{p:number[];ground:number[]}[]=[];
 for(const [key,lamps] of cells){
 const cell=new T.Group();cell.name='Streetlight cell '+key;group.add(cell);
 const [posts,feet,arms,shades,bulbs]=shapes.map((shape,index)=>new T.InstancedMesh(shape,index===4?globeMaterial:metal,lamps.length));
 const m=new T.Matrix4(),q=new T.Quaternion(),yAxis=new T.Vector3(0,1,0),scale=new T.Vector3(),pos=new T.Vector3();
 const p:number[]=[],uv:number[]=[];
 lamps.forEach((l,i)=>{
  const reach=l.kind==='road'?1.5:0,hx=l.x+l.dx*reach,hz=l.z+l.dz*reach,hy=l.y+l.height;
  q.setFromAxisAngle(yAxis,Math.atan2(l.dx,l.dz));
  posts.setMatrixAt(i,m.compose(pos.set(l.x,l.y+l.height/2,l.z),q,scale.set(1,l.height,1)));
  feet.setMatrixAt(i,m.compose(pos.set(l.x,l.y+.11,l.z),q,scale.set(1,1,1)));
  arms.setMatrixAt(i,m.compose(pos.set(l.x+l.dx*reach/2,hy-.1,l.z+l.dz*reach/2),q,scale.set(.09,.11,Math.max(.08,reach))));
  shades.setMatrixAt(i,m.compose(pos.set(hx,hy+(l.kind==='path'?.26:0),hz),q,scale.set(l.kind==='path'?.7:1,1,l.kind==='path'?.5:1)));
  bulbs.setMatrixAt(i,m.compose(pos.set(hx,hy-.1,hz),q,scale.set(l.kind==='path'?.22:.20,l.kind==='path'?.27:.04,l.kind==='path'?.22:.35)));
  heads.push({p:[hx,hy-.1,hz],ground:[hx,l.y,hz]});
  const radius=l.kind==='road'?17:8,steps=4;
  for(let u=0;u<steps;u++)for(let v=0;v<steps;v++){
   const corners=[[u,v],[u+1,v],[u+1,v+1],[u,v+1]].map(([a,b])=>({x:hx+(a/steps*2-1)*radius,z:hz+(b/steps*2-1)*radius,u:a/steps,v:b/steps}));
   if(corners.some(c=>!terrain.land(c.x,c.z)||Math.abs(terrain.height(c.x,c.z)-l.y)>1))continue;
   for(const index of[0,1,2,0,2,3]){const c=corners[index];p.push(c.x,terrain.height(c.x,c.z)+.115,c.z);uv.push(c.u,c.v);}
  }
 });
 // One rigid metal mesh per cell avoids five submissions per visible lamp cell.
 const pieces:T.BufferGeometry[]=[];const instance=new T.Matrix4();
 for(const mesh of[posts,feet,arms,shades])for(let i=0;i<lamps.length;i++){mesh.getMatrixAt(i,instance);pieces.push(mesh.geometry.clone().applyMatrix4(instance));}
 const metalGeometry=mergeGeometries(pieces,false)!;for(const piece of pieces)piece.dispose();
 metalGeometry.computeBoundingSphere();const fixtures=new T.Mesh(metalGeometry,metal);fixtures.name='Streetlight fixtures '+key;cell.add(fixtures);
 bulbs.computeBoundingSphere();cell.add(bulbs);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.computeBoundingSphere();
 const pools=new T.Mesh(geometry,poolMaterial);pools.name='Persistent streetlight illumination';cell.add(pools);nightMeshes.push(pools,bulbs);
 }

 return{plan,lamps:heads,count:plan.length,setNight(value:number){night.value=value;for(const mesh of nightMeshes)mesh.visible=value>.01;globeMaterial.color.setRGB(.7+value,.61+value*.8,.44+value*.6);}};
}
