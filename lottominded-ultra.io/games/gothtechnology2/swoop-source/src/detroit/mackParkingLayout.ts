import {MACK_STUDIO,studioMap} from './mackStudioSite.ts';
type ParkingLot={x:number;z:number;width:number;depth:number};
/** Reject the old estimated parking pad now occupied by the mapped studio. */
export function parkingClearOfStudio(lot:ParkingLot){
 const studio=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>studioMap(u*MACK_STUDIO.width/2,v*MACK_STUDIO.depth/2));
 const pad=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:lot.x+u*lot.width/2,z:lot.z+v*lot.depth/2}));
 const edge={x:studio[1].x-studio[0].x,z:studio[1].z-studio[0].z},other={x:studio[3].x-studio[0].x,z:studio[3].z-studio[0].z};
 return [{x:1,z:0},{x:0,z:1},edge,other].some(axis=>{
  const a=studio.map(p=>p.x*axis.x+p.z*axis.z),b=pad.map(p=>p.x*axis.x+p.z*axis.z);
  return Math.max(...a)<=Math.min(...b)||Math.max(...b)<=Math.min(...a);
 });
}
export const MACK_PARKING_LOTS=[2495,2583].map(x=>({x,z:-1471,width:20,depth:25})).filter(parkingClearOfStudio);
