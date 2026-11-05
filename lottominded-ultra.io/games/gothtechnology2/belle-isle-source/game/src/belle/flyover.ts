export const FLYOVER_SHOT_SECONDS=24;
export const FLYOVER_SHOTS=[
 {name:'MACARTHUR BRIDGE · DETROIT RIVER',from:[205,16,495],to:[218,17,528],lookFrom:[318,7,590],lookTo:[330,7,614]},
 {name:'THE CONSERVATORY · ISLAND GARDENS',from:[1248,29,1260],to:[1266,29,1252],lookFrom:[1310,12,1151],lookTo:[1316,12,1149]},
 {name:'DETROIT · ACROSS THE WATER',from:[-175,18,1505],to:[-202,22,1480],lookFrom:[-3127,100,1983],lookTo:[-3127,100,1983]}
] as const;
/** Wide establishing views; no orbit approaches a facade or passes through a landmark. */
export function sampleFlyover(seconds:number,aspect=16/9){
 const loop=FLYOVER_SHOT_SECONDS*FLYOVER_SHOTS.length,wrapped=((seconds%loop)+loop)%loop;
 const index=Math.floor(wrapped/FLYOVER_SHOT_SECONDS),shot=FLYOVER_SHOTS[index],t=(wrapped%FLYOVER_SHOT_SECONDS)/FLYOVER_SHOT_SECONDS,ease=t*t*(3-2*t);
 const mix=(a:readonly number[],b:readonly number[])=>a.map((n,i)=>n+(b[i]-n)*ease) as [number,number,number];
 const fadeIn=Math.min(1,t*FLYOVER_SHOT_SECONDS/1.1),fadeOut=Math.min(1,(1-t)*FLYOVER_SHOT_SECONDS/1.1);
 const target=mix(shot.lookFrom,shot.lookTo);
 // Portrait framing centers the greenhouse above the title instead of cropping its dome.
 if(index===1&&aspect<.9){target[0]=1330.8;target[1]=0;target[2]=1174.7;}
 return {index,name:shot.name,position:mix(shot.from,shot.to),target,shutter:1-Math.min(fadeIn,fadeOut),progress:t};
}
