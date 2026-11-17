import * as T from 'three';
/** World-space bridge weathering. PBR/geometry unchanged; no AO fullscreen pass,
 * network textures or added draw calls. CC0 texture atlases remain an authoring
 * candidate until offline bake and screenshot review pass. */
export type BridgeFinish='aged-concrete'|'weathered-red-iron'|'rusted-steel';
export function bridgeFinishFragment(type:BridgeFinish):string{
 const common='{\nfloat belleBridgePitted=.5+.25*sin(bridgeWorld.x*2.13+bridgeWorld.z*.71)+.25*sin(bridgeWorld.z*1.72-bridgeWorld.y*2.32);\n'
  +'float belleBridgeGrain=fract(sin(dot(floor(bridgeWorld.xz*9.),vec2(12.9898,78.233)))*43758.5453);\n'
  +'float belleBridgeAA=1.-smoothstep(.3,1.8,length(fwidth(bridgeWorld.xz))*9.);\n';
 if(type==='aged-concrete')return common+
  'float waterStain=1.-smoothstep(.2,2.3,bridgeWorld.y);\n'
  +'float chalk=smoothstep(.5,.83,belleBridgePitted);\n'
  +'diffuseColor.rgb*=vec3(.93,.95,.93)*(.88+.16*belleBridgePitted-.09*waterStain-.08*(1.-smoothstep(1.2,5.8,bridgeWorld.y)));\n'
  +'diffuseColor.rgb*=1.+(belleBridgeGrain-.5)*.05*belleBridgeAA;\n'
  +'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.54,.56,.52),chalk*.08);\n}\n';
 if(type==='weathered-red-iron')return common+
  'float ironOxide=smoothstep(.61,.90,belleBridgePitted)*.15;\n'
  +'diffuseColor.rgb*=.91+.12*belleBridgePitted;\n'
  +'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.21,.085,.049),ironOxide);\n}\n';
 return common+
  'float rust=smoothstep(.47,.79,belleBridgePitted)*.30;\n'
  +'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.15,.09),rust);\n'
  +'diffuseColor.rgb*=.94+.09*(belleBridgeGrain-.5)*belleBridgeAA;\n}\n';
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
