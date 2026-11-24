/** Test-only sensor contract, serialized into one isolated Playwright context.
 * Never imported by the game. It does not call or delegate to device sensors.
 * Browser integration/error handling is tested separately with native emulation.
 */
export function installGpsSensorContract({origin,position,intervalMs=2000}){
 if(globalThis.location.origin!==origin)return;
 if(Object.hasOwn(globalThis,'__belleGpsSensorContract'))throw Error('GPS sensor contract already installed');
 const {latitude,longitude,accuracy}=position??{};
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180
   ||!Number.isFinite(accuracy)||accuracy<=0||intervalMs!==2000)throw Error('Invalid synthetic GPS contract');
 const previous=Object.getOwnPropertyDescriptor(navigator,'geolocation');
 const watches=new Map();let nextId=0,timer=null,disposed=false,lastStamp=-Infinity;
 let watchStarts=0,watchClears=0,emittedFixes=0,emittedErrors=0;
 const snapshot=()=>({source:'deterministic-watch-contract',activeWatches:watches.size,watchStarts,watchClears,emittedFixes,emittedErrors,timerActive:timer!==null,disposed});
 const stopTimer=()=>{if(timer!==null){clearInterval(timer);timer=null;}};
 const send=(id,watch)=>{
  if(disposed||watches.get(id)!==watch)return;
  // Use the real wall clock. The +1 only makes callbacks within one clock
  // millisecond distinct; no game clock, freshness rule or timestamp is patched.
  lastStamp=Math.max(Date.now(),lastStamp+1);emittedFixes++;
  watch.success(Object.freeze({timestamp:lastStamp,coords:Object.freeze({latitude,longitude,accuracy,altitude:null,altitudeAccuracy:null,heading:null,speed:0})}));
 };
 const source=Object.freeze({
  watchPosition(success,error){
   if(disposed)throw Error('GPS sensor contract is disposed');
   if(typeof success!=='function')throw TypeError('A position callback is required');
   const id=nextId++,watch={success,error};watches.set(id,watch);watchStarts++;
   queueMicrotask(()=>send(id,watch));
   if(timer===null)timer=setInterval(()=>{for(const [watchId,current]of [...watches])send(watchId,current);},intervalMs);
   return id;
  },
  clearWatch(id){if(watches.delete(id))watchClears++;if(watches.size===0)stopTimer();},
  getCurrentPosition(){throw Error('This test contract supports watchPosition only; native sensors are never a fallback');},
 });
 const controller={
  snapshot,
  emitUnavailable(){
   if(disposed)throw Error('GPS sensor contract is disposed');
   for(const [id,watch]of [...watches])if(watches.get(id)===watch&&typeof watch.error==='function'){emittedErrors++;watch.error({code:2});}
  },
  dispose(){
   if(disposed)return {...snapshot(),restored:true};
   disposed=true;stopTimer();watchClears+=watches.size;watches.clear();
   if(previous)Object.defineProperty(navigator,'geolocation',previous);else delete navigator.geolocation;
   delete globalThis.__belleGpsSensorContract;
   const restored=Object.getOwnPropertyDescriptor(navigator,'geolocation');
   return {...snapshot(),restored:previous?restored?.get===previous.get&&restored?.set===previous.set&&restored?.value===previous.value&&!Object.hasOwn(globalThis,'__belleGpsSensorContract'):restored===undefined&&!Object.hasOwn(globalThis,'__belleGpsSensorContract')};
  },
 };
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:source});
 Object.defineProperty(globalThis,'__belleGpsSensorContract',{configurable:true,value:controller});
}
