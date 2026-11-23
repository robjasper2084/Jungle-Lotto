/** Composable WebGL shader additions. No global ShaderChunk mutation. */
export const WORLD_VERTEX=`
varying vec3 belleAtmosphereWorld;
`;
export const WORLD_POSITION=`
vec4 belleWorld=vec4(transformed,1.0);
#ifdef USE_BATCHING
 belleWorld=batchingMatrix*belleWorld;
#endif
#ifdef USE_INSTANCING
 belleWorld=instanceMatrix*belleWorld;
#endif
belleAtmosphereWorld=(modelMatrix*belleWorld).xyz;
`;
export const WORLD_FRAGMENT=`
varying vec3 belleAtmosphereWorld;
uniform sampler2D belleCloudNoise;
uniform vec3 belleSunDirection;
uniform float belleCloudTime,belleCloudCoverage,belleCloudStrength,belleAirStrength;
float belleCloudShade(){
 if(belleCloudStrength<.0001||belleSunDirection.y<.08)return 1.0;
 vec2 projected=belleAtmosphereWorld.xz+belleSunDirection.xz*(900.0-belleAtmosphereWorld.y)/max(.18,belleSunDirection.y);
 vec2 uv=projected*.00048+vec2(belleCloudTime*.00028,belleCloudTime*.00011);
 float field=texture2D(belleCloudNoise,uv).r;
 float threshold=mix(.75,.34,belleCloudCoverage);
 float shade=smoothstep(threshold-.035,threshold+.14,field);
 return 1.0-shade*belleCloudStrength;
}
`;
export const HEIGHT_FOG=`
#ifdef USE_FOG
 #ifdef FOG_EXP2
  float belleA=max(0.0,cameraPosition.y),belleB=max(0.0,belleAtmosphereWorld.y);
  float belleDensity=.24+.76*(exp(-belleA/140.0)+4.0*exp(-(belleA+belleB)/280.0)+exp(-belleB/140.0))/6.0;
  float belleDistance=length(cameraPosition-belleAtmosphereWorld);
  float belleOptical=fogDensity*belleDistance*belleDensity;
  float fogFactor=1.0-exp(-belleOptical*belleOptical);
 #else
  float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
 #endif
 vec3 belleAerialColor=fogColor;
 if(belleAirStrength>.0001&&belleSunDirection.y>.01){
  vec3 belleViewRay=normalize(belleAtmosphereWorld-cameraPosition);
  float belleForward=max(0.0,dot(belleViewRay,normalize(belleSunDirection)));
  float bellePhase=belleForward*belleForward;
  bellePhase*=bellePhase;
  belleAerialColor=mix(fogColor,vec3(.91,.73,.54),min(.25,belleAirStrength)*bellePhase);
 }
 gl_FragColor.rgb=mix(gl_FragColor.rgb,belleAerialColor,fogFactor);
#endif
`;
// The fixed light pool does not cast point shadows. A real WebGL2 loop can
// index its uniform structs directly, so keep one copy of the physical
// lighting calculation in the shader. Shadow samplers still use Three's
// statically indexed implementation whenever a point shadow is present.
const unrolledPointLights=/#pragma unroll_loop_start\s+for \( int i = 0; i < NUM_POINT_LIGHTS; i \+\+ \) \{[\s\S]*?#pragma unroll_loop_end/;
const pooledPointLights=`
 for (int i = 0; i < NUM_POINT_LIGHTS; ++i) {
  if (pointLights[i].color == vec3(0.0)) continue;
  getPointLightInfo(pointLights[i], geometryPosition, directLight);
  if (directLight.visible) {
   RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  }
 }
`;
export function atmosphereShader(vertex:string,fragment:string,directionalChunk='',usePointPool=false){
 if(!vertex.includes('#include <worldpos_vertex>'))return {vertex,fragment,applied:false};
 // The four permanent road and interior light slots are often black. The
 // uniform guard skips their attenuation, shadow and BRDF work together.
 // Three expands this loop once per slot, preserving all active light paths.
 const localLights=directionalChunk.replace(/(pointLight = pointLights\[ i \];)([\s\S]*?RE_Direct\( directLight,[^;]+;)/,
  '$1\n if (pointLight.color != vec3(0.0)) {\n$2\n }')
  // Parked vehicle headlamps keep their shader slots but contribute no light.
  // Include spot maps and shadows in the guard; retain the entire active path.
  .replace(/(spotLight = spotLights\[ i \];)([\s\S]*?RE_Direct\( directLight,[^;]+;)/,
   '$1\n if (spotLight.color != vec3(0.0)) {\n$2\n }');
 let directional=localLights.replace(/getDirectionalLightInfo\(\s*directionalLight,\s*directLight\s*\);/g,'$&\n directLight.color*=belleCloudShade();');
 if(usePointPool)directional=directional.replace(unrolledPointLights,pooledPointLights);
 if(directional!==directionalChunk)fragment=fragment.replace('#include <lights_fragment_begin>',directional);
 return {vertex:WORLD_VERTEX+vertex.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n'+WORLD_POSITION),
  fragment:WORLD_FRAGMENT+fragment.replace('#include <fog_fragment>',HEIGHT_FOG),applied:true};
}
export const WIND_HEADER='uniform float belleWindTime,belleWindAmount;uniform vec2 belleWindRange;\n';
export const WIND_VERTEX=`
if(belleWindAmount!=0.0){
float belleSpan=max(.0001,belleWindRange.y-belleWindRange.x);
float bellePin=1.0-clamp((position.y-belleWindRange.x)/belleSpan,0.0,1.0);
float bellePhase=belleWindTime*2.1+position.y/belleSpan*5.0+position.z/belleSpan*3.0;
transformed.x+=sin(bellePhase)*belleWindAmount*bellePin*bellePin;
transformed.z+=cos(bellePhase*.79)*belleWindAmount*.55*bellePin*bellePin;
}
`;
export const WIND_NORMAL=`
if(belleWindAmount!=0.0){
float belleNS=max(.0001,belleWindRange.y-belleWindRange.x);
float belleNM=1.0-clamp((position.y-belleWindRange.x)/belleNS,0.0,1.0);
float belleNP=belleWindTime*2.1+position.y/belleNS*5.0+position.z/belleNS*3.0;
float belleND=step(belleWindRange.x,position.y)*(1.0-step(belleWindRange.y,position.y));
float belleDX=belleWindAmount*(-2.0*belleNM*belleND*sin(belleNP)+5.0*belleNM*belleNM*cos(belleNP))/belleNS;
float belleDZ=belleWindAmount*.55*(-2.0*belleNM*belleND*cos(belleNP*.79)-3.95*belleNM*belleNM*sin(belleNP*.79))/belleNS;
objectNormal.y-=belleDX*objectNormal.x+belleDZ*objectNormal.z;
}
objectNormal=normalize(objectNormal);
`;
/** Crown mode anchors foliage at its trunk rather than moving its lower leaves. */
export function windVertex(vertex:string,crown=false){
 if(!vertex.includes('#include <begin_vertex>'))return vertex;
 const vertexWind=crown?WIND_VERTEX.replace('bellePin=1.0-clamp','bellePin=clamp'):WIND_VERTEX;
 const normalWind=crown?WIND_NORMAL.replace('belleNM=1.0-clamp','belleNM=clamp').replace('-2.0*belleNM*belleND*sin','2.0*belleNM*belleND*sin').replace('-2.0*belleNM*belleND*cos','2.0*belleNM*belleND*cos'):WIND_NORMAL;
 return WIND_HEADER+vertex.replace('#include <begin_vertex>','#include <begin_vertex>\n'+vertexWind).replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n'+normalWind);
}
