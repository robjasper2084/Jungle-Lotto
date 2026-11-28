import {addDetroitDistricts as original} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/detroitScene.ts';
import {clipHostSurface} from './visualDistricts.ts';

/** Same host district renderer and styles, with exact overlap removal applied
 * before roadContact receives its final geometry. No duplicate raised roads. */
export function addDetroitDistricts(...args:Parameters<typeof original>){
  const poly=args[3],road=args[4];
  args[3]=(...p)=>clipHostSurface(poly(...p));
  args[4]=(...p)=>clipHostSurface(road(...p));
  return original(...args);
}
