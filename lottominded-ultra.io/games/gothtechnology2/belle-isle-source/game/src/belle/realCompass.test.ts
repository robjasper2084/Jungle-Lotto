import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserCompass,compassHeadingFromEvent,smoothCompassHeading,type CompassClock,type CompassDependencies,type CompassReading,type CompassSnapshot} from './realCompass.ts';

const close=(actual:number|null|undefined,expected:number,tolerance=1e-8)=>{
 assert.equal(typeof actual,'number');assert.ok(Math.abs(actual!-expected)<tolerance,`${actual} != ${expected}`);
};
const absolute=(alpha=0,beta=0,gamma=0):CompassReading=>({absolute:true,alpha,beta,gamma});
test('absolute compass uses north/east/south/west rather than relative alpha',()=>{
 for(const [alpha,heading]of[[0,0],[270,90],[180,180],[90,270]])close(compassHeadingFromEvent(absolute(alpha))?.headingDegrees,heading);
 assert.equal(compassHeadingFromEvent({...absolute(0),absolute:false}),null);
 assert.equal(compassHeadingFromEvent({alpha:0,beta:0,gamma:0}),null);
});
test('screen orientation changes top-edge heading and compensates physical rotation',()=>{
 close(compassHeadingFromEvent(absolute(0),90)?.headingDegrees,90);
 close(compassHeadingFromEvent(absolute(0),270)?.headingDegrees,270);
 close(compassHeadingFromEvent(absolute(90),90)?.headingDegrees,0);
 close(compassHeadingFromEvent(absolute(270),-90)?.headingDegrees,0);
 close(compassHeadingFromEvent(absolute(180),180)?.headingDegrees,0);
});
test('tilt projection follows the horizontal top edge and rejects a vertical top edge',()=>{
 close(compassHeadingFromEvent(absolute(90,40,20))?.headingDegrees,270);
 const expected=(Math.atan2(Math.cos(Math.PI/6),Math.sin(Math.PI/6)**2)*180/Math.PI+360)%360;
 close(compassHeadingFromEvent(absolute(0,30,30),90)?.headingDegrees,expected);
 assert.equal(compassHeadingFromEvent(absolute(0,90,0)),null);
 assert.equal(compassHeadingFromEvent(absolute(0,80,0)),null);
 assert.equal(compassHeadingFromEvent(absolute(0,0,90),90),null);
});
test('WebKit headings require useful nonnegative accuracy and receive screen compensation',()=>{
 const event={absolute:false,alpha:150,beta:0,gamma:0,webkitCompassHeading:350,webkitCompassAccuracy:12};
 close(compassHeadingFromEvent(event)?.headingDegrees,350);
 close(compassHeadingFromEvent(event,90)?.headingDegrees,80);
 assert.equal(compassHeadingFromEvent({...event,webkitCompassAccuracy:-1}),null);
 assert.equal(compassHeadingFromEvent({...event,webkitCompassAccuracy:31}),null);
 assert.equal(compassHeadingFromEvent({...event,webkitCompassAccuracy:null}),null);
 assert.equal(compassHeadingFromEvent({...event,absolute:true,webkitCompassAccuracy:90}),null);
 assert.equal(compassHeadingFromEvent({...event,beta:90}),null);
});
test('missing and invalid orientation components never become a zero heading',()=>{
 for(const event of [{...absolute(),alpha:null},{...absolute(),beta:null},{...absolute(),gamma:NaN},absolute(400),absolute(0,181),absolute(0,0,91)])assert.equal(compassHeadingFromEvent(event),null);
 assert.equal(compassHeadingFromEvent(absolute(),NaN),null);
});
test('angular smoothing crosses north by the short path',()=>{
 const heading=smoothCompassHeading(359,1,.18*Math.log(2));
 assert.ok(heading<.0001||heading>359.9999);
 close(smoothCompassHeading(1,359,.18*Math.log(2)),0);
});

