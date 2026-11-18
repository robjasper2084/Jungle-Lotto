/** Bounded resilience for transient first-party image fetches such as HTTP 503.
 * Retried files have identical paths/bytes; no placeholder texture is invented. */
export async function retrySurfaceTexture<T>(
 load:(attempt:number)=>Promise<T>,signal:AbortSignal,
 pause:(milliseconds:number)=>Promise<void>=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds))
):Promise<T>{
 let last:unknown;
 for(let attempt=0;attempt<3;attempt++){
  if(signal.aborted)throw signal.reason??new Error('Surface texture load aborted');
  try{return await load(attempt);}
  catch(error){
   last=error;
   if(signal.aborted||attempt===2)break;
   await pause((attempt+1)*150);
  }
 }
 throw signal.aborted?(signal.reason??new Error('Surface texture load aborted')):last;
}
