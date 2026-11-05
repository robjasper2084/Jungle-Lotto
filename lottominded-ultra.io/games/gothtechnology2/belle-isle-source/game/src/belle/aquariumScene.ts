import * as T from 'three';
import {aquariumLocal,type AquariumLayout} from './aquarium.ts';
// Original tile textures; reference photos are not redistributed in the game.
function tiles(kind:'jade'|'black'|'floor'){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d')!;
 ctx.fillStyle=kind==='black'?'#313d36':kind==='floor'?'#6b6f64':'#597b66';ctx.fillRect(0,0,512,512);
 const n=kind==='floor'?16:kind==='black'?8:6,h=512/n,w=kind==='black'?h*2:h;
 for(let y=0;y<n;y++)for(let x=-1;x<=Math.ceil(512/w);x++){
  const seed=((Math.imul(x+17,92821)^Math.imul(y+31,68917))>>>0)%101/100;
  ctx.fillStyle=kind==='black'?'hsl(160,17%,'+(9+seed*5)+'%)':kind==='floor'?'hsl(70,12%,'+(43+seed*5)+'%)':'hsl('+(96+seed*12)+',30%,'+(43+seed*7)+'%)';
  ctx.fillRect(x*w+(y%2&&kind==='black'?w/2:0)+1.1,y*h+1.1,w-2.2,h-2.2);
  if(kind==='jade'){ctx.fillStyle='rgba(230,245,218,.13)';ctx.fillRect(x*w+2,y*h+2,w-4,1.5);}
 }
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;
}
export function prepareAquariumMaterials(root:T.Object3D){
 const maps={jade:tiles('jade'),black:tiles('black'),floor:tiles('floor')};
 root.traverse(o=>{if(!(o instanceof T.Mesh)||!o.name.startsWith('107227742_'))return;
  for(const m of(Array.isArray(o.material)?o.material:[o.material]) as T.MeshStandardMaterial[]){
   if(m.name==='Aquarium aged limestone'){m.color.setRGB(.62,.49,.34);m.roughness=.86;}
   if(m.name==='Aquarium aged handrails'){m.color.set(0x978b70);m.metalness=.72;m.roughness=.36;}
   if(m.name==='Aquarium facade dark glass'){m.envMapIntensity=.8;}
   if(m.name==='Aquarium jade glazed tile'){m.map=maps.jade;m.color.setRGB(.85,.92,.86);m.bumpMap=maps.jade;m.bumpScale=.0025;m.envMapIntensity=.28;m.roughness=.42;}
   if(m.name==='Aquarium black glazed tile'){m.map=maps.black;m.color.setRGB(1,1,1);m.bumpMap=maps.black;m.bumpScale=.004;}
   if(m.name==='Aquarium mosaic floor'){m.map=maps.floor;m.color.setRGB(.92,.94,.86);m.bumpMap=maps.floor;m.bumpScale=.004;}
   if(m.name==='Aquarium tank glazing'){m.transparent=true;m.opacity=.08;m.depthWrite=false;m.side=T.DoubleSide;o.castShadow=false;}
   if(m.name==='Aquarium jade glazed tile')m.side=T.DoubleSide;
   m.needsUpdate=true;
  }
 });
}
export function addAquariumLife(scene:T.Scene,c:AquariumLayout){
 const group=new T.Group();group.name='Aquarium fish and gallery lights';group.position.set(c.center[0],2,c.center[1]);group.rotation.y=c.yaw;scene.add(group);
 const habitats=[...c.tanks.map(t=>({u:t.u,v:t.v,ru:.83,rv:.86})),...[-1,1].flatMap(s=>[-1,1].map(t=>({u:s*1.1,v:t*1.1,ru:.57,rv:.57})))];
 const count=habitats.length*4,body=new T.InstancedMesh(new T.SphereGeometry(1,10,6),new T.MeshStandardMaterial({color:0x91b4aa,roughness:.48,metalness:.3,emissive:0x253d36,emissiveIntensity:.35}),count);
 const tailGeo=new T.BufferGeometry();tailGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,-.16,.12,0,-.16,-.12,0],3));tailGeo.computeVertexNormals();
 const tails=new T.InstancedMesh(tailGeo,new T.MeshStandardMaterial({color:0x7b9e89,side:T.DoubleSide,roughness:.6,emissive:0x253d36,emissiveIntensity:.3}),count);
 const eyes=new T.InstancedMesh(new T.SphereGeometry(.014,6,4),new T.MeshStandardMaterial({color:0x131d1a,roughness:.24}),count*2);
 const fins=new T.InstancedMesh(tailGeo,new T.MeshStandardMaterial({color:0x849b89,side:T.DoubleSide,roughness:.65}),count);
 eyes.instanceMatrix.setUsage(T.DynamicDrawUsage);fins.instanceMatrix.setUsage(T.DynamicDrawUsage);eyes.frustumCulled=fins.frustumCulled=false;group.add(eyes,fins);
 body.instanceMatrix.setUsage(T.DynamicDrawUsage);tails.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(body,tails);body.frustumCulled=tails.frustumCulled=false;
 const colors=[0x99b8ae,0xa99d69,0x728c89,0x72849b];for(let i=0;i<count;i++){body.setColorAt(i,new T.Color(colors[i%4]));tails.setColorAt(i,new T.Color(colors[i%4]));}
 for(const v of [-23,0,23]){const light=new T.PointLight(0xc4dbc6,8,32,1.6);light.position.set(0,4.6,-v);group.add(light);}
 const dummy=new T.Object3D(),pos=new T.Vector3();let last=-1;
 return{update(time:number,x:number,z:number){const local=aquariumLocal(c,x,z);group.visible=Math.abs(local.u)<26&&Math.abs(local.v)<58;if(!group.visible||time-last<1/30)return;last=time;
  for(let i=0;i<count;i++){const h=habitats[Math.floor(i/4)],phase=time*(.22+(i%3)*.035)+i*2.17,du=-Math.sin(phase)*h.ru,dv=Math.cos(phase)*h.rv,yaw=Math.atan2(dv,du),length=.19+(i%4)*.025;
   pos.set(h.u+Math.cos(phase)*h.ru,1.65+(i%4)*.18+Math.sin(phase*1.3)*.08,-h.v-Math.sin(phase)*h.rv);
   dummy.position.copy(pos);dummy.rotation.set(0,yaw,Math.sin(phase*.7)*.025);dummy.scale.set(length,.09,.065);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);
   for(let side=0;side<2;side++){const flank=side===0?-.058:.058;dummy.position.set(pos.x+Math.cos(yaw)*length*.72+Math.sin(yaw)*flank,pos.y+.025,pos.z-Math.sin(yaw)*length*.72+Math.cos(yaw)*flank);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(1);dummy.updateMatrix();eyes.setMatrixAt(i*2+side,dummy.matrix);}
   dummy.position.set(pos.x,pos.y+.065,pos.z);dummy.rotation.set(0,yaw,0);dummy.scale.set(.75,.65,.65);dummy.updateMatrix();fins.setMatrixAt(i,dummy.matrix);
   dummy.position.set(pos.x-Math.cos(yaw)*length,pos.y,pos.z+Math.sin(yaw)*length);dummy.rotation.set(0,yaw+Math.sin(time*6+i)*.22,0);dummy.scale.setScalar(.9);dummy.updateMatrix();tails.setMatrixAt(i,dummy.matrix);
  }body.instanceMatrix.needsUpdate=true;tails.instanceMatrix.needsUpdate=true;eyes.instanceMatrix.needsUpdate=true;fins.instanceMatrix.needsUpdate=true;
 }};
}
