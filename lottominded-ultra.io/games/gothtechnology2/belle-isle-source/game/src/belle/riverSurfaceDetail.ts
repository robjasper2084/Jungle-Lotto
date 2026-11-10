/** Coarse river slopes survive distance filtering while each band attenuates
 * by its projected pixel footprint. Fine normal maps keep their existing filter.
 * Same world-space field on both sides of the connected near/far mesh boundary. */
export const RIVER_BROAD_NORMALS=`
float riverPhaseA=dot(p,vec2(.31,.19))-riverTime*.83+sin(dot(p,vec2(.023,-.017)))*.55;
float riverPhaseB=dot(p,vec2(-.14,.27))-riverTime*.61+sin(dot(p,vec2(.013,.021)))*.40;
vec2 riverBandFootprint=vec2(fwidth(riverPhaseA),fwidth(riverPhaseB));
vec2 riverBandVisibility=exp(-.25*riverBandFootprint*riverBandFootprint);
vec2 riverBroad=cos(riverPhaseA)*vec2(.016,.011)*riverBandVisibility.x
              +cos(riverPhaseB)*vec2(-.009,.018)*riverBandVisibility.y;
wave+=riverBroad;
`;
export function riverBandVisibility(radiansPerPixel:number){
 return Number.isFinite(radiansPerPixel)&&radiansPerPixel>=0?Math.exp(-.25*radiansPerPixel*radiansPerPixel):0;
}
