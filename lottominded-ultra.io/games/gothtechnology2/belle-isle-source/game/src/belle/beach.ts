import * as T from 'three';
import type {ParkMap,ParkTerrain} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import {planBeachDetails} from './beachDetailPlan.ts';
import {bankGrassGeometry,createShoreDetailPool} from './shoreDetail.ts';

export async function addBeach(scene:T.Scene,data:ParkMap,terrain:ParkTerrain){
 const meta=await fetch('./belle/beach-surface.json').then(r=>r.json()),buffer=await fetch('./belle/beach-surface.bin').then(r=>r.arrayBuffer());
 const packed=new T.InterleavedBuffer(new Float32Array(buffer),8),g=new T.BufferGeometry();
 g.setAttribute('position',new T.InterleavedBufferAttribute(packed,3,0));g.setAttribute('normal',new T.InterleavedBufferAttribute(packed,3,3));g.setAttribute('uv',new T.InterleavedBufferAttribute(packed,2,6));g.setIndex(meta.indices);
 const loader=new T.TextureLoader();const load=async(name:string)=>{const t=await loader.loadAsync('./belle/textures/beach-sand-'+name+'.jpg');t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.setScalar(.375);t.anisotropy=4;return t;};
 const [albedo,normal,roughness]=await Promise.all([load('albedo'),load('normal'),load('roughness')]);albedo.colorSpace=T.SRGBColorSpace;
 const sand=new T.MeshStandardMaterial({color:0xf0e8d7,map:albedo,normalMap:normal,roughnessMap:roughness,roughness:.91,metalness:0});sand.normalScale.set(.39,.39);
 // Metre-scale ripples, low-frequency sediment and subpixel-faded grains.
 // No giant photographic repeat or high-frequency sparkle while riding.
 sand.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 sandWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nsandWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 sandWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 s=sandWorld.xz;
   // Main Belle Isle swim beach: open warm dry sand, subtle tide-darkened
   // waterline and low, wind-arranged ripples. No additional texture fetches.
   float damp=1.-smoothstep(.13,.72,sandWorld.y);
   float ridges=.5+.25*sin(s.x*.29+sin(s.y*.21)*1.8)+.25*sin(s.y*.47-s.x*.16);
   float detail=1.-smoothstep(.25,1.5,length(fwidth(s))*95.);
   float grain=fract(sin(dot(floor(s*87.),vec2(12.9898,78.233)))*43758.5453);
   float sediment=mix(1.,.85+.28*grain,detail);
   diffuseColor.rgb*=mix(vec3(.48,.49,.46),vec3(.97,.94,.86),1.-damp)
                       *(.88+.17*ridges)*sediment;
  `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   // Physically-based, nonmetallic specularity for damp sand; coarse dry
   // grains stay diffuse, reducing flicker in the flyover and on small screens.
   roughnessFactor=clamp(mix(.28,max(.78,roughnessFactor),1.-damp),.25,1.);
  `);
 };sand.customProgramCacheKey=()=>'belle-curved-wet-sand-v3';
 const mesh=new T.Mesh(g,sand);mesh.name='Mapped beach · sloping dry sand and wet shore';mesh.receiveShadow=true;scene.add(mesh);
 // Keep the actual public swim strand open. Pebbles collect near the water,
 // sparse grass and driftwood on the landward margin, not across riding paths.
 const occupied=roadIndex(data.roads);
 const plan=planBeachDetails(terrain.beaches,terrain,(x,z,margin)=>occupied(x,z,'',margin));
 const stoneGeo=new T.IcosahedronGeometry(1,0);
 const stoneMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.93,flatShading:true});
 const grassMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.95,side:T.DoubleSide});
 const logGeo=new T.CylinderGeometry(.42,.52,1,7,1);logGeo.rotateZ(Math.PI/2);
 const logMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true});
 const stones=createShoreDetailPool(scene,stoneGeo,stoneMat,plan.stones,'rocks','Beach edge · scattered river pebbles');
 const grasses=createShoreDetailPool(scene,bankGrassGeometry(),grassMat,plan.grasses,'plants','Beach backshore · sparse natural grasses');
 const driftwood=createShoreDetailPool(scene,logGeo,logMat,plan.driftwood,'rocks','Beach margin · low-poly driftwood');
 const stats={stones:stones.stats,grasses:grasses.stats,driftwood:driftwood.stats,maxExtraDraws:3};
 return{material:sand,triangles:meta.indices.length/3,stats,
   setQuality(value:string){stones.setQuality(value);grasses.setQuality(value);driftwood.setQuality(value);},
   update(x:number,z:number){stones.update(x,z);grasses.update(x,z);driftwood.update(x,z);}
 };

}
