export const CLOUD_TYPES=['changing','clear','wispy','scattered','layered','overcast'] as const;
export type CloudType=typeof CLOUD_TYPES[number];
export type SkySettings={hour:number;cycle:boolean;dayMinutes:number;clouds:CloudType};
export const DEFAULT_SKY:SkySettings={hour:16.7,cycle:true,dayMinutes:20,clouds:'changing'};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const wrapHour=(hour:number)=>((hour%24)+24)%24;
export function normalizeSky(value:Partial<SkySettings>|null):SkySettings{
 const v=value||{};return {hour:Number.isFinite(v.hour)?wrapHour(v.hour!):DEFAULT_SKY.hour,cycle:typeof v.cycle==='boolean'?v.cycle:DEFAULT_SKY.cycle,dayMinutes:[10,20,60].includes(v.dayMinutes!)?v.dayMinutes!:20,clouds:CLOUD_TYPES.includes(v.clouds!)?v.clouds!:'changing'};
}
/** Only foreground, unpaused play advances the clock; never catch up after a stalled tab. */
export function advanceHour(hour:number,seconds:number,settings:SkySettings,running:boolean){return wrapHour(hour+(settings.cycle&&running&&Number.isFinite(seconds)?clamp(seconds,0,.1)*24/(settings.dayMinutes*60):0));}
export function clockLabel(hour:number){const minutes=Math.floor(wrapHour(hour)*60)%1440;return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
/** Art-directed skyline alignment, not an astronomical sun-position calculation. */
export function sunDirection(hour:number):[number,number,number]{
 const a=(wrapHour(hour)-12)*Math.PI/12,s=Math.sin(a),c=Math.cos(a),x=-.981627183447664*s+.190808995376545*c*.30,y=.82*c,z=.190808995376545*s+.981627183447664*c*.30,length=Math.hypot(x,y,z);return [x/length,y/length,z/length];
}
export function smooth(a:number,b:number,x:number){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
/** Keep the road and nearby gates clear while separating the far river skyline.
 * Fog colour still comes from the live sky, including sunset and night. */
export function islandHazeDensity(overcast:number,night=0){
 const cover=Number.isFinite(overcast)?clamp(overcast,0,1):0,dark=Number.isFinite(night)?clamp(night,0,1):0;
 return .00020+cover*.000045-dark*.00002;
}
export const SKY_KEYS=[
 {hour:0,top:'#071124',horizon:'#192636',warm:'#263440',cloud:'#253040',sun:'#c7daee'},
 {hour:5,top:'#101c34',horizon:'#334352',warm:'#8c5140',cloud:'#343c50',sun:'#f9a45c'},
 {hour:5.8,top:'#273955',horizon:'#8297a6',warm:'#ed8c52',cloud:'#626171',sun:'#ffba77'},
 {hour:6.4,top:'#497b9e',horizon:'#b5c4cc',warm:'#ffd6a2',cloud:'#999799',sun:'#ffcd91'},
 {hour:8,top:'#397fac',horizon:'#c3d5df',warm:'#e4e6df',cloud:'#e1e4e4',sun:'#fff0d8'},
 {hour:12,top:'#337eb1',horizon:'#bdd3e1',warm:'#ecedf0',cloud:'#eef1f3',sun:'#fff6e8'},
 {hour:15,top:'#4b89b1',horizon:'#cad4da',warm:'#f2e1c7',cloud:'#e4e2de',sun:'#ffe7c1'},
 {hour:16.7,top:'#6d9db8',horizon:'#d8e1e2',warm:'#f8cd9f',cloud:'#c1c7c6',sun:'#ffe2b5'},
 {hour:17.6,top:'#63859f',horizon:'#ddcec0',warm:'#f3ac6a',cloud:'#aaa9a7',sun:'#ffe4b4'},
 {hour:18.15,top:'#40536d',horizon:'#a58c85',warm:'#df7947',cloud:'#777c86',sun:'#ffc18a'},
 {hour:18.7,top:'#172840',horizon:'#384761',warm:'#75474a',cloud:'#343a50',sun:'#e7ad90'},
 {hour:19.6,top:'#0a1830',horizon:'#233449',warm:'#344354',cloud:'#293449',sun:'#c7daee'},
 {hour:24,top:'#071124',horizon:'#192636',warm:'#263440',cloud:'#253040',sun:'#c7daee'}
];
export function skyKeyBlend(hour:number){const h=wrapHour(hour);let i=0;while(i<SKY_KEYS.length-2&&h>SKY_KEYS[i+1].hour)i++;return {a:SKY_KEYS[i],b:SKY_KEYS[i+1],t:smooth(SKY_KEYS[i].hour,SKY_KEYS[i+1].hour,h)};}
export type CloudShape={coverage:number;density:number;stretch:number;scale:number;overcast:number};
const SHAPES:Record<Exclude<CloudType,'changing'>,CloudShape>={
 clear:{coverage:.08,density:.28,stretch:1.2,scale:1,overcast:0},
 wispy:{coverage:.54,density:.66,stretch:5.8,scale:1.15,overcast:.04},
 scattered:{coverage:.62,density:.95,stretch:1.1,scale:1.5,overcast:.1},
 layered:{coverage:.73,density:.92,stretch:3.9,scale:.85,overcast:.35},
 overcast:{coverage:.91,density:1,stretch:1.5,scale:.65,overcast:.87}
};
export function cloudShape(type:CloudType,hour:number):CloudShape{
 if(type!=='changing')return {...SHAPES[type]};
 const order=['layered','wispy','scattered','scattered','layered','scattered','layered','layered'] as const;
 const phase=wrapHour(hour)/3,index=Math.floor(phase),t=smooth(0,1,phase-index),a=SHAPES[order[index]],b=SHAPES[order[(index+1)%order.length]];
 return Object.fromEntries(Object.keys(a).map(k=>[k,a[k as keyof CloudShape]+(b[k as keyof CloudShape]-a[k as keyof CloudShape])*t])) as CloudShape;
}
