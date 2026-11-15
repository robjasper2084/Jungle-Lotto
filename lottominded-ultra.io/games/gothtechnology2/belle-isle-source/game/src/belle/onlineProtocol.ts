import {createPose,lerpPose,type RidePose} from '../../runtime/ride-core/src/controller.ts';
import {CLOUD_TYPES,type SkySettings} from './skyModel.ts';
import {CORLEO_ACTIONS,type CorleoAnimationState} from './vehicles/corleoState.ts';
export const BELLE_PROTOCOL='belle-isle-explore-v2';
export const MAX_EXPLORERS=4;
export const PLAYER_COLORS=['#62e0d1','#ffc66d','#adabff','#fb91ab'] as const;
export type Explorer={id:string;name:string;joined:number;protocol:typeof BELLE_PROTOCOL;voice:false|'all'|'squad-a'|'squad-b'};
export type ExplorerFrame=CorleoAnimationState&{seq:number;pose:RidePose;mode:'ride'|'hover'|'slide';seat:number;active:boolean;vehicle?:'onewheel'|'hoverbike'|'jetson'|'corleo';pilot?:'professional'|'maverick';livery?:'industrial'|'sport_red'|'sport_blue';lights?:boolean;brake?:boolean;energy?:number};
const poseKeys=Object.keys(createPose()) as (keyof RidePose)[];
export function cleanName(v:unknown){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>]/g,'').trim().slice(0,24):'';}
export function explorer(v:any):Explorer|undefined{if(!v||v.protocol!==BELLE_PROTOCOL||typeof v.id!=='string'||!/^[-a-f0-9]{36}$/.test(v.id)||!cleanName(v.name)||!Number.isSafeInteger(v.joined)||v.joined<0||v.joined>Date.now()+60000||![false,'all','squad-a','squad-b'].includes(v.voice))return;return{id:v.id,name:cleanName(v.name),joined:v.joined,protocol:BELLE_PROTOCOL,voice:v.voice};}
export function explorerRoster(values:unknown[]){const seen=new Set<string>();return values.map(explorer).filter((m):m is Explorer=>!!m&&!seen.has(m.id)&&!!seen.add(m.id)).sort((a,b)=>a.joined-b.joined||a.id.localeCompare(b.id)).slice(0,MAX_EXPLORERS);}
export function explorerFrame(v:any,last=-1):ExplorerFrame|undefined{
 if(!v||!Number.isSafeInteger(v.seq)||v.seq<=last||!v.pose||!['ride','hover','slide'].includes(v.mode)||typeof v.active!=='boolean'||!Number.isFinite(v.seat)||v.seat<0||v.seat>1)return;
 for(const k of poseKeys)if(!Number.isFinite(v.pose[k])||Math.abs(v.pose[k])>1e7)return;
 if(Math.abs(v.pose.x)>20000||Math.abs(v.pose.z)>20000||v.pose.y< -500||v.pose.y>3000||Math.abs(v.pose.speed)>150)return;
 if(v.vehicle!==undefined&&!['onewheel','hoverbike','jetson','corleo'].includes(v.vehicle))return;
 if(v.pilot!==undefined&&!['professional','maverick'].includes(v.pilot))return;
 if(v.livery!==undefined&&!['industrial','sport_red','sport_blue'].includes(v.livery))return;
 if(v.corleoAction!==undefined||v.corleoTime!==undefined){if(v.vehicle!=='corleo'||!CORLEO_ACTIONS.includes(v.corleoAction)||!Number.isFinite(v.corleoTime)||v.corleoTime<0||v.corleoTime>60)return;}
 if(v.lights!==undefined&&typeof v.lights!=='boolean'||v.brake!==undefined&&typeof v.brake!=='boolean'||v.energy!==undefined&&(!Number.isFinite(v.energy)||v.energy<0||v.energy>1))return;
 const selection=v.vehicle===undefined?{}:{vehicle:v.vehicle,...(v.pilot===undefined?{}:{pilot:v.pilot}),...(v.livery===undefined?{}:{livery:v.livery})};
 const telemetry=Object.fromEntries(['lights','brake','energy','corleoAction','corleoTime'].filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
 return {seq:v.seq,pose:Object.fromEntries(poseKeys.map(k=>[k,v.pose[k]])) as RidePose,mode:v.mode,seat:v.seat,active:v.active,...selection,...telemetry};
}
export function networkSky(v:any):SkySettings|undefined{if(!v||!Number.isFinite(v.hour)||v.hour<0||v.hour>=24||typeof v.cycle!=='boolean'||![10,20,60].includes(v.dayMinutes)||!CLOUD_TYPES.includes(v.clouds))return;return{hour:v.hour,cycle:v.cycle,dayMinutes:v.dayMinutes,clouds:v.clouds};}
/** Receive-time interpolation avoids relying on synchronized device clocks. */
export class ExplorerBuffer{
 private frames:{at:number;frame:ExplorerFrame}[]=[];last=-1;
 push(value:unknown,at:number){const frame=explorerFrame(value,this.last);if(!frame)return false;const previous=this.frames.at(-1)?.frame;this.last=frame.seq;if(previous&&(Math.hypot(previous.pose.x-frame.pose.x,previous.pose.y-frame.pose.y,previous.pose.z-frame.pose.z)>40||previous.mode!==frame.mode||previous.vehicle!==frame.vehicle||previous.pilot!==frame.pilot||previous.livery!==frame.livery))this.frames=[];this.frames.push({at,frame});if(this.frames.length>6)this.frames.shift();return true;}
 sample(now:number):ExplorerFrame|undefined{const last=this.frames.at(-1);if(!last||now-last.at>3500||!last.frame.active)return;const target=now-130;let a=this.frames[0],b=last;for(const f of this.frames){if(f.at<=target)a=f;else{b=f;break;}}const t=Math.min(1,Math.max(0,(target-a.at)/Math.max(1,b.at-a.at))),out={...b.frame,pose:createPose(),seat:a.frame.seat+(b.frame.seat-a.frame.seat)*t};lerpPose(a.frame.pose,b.frame.pose,t,out.pose);for(const key of ['headingY','wheelSpin'] as const){const diff=Math.atan2(Math.sin(b.frame.pose[key]-a.frame.pose[key]),Math.cos(b.frame.pose[key]-a.frame.pose[key]));out.pose[key]=a.frame.pose[key]+diff*t;}return out;}
}
