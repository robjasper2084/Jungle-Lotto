/** Coarse river slopes survive distance filtering while each band attenuates
 * by its projected pixel footprint. Fine normal maps keep their existing filter.
 * Same world-space field on both sides of the connected near/far mesh boundary. */
export const RIVER_BROAD_NORMALS=`
// Nonparallel, independently warped crests avoid the repeated cross-hatch of
// two strong regular sine fields. Broad slopes remain below one half degree.
float riverPhaseA=dot(p,vec2(.75,.41))-riverTime*.71
 +2.2*sin(dot(p,vec2(.023,.037)))+.9*sin(dot(p,vec2(.051,-.017)));
float riverPhaseB=dot(p,vec2(-.24,.63))-riverTime*.57
 +1.8*sin(dot(p,vec2(.041,-.029)))+.7*sin(dot(p,vec2(.019,.053)));
float riverPatch=.65+.35*sin(dot(p,vec2(.017,.011))+sin(dot(p,vec2(.043,-.029))));
vec2 riverBandFootprint=vec2(fwidth(riverPhaseA),fwidth(riverPhaseB));
vec2 riverBandVisibility=exp(-.25*riverBandFootprint*riverBandFootprint);
vec2 riverBroad=cos(riverPhaseA)*vec2(.0045,.0024)*riverBandVisibility.x
              +cos(riverPhaseB)*vec2(-.0012,.0031)*riverBandVisibility.y;
wave+=riverBroad*riverPatch;
`;
export function riverBandVisibility(radiansPerPixel:number){
 return Number.isFinite(radiansPerPixel)&&radiansPerPixel>=0?Math.exp(-.25*radiansPerPixel*radiansPerPixel):0;
}

/** Sunset river suntrail: existing normal fields only, footprint-filtered and energy-bounded. */
export function riverPhotoGlintGLSL(reference=false):string{
 return [
  'float riverSunWide=pow(riverSunAlignment,'+(reference?'105.':'58.')+');',
  'float riverSunCore=pow(riverSunAlignment,'+(reference?'430.':'230.')+');',
  'float belleGlintPhase=dot(p,vec2(.64,-.29))+riverTime*1.15;',
  'float belleGlintFilter=1.-smoothstep(.38,1.45,fwidth(belleGlintPhase));',
  'riverSunSparkle=clamp(riverSunSparkle+.16*sin(belleGlintPhase+wave.x*3.)*belleGlintFilter+.13*(r1.x-r2.y)*riverNormalVisibility,.58,1.07);',
  'float belleGlintEnergy=min(.78,riverSunGlint*(riverSunWide*.23+riverSunCore*.56)*riverSunSparkle);',
  'totalEmissiveRadiance+=vec3(.98,.83,.65)*belleGlintEnergy;'
 ].join('\n');
}
