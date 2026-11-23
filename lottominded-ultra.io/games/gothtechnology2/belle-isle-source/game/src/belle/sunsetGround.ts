import * as T from 'three';
/** Tint turf and walkways. Roads keep the asphalt finish shared by the island and bridge. */
export function dressSunsetGround(scene:T.Scene){
 const targets:Record<string,number>={'Park lawn':0xb6c96d,'Park grass bank':0xb6c96d,'Concrete pathways':0xbca78d,'Concrete pavers':0xbca78d};
 const done=new Set<T.Material>();
 scene.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){
  if(!(m instanceof T.MeshStandardMaterial)||done.has(m)||!targets[m.name])continue;done.add(m);
  const ratio=new T.Color(targets[m.name]);ratio.r/=Math.max(.01,m.color.r);ratio.g/=Math.max(.01,m.color.g);ratio.b/=Math.max(.01,m.color.b);
  const before=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{before(shader,renderer);shader.uniforms.sunsetPigment={value:ratio};shader.vertexShader='varying vec2 sunsetGroundXZ;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nsunsetGroundXZ=(modelMatrix*vec4(transformed,1.)).xz;');shader.fragmentShader='varying vec2 sunsetGroundXZ;uniform vec3 sunsetPigment;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float lawnVariation=.96+.04*sin(sunsetGroundXZ.x*.047+sin(sunsetGroundXZ.y*.02))*sin(sunsetGroundXZ.y*.061);
   diffuseColor.rgb*=sunsetPigment*lawnVariation;
  `);};m.customProgramCacheKey=()=>key+'-reference-island-v2';m.needsUpdate=true;
 }});
}
