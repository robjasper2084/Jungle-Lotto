export type WaterfowlRoute={species:'swan'|'duck';x:number;z:number;rx:number;rz:number;period:number;phase:number;plumage:'white'|'drake'|'hen'};
/** Six individual residents, close enough to see from the east lagoon footpath. */
export const WATERFOWL:readonly WaterfowlRoute[]=[
 {species:'swan',plumage:'white',x:3936,z:-186,rx:3.2,rz:2.3,period:68,phase:0},
 {species:'swan',plumage:'white',x:3925,z:-182,rx:3.5,rz:2.7,period:77,phase:1.2},
 {species:'swan',plumage:'white',x:3916,z:-171,rx:3.4,rz:2.4,period:73,phase:2.8},
 {species:'swan',plumage:'white',x:3927,z:-166,rx:3.1,rz:2.2,period:82,phase:4.1},
 {species:'duck',plumage:'drake',x:3940,z:-194,rx:2.2,rz:1.7,period:49,phase:.8},
 {species:'duck',plumage:'hen',x:3933,z:-200,rx:2.4,rz:1.8,period:54,phase:3.5},
];
export function waterfowlPose(route:WaterfowlRoute,time:number){
 const t=(Number.isFinite(time)?time:0)*Math.PI*2/route.period+route.phase;
 return {x:route.x+Math.cos(t)*route.rx,z:route.z+Math.sin(t)*route.rz,y:1.05+Math.sin(t*3+route.phase)*.012,heading:Math.atan2(-Math.sin(t)*route.rx,Math.cos(t)*route.rz),roll:Math.sin(t*4)*.012};
}
