export const FLYOVER_SHOT_SECONDS=24;
export const FLYOVER_SHOTS=[
 {name:'SCOTT FOUNTAIN · REFLECTING POOL',from:[149,8,1368],to:[158,8.6,1372],lookFrom:[182,6.5,1300],lookTo:[186,6.5,1301]},
 {name:'MACARTHUR BRIDGE · DETROIT RIVER',from:[-190,37,570],to:[-152,42,650],lookFrom:[240,7,490],lookTo:[280,7,565]},
 {name:'THE CONSERVATORY · ISLAND GARDENS',from:[1130,43,1375],to:[1162,46,1400],lookFrom:[1337,10,1168],lookTo:[1340,10,1170]},
 {name:'DETROIT · ACROSS THE WATER',from:[-175,18,1505],to:[-202,22,1480],lookFrom:[-3127,100,1983],lookTo:[-3127,100,1983]}
] as const;
/** Wide establishing views; no orbit approaches a facade or passes through a landmark. */
export function sampleFlyover(seconds:number){
 const loop=FLYOVER_SHOT_SECONDS*FLYOVER_SHOTS.length,wrapped=((seconds%loop)+loop)%loop;
 const index=Math.floor(wrapped/FLYOVER_SHOT_SECONDS),shot=FLYOVER_SHOTS[index],t=(wrapped%FLYOVER_SHOT_SECONDS)/FLYOVER_SHOT_SECONDS,ease=t*t*(3-2*t);
 const mix=(a:readonly number[],b:readonly number[])=>a.map((n,i)=>n+(b[i]-n)*ease) as [number,number,number];
 const fadeIn=Math.min(1,t*FLYOVER_SHOT_SECONDS/1.1),fadeOut=Math.min(1,(1-t)*FLYOVER_SHOT_SECONDS/1.1);
 return {index,name:shot.name,position:mix(shot.from,shot.to),target:mix(shot.lookFrom,shot.lookTo),shutter:1-Math.min(fadeIn,fadeOut),progress:t};
}
