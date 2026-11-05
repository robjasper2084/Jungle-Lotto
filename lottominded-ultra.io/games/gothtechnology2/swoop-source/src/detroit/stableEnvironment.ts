import {PMREMGenerator,type ShaderMaterial,type WebGLRenderTarget} from 'three';

/** PMREM always samples the normal-facing view (0,0,1). Its hemisphere
 * height is sqrt(1-Xi.x); subtracting squared sin/cos terms loses precision
 * at the cardinal samples on ANGLE's constant-folding compiler. */
export function stableEnvironmentShader(source:string){
 return source.replace(/vec3 importanceSampleGGX_VNDF\(vec2 Xi, vec3 V, float roughness\) \{[\s\S]*?\n\s*\}/,`vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
  float radius = roughness * roughness * sqrt(Xi.x);
  float phi = 2.0 * PI * Xi.y;
  return normalize(vec3(radius * cos(phi), radius * sin(phi), sqrt(max(0.0, 1.0 - Xi.x))));
 }`);
}
/** Isolate the Three r185 PMREM adaptation; no global shader/log overrides. */
export class StableEnvironment extends PMREMGenerator{
 _allocateTargets():WebGLRenderTarget{
  const target=(PMREMGenerator.prototype as unknown as {_allocateTargets:(this:PMREMGenerator)=>WebGLRenderTarget})._allocateTargets.call(this);
  const material=(this as unknown as {_ggxMaterial:ShaderMaterial})._ggxMaterial;
  material.fragmentShader=stableEnvironmentShader(material.fragmentShader);
  return target;
 }
}
