import * as T from 'three';
/** World-space bridge weathering. PBR/geometry unchanged; no AO fullscreen pass,
 * network textures or added draw calls. CC0 texture atlases remain an authoring
 * candidate until offline bake and screenshot review pass. */
export type BridgeFinish='aged-concrete'|'weathered-red-iron'|'rusted-steel';
export function bridgeFinishFragment(type:BridgeFinish):string{
 const common='float pitted=.5+.25*sin(bridgeWorld.x*2.13+bridgeWorld.z*.71)+.25*sin(bridgeWorld.z*1.72-bridgeWorld.y*2.32);\n'
  +'float grain=fract(sin(dot(floor(bridgeWorld.xz*9.),vec2(12.9898,78.233)))*43758.5453);\n'
  +'float antialias=1.-smoothstep(.3,1.8,length(fwidth(bridgeWorld.xz))*9.);\n';
 if(type==='aged-concrete')return common+
  'float waterStain=1.-smoothstep(.2,2.3,bridgeWorld.y);\n'
  +'float chalk=smoothstep(.5,.83,pitted);\n'
  +'diffuseColor.rgb*=vec3(.93,.95,.93)*(.88+.16*pitted-.09*waterStain);\n'
  +'diffuseColor.rgb*=1.+(grain-.5)*.05*antialias;\n'
  +'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.54,.56,.52),chalk*.08);\n';
 if(type==='weathered-red-iron')return common+
  'float ironOxide=smoothstep(.61,.90,pitted)*.15;\n'
  +'diffuseColor.rgb*=.91+.12*pitted;\n'
  +'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.21,.085,.049),ironOxide);\n';
 return common+
  'float rust=smoothstep(.47,.79,pitted)*.30;\n'
  +'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.15,.09),rust);\n'
  +'diffuseColor.rgb*=.94+.09*(grain-.5)*antialias;\n';
}
export function finishBridgeMaterial(material:T.MeshStandardMaterial,type:BridgeFinish){
 const oldCompile=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  oldCompile(shader,renderer);
  shader.vertexShader='varying vec3 bridgeWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nbridgeWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 bridgeWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+bridgeFinishFragment(type));
 };
 material.customProgramCacheKey=()=>oldKey+'-belle-bridge-weather-v1-'+type;
 material.roughness=type==='aged-concrete'?.91:type==='weathered-red-iron'?.75:.82;
 material.needsUpdate=true;
 return material;
}
