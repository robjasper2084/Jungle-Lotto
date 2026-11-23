import * as T from 'three';
import {seasonLook} from './seasonModel.ts';

/** Whole crown lobes thin together in both the color and shadow passes. */
export function solidCanopySeason(material:T.MeshStandardMaterial,geometry:T.BufferGeometry,evergreen:boolean,month:{value:number}){
 const stride=geometry.userData.crownLobeIndices as number;
 const lobes=geometry.getIndex()!.count/stride;
 const autumn={value:0},spring={value:0};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{autumn,spring});
  shader.fragmentShader='uniform float autumn, spring;\n'+shader.fragmentShader.replace(
   '#include <color_fragment>',`#include <color_fragment>
   float crownLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(crownLuma*1.67,crownLuma*.81,crownLuma*.25),autumn*.64);
   diffuseColor.rgb*=mix(vec3(1.0),vec3(1.10,1.13,.76),spring*.4);`);
 };
 material.customProgramCacheKey=()=> 'solid-canopy-season-v1';
 return{material,update(){
  const look=seasonLook(month.value,evergreen);
  autumn.value=look.autumn;spring.value=look.spring;
  geometry.setDrawRange(0,Math.round(lobes*look.density)*stride);
 }};
}

export function seasonalMaterial(source:T.Material,leaf:boolean,far:boolean,evergreen:boolean,month:{value:number},referenceStyle=false){
 const material=source.clone() as T.MeshStandardMaterial;material.side=T.DoubleSide;material.transparent=false;material.alphaTest=leaf?(far?.34:.36):0;material.alphaToCoverage=leaf;material.roughness=.88;
 const referenceLeaf=referenceStyle&&leaf;
 const density={value:1},autumn={value:0},spring={value:0};
 material.onBeforeCompile=s=>{Object.assign(s.uniforms,{leafDensity:density,autumn,spring});s.vertexShader=(leaf?'attribute float canopyDensity;varying float treeCanopyDensity;\n':'')+'attribute float lodWeight;varying float treeWeight;varying vec3 localTreePos;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntreeWeight=lodWeight;localTreePos=position;'+(leaf?'treeCanopyDensity=canopyDensity;':''));s.fragmentShader=(leaf?'varying float treeCanopyDensity;\n':'')+'varying float treeWeight;varying vec3 localTreePos;uniform float leafDensity,autumn,spring;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nfloat screenNoise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);if('+ (far?'screenNoise<1.-treeWeight':'screenNoise>treeWeight') +')discard;'+(leaf?'float leafSeed=fract(sin(dot(floor(localTreePos*1.8),vec3(12.4,53.7,21.1)))*43758.54);if(leafSeed>clamp(leafDensity*treeCanopyDensity,0.,1.))discard;float luma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(luma*2.0,luma*.85,luma*.16),autumn*'+(referenceLeaf?'.62':'.92')+');diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.15,1.15,.72),spring*.4);':''));};
 // Species vary these uniforms independently while sharing the same GLSL.
 material.customProgramCacheKey=()=>referenceLeaf?'reference-seasonal-'+far:'seasonal-tree-'+leaf+'-'+far;
 return{material,update(){const look=seasonLook(month.value,evergreen);density.value=look.density;autumn.value=look.autumn;spring.value=look.spring;}};
}
