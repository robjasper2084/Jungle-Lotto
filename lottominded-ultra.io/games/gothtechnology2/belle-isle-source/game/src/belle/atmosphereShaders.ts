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
uniform float belleCloudTime,belleCloudCoverage,belleCloudStrength;
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
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);
#endif
`;
export function atmosphereShader(vertex:string,fragment:string,directionalChunk=''){
 if(!vertex.includes('#include <worldpos_vertex>'))return {vertex,fragment,applied:false};
 const directional=directionalChunk.replace(/getDirectionalLightInfo\(\s*directionalLight,\s*directLight\s*\);/g,'$&\n directLight.color*=belleCloudShade();');
 if(directional!==directionalChunk)fragment=fragment.replace('#include <lights_fragment_begin>',directional);
 return {vertex:WORLD_VERTEX+vertex.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n'+WORLD_POSITION),
  fragment:WORLD_FRAGMENT+fragment.replace('#include <fog_fragment>',HEIGHT_FOG),applied:true};
}
export const WIND_HEADER='uniform float belleWindTime,belleWindAmount;uniform vec2 belleWindRange;\n';
export const WIND_VERTEX=`
float belleSpan=max(.0001,belleWindRange.y-belleWindRange.x);
float bellePin=1.0-clamp((position.y-belleWindRange.x)/belleSpan,0.0,1.0);
float bellePhase=belleWindTime*2.1+position.y/belleSpan*5.0+position.z/belleSpan*3.0;
transformed.x+=sin(bellePhase)*belleWindAmount*bellePin*bellePin;
transformed.z+=cos(bellePhase*.79)*belleWindAmount*.55*bellePin*bellePin;
`;
export const WIND_NORMAL=`
float belleNS=max(.0001,belleWindRange.y-belleWindRange.x);
float belleNM=1.0-clamp((position.y-belleWindRange.x)/belleNS,0.0,1.0);
float belleNP=belleWindTime*2.1+position.y/belleNS*5.0+position.z/belleNS*3.0;
float belleND=step(belleWindRange.x,position.y)*(1.0-step(belleWindRange.y,position.y));
float belleDX=belleWindAmount*(-2.0*belleNM*belleND*sin(belleNP)+5.0*belleNM*belleNM*cos(belleNP))/belleNS;
float belleDZ=belleWindAmount*.55*(-2.0*belleNM*belleND*cos(belleNP*.79)-3.95*belleNM*belleNM*sin(belleNP*.79))/belleNS;
objectNormal.y-=belleDX*objectNormal.x+belleDZ*objectNormal.z;
objectNormal=normalize(objectNormal);
`;
export function windVertex(vertex:string){
 if(!vertex.includes('#include <begin_vertex>'))return vertex;
 return WIND_HEADER+vertex.replace('#include <begin_vertex>','#include <begin_vertex>\n'+WIND_VERTEX).replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n'+WIND_NORMAL);
}
