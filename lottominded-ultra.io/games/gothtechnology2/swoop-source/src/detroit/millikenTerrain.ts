/** Google Maps Ze Mound pin, west of the harbor; height/footprint are authored estimates. */
export const MILLIKEN_BERM={x:-176.4192632,z:-1091.9538648,rx:37,rz:65,height:7.2};
export function millikenHill(x:number,z:number){const b=MILLIKEN_BERM,r=Math.hypot((x-b.x)/b.rx,(z-b.z)/b.rz);return r>=1?0:b.height*Math.pow(1-r*r,2);}
