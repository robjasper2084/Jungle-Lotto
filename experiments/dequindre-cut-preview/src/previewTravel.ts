import {previewState} from './previewState.ts';

export type PreviewPlace={x:number;z:number;yaw?:number};
type Prepare=(place:PreviewPlace)=>Promise<void>;
let prepare:Prepare|undefined;
let pending:Promise<void>|undefined;

/** One host-owned preparation hook. It never moves the player itself: native
 * travel remains responsible for vehicle exit, reset, focus and input state. */
export function registerPreviewTravel(callback:Prepare){
  prepare=callback;
  return ()=>{if(prepare===callback)prepare=undefined;};
}

export async function preparePreviewTravel(place:PreviewPlace){
  if(!prepare)throw Error('The map is still preparing. Please try again shortly.');
  if(pending)throw Error('A destination is already preparing. Please wait.');
  if(!Number.isFinite(place.x)||!Number.isFinite(place.z))throw Error('This destination has invalid coordinates.');
  previewState.travelPending=true;
  const callback=prepare;
  pending=Promise.resolve().then(()=>callback(place));
  try{await pending;}
  finally{pending=undefined;previewState.travelPending=false;}
}
