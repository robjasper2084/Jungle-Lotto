import {gunzipSync} from 'fflate';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
export const STREET_CACHE_REVISION='draped-streets-20261010-joins-ramp-1';
export type StreetCache={version?:number;encoding?:string;revision:string;sections:number;triangles:number;values:number;tiles:{x:number;z:number;material:string;offset:number;count:number;indexOffset?:number;indexCount?:number;encodedOffset?:number;vertexBytes?:number;indexBytes?:number}[];positions:Float32Array;indices?:Uint32Array};
/** Precomputed from the same mapped drape function as riding collision. This
 * removes repeated polygon clipping at startup without reducing road detail. */
export async function loadStreetSurfaceCache():Promise<StreetCache|null>{
 if(typeof document==='undefined')return null;
 try{let name='street-surfaces-indexed',response=await fetch('/exports/street-life/'+name+'.json');if(response.status===404){name='street-surfaces';response=await fetch('/exports/street-life/'+name+'.json');}if(!response.ok)return null;const meta=await response.json() as Omit<StreetCache,'positions'>;
  if(meta.revision!==STREET_CACHE_REVISION||!Number.isSafeInteger(meta.values)||meta.values>40_000_000||!Array.isArray(meta.tiles))return null;
   const data=await fetch('/exports/street-life/'+name+'.bin.gz');if(!data.ok)return null;
  // Native streaming inflation keeps the large street mesh off the JS thread.
   const raw=typeof DecompressionStream!=='undefined'&&data.body?new Uint8Array(await new Response(data.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()):gunzipSync(new Uint8Array(await data.arrayBuffer()));
   if(meta.version===2){
    if(meta.encoding!=='meshopt')return null;await MeshoptDecoder.ready;const decoded=new Uint8Array(meta.values*4);
    for(const t of meta.tiles){const {offset,count,indexOffset,indexCount,encodedOffset,vertexBytes,indexBytes}=t;
     if(![offset,count,indexOffset,indexCount,encodedOffset,vertexBytes,indexBytes].every(n=>Number.isSafeInteger(n)&&n!>=0)||count%3||indexCount!%3||offset+count>meta.values||indexOffset!+indexCount!>meta.values||encodedOffset!+vertexBytes!+indexBytes!>raw.length)return null;
     MeshoptDecoder.decodeVertexBuffer(decoded.subarray(offset*4,(offset+count)*4),count/3,12,raw.subarray(encodedOffset,encodedOffset!+vertexBytes!));
     MeshoptDecoder.decodeIndexSequence(decoded.subarray(indexOffset!*4,(indexOffset!+indexCount!)*4),indexCount!,4,raw.subarray(encodedOffset!+vertexBytes!,encodedOffset!+vertexBytes!+indexBytes!));
     for(const i of new Uint32Array(decoded.buffer,indexOffset!*4,indexCount))if(i>=count/3)return null;
    }
    return {...meta,positions:new Float32Array(decoded.buffer),indices:new Uint32Array(decoded.buffer)};
   }
   if(raw.byteLength!==meta.values*4)return null;
   for(const t of meta.tiles)if(![t.x,t.z,t.offset,t.count].every(Number.isFinite)||t.offset<0||t.count<0||t.count%9||t.offset+t.count>meta.values)return null;
   return {...meta,positions:new Float32Array(raw.buffer,raw.byteOffset,meta.values)};
 }catch{return null;}
}
