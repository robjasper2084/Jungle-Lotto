import * as T from 'three';
import {skyBirdPose} from './skyAtmosphere.ts';
/** Distant river silhouettes: six birds, one draw, twelve triangles; no shadow maps. */
export class SkyLife {
 private readonly birds:T.InstancedMesh;
 private readonly clock={value:0};
 private readonly dummy=new T.Object3D();
 private readonly pose={x:0,y:0,z:0,heading:0};
 constructor(scene:T.Scene){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([0,0,.25,-.95,0,-.05,-.12,0,-.3,0,0,.25,.12,0,-.3,.95,0,-.05],3));
  geometry.setAttribute('birdPhase',new T.InstancedBufferAttribute(new Float32Array([0,1.1,2.4,3.2,4.6,5.4]),1));
  const material=new T.MeshBasicMaterial({color:0x4a525a,side:T.DoubleSide,fog:true});
  material.onBeforeCompile=shader=>{
   shader.uniforms.birdClock=this.clock;
   shader.vertexShader='attribute float birdPhase;uniform float birdClock;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=sin(birdClock*5.+birdPhase)*abs(position.x)*.33;');
  };
  material.customProgramCacheKey=()=>'belle-distant-gulls-v1';
  this.birds=new T.InstancedMesh(geometry,material,6);this.birds.name='Distant Belle Isle river gulls';
  this.birds.instanceMatrix.setUsage(T.DynamicDrawUsage);this.birds.frustumCulled=false;this.birds.visible=false;
  scene.add(this.birds);
 }
 update(seconds:number,daylight:number,animate:boolean,high:boolean){
  this.birds.visible=animate&&daylight>.35;if(!this.birds.visible)return;
  this.clock.value=Number.isFinite(seconds)?seconds:0;this.birds.count=high?6:3;
  for(let i=0;i<this.birds.count;i++){
   const p=skyBirdPose(i,this.clock.value,this.pose);this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(0,p.heading,0);this.dummy.updateMatrix();this.birds.setMatrixAt(i,this.dummy.matrix);
  }
  this.birds.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.birds.removeFromParent();this.birds.geometry.dispose();(this.birds.material as T.Material).dispose();}
}
