import type {SurfaceId} from './terrain.ts';
import {nearestCut} from './geography.ts';

export const inMillikenPark=(x:number,z:number)=>x<28&&x> -350&&z< -1010&&z> -1750;
/** Road/path ribbons own their edges; the terrain underneath is lawn. Never
 * classify whole 2–20 m terrain faces as paving in the park. */
export function terrainVisualSurface(x:number,z:number,surface:SurfaceId):SurfaceId{
 if(inMillikenPark(x,z))return 'grass';
 const c=nearestCut(x,z);
 return surface==='pavement'&&c.d>300&&Math.abs(c.u)<110?'grass':surface;
}
