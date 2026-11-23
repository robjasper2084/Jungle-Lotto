import {ShaderChunk} from 'three';

// Three's 16x16 DFG lookup has one level and uses bilinear filtering. Its
// view-dependent sample is identical for the direct and indirect base lobes.
// Clearcoat has a different normal and roughness and retains its own lookup.
const pars=ShaderChunk.lights_physical_pars_fragment;
const viewLookup='texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg';
const scatteringStart=pars.indexOf('void computeMultiscatteringIridescence(');
const reusable=pars.slice(scatteringStart).replace(viewLookup,'belleViewDFG')
 .replace('texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg','belleViewDFG')
 .replace('texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg','textureLod( dfgLUT, vec2( material.roughness, dotNL ), 0.0 ).rg');
const lightingPars=('vec2 belleViewDFG;\n'+pars.slice(0,scatteringStart)+reusable)
 .replace('vec3 irradiance = dotNL * directLight.color;',`
 // A different clearcoat normal can still face this light.
 #ifndef USE_CLEARCOAT
  if (dotNL == 0.0) return;
 #endif
 vec3 irradiance = dotNL * directLight.color;`)
 // The metallic lobe is multiplied by zero on dielectric surfaces. Keep the
 // dielectric calculation for indirect diffuse and all partially metallic pixels.
 .replace(/(computeMultiscattering(?:Iridescence)?\( geometryNormal, geometryViewDir, material\.diffuseColor,[^;]+;)/g,
  'if (material.metalness != 0.0) $1');

const viewSample=`
vec3 belleDfgViewDir=isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition);
belleViewDFG=textureLod(dfgLUT,vec2(material.roughness,saturate(dot(normal,belleDfgViewDir))),0.0).rg;`;

// At roughness 1, Three's isotropic reflection direction is the normal. The
// diffuse environment lookup already sampled the same PMREM face and mip.
const radiance='radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );';
const environment=ShaderChunk.lights_fragment_maps.replace(radiance,`
 #if defined( ENVMAP_TYPE_CUBE_UV ) && defined( RE_IndirectDiffuse )
  if (material.roughness == 1.0) radiance += iblIrradiance * RECIPROCAL_PI;
  else ${radiance}
 #else
  ${radiance}
 #endif`);

// Each hardware comparison already bilinearly filters four depth texels.
// A fixed, centered triangle preserves soft edges without per-fragment noise,
// trigonometry and the two extra comparisons in Three's stock PCF filter.
const shadows=ShaderChunk.shadowmap_pars_fragment.replace(
 /vec2 texelSize = vec2\( 1\.0 \) \/ shadowMapSize;[\s\S]*?\) \* 0\.2;/,
 `vec2 spread=vec2(shadowRadius)/shadowMapSize;
   shadow=(
    texture(shadowMap, vec3(shadowCoord.xy + vec2(0., .65)*spread, shadowCoord.z)) +
    texture(shadowMap, vec3(shadowCoord.xy + vec2(-.563, -.325)*spread, shadowCoord.z)) +
    texture(shadowMap, vec3(shadowCoord.xy + vec2(.563, -.325)*spread, shadowCoord.z))
   ) / 3.;`);

/** Patch only materials that still use the stock Three physical-lighting interface. */
export function physicalLighting(fragment:string){
 const declarations='#include <lights_physical_pars_fragment>',material='#include <lights_physical_fragment>';
 if(!fragment.includes(declarations)||!fragment.includes(material))return fragment;
 return fragment.replace(declarations,lightingPars).replace(material,material+viewSample)
  .replace('#include <lights_fragment_maps>',environment)
  .replace('#include <shadowmap_pars_fragment>',shadows);
}
