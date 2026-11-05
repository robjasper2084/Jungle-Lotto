import * as T from 'three';
import {createGroundSample,type TerrainSampler} from '../../runtime/ride-core/src/terrain.ts';

export type ContactShadowPose={x:number;y:number;z:number;heading:number;vehicle:'onewheel'|'hoverbike'};
const shapes={onewheel:{x:.48,z:.76,height:2.2},hoverbike:{x:1.35,z:1.9,height:5}};

/** One soft, terrain-aligned quad. It supplements nearby lighting without a
 * render target, texture download, new light or extra shadow-map pass. */
export function createVehicleContactShadow(scene:T.Scene,terrain:Pick<TerrainSampler,'sampleGround'>){
 const geometry=new T.PlaneGeometry(2,2).rotateX(-Math.PI/2);
 const material=new T.MeshBasicMaterial({color:0x14201f,transparent:true,opacity:.14,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 contactUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncontactUv=uv;');
  shader.fragmentShader='varying vec2 contactUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float contactEdge=1.-smoothstep(.05,1.,length(contactUv*2.-1.));
   diffuseColor.a*=contactEdge*contactEdge;
  `);
 };material.customProgramCacheKey=()=>'vehicle-contact-gradient-v1';
 const mesh=new T.Mesh(geometry,material);mesh.name='Vehicle contact shadow';mesh.visible=false;mesh.renderOrder=1;scene.add(mesh);
 const ground=createGroundSample(),up=new T.Vector3(0,1,0),normal=new T.Vector3(),tilt=new T.Quaternion(),yaw=new T.Quaternion();
 let opacity=.14;
 return {
  setQuality(quality:string){opacity=quality==='smooth'?.20:.14;},
  update(pose:ContactShadowPose|null){
   mesh.visible=false;
   if(!pose||![pose.x,pose.y,pose.z,pose.heading].every(Number.isFinite))return;
   terrain.sampleGround(pose.x,pose.z,ground,pose.y);
   const shape=shapes[pose.vehicle],clearance=pose.y-ground.height;
   if(ground.offCourse||!Number.isFinite(clearance)||clearance<-.2||clearance>=shape.height||ground.normal.y<.55)return;
   normal.set(ground.normal.x,ground.normal.y,ground.normal.z);
   if(!Number.isFinite(normal.lengthSq())||normal.lengthSq()<.5)return;
   normal.normalize();tilt.setFromUnitVectors(up,normal);yaw.setFromAxisAngle(up,pose.heading);
   const height=Math.max(0,clearance),spread=1+height*.14;
   // Joined pavement is 65 mm above the terrain; road markings reach 84 mm.
   mesh.position.set(pose.x,ground.height+.09,pose.z);mesh.quaternion.copy(tilt).multiply(yaw);
   mesh.scale.set(shape.x*spread,1,shape.z*spread);
   material.opacity=opacity*(1-height/shape.height)**2;
   mesh.visible=material.opacity>.003;
  },
  dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}
 };
}
