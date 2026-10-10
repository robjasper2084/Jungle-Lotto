import {gunzipSync} from 'fflate';
export const STREET_CACHE_REVISION='draped-streets-20261010-joins-ramp-1';
export type StreetCache={revision:string;sections:number;triangles:number;values:number;tiles:{x:number;z:number;material:string;offset:number;count:number}[];positions:Float32Array};
/** Precomputed from the same mapped drape function as riding collision. This
 * removes repeated polygon clipping at startup without reducing road detail. */
export async function loadStreetSurfaceCache():Promise<StreetCache|null>{
 if(typeof document==='undefined')return null;
 try{const response=await fetch('/exports/street-life/street-surfaces.json');if(!response.ok)return null;const meta=await response.json() as Omit<StreetCache,'positions'>;
  if(meta.revision!==STREET_CACHE_REVISION||!Number.isSafeInteger(meta.values)||meta.values>40_000_000||!Array.isArray(meta.tiles))return null;
  const data=await fetch('/exports/street-life/street-surfaces.bin.gz');if(!data.ok)return null;const raw=gunzipSync(new Uint8Array(await data.arrayBuffer()));if(raw.byteLength!==meta.values*4)return null;
  for(const t of meta.tiles)if(![t.x,t.z,t.offset,t.count].every(Number.isFinite)||t.offset<0||t.count<0||t.count%9||t.offset+t.count>meta.values)return null;
  return {...meta,positions:new Float32Array(raw.buffer,raw.byteOffset,meta.values)};
 }catch{return null;}
}
