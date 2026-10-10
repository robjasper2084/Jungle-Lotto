import {ENGINE_ID} from './identity.ts';
export {ENGINE_ID};
type ABI=Record<string,(...args:number[])=>number>;
let compiled:WebAssembly.Module|undefined;
export async function initializeEngine(bytes:Uint8Array){
 const data=new Uint8Array(bytes),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==ENGINE_ID.module)throw Error('Engine module hash mismatch');
 const module=await WebAssembly.compile(data);
 if(WebAssembly.Module.imports(module).length)throw Error('Unexpected engine imports');
 const probe=new EngineContext(module);probe.dispose();compiled=module;
 return ENGINE_ID;
}
export function engineReady(){return !!compiled;}
export class EngineContext{
 readonly api:ABI;private handle:number;disposed=false;
 constructor(module=compiled){
  if(!module)throw Error('Compiled engine is not initialized');
  const instance=new WebAssembly.Instance(module,{});this.api=instance.exports as unknown as ABI;
  this.api._initialize();
  if(this.api.bf_abi()!==ENGINE_ID.bridgeAbi||this.api.bf_upstream()!==0x6b4d4e1f||this.api.bf_capabilities()!==7)throw Error('Engine ABI mismatch');
  this.handle=this.api.bf_create();if(this.handle<=0)throw Error('Engine context allocation failed');
 }
 call(name:string,...args:number[]){if(this.disposed)throw Error('Engine context disposed');return this.api['bf_'+name](this.handle,...args);}
 checked(name:string,...args:number[]){const result=this.call(name,...args);if(result!==1)throw Error('Engine '+name+' failed ('+result+')');}
 frame(slot:number,values:ReadonlyArray<readonly [number,number]>){
  if(!Number.isInteger(slot)||slot<0||slot>=6)throw RangeError('Invalid engine slot');
  const seen=new Set<number>();
  for(const [channel,value]of values){if(!Number.isInteger(channel)||channel<0||channel>=64||seen.has(channel)||!Number.isFinite(value)||Math.abs(value)>1)throw RangeError('Invalid complete engine frame');seen.add(channel);}
  // Validation precedes clear: an invalid frame never partially mutates held input.
  this.checked('clear',slot);for(const [channel,value]of values)this.checked('set',slot,channel,value);this.checked('frame');
 }
 get(slot:number,channel:number){if(!Number.isInteger(slot)||slot<0||slot>=6||!Number.isInteger(channel)||channel<0||channel>=64)throw RangeError('Invalid engine channel');return this.call('get',slot,channel);}
 clear(){for(let i=0;i<6;i++)this.checked('clear',i);}
 capture(){const size=this.call('capture');if(size<=0||size>24000)throw Error('Engine snapshot failed');return Array.from({length:size},(_,i)=>this.call('saved',i));}
 restore(values:readonly number[]){
  if(!Array.isArray(values)||!values.length||values.length>24000||!values.every(Number.isFinite))throw Error('Invalid engine snapshot');
  this.checked('restore_begin',values.length);values.forEach((v,i)=>this.checked('restore_value',i,v));this.checked('restore_commit');
 }
 dispose(){if(!this.disposed){this.checked('destroy');this.disposed=true;}}
}
