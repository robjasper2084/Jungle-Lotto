import * as T from 'three';
import {ASPHALT_PATCH_DETAIL} from './asphaltPolish.ts';
import {ART_ROAD_WETNESS} from './artDirection.ts';

// All asphalt uses the same world coordinates, including overlapping junction
// ribbons. Route-relative wear would give those coplanar surfaces different
// colours and cause flickering at road joins.
export function finishAsphalt(material:T.MeshStandardMaterial){
 material.roughness=.92;
 material.onBeforeCompile=shader=>{
  shader.uniforms.belleArtRoadWetness=ART_ROAD_WETNESS;
  shader.vertexShader='varying vec2 asphaltXZ;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nasphaltXZ=(modelMatrix*vec4(transformed,1.)).xz;');
  shader.fragmentShader='varying vec2 asphaltXZ;uniform float belleArtRoadWetness;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   // Keep aggregate and old cracks subtle instead of black, repeating trenches.
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.12,.12),.26);
   vec2 q=asphaltXZ;
   float mottling=.5+.28*sin(q.x*.29+sin(q.y*.37))+.22*sin(q.y*.53-q.x*.17);
   // Filtered Higgsfield maps supply aggregate without sine-hash banding.
   diffuseColor.rgb*=mix(vec3(.76,.78,.77),vec3(.98,.96,.92),mottling);
   diffuseColor.rgb*=1.-clamp(belleArtRoadWetness,0.,.55)*.17;
   ${ASPHALT_PATCH_DETAIL}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    // Existing world-space aggregate; no additional sampler or new draw.
    float asphaltRoughnessNoise=fract(sin(dot(floor(asphaltXZ*.64),vec2(13.91,47.23)))*43758.5453);
    roughnessFactor=clamp(roughnessFactor+(asphaltRoughnessNoise-.5)*.075,.78,1.);
    roughnessFactor=mix(roughnessFactor,.36,clamp(belleArtRoadWetness,0.,.55));
  `);
 };material.customProgramCacheKey=()=>'world-asphalt-weather-v6-art-mood|resolved-repairs-v1';
}

/** Colour the exposed bank by elevation, not rows of flat-colour triangles. */
export function finishBank(material:T.MeshStandardMaterial,waterLevel:number,top:number,stone=false){
 material.onBeforeCompile=shader=>{
  // Preserve the independently rounded GLSL constants as material inputs.
  shader.uniforms.bankLevels={value:new T.Vector3(Number(waterLevel.toFixed(3)),Number((top-waterLevel-.65).toFixed(3)),Number((top-waterLevel-.12).toFixed(3)))};
  shader.uniforms.bankStone={value:stone};
  shader.vertexShader='varying vec3 bankWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nbankWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 bankWorld;uniform vec3 bankLevels;uniform bool bankStone;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float noise=.5+.25*sin(bankWorld.x*2.1+sin(bankWorld.z*1.3))+.25*sin(bankWorld.z*3.7-bankWorld.x*.8);
   float height=bankWorld.y-bankLevels.x;
   float dry=smoothstep(.04,.48,height+(noise-.5)*.12);
   float turf=smoothstep(bankLevels.y,bankLevels.z,height);
   vec3 earth=mix(vec3(.18,.23,.23),vec3(.58,.54,.43),dry);
   if(bankStone)earth=mix(vec3(.35,.40,.36),vec3(.87,.86,.79),dry);
   else earth=mix(earth,vec3(.55,.61,.39),turf);
   float wetEdge=1.-smoothstep(.035,.22,height);
   diffuseColor.rgb*=earth*(.92+.12*noise)*(1.-wetEdge*.12);
  `);
 };material.customProgramCacheKey=()=>'bank-wet-edge-v4';
}
