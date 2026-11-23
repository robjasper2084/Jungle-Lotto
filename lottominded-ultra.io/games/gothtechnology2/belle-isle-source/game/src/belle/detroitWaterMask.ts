import * as T from 'three';
import {districts} from './detroitGround.ts';

// The rolling river patch follows the camera. Mask inland excavations so it
// cannot appear through the below-river-datum surfaces of either district.
export function maskDistrictGround(materials:T.Material[]){
 const {grid,greenway}=districts;
 const minX=Math.min(grid.x0,...greenway.map(p=>p[0]))-25,minZ=Math.min(grid.z0,...greenway.map(p=>p[1]))-25;
 const maxX=Math.max(grid.x0+(grid.nx-1)*grid.step,...greenway.map(p=>p[0]))+25;
 const maxZ=Math.max(grid.z0+(grid.nz-1)*grid.step,...greenway.map(p=>p[1]))+25;
 const size=512,pixels=new Uint8Array(size*size);
 const pixelX=(x:number)=>Math.max(0,Math.min(size-1,Math.floor((x-minX)*size/(maxX-minX))));
 const pixelZ=(z:number)=>Math.max(0,Math.min(size-1,Math.floor((z-minZ)*size/(maxZ-minZ))));
 function fill(x0:number,z0:number,x1:number,z1:number){
  const start=pixelX(x0),end=pixelX(x1)+1;
  for(let z=pixelZ(z0);z<=pixelZ(z1);z++)pixels.fill(255,z*size+start,z*size+end);
 }
 fill(grid.x0,grid.z0,grid.x0+(grid.nx-1)*grid.step,grid.z0+(grid.nz-1)*grid.step);
 for(const [x,z] of greenway)fill(x-14,z-14,x+14,z+14);
 const texture=new T.DataTexture(pixels,size,size,T.RedFormat);texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
 const bounds=new T.Vector4(minX,minZ,maxX-minX,maxZ-minZ);
 for(const material of materials){
  const previous=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey();
  material.onBeforeCompile=(s,r)=>{
   previous(s,r);s.uniforms.detroitDry={value:texture};s.uniforms.detroitBounds={value:bounds};
   s.vertexShader='varying vec2 detroitXZ;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n detroitXZ=(modelMatrix*vec4(transformed,1.)).xz;');
   s.fragmentShader='varying vec2 detroitXZ;uniform sampler2D detroitDry;uniform vec4 detroitBounds;\n'+s.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    vec2 maskUV=(detroitXZ-detroitBounds.xy)/detroitBounds.zw;
    if(all(greaterThanEqual(maskUV,vec2(0.)))&&all(lessThanEqual(maskUV,vec2(1.)))&&texture2D(detroitDry,maskUV).r>.45)discard;`);
  };
  material.customProgramCacheKey=()=>cache+'-detroit-dry';
 }
}
