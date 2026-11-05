import {segment,type Point} from './terrain.ts';
/** Dawn chorus, daytime calls and quiet birds at night. */
export function birdActivity(hour:number){
 const h=((Number.isFinite(hour)?hour:12)%24+24)%24;
 if(h<5||h>21)return .04;
 if(h<7)return .04+(h-5)/2*.96;
 if(h<10)return 1;
 if(h<17)return .76;
 if(h<19)return .9;
 return .9-(h-19)/2*.86;
}
/** Queried at low frequency, never per frame. */
export function shoreSoundLevel(edges:Point[][],x:number,z:number){
 let nearest=60;for(const line of edges)for(let i=1;i<line.length;i++)nearest=Math.min(nearest,segment(x,z,line[i-1],line[i]).d);
 const t=Math.max(0,1-nearest/45);return t*t*(3-2*t);
}
export function natureShouldPlay(enabled:boolean,volume:number,playing:boolean,visible:boolean,focused:boolean,preview:boolean){
 return enabled&&Number.isFinite(volume)&&volume>0&&visible&&focused&&(playing||preview);
}
