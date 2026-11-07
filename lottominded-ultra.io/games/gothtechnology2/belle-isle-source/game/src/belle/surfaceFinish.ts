import * as T from 'three';
import {ASPHALT_PATCH_DETAIL} from './asphaltPolish.ts';

// All asphalt uses the same world coordinates, including overlapping junction
// ribbons. Route-relative wear would give those coplanar surfaces different
// colours and cause flickering at road joins.
export function finishAsphalt(material:T.MeshStandardMaterial){
 material.roughness=.96;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 asphaltXZ;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nasphaltXZ=(modelMatrix*vec4(transformed,1.)).xz;');
  shader.fragmentShader='varying vec2 asphaltXZ;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   // Keep aggregate and old cracks subtle instead of black, repeating trenches.
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.12,.12),.26);
   vec2 q=asphaltXZ;
   float mottling=.5+.28*sin(q.x*.29+sin(q.y*.37))+.22*sin(q.y*.53-q.x*.17);
   float aggregate=fract(sin(dot(floor(q*92.),vec2(12.9898,78.233)))*43758.5453);
   float resolved=1.-smoothstep(.3,1.6,length(fwidth(q))*92.);
   diffuseColor.rgb*=mix(vec3(.76,.78,.77),vec3(.98,.96,.92),mottling)*mix(1.,mix(.78,1.14,aggregate),resolved);
   ${ASPHALT_PATCH_DETAIL}
  `);
 };material.customProgramCacheKey=()=>'world-asphalt-weather-v3';
}

/** Colour the exposed bank by elevation, not rows of flat-colour triangles. */
export function finishBank(material:T.MeshStandardMaterial,waterLevel:number,top:number,stone=false){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 bankWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nbankWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 bankWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float noise=.5+.25*sin(bankWorld.x*2.1+sin(bankWorld.z*1.3))+.25*sin(bankWorld.z*3.7-bankWorld.x*.8);
   float height=bankWorld.y-${waterLevel.toFixed(3)};
   float dry=smoothstep(.04,.48,height+(noise-.5)*.12);
   float turf=smoothstep(${(top-waterLevel-.65).toFixed(3)},${(top-waterLevel-.12).toFixed(3)},height);
   vec3 earth=mix(vec3(.24,.27,.22),vec3(.59,.55,.43),dry);
   ${stone?'earth=mix(vec3(.35,.40,.36),vec3(.87,.86,.79),dry);':'earth=mix(earth,vec3(.57,.65,.42),turf);'}
   float grain=fract(sin(dot(floor(bankWorld.xz*55.),vec2(12.9898,78.233)))*43758.5453);
   float detail=1.-smoothstep(.35,1.8,length(fwidth(bankWorld.xz))*55.);
   diffuseColor.rgb*=earth*(.92+.12*noise)*mix(1.,mix(.83,1.15,grain),detail);
  `);
 };material.customProgramCacheKey=()=>['bank-wet-edge-v1',waterLevel,top,stone].join('-');
}
