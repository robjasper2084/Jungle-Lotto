import * as T from 'three';
export const LED_COLORS=['#79dfff','#ffb44f','#ff3c55','#b277ff','#75ffbe','#f5f2e5'];
export function ledColor(base:string,mode:string,elapsed:number,reduced:boolean){return mode==='cycle'&&!reduced?new T.Color().setHSL((elapsed/18)%1,.88,.62):new T.Color(base);}