class Target {
 hidden=false;listeners=new Map<string,Set<EventListener>>();
 addEventListener(type:string,listener:EventListener){let set=this.listeners.get(type);if(!set)this.listeners.set(type,set=new Set());set.add(listener);}
 removeEventListener(type:string,listener:EventListener){this.listeners.get(type)?.delete(listener);}
 emit(type:string,data:object={}){for(const listener of [...this.listeners.get(type)??[]])listener({type,...data}as Event);}
 count(type:string){return this.listeners.get(type)?.size??0;}
}
class Clock implements CompassClock {
 time=0;nextId=0;callbacks=new Map<number,()=>void>();cleared:number[]=[];
 now=()=>this.time;
 setInterval=(callback:()=>void,_milliseconds:number)=>{const id=this.nextId++;this.callbacks.set(id,callback);return id;};
 clearInterval=(id:unknown)=>{this.cleared.push(Number(id));this.callbacks.delete(Number(id));};
 tick(milliseconds:number){this.time+=milliseconds;for(const callback of [...this.callbacks.values()])callback();}
}
function fixture(overrides:Partial<CompassDependencies>={}){
 const page=new Target(),document=new Target(),screenOrientation=new Target(),clock=new Clock(),changes:CompassSnapshot[]=[];
 let angle=0;
 const compass=new BrowserCompass(value=>changes.push(value),{page,document,screenOrientation,clock,orientation:{},secureContext:true,screenAngle:()=>angle,...overrides});
 return {compass,page,document,screenOrientation,clock,changes,setAngle:(value:number)=>angle=value};
}
test('construction leaves sensors off and enable installs one listener pair',async()=>{
 const f=fixture();assert.equal(f.page.count('deviceorientation'),0);assert.equal(f.compass.snapshot.status,'off');
 await f.compass.enable();await f.compass.enable();assert.equal(f.page.count('deviceorientation'),1);assert.equal(f.page.count('deviceorientationabsolute'),1);assert.equal(f.clock.callbacks.size,1);
 f.page.emit('deviceorientationabsolute',absolute(270));assert.equal(f.compass.snapshot.status,'tracking');close(f.compass.snapshot.headingDegrees,90);
 f.compass.stop();assert.equal(f.page.count('deviceorientation'),0);assert.equal(f.clock.callbacks.size,0);assert.ok(f.clock.cleared.includes(0));assert.deepEqual(f.compass.snapshot,{status:'off',headingDegrees:null,accuracyDegrees:null});
});
test('permission is requested synchronously, once, and cancellation ignores late grant',async()=>{
 let calls=0,resolve!:(value:string)=>void;
 const permission=new Promise<string>(done=>resolve=done);
 const f=fixture({orientation:{requestPermission:absolute=>{assert.equal(absolute,true);calls++;return permission;}}});
 const pending=f.compass.enable();assert.equal(calls,1);assert.equal(f.compass.snapshot.status,'requesting');
 await f.compass.enable();assert.equal(calls,1);f.compass.stop();resolve('granted');await pending;
 assert.equal(f.compass.snapshot.status,'off');assert.equal(f.page.count('deviceorientation'),0);assert.equal(f.clock.callbacks.size,0);
});
test('denied and unavailable permissions never install orientation listeners',async()=>{
 const denied=fixture({orientation:{requestPermission:async()=>'denied'}});await denied.compass.enable();assert.equal(denied.compass.snapshot.status,'denied');assert.equal(denied.page.count('deviceorientation'),0);
 const blocked=fixture({orientation:{requestPermission:()=>{throw {name:'NotAllowedError'};}}});await blocked.compass.enable();assert.equal(blocked.compass.snapshot.status,'denied');
 const insecure=fixture({secureContext:false});await insecure.compass.enable();assert.equal(insecure.compass.snapshot.status,'unavailable');assert.equal(insecure.page.count('deviceorientation'),0);
 const unsupported=fixture({orientation:null});await unsupported.compass.enable();assert.equal(unsupported.compass.snapshot.status,'unavailable');
});
test('a tab hidden before permission resolution cannot keep a pending compass session',async()=>{
 let resolve!:(value:string)=>void;
 const permission=new Promise<string>(done=>resolve=done);
 const f=fixture({orientation:{requestPermission:()=>permission}});
 const pending=f.compass.enable();f.document.hidden=true;resolve('granted');await pending;
 assert.equal(f.compass.snapshot.status,'off');assert.equal(f.page.count('deviceorientation'),0);
 f.document.hidden=false;await f.compass.enable();assert.equal(f.page.count('deviceorientation'),1);
});
test('unavailable devices time out; stale headings expire and recover only from valid data',async()=>{
 const f=fixture();await f.compass.enable();f.clock.tick(3000);assert.equal(f.compass.snapshot.status,'unavailable');
 f.page.emit('deviceorientationabsolute',absolute(90));assert.equal(f.compass.snapshot.status,'tracking');close(f.compass.snapshot.headingDegrees,270);
 f.clock.tick(2000);f.page.emit('deviceorientation',{...absolute(15),absolute:false});f.clock.tick(1000);
 assert.equal(f.compass.snapshot.status,'stale');assert.equal(f.compass.snapshot.headingDegrees,null);
 f.page.emit('deviceorientationabsolute',absolute(270));close(f.compass.snapshot.headingDegrees,90);assert.equal(f.compass.snapshot.status,'tracking');
});
test('known invalid compass data immediately removes a previously usable heading',async()=>{
 const f=fixture();await f.compass.enable();f.page.emit('deviceorientationabsolute',absolute(0));
 f.page.emit('deviceorientationabsolute',absolute(0,90,0));assert.equal(f.compass.snapshot.status,'unavailable');assert.equal(f.compass.snapshot.headingDegrees,null);
});
test('background and pagehide stop sensing and do not restart automatically',async()=>{
 const f=fixture();await f.compass.enable();f.document.hidden=true;f.document.emit('visibilitychange');
 assert.equal(f.compass.snapshot.status,'off');assert.equal(f.page.count('deviceorientation'),0);
 f.document.hidden=false;f.document.emit('visibilitychange');assert.equal(f.page.count('deviceorientation'),0);
 await f.compass.enable();f.page.emit('pagehide');assert.equal(f.page.count('deviceorientation'),0);assert.equal(f.clock.callbacks.size,0);
});
test('obsolete event handlers cannot revive a stopped or restarted session',async()=>{
 const f=fixture();await f.compass.enable();const old=[...f.page.listeners.get('deviceorientationabsolute')!][0];
 f.compass.stop();await f.compass.enable();old({...absolute(90),type:'deviceorientationabsolute'}as unknown as Event);
 assert.equal(f.compass.snapshot.status,'requesting');f.page.emit('deviceorientationabsolute',absolute(0));close(f.compass.snapshot.headingDegrees,0);
});
test('screen rotation invalidates smoothing across different screen axes',async()=>{
 const f=fixture();await f.compass.enable();f.page.emit('deviceorientationabsolute',absolute(0));
 f.clock.tick(10);f.setAngle(90);f.page.emit('deviceorientationabsolute',absolute(0));close(f.compass.snapshot.headingDegrees,90);
});
test('screen orientation changes discard the old heading before the next sensor event',async()=>{
 const f=fixture();await f.compass.enable();f.page.emit('deviceorientationabsolute',absolute(0));
 f.setAngle(90);f.screenOrientation.emit('change');assert.equal(f.compass.snapshot.headingDegrees,null);assert.equal(f.compass.snapshot.status,'unavailable');
 f.page.emit('deviceorientationabsolute',absolute(0));close(f.compass.snapshot.headingDegrees,90);
 f.page.emit('orientationchange');assert.equal(f.compass.snapshot.headingDegrees,null);
});
test('dispose removes lifecycle and sensor listeners and prevents future requests',async()=>{
 const f=fixture();await f.compass.enable();f.compass.dispose();f.compass.dispose();await f.compass.enable();
 assert.equal(f.page.count('pagehide'),0);assert.equal(f.page.count('orientationchange'),0);assert.equal(f.screenOrientation.count('change'),0);assert.equal(f.document.count('visibilitychange'),0);assert.equal(f.page.count('deviceorientation'),0);assert.equal(f.clock.callbacks.size,0);assert.equal(f.compass.snapshot.status,'off');
});
