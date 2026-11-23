import {CADILLAC_WHEEL_DEFAULTS,normalizeCadillacWheelSelection,type CadillacWheelSelection} from './cadillacWheels.ts';

export const CADILLAC_MODS_STORAGE_KEY='belle-cadillac-mods-v1';
type Reader=Pick<Storage,'getItem'>;
type Writer=Pick<Storage,'setItem'>;

/** Only cosmetic choices survive a new ride. Suspension always starts neutral;
 * an old height or hop must never activate automatically at a different spawn. */
export function readCadillacModsPreferences(storage?:Reader):CadillacWheelSelection{
 try{
  const source=storage??(typeof localStorage==='undefined'?undefined:localStorage);
  const value:unknown=JSON.parse(source?.getItem(CADILLAC_MODS_STORAGE_KEY)??'null');
  if(!value||typeof value!=='object'||!('version'in value)||value.version!==1||!('wheels'in value))return{...CADILLAC_WHEEL_DEFAULTS};
  return normalizeCadillacWheelSelection(value.wheels);
 }catch{return{...CADILLAC_WHEEL_DEFAULTS};}
}

export function writeCadillacModsPreferences(wheels:CadillacWheelSelection,storage?:Writer):boolean{
 try{
  const target=storage??(typeof localStorage==='undefined'?undefined:localStorage);
  if(!target)return false;
  target.setItem(CADILLAC_MODS_STORAGE_KEY,JSON.stringify({version:1,wheels:normalizeCadillacWheelSelection(wheels)}));
  return true;
 }catch{return false;}
}
