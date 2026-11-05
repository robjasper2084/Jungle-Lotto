import {clockLabel,type SkySettings,type CloudType} from './skyModel.ts';
export function connectSkySettings(sky:{settings:SkySettings;hour:number;configure(next:Partial<SkySettings>):void}){
 const input=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
 const hour=input<HTMLInputElement>('sky-hour'),label=input<HTMLOutputElement>('sky-clock'),cycle=input<HTMLInputElement>('sky-cycle'),speed=input<HTMLSelectElement>('sky-speed'),clouds=input<HTMLSelectElement>('sky-clouds'),preset=input<HTMLSelectElement>('sky-preset');
 const initial=sky.settings;cycle.checked=initial.cycle;speed.value=String(initial.dayMinutes);clouds.value=initial.clouds;
 const refresh=()=>{const state=sky.settings;cycle.checked=state.cycle;speed.value=String(state.dayMinutes);clouds.value=state.clouds;label.value=clockLabel(sky.hour);if(document.activeElement!==hour)hour.value=String(sky.hour);};
 const choose=(value:number)=>{sky.configure({hour:value,cycle:false});cycle.checked=false;hour.value=String(sky.hour);label.value=clockLabel(sky.hour);};
 hour.oninput=()=>{choose(Number(hour.value));preset.value='';};
 preset.onchange=()=>{if(preset.value)choose(Number(preset.value));};
 cycle.onchange=()=>sky.configure({cycle:cycle.checked});speed.onchange=()=>sky.configure({dayMinutes:Number(speed.value)});clouds.onchange=()=>sky.configure({clouds:clouds.value as CloudType});refresh();return refresh;
}
