import * as T from 'three';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
import {EFFECT_PATCHES,type EffectPatch} from './effectRules.ts';
import {routePosition} from './districtView.ts';
import {reducedEffects} from './rideEffects.ts';
import type {RidePose} from './controller.ts';
export function cutEffectPatches():EffectPatch[]{return EFFECT_PATCHES.map(p=>({...p,...routePosition(p.d,p.u)}));}
/** Authored cosmetic patches share exact footprints with tire effect detection. No colliders. */
export class RouteAmbience {
 private group=new T.Group();private grass:T.InstancedMesh;private leaves:T.InstancedMesh;private roots:{x:number;y:number;z:number;phase:number;scale:number}[]=[];private dummy=new T.Object3D();
 constructor(scene:T.Scene,terrain:TerrainSampler,readonly patches:readonly EffectPatch[]){
  const sample=createGroundSample();
  for(const patch of patches){
   const wet=patch.kind==='wet',leaves=patch.kind==='leaves';
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
   const gradient=ctx.createRadialGradient(64,64,20,64,64,64);gradient.addColorStop(0,wet?'#ffffff':'#dddddd');gradient.addColorStop(.75,wet?'#eeeeee':'#aaaaaa');gradient.addColorStop(1,'#000000');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
   if(!wet){ctx.globalCompositeOperation='multiply';for(let i=0;i<500;i++){ctx.fillStyle=i%2?'#888888':'#dddddd';ctx.fillRect(i*31%128,i*47%128,2,2);}}
   const alpha=new T.CanvasTexture(canvas),material=wet?new T.MeshPhysicalMaterial({color:'#253d43',metalness:.15,roughness:.09,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:.65,transparent:true,opacity:.76,alphaMap:alpha,depthWrite:false}):new T.MeshStandardMaterial({color:leaves?'#71683c':patch.kind==='gravel'?'#a39b84':'#8a7250',roughness:1,transparent:true,opacity:leaves?.28:.8,alphaMap:alpha,depthWrite:false});
   const geometry=new T.CircleGeometry(1,48),position=geometry.attributes.position;
   const c=Math.cos(patch.heading),s=Math.sin(patch.heading);
   for(let i=0;i<position.count;i++){const u=position.getX(i)*patch.rx,v=position.getY(i)*patch.rz,x=patch.x+u*c+v*s,z=patch.z-u*s+v*c;position.setXYZ(i,x,terrain.sampleGround(x,z,sample).height+.026,z);}
   geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,material);mesh.material.side=T.DoubleSide;mesh.receiveShadow=true;mesh.name=patch.id;this.group.add(mesh);
  }
  const blade=new T.PlaneGeometry(.035,.28,1,3);blade.translate(0,.14,0);
  const material=new T.MeshStandardMaterial({color:'#637747',roughness:1,side:T.DoubleSide});
  this.grass=new T.InstancedMesh(blade,material,48);this.grass.frustumCulled=false;this.grass.receiveShadow=true;this.group.add(this.grass);
  const sites=patches.filter(p=>p.kind==='leaves');
  for(let i=0;i<48;i++){const p=sites[i%sites.length];if(!p)break;const u=(i%2?1:-1)*.9,v=((i*17%31)/31-.5)*8,c=Math.cos(p.heading),s=Math.sin(p.heading),x=p.x+u*c+v*s,z=p.z-u*s+v*c;this.roots.push({x,y:terrain.sampleGround(x,z,sample).height,z,phase:i*2.4,scale:.65+(i*13%19)/22});}
  this.grass.count=this.roots.length;
  this.leaves=new T.InstancedMesh(new T.PlaneGeometry(.11,.055),new T.MeshStandardMaterial({color:'#9b8345',roughness:1,side:T.DoubleSide}),24);this.leaves.frustumCulled=false;this.leaves.count=this.roots.length?24:0;this.group.add(this.leaves);scene.add(this.group);this.update(0,[]);
 }
 update(time:number,riders:readonly RidePose[]){const reduced=reducedEffects();this.roots.forEach((root,i)=>{let bend=0;for(const rider of riders){const d=Math.hypot(root.x-rider.x,root.z-rider.z);if(d<1.8)bend=Math.max(bend,(1-d/1.8)*Math.min(.28,Math.abs(rider.speed)*.025));}const sway=reduced?0:Math.sin(time*1.5+root.phase)*.07+bend;this.dummy.position.set(root.x,root.y,root.z);this.dummy.rotation.set(sway,root.phase,sway*.5);this.dummy.scale.setScalar(root.scale);this.dummy.updateMatrix();this.grass.setMatrixAt(i,this.dummy.matrix);});this.grass.instanceMatrix.needsUpdate=true;
 this.leaves.visible=!reduced;
 if(!reduced)for(let i=0;i<this.leaves.count;i++){const root=this.roots[i%this.roots.length],phase=(time*.18+i*.137)%1;this.dummy.position.set(root.x+(phase-.5)*5,root.y+.08+Math.sin(phase*Math.PI)*(.3+i%3*.15),root.z+Math.sin(time*.6+i)*.4);this.dummy.rotation.set(time*1.7+i,time*.7+i,time+i);this.dummy.scale.setScalar(.7+i%3*.2);this.dummy.updateMatrix();this.leaves.setMatrixAt(i,this.dummy.matrix);}this.leaves.instanceMatrix.needsUpdate=true;}
 dispose(){this.group.removeFromParent();this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const m=o.material as T.MeshStandardMaterial;m.alphaMap?.dispose();m.dispose();}});}
}
