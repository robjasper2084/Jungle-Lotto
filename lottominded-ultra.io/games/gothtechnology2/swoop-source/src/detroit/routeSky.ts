import * as T from 'three';
import {NaturalSky} from '../../../ride-core/src/naturalSky.ts';
export const DAY_SUN=new T.Vector3(22,35,24).normalize();
// Low golden sunrise, composed river-side to the left of GM from the Cut.
// Keep the legacy DUSK export for the existing day/low-sun toggle.
export const DUSK_SUN=new T.Vector3(18,4.5,44).normalize();
export const DAY_HAZE='#b6c8ce',DUSK_HAZE='#c4a17c';
/** Sky, sun shadows and horizon haze use the same daylight direction. */
export class RouteSky extends NaturalSky {
 private dusk=false;
 constructor(){super();this.update(0,DAY_SUN);}
 setDusk(value:boolean){this.dusk=value;}
 tick(dt:number,haze?:T.Color,low=false,reduced=false,paused=false){this.update(dt,this.dusk?DUSK_SUN:DAY_SUN,.18,0,low,reduced,paused,haze);}
}
