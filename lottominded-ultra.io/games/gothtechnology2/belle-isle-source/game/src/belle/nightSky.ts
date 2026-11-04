import {wrapHour} from './skyModel.ts';
type Direction=[number,number,number];
const direction=(azimuth:number,altitude:number):Direction=>[Math.sin(azimuth)*Math.cos(altitude),Math.sin(altitude),Math.cos(azimuth)*Math.cos(altitude)];
/** An art-directed lunar arc, independent of the sun. Not a real-date ephemeris. */
export function moonDirection(hour:number):Direction{
 const phase=wrapHour(hour-18)/12;
 return direction(-Math.PI*.7+phase*Math.PI*1.4,Math.sin(phase*Math.PI)*.78+.08);
}
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function meteorFrame(seconds:number,night:number,reduced:boolean){
 const index=Math.floor(Math.max(0,seconds)/37),age=seconds-index*37-(8+hash(index)*16),duration=.85;
 const visible=!reduced&&night>.5&&age>=0&&age<duration;
 const t=Math.max(0,Math.min(1,age/duration)),az=hash(index+7)*Math.PI*2,alt=.35+hash(index+13)*.45;
 const head=direction(az+t*.24,alt-t*.12),tail=direction(az+Math.max(0,t-.36)*.24,alt-Math.max(0,t-.36)*.12);
 return{head,tail,opacity:visible?Math.sin(Math.PI*t)*night:0};
}
