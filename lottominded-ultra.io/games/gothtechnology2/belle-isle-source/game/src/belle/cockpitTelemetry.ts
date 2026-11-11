import {speedMph} from './speedUnits.ts';
import type {JarvsStatus} from './jarvsAvionics.ts';
import {gearLabel,type DriveGear} from './hoverTransmission.ts';
export type CockpitInput={speed:number;height:number;heading:number;landed:boolean;landing:boolean;boost:boolean;collision:boolean;lights:boolean;drone?:boolean;cruiseSpeed?:number|null;gear?:DriveGear;clutch?:number;throttle?:number;brake?:number;jarvs?:{status:JarvsStatus;signalLock:boolean}};
export function cockpitTelemetry(p:CockpitInput){
 const degrees=((180-p.heading*180/Math.PI)%360+360)%360;
 return{gear:gearLabel(p.gear??'auto'),driveState:p.brake?'BRAKE':(p.clutch??0)>.8?'CLUTCH':p.gear===0?'NEUTRAL':'DRIVE',throttle:Math.min(1,Math.abs(p.throttle??0)),speed:speedMph(p.speed),height:Math.max(0,p.height).toFixed(1),bearing:Math.round(degrees)%360,compass:['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8],mode:p.landed?'LANDED':p.landing?'LANDING':p.boost?'BOOST':p.cruiseSpeed!=null?'CRUISE':p.drone?'ALT HOLD':'IN FLIGHT',warning:p.collision?'OBSTACLE':p.speed<-.1?'REVERSE':'',lights:p.lights};
}
