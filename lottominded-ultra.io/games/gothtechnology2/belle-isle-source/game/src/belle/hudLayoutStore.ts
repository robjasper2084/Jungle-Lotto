import {emptyArchive,HUD_STORAGE_KEY,importArchive,validateArchive,type HudArchive} from './hudLayoutModel.ts';
export type HudStorage=Pick<Storage,'getItem'|'setItem'>;
export function availableHudStorage():HudStorage|undefined {try{return localStorage;}catch{return undefined;}}
export function loadHudArchive(storage:HudStorage|undefined):{archive:HudArchive;notice:string}{
 try{const raw=storage?.getItem(HUD_STORAGE_KEY);return {archive:raw?importArchive(raw):emptyArchive(),notice:storage?'':'Storage unavailable. Changes can be used for this visit and exported.'};}
 catch{return {archive:emptyArchive(),notice:'Saved HUD data could not be read. The built-in controls are unchanged.'};}
}
export function saveHudArchive(storage:HudStorage|undefined,value:HudArchive):{archive:HudArchive;saved:boolean;notice:string}{
 const archive=validateArchive(value);
 try{if(!storage)throw new Error('Storage unavailable');storage.setItem(HUD_STORAGE_KEY,JSON.stringify(archive));return {archive,saved:true,notice:'HUD saved on this device.'};}
 catch{return {archive,saved:false,notice:'HUD applied for this visit only. Device storage failed; export JSON to keep a copy.'};}
}
/** Read legacy values without rewriting progress, loadouts, photos or preference keys. */
export function legacyHudPreferences(storage:HudStorage|undefined){
 const read=(key:string)=>{try{return storage?.getItem(key)??null;}catch{return null;}};
 const numeric=(key:string,fallback:number,min:number,max:number)=>{const raw=read(key),n=raw===null?fallback:Number(raw);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
 return {joystick:read('belle-joystick-mode')==='fixed'?'fixed':'floating',sensitivity:numeric('belle-look-sensitivity',1,.4,1.8),scale:numeric('belle-control-size',1,.85,1.2),opacity:numeric('belle-control-opacity',.45,.2,.85),spacing:read('belle-control-layout')==='wide'?'wide':'standard'};
}
