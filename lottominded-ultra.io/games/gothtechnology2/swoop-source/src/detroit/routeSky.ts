import * as T from 'three';
import {NaturalSky} from '../../../ride-core/src/naturalSky.ts';
import {districtSun,DETROIT_REFERENCE} from '../../../greater-detroit-graphics/src/visualStandard.ts';
export const DAY_SUN=new T.Vector3(22,35,24).normalize();
// Low golden sunrise, composed river-side to the left of GM from the Cut.
// Keep the legacy DUSK export for the existing day/low-sun toggle.
export const DUSK_SUN=new T.Vector3(18,4.5,44).normalize();
const calibrated=(hour:number)=>{const p=districtSun('swoop-detroit',DETROIT_REFERENCE.date,hour);return new T.Vector3(p.x,p.y,p.z).normalize();};
const SHARED_DAY_SUN=calibrated(14),SHARED_DUSK_SUN=calibrated(17.5);
export const DAY_HAZE='#b6c8ce',DUSK_HAZE='#c4a17c';
/** Sky, sun shadows and horizon haze use the same daylight direction. */
export class RouteSky extends NaturalSky {
 private dusk=false;
 private sharedSolarCalibration=false;
 setSharedSolarCalibration(enabled:boolean){this.sharedSolarCalibration=!!enabled;}
 get sunVector(){return this.sharedSolarCalibration?(this.dusk?SHARED_DUSK_SUN:SHARED_DAY_SUN):(this.dusk?DUSK_SUN:DAY_SUN);}
 constructor(){super();this.update(0,DAY_SUN);}
 setDusk(value:boolean){this.dusk=value;}
 tick(dt:number,haze?:T.Color,low=false,reduced=false,paused=false){this.update(dt,this.sunVector,.18,0,low,reduced,paused,haze);}
}
