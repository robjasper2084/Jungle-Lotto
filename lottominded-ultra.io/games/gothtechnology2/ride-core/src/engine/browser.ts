import {initializeEngine,engineReady,EngineContext,ENGINE_ID} from './runtime.ts';
let loading:Promise<void>|undefined;
export function engineRequested(){return new URLSearchParams(location.search).get('engine')==='breadflower';}
export async function loadEngineForPage(required=false){
 if(!required&&!engineRequested())return;
 if(!loading)loading=(async()=>{
  const response=await fetch(new URL('./breadflower.wasm',import.meta.url));if(!response.ok)throw Error('Engine download failed');
  await initializeEngine(new Uint8Array(await response.arrayBuffer()));
  document.documentElement.dataset.compiledEngine=JSON.stringify(ENGINE_ID);
 })();
 try{await loading;}catch(error){
  const status=document.createElement('p');status.setAttribute('role','alert');status.id='engine-load-status';
  status.style.cssText='position:fixed;bottom:12px;left:12px;z-index:10000;padding:12px;max-width:40ch;background:#172c35;color:#fff';
  status.textContent='Engine test unavailable. Normal riding is available. '+(error as Error).message;document.body.append(status);
  document.documentElement.dataset.compiledEngineError=(error as Error).message;
 }
}
type Actions={throttle?:number;steer?:number;hop?:boolean;hopHeld?:boolean;crouch?:boolean;reset?:boolean;trick?:number;eyeControl?:boolean;seated?:boolean};
// Application mapping, not upstream EUC semantics. No rule health exists in this path.
export class RideInputGate{
 private core=engineReady()&&engineRequested()?new EngineContext():undefined;
 private frames=0;
 route<T extends Actions>(actions:T):T{
  if(!this.core)return actions;
  const trick=actions.trick??0;if(!Number.isInteger(trick)||trick<0||trick>255)throw RangeError('Invalid trick');
  const values: [number,number][]=[[0,actions.steer??0],[3,actions.throttle??0],[9,+!!actions.hop],[14,+!!actions.hopHeld],[38,+!!actions.crouch],[15,+!!actions.reset],[16,trick/255],[17,+!!actions.eyeControl],[18,+!!actions.seated]];
  this.core.frame(0,values);const get=(c:number)=>this.core!.get(0,c);
  const result={...actions,steer:get(0),throttle:get(3),hop:!!get(9),hopHeld:!!get(14),crouch:!!get(38),reset:!!get(15),trick:Math.round(get(16)*255),eyeControl:!!get(17),seated:!!get(18)};
  if(++this.frames%120===0){const data=document.documentElement.dataset;data.engineInputFrames=String(Number(data.engineInputFrames??0)+120);data.engineLastSteer=String(get(0));data.engineLastThrottle=String(get(3));}
  return result;
 }
 clear(){this.core?.clear();}
}
