import type {TerrainSampler as MapTerrain} from '../simulation/world.ts';
import {createGroundSample} from '../simulation/world.ts';
import type {TerrainSampler,Vec3} from '@digital-static/ridecore';

/** RideCore accepts displacement rays; the map physics expects unit directions. */
export function rideCoreTerrain(map:MapTerrain):TerrainSampler {
  const sample=createGroundSample();
  const unit=(d:Vec3)=>{const n=Math.hypot(d.x,d.y,d.z);return n>1e-10?{x:d.x/n,y:d.y/n,z:d.z/n}:null;};
  return {
    sampleGround(x,z,out){
      const g=map.sampleGround(x,z,sample);out.height=g.height;Object.assign(out.normal,g.normal);out.offCourse=g.offCourse;
      out.surface=g.surface==='spill'?'ice':g.surface==='roughPavement'?'pavement':g.surface;return out;
    },
    raycast(o,d,max){const n=unit(d);return n&&max>0?map.raycast(o,n,max):null;},
    raycastObstacle(o,d,max,width,lateral,out){const n=unit(d);return n&&max>0?map.raycastObstacle?.(o,n,max,width,lateral,out)??null:null;}
  };
}
