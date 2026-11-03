export const FLYOVER_SHOT_SECONDS=18;
export const FLYOVER_SHOTS=[
 {name:'MACARTHUR BRIDGE',from:[-125,34,470],to:[-65,43,600],lookFrom:[255,8,430],lookTo:[290,8,560]},
 {name:'THE CONSERVATORY',from:[1268,27,1235],to:[1362,23,1252],lookFrom:[1337,13,1173],lookTo:[1333,13,1173]},
 {name:'DETROIT RIVERFRONT',from:[-155,23,1505],to:[-205,28,1480],lookFrom:[-3127,110,1983],lookTo:[-3127,100,1983]}
] as const;
/** Slow, metre-scale moves through the actual game world; cuts happen under the shutter. */
export function sampleFlyover(seconds:number){
 const loop=FLYOVER_SHOT_SECONDS*FLYOVER_SHOTS.length;
 const wrapped=((seconds%loop)+loop)%loop;
 const index=Math.floor(wrapped/FLYOVER_SHOT_SECONDS),shot=FLYOVER_SHOTS[index];
 const t=(wrapped%FLYOVER_SHOT_SECONDS)/FLYOVER_SHOT_SECONDS;
 const ease=t*t*(3-2*t);
 const mix=(a:readonly number[],b:readonly number[])=>a.map((n,i)=>n+(b[i]-n)*ease) as [number,number,number];
 // A 0.8 second black shutter masks camera cuts and distant mesh population.
 const fadeIn=Math.min(1,t*FLYOVER_SHOT_SECONDS/.8),fadeOut=Math.min(1,(1-t)*FLYOVER_SHOT_SECONDS/.8);
 return {index,name:shot.name,position:mix(shot.from,shot.to),target:mix(shot.lookFrom,shot.lookTo),shutter:1-Math.min(fadeIn,fadeOut),progress:t};
}
