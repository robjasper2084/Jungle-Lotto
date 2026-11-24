import {RealLocationPanel} from '../src/belle/realLocationPanel.ts';
import {REAL_LOCATION_ORIGIN,REAL_LOCATION_METRES_PER_DEGREE,type LocationPositionInput} from '../src/belle/realLocation.ts';

export type FixtureCommand='open'|'usable'|'poor'|'denied'|'stale'|'outside'|'pause'|'visible'|'step'|'north'|'east'|'invalid-compass'|'deny-compass';
export type FixtureAPI={command:(command:FixtureCommand)=>void;setReduced:(enabled:boolean)=>void;report:()=>string};
if(!import.meta.env.DEV)throw new Error('The GPS fixture is development-only.');
if(window.parent===window)throw new Error('Open qa/gps-ui.html; this fixture runs inside its isolated frame.');

// These shims are confined to this development frame. Native geolocation and
// orientation APIs are never called, and the iframe policy denies real sensors.
type Watch={success:(position:LocationPositionInput)=>void;error:(error:{code:number})=>void};
const watches=new Map<number,Watch>();let nextWatch=0,watchCalls=0,clearCalls=0;
let scenario='usable',hidden=false,syntheticX=1500,lastStamp=0,reduced=false;
let compass='north',compassPermission='granted',permissionCalls=0;
const orientationTarget=new EventTarget();
const nativeAdd=window.addEventListener.bind(window),nativeRemove=window.removeEventListener.bind(window);
const sensorType=(type:string)=>type==='deviceorientation'||type==='deviceorientationabsolute';
Object.defineProperty(window,'addEventListener',{configurable:true,value:(type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{
  if(sensorType(type))orientationTarget.addEventListener(type,listener,options);else nativeAdd(type,listener,options);
}});
Object.defineProperty(window,'removeEventListener',{configurable:true,value:(type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{
  if(sensorType(type))orientationTarget.removeEventListener(type,listener,options);else nativeRemove(type,listener,options);
}});
Object.defineProperty(window,'orientation',{configurable:true,get:()=>0});
Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class extends Event{
  static requestPermission(){permissionCalls++;return Promise.resolve(compassPermission);}
}});
function sendPosition(watch:Watch){
  if(scenario==='denied'){watch.error({code:1});return;}
  const x=scenario==='outside'?9000:syntheticX;
  const now=Date.now();lastStamp=Math.max(now,lastStamp+1);
  watch.success({timestamp:scenario==='stale'?now-30000:lastStamp,coords:{
    latitude:REAL_LOCATION_ORIGIN[1]-550/REAL_LOCATION_METRES_PER_DEGREE,
    longitude:REAL_LOCATION_ORIGIN[0]+x/(REAL_LOCATION_METRES_PER_DEGREE*Math.cos(REAL_LOCATION_ORIGIN[1]*Math.PI/180)),
    accuracy:scenario==='poor'?120:5,heading:null,speed:0,
  }});
}
function emitGPS(){for(const watch of [...watches.values()])sendPosition(watch);}
Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
  watchPosition(success:Watch['success'],error:Watch['error']){const id=nextWatch++;watchCalls++;const watch={success,error};watches.set(id,watch);queueMicrotask(()=>{if(watches.has(id))sendPosition(watch);});return id;},
  clearWatch(id:number){clearCalls++;watches.delete(id);},
  getCurrentPosition(){throw new Error('Only simulated watchPosition is provided.');},
}});
function emitCompass(){
  if(hidden)return;
  const event=new Event('deviceorientationabsolute');
  Object.assign(event,{absolute:true,alpha:compass==='east'?270:0,beta:compass==='invalid'?90:0,gamma:0});
  orientationTarget.dispatchEvent(event);
}
const panel=new RealLocationPanel({contains:(x,z)=>x>=0&&x<=3000&&z>=0&&z<=2000,canFollow:()=>null,
  onFollowChanged:()=>{},onOpen:()=>{},reducedMotion:()=>reduced});
const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
const ctx=canvas.getContext('2d')!;
let frameId=0,previous=performance.now(),firstGap:number|null=null,lastTargetX=NaN,lastTargetZ=NaN;
let displayX:number|null=null,displayZ:number|null=null;
function draw(now:number){
  const dt=Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;
  const view=panel.update(dt),fix=panel.snapshot.fix;
  displayX=view?.x??null;displayZ=view?.z??null;
  if(view&&fix&&(fix.x!==lastTargetX||fix.z!==lastTargetZ)){
    firstGap=Math.hypot(fix.x-view.x,fix.z-view.z);lastTargetX=fix.x;lastTargetZ=fix.z;
  }
  const w=innerWidth,h=innerHeight;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.fillStyle='#13393d';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#44675c';ctx.lineWidth=1;
  for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  const px=(x:number)=>w/2+(x-1500)*4,pz=(z:number)=>h/2+(z-550)*4;
  panel.drawMap(ctx,px,pz);
  if(view){ctx.beginPath();ctx.arc(px(view.x),pz(view.z),9,0,Math.PI*2);ctx.fillStyle='#ffd68b';ctx.fill();}
  frameId=requestAnimationFrame(draw);
}
frameId=requestAnimationFrame(draw);
const gpsTimer=setInterval(()=>{if(!hidden)emitGPS();},1000),compassTimer=setInterval(emitCompass,250);
const api:FixtureAPI={
  command(command){
    if(command==='open'){document.querySelector<HTMLButtonElement>('.real-location-open')?.click();return;}
    if(command==='pause'||command==='visible'){hidden=command==='pause';document.dispatchEvent(new Event('visibilitychange'));return;}
    if(command==='north'||command==='east'||command==='invalid-compass'||command==='deny-compass'){
      compassPermission=command==='deny-compass'?'denied':'granted';
      if(command!=='deny-compass')compass=command==='invalid-compass'?'invalid':command;
      emitCompass();return;
    }
    if(command==='step'){syntheticX+=6;scenario='usable';}else scenario=command;
    emitGPS();
  },
  setReduced(enabled){reduced=enabled;},
  report(){
    const focus=document.activeElement as HTMLElement|null;
    const focusLabel=focus?.id||focus?.getAttribute('aria-label')||focus?.textContent?.trim().slice(0,45)||focus?.tagName||'none';
    return `Viewport: ${innerWidth} × ${innerHeight} · Simulated tab: ${hidden?'hidden':'visible'}\nLocation: ${panel.snapshot.status} · Follow: ${panel.following?'on':'off'} · GPS feed: ${scenario}\nSimulated watches: ${watches.size} active / ${watchCalls} started / ${clearCalls} cleared · Simulated compass requests: ${permissionCalls}\nReduced motion: ${reduced?'ON':'OFF'} · Last target change first-frame gap: ${firstGap===null?'start Follow, then Step':firstGap.toFixed(3)+' m'}\nDisplayed synthetic position: ${displayX===null?'none':displayX.toFixed(2)+', '+displayZ?.toFixed(2)} · Focus: ${focusLabel}`;
  },
};
(window as Window&{gpsUiFixture?:FixtureAPI}).gpsUiFixture=api;
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);clearInterval(gpsTimer);clearInterval(compassTimer);panel.dispose();},{once:true});
