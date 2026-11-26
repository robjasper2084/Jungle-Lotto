import {LAWN_DETAIL} from './cinematicPolicy.ts';

/** Experimental fragment path: a zero detail weight does not need a sine hash.
 * Derivatives remain unconditional, and all color arithmetic stays in its original
 * order. This candidate is opt-in until identical rendered pixels are verified. */
export const LAWN_DETAIL_GRAIN_GUARD=LAWN_DETAIL.replace(
 'float belleLawnGrain=fract(sin(dot(floor(terrainXZ*8.),vec2(31.17,73.91)))*43758.5453);',
 `float belleLawnGrain=.5;
 if(belleLawnResolved>0.){
  belleLawnGrain=fract(sin(dot(floor(terrainXZ*8.),vec2(31.17,73.91)))*43758.5453);
 }`
);

export const LAWN_GRAIN_GUARD_KEY='belle-lawn-grain-guard-v1';
