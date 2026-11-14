import {clearanceWarning} from './cinematicPolicy.ts';
import {speedMph} from './speedUnits.ts';
import type {JarvsReading} from './jarvsAvionics.ts';
import {gearLabel,type DriveGear} from './hoverTransmission.ts';
export type CockpitInput={speed:number;height:number;heading:number;landed:boolean;landing:boolean;boost:boolean;collision:boolean;lights:boolean;drone?:boolean;cruiseSpeed?:number|null;gear?:DriveGear;clutch?:number;throttle?:number;brake?:number;jarvs?:CockpitJarvsInput};
export function cockpitTelemetry(p:CockpitInput){
 const degrees=((180-p.heading*180/Math.PI)%360+360)%360;
 return{gear:gearLabel(p.gear??'auto'),driveState:p.brake?'BRAKE':(p.clutch??0)>.8?'CLUTCH':p.gear===0?'NEUTRAL':'DRIVE',throttle:Math.min(1,Math.abs(p.throttle??0)),speed:speedMph(p.speed),height:Math.max(0,p.height).toFixed(1),bearing:Math.round(degrees)%360,compass:['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8],mode:p.landed?'LANDED':p.landing?'LANDING':p.boost?'BOOST':p.cruiseSpeed!=null?'CRUISE':p.drone?'ALT HOLD':'IN FLIGHT',warning:p.collision?'OBSTACLE':p.speed<-.1?'REVERSE':clearanceWarning(p.height,p.speed,p.landed)?'LOW CLEARANCE':'',lights:p.lights};
}

/** The existing flight advisor's read-only, bounded snapshot on the in-bike LCD.
 * Standby never implies an obstacle-free path. The UI cannot steer or lift. */
export type CockpitJarvsInput=Pick<JarvsReading,'status'|'signalLock'|'radarMeters'|'terrainRise'|'memoryCells'|'threat'|'advice'|'suggestedLift'>&{assistEnabled:boolean};
export function jarvsLcdReading(reading?:CockpitJarvsInput){
 if(!reading?.signalLock)return{status:'STANDBY',risk:0,radar:'SCAN STANDBY',terrain:'RISE --',cells:'ROUTE 0/64',advice:'Sensors standby',assist:'ASSIST INACTIVE'};
 const clamp=(n:number,min:number,max:number)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;
 const distance=typeof reading.radarMeters==='number'&&Number.isFinite(reading.radarMeters)?Math.max(0,reading.radarMeters):null;
 const lift=clamp(reading.terrainRise,0,36),cells=Math.round(clamp(reading.memoryCells,0,64));
 return{status:reading.status,risk:clamp(reading.threat,0,1),
  radar:distance===null?'SCAN NO RETURN':'SCAN '+Math.round(distance)+'m',
  terrain:'RISE +'+lift.toFixed(1)+'m',cells:'ROUTE '+cells+'/64',
  advice:String(reading.advice||'No reading').slice(0,160),
  assist:!reading.assistEnabled?'ASSIST OFF':reading.suggestedLift>0?'ASSIST LIFT':'ASSIST ARMED'};
}
