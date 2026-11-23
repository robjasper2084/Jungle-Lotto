/** Hardware MSAA is selected at WebGL context creation, not switched per frame. */
export type AntiAliasingMode='automatic'|'on'|'off';
export interface AntiAliasingDevice {
 coarsePointer:boolean;
 deviceMemoryGB?:number;
 logicalCores?:number;
}
/** Legacy graphics saves have no AA field; preserve the previous desktop default. */
export function readAntiAliasingMode(value:unknown):AntiAliasingMode {
 return value==='on'||value==='off'?value:'automatic';
}
/** Auto avoids the MSAA framebuffer cost on touch or clearly low-power hardware.
 * On and Off are user overrides. No shader pass or per-frame allocation is added. */
export function enableHardwareAntialiasing(mode:AntiAliasingMode,device:AntiAliasingDevice):boolean {
 if(mode==='on')return true;
 if(mode==='off')return false;
 if(device.coarsePointer)return false;
 const memory=device.deviceMemoryGB,cores=device.logicalCores;
 if(typeof memory==='number'&&Number.isFinite(memory)&&memory>0&&memory<=2)return false;
 if(typeof cores==='number'&&Number.isFinite(cores)&&cores>0&&cores<4)return false;
 return true;
}
