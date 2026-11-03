import type {ParkMap} from './terrain.ts';
export const KOI_POND_ID='762688416';
export const KOI_COUNT=12;
export const TEMPERANCE_VIEW:[number,number]=[1338,1196];
/** Metres, beneath the 1.05 m pond surface. Two loops stay inside the mapped pond. */
export function koiPose(index:number,time:number){
 const lower=index>=6,i=index%6,a=time*(.12+i*.009)+i*Math.PI/3;
 const rx=(lower?1.7:1.15)+i*.08,rz=(lower?1.65:1.5)+i*.1;
 return {x:(lower?1337.1:1334.1)+Math.cos(a)*rx,z:(lower?1149.9:1136.6)+Math.sin(a)*rz,
  y:.78+Math.sin(time*.8+index)*.035,yaw:Math.atan2(-Math.sin(a)*rx,Math.cos(a)*rz),tail:Math.sin(time*5+index)*.32,size:.86+i*.055};
}
export type Flow={from:[number,number,number];to:[number,number,number];rise:number;radius:number;seconds:number};
export type Fountain={id:string;name:string;x:number;z:number;yaw:number;range:number;volume:number;flows:Flow[]};
export function flowPoint(f:Flow,t:number):[number,number,number]{return [f.from[0]+(f.to[0]-f.from[0])*t,f.from[1]+(f.to[1]-f.from[1])*t+4*f.rise*t*(1-t),f.from[2]+(f.to[2]-f.from[2])*t];}
/** Nozzles follow the existing Blender-authored bowls, not the collider bounds. */
export function fountains(map:ParkMap):Fountain[]{return (map.monuments||[]).filter(m=>['scott_fountain','barbour','temperance'].includes(m.model)).map(m=>{
 const flows:Flow[]=[];const add=(from:Flow['from'],to:Flow['to'],rise:number,radius:number,seconds=1.3)=>flows.push({from,to,rise,radius,seconds});
 if(m.model==='scott_fountain'){
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;add([0,8.4,0],[Math.sin(a)*.75,8.35,Math.cos(a)*.75],4.6,.045,2);}
  for(let i=0;i<48;i++){const a=i*Math.PI*2/48;add([Math.sin(a)*3.24,8.4,Math.cos(a)*3.24],[Math.sin(a)*4.25,5.78,Math.cos(a)*4.25],.08,.032,.85);}
  for(let i=0;i<24;i++){const a=i*Math.PI*2/24;add([Math.sin(a)*19,.74,Math.cos(a)*19],[Math.sin(a)*21.2,.42,Math.cos(a)*21.2],.8,.027,1.15);}
  for(let i=0;i<4;i++){const a=i*Math.PI/2;add([Math.sin(a)*10.35,2.9,Math.cos(a)*10.35],[Math.sin(a)*13,1.57,Math.cos(a)*13],.20,.055,.8);add([Math.sin(a)*14.7,1.56,Math.cos(a)*14.7],[Math.sin(a)*15.05,.42,Math.cos(a)*15.05],.03,.035,.6);}
 }else if(m.model==='barbour'){
  for(let i=0;i<4;i++){const a=i*Math.PI/2;add([Math.sin(a)*2.08,1.45,Math.cos(a)*2.08],[Math.sin(a)*3.7,.32,Math.cos(a)*3.7],.16,.037,.8);}
 }else add([0,1.18,.37],[0,1.08,-.17],.17,.012,.45);
 return{id:m.id,name:m.name,x:m.x,z:m.z,yaw:m.yaw,range:m.model==='scott_fountain'?95:m.model==='barbour'?32:7,volume:m.model==='temperance'?.22:.8,flows};
 });}
/** Smooth distance rolloff; callers can mute interiors separately. */
export function waterLevel(sources:Fountain[],x:number,z:number){let level=0;for(const s of sources){const d=Math.hypot(x-s.x,z-s.z),t=Math.max(0,1-d/s.range);level=Math.max(level,t*t*(3-2*t)*s.volume);}return level;}
export function natureMix(enabled:boolean,playing:boolean,volume:number,indoors:boolean,water:number){const v=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0;const master=enabled&&playing?v:0;return {wind:master*(indoors?.018:.13),birds:master*(indoors?.07:1),water:master*Math.max(0,Math.min(1,water))*.34};}
