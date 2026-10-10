import * as T from 'three';
/** Per-camera cutout fade; only foliage in the rider sightline is affected. */
export function foliageSightline(material:T.Material){
 if(material.userData.rideSightline)return;material.userData.rideSightline=true;
 const target={value:new T.Vector3()},enabled={value:0},compile=material.onBeforeCompile,render=material.onBeforeRender,key=material.customProgramCacheKey.bind(material);
 material.customProgramCacheKey=()=>key()+'|ride-sightline-v1';
 material.onBeforeCompile=(shader,renderer)=>{compile.call(material,shader,renderer);shader.uniforms.rideSightTarget=target;shader.uniforms.rideSightEnabled=enabled;
  shader.vertexShader='varying vec3 vRideSightWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vec4 rideSightPosition=vec4(transformed,1.0);
#ifdef USE_INSTANCING
rideSightPosition=instanceMatrix*rideSightPosition;
#endif
vRideSightWorld=(modelMatrix*rideSightPosition).xyz;`);
  shader.fragmentShader='varying vec3 vRideSightWorld; uniform vec3 rideSightTarget; uniform float rideSightEnabled;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
if(rideSightEnabled>0.5){
 vec3 sight=rideSightTarget-cameraPosition;float lengthSquared=dot(sight,sight);
 float along=dot(vRideSightWorld-cameraPosition,sight)/max(lengthSquared,0.001);
 float radius=length(vRideSightWorld-(cameraPosition+sight*clamp(along,0.0,1.0)));
 float fade=(1.0-smoothstep(0.65,1.15,radius))*smoothstep(0.03,0.10,along)*(1.0-smoothstep(0.86,0.98,along));
 float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
 if(grain<fade*0.72)discard;
}`);
 };
 material.onBeforeRender=(renderer,scene,camera,geometry,object,group)=>{render.call(material,renderer,scene,camera,geometry,object,group);const point=camera.userData.rideSightline;enabled.value=point?1:0;if(point)target.value.copy(point);};
 material.needsUpdate=true;
}
