import type * as T from 'three';

/** The original world-space lawn tint, shared with the pixel-equivalence fixture.
 * Keep these expressions and their operation order unchanged. */
export function finishParkLawn(material:T.MeshStandardMaterial){
 material.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 terrainXZ;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nterrainXZ=(modelMatrix*vec4(transformed,1.)).xz;');shader.fragmentShader='varying vec2 terrainXZ;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat meadowVariation=.5+.25*sin(terrainXZ.x*.037+sin(terrainXZ.y*.043)*2.)+.25*sin(terrainXZ.y*.077+terrainXZ.x*.019);diffuseColor.rgb*=mix(vec3(.72,.79,.62),vec3(1.05,1.04,.91),meadowVariation);');};
}
