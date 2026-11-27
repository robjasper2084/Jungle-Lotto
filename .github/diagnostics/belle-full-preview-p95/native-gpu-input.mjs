/** Observe native input boundaries without replacing promises or issuing input. */
import assert from 'node:assert/strict';

export function bindNativeGpuInput(keyboard,sampler,{now=()=>performance.now(),onError=()=>{}}={}){
 const receipt={scope:'first-W-down-through-first-W-up; later GPS input excluded',firstDown:null,firstUp:null,wDownCalls:0,wUpCalls:0};
 const cleanups=[];
 const report=error=>{try{onError(error);}catch{/* Keep original input/result priority. */}};
 const observe=fn=>{try{const result=fn();if(result?.then)result.catch(report);}catch(error){report(error);}};
 for(const key of ['down','up']){
  const original=keyboard[key];assert.equal(typeof original,'function','Missing original keyboard.'+key);
  const descriptor=Object.getOwnPropertyDescriptor(keyboard,key);
  const wrapped=function(...args){
   let row=null;
   if(args[0]==='w'&&!receipt.firstUp)observe(()=>{
    receipt[key==='down'?'wDownCalls':'wUpCalls']++;
    const field=key==='down'?'firstDown':'firstUp';
    if(!receipt[field]){
     row=receipt[field]={args:[...args],requestedHostMs:now(),completedHostMs:null,rejectedHostMs:null,rejection:null};
     assert.deepEqual(args,['w'],'Original W input arguments changed');
    }
   });
   let result;
   try{result=Reflect.apply(original,this,args);}catch(error){
    if(row)observe(()=>{row.rejectedHostMs=now();row.rejection=String(error);if(key==='up')return sampler.stopRide(row.requestedHostMs);});
    throw error;
   }
   // The native release is issued before sampler cancellation; no sampler
   // promise or process cleanup is ever awaited by an input operation.
   if(row&&key==='up')observe(()=>sampler.stopRide(row.requestedHostMs));
   if(row)Promise.resolve(result).then(
    ()=>observe(()=>{row.completedHostMs=now();if(key==='down')return sampler.startRide(row.completedHostMs);}),
    error=>observe(()=>{row.rejectedHostMs=now();row.rejection=String(error);})
   );
   return result;
  };
  Object.defineProperty(keyboard,key,{configurable:true,writable:true,value:wrapped});
  cleanups.push(()=>{if(keyboard[key]!==wrapped)return;if(descriptor)Object.defineProperty(keyboard,key,descriptor);else delete keyboard[key];});
 }
 return {receipt,restore(){for(const clean of cleanups.reverse())clean();}};
}

export function verifyNativeGpuInput(receipt){
 assert.equal(receipt?.scope,'first-W-down-through-first-W-up; later GPS input excluded');
 assert(receipt&&Number.isSafeInteger(receipt.wDownCalls)&&receipt.wDownCalls>=1);
 assert(Number.isSafeInteger(receipt.wUpCalls)&&receipt.wUpCalls===1,'Expected exactly one original W release');
 for(const name of ['firstDown','firstUp']){
  const row=receipt[name];assert(row,'Missing native '+name);assert.deepEqual(row.args,['w']);
  assert(Number.isFinite(row.requestedHostMs)&&Number.isFinite(row.completedHostMs));
  assert(row.completedHostMs>=row.requestedHostMs);assert.equal(row.rejectedHostMs,null);assert.equal(row.rejection,null);
 }
 // These are conservative host operation bounds, not browser event times.
 // The existing trusted-browser-marker gate remains the 90-second authority.
 assert(receipt.firstUp.requestedHostMs>receipt.firstDown.completedHostMs,'Invalid conservative held-input bracket');
 return {startHostMs:receipt.firstDown.completedHostMs,endHostMs:receipt.firstUp.requestedHostMs,
  firstDispatchStartedHostMs:receipt.firstDown.requestedHostMs,releaseCompletedHostMs:receipt.firstUp.completedHostMs};
}
