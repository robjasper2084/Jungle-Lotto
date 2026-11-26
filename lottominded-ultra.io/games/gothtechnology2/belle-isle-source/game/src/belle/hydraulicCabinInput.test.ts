import test from 'node:test';
import assert from 'node:assert/strict';
import {HydraulicCabinInput} from './hydraulicCabinInput.ts';

function fixture(){
 const listeners=new Map<string,Set<(event:PointerEvent)=>void>>(),captures=new Set<number>();
 const canvas={
  addEventListener(type:string,listener:(event:PointerEvent)=>void){let set=listeners.get(type);if(!set){set=new Set();listeners.set(type,set);}set.add(listener);},
  removeEventListener(type:string,listener:(event:PointerEvent)=>void){listeners.get(type)?.delete(listener);},
  setPointerCapture(id:number){captures.add(id);},hasPointerCapture(id:number){return captures.has(id);},releasePointerCapture(id:number){captures.delete(id);},
 };
 let enabled=true,hit:'front-up'|'back-up'|null='front-up';
 const requests:string[]=[];
 const input=new HydraulicCabinInput(canvas as unknown as HTMLCanvasElement,{enabled:()=>enabled,pick:()=>hit,request:pose=>{requests.push(pose);return{accepted:true};}});
 function dispatch(type:string,override:Record<string,unknown>={}){
  const event={pointerId:1,button:0,isPrimary:true,isTrusted:true,clientX:50,clientY:50,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...override};
  for(const listener of listeners.get(type)??[])listener(event as unknown as PointerEvent);return event;
 }
 return{input,dispatch,requests,captures,listeners,enabled(value:boolean){enabled=value;},hit(value:typeof hit){hit=value;}};
}

test('only release of a trusted stationary tap on the same physical switch dispatches once',()=>{
 const f=fixture();const down=f.dispatch('pointerdown');assert(down.stopped&&down.prevented);assert.equal(f.requests.length,0);assert(f.captures.has(1));
 f.dispatch('pointerup');f.dispatch('pointerup');assert.deepEqual(f.requests,['front-up']);assert.equal(f.captures.size,0);f.input.dispose();
});
test('look drags and release over another switch never activate a pose',()=>{
 for(const cancel of [(f:ReturnType<typeof fixture>)=>f.dispatch('pointermove',{clientX:60}),(f:ReturnType<typeof fixture>)=>f.hit('back-up')]){
  const f=fixture();f.dispatch('pointerdown');cancel(f);f.dispatch('pointerup');assert.deepEqual(f.requests,[]);assert.equal(f.captures.size,0);f.input.dispose();
 }
});
test('wrong button, secondary pointer, synthetic input, disabled mode and empty space leave camera input untouched',()=>{
 for(const override of [{button:2},{isPrimary:false},{isTrusted:false}]){
  const f=fixture();const down=f.dispatch('pointerdown',override);assert.equal(down.stopped,false);f.dispatch('pointerup');assert.deepEqual(f.requests,[]);f.input.dispose();
 }
 for(const prepare of [(f:ReturnType<typeof fixture>)=>f.enabled(false),(f:ReturnType<typeof fixture>)=>f.hit(null)]){
  const f=fixture();prepare(f);const down=f.dispatch('pointerdown');assert.equal(down.stopped,false);f.dispatch('pointerup');assert.deepEqual(f.requests,[]);f.input.dispose();
 }
});
test('mode changes, pointer cancellation, lost capture and a second finger clear pending commands',()=>{
 for(const cancel of [(f:ReturnType<typeof fixture>)=>f.enabled(false),(f:ReturnType<typeof fixture>)=>f.dispatch('pointercancel'),(f:ReturnType<typeof fixture>)=>f.dispatch('lostpointercapture'),(f:ReturnType<typeof fixture>)=>f.dispatch('pointerdown',{pointerId:2,isPrimary:false}),(f:ReturnType<typeof fixture>)=>f.input.cancel()]){
  const f=fixture();f.dispatch('pointerdown');cancel(f);f.dispatch('pointerup');assert.deepEqual(f.requests,[]);assert.equal(f.captures.size,0);f.input.dispose();
 }
});
test('disposal releases captures and every canvas event listener',()=>{
 const f=fixture();f.dispatch('pointerdown');f.input.dispose();f.input.dispose();assert.equal(f.captures.size,0);assert([...f.listeners.values()].every(set=>set.size===0));f.dispatch('pointerup');assert.deepEqual(f.requests,[]);
});
