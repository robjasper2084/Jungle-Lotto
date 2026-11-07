/** Bound an individual caller's wait, not the shared GLTF transfer.
 * A timeout or cancellation must not mount a vehicle or cancel another caller.
 * Late success remains reusable by the shared loader; late rejection is observed.
 * Like any JS timer, this cannot interrupt a synchronously blocked GPU/JS thread.
 */
export function waitForRideModel<T>(loading:Promise<T>,timeoutMs:number,signal?:AbortSignal):Promise<T>{
 return new Promise<T>((resolve,reject)=>{
  let settled=false,timer:ReturnType<typeof setTimeout>|undefined;
  const cleanup=()=>{if(timer!==undefined)clearTimeout(timer);signal?.removeEventListener('abort',abort);};
  const succeed=(value:T)=>{if(settled)return;settled=true;cleanup();resolve(value);};
  const fail=(error:unknown)=>{if(settled)return;settled=true;cleanup();reject(error);};
  const abort=()=>fail(signal?.reason instanceof Error?signal.reason:new DOMException('Ride preparation cancelled','AbortError'));
  // Observe both outcomes even when the caller was cancelled before subscribing.
  void loading.then(succeed,fail);
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>fail(new Error('Hoverbike model download timed out. Please retry or choose the one-wheel ride.')),timeoutMs);
 });
}
