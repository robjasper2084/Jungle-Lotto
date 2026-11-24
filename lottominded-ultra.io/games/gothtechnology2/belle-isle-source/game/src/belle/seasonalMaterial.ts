import * as T from 'three';
import {seasonLook} from './seasonModel.ts';
export function seasonalMaterial(source:T.Material,leaf:boolean,far:boolean,evergreen:boolean,month:{value:number},referenceStyle=false){
 const material=source.clone() as T.MeshStandardMaterial;material.side=T.DoubleSide;material.transparent=false;material.alphaTest=leaf?(far?.34:.36):0;material.alphaToCoverage=leaf;material.roughness=.88;
 const referenceLeaf=referenceStyle&&leaf;
 // Trunks keep independent material bindings; only their linked program is
 // shared. Leaves and Basic-material impostors retain their authored variants.
 const sharedTrunkLod=!leaf&&source instanceof T.MeshStandardMaterial&&source.type==='MeshStandardMaterial';
 const density={value:1},autumn={value:0},spring={value:0};
 material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{leafDensity:density,autumn,spring});
  if(sharedTrunkLod)s.uniforms.treeFarLod={value:far};
  const canopy=leaf?'varying float treeCanopyDensity;\n':'';
  const varyings='varying float treeWeight;varying vec3 localTreePos;\n'+canopy;
  s.vertexShader='attribute float lodWeight;\n'+(leaf?'attribute float canopyDensity;\n':'')+varyings+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntreeWeight=lodWeight;localTreePos=position;'+(leaf?'treeCanopyDensity=canopyDensity;':''));
  s.fragmentShader=varyings+'uniform float leafDensity,autumn,spring;\n'+(sharedTrunkLod?'uniform bool treeFarLod;\n':'')+s.fragmentShader;
  // Use the unanimated tree coordinates in both LODs so the pattern moves
  // with the tree while the camera pans or the leaves sway.
  const coverage=`
   if(treeWeight<=0.0)discard;
   if(treeWeight<1.0){
    vec3 lodCell=floor(localTreePos*6.0);
    float lodSeed=fract(52.9829189*fract(dot(lodCell,vec3(.06711056,.00583715,.02383154))));
    ${sharedTrunkLod?`if(treeFarLod){
     if(lodSeed<1.0-treeWeight)discard;
    }else{
     if(lodSeed>=treeWeight)discard;
    }`:`if(${far?'lodSeed<1.0-treeWeight':'lodSeed>=treeWeight'})discard;`}
   }`;
  const seasons=leaf?`
   float leafSeed=fract(sin(dot(floor(localTreePos*1.8),vec3(12.4,53.7,21.1)))*43758.54);
   if(leafSeed>clamp(leafDensity*treeCanopyDensity,0.,1.))discard;
   float luma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(luma*2.0,luma*.85,luma*.16),autumn*${referenceLeaf?'.62':'.92'});
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.15,1.15,.72),spring*.4);`:'';
  s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>'+coverage+seasons);
 };
 // Species vary these uniforms independently while sharing the same GLSL.
 material.customProgramCacheKey=()=>sharedTrunkLod?'seasonal-trunk-selector-v1':referenceLeaf?'reference-seasonal-stable-'+far:'seasonal-tree-stable-'+leaf+'-'+far;
 return{material,update(){const look=seasonLook(month.value,evergreen);density.value=look.density;autumn.value=look.autumn;spring.value=look.spring;}};
}
