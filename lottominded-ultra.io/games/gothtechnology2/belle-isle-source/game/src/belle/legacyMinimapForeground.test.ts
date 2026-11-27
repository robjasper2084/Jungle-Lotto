import test from 'node:test';
import assert from 'node:assert/strict';
import {createLegacyMinimapForeground} from './legacyMinimapForeground.ts';
import {installCinematicPresentation} from './cinematicPresentation.ts';

// Semantic ownership/state model only. It deliberately keeps the current path
// outside save/restore and records paint effects. It is NOT native pixel proof.
const copy = <T>(value:T):T => structuredClone(value);
const identity = () => [1,0,0,1,0,0];
class Canvas extends EventTarget { width=420; height=290; }
class Native {
  canvas=new Canvas(); lost=false; paints:unknown[]=[]; path:unknown[]=[]; stack:Record<string,unknown>[]=[];
  state:Record<string,any>={fillStyle:'#000000',strokeStyle:'#000000',lineWidth:1,globalAlpha:1,font:'10px sans-serif',textAlign:'start',transform:identity(),dash:[]};
  declare fillStyle:string; declare strokeStyle:string; declare lineWidth:number; declare globalAlpha:number; declare font:string; declare textAlign:CanvasTextAlign;
  isContextLost(){return this.lost;}
  save(){this.stack.push(copy(this.state));}
  restore(){const value=this.stack.pop();if(value)this.state=value;}
  getTransform(){const [a,b,c,d,e,f]=this.state.transform;return {a,b,c,d,e,f};}
  setTransform(...values:number[]){this.state.transform=values.slice();}
  multiply(n:number[]){const [a,b,c,d,e,f]=this.state.transform,[g,h,i,j,k,l]=n;this.state.transform=[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];}
  translate(x:number,y:number){this.multiply([1,0,0,1,x,y]);}
  rotate(angle:number){const c=Math.cos(angle),s=Math.sin(angle);this.multiply([c,s,-s,c,0,0]);}
  setLineDash(dash:number[]){this.state.dash=dash.slice();}
  getLineDash(){return this.state.dash.slice();}
  beginPath(){this.path=[];}
  closePath(){this.path.push(['close']);}
  point(name:string,x:number,y:number){const [a,b,c,d,e,f]=this.state.transform;this.path.push([name,a*x+c*y+e,b*x+d*y+f]);}
  moveTo(x:number,y:number){this.point('move',x,y);}
  lineTo(x:number,y:number){this.point('line',x,y);}
  arc(...args:number[]){if(args[2]<0)throw new RangeError('native radius');this.path.push(['arc',args.slice(),this.state.transform.slice()]);}
  ellipse(...args:number[]){if(args[2]<0||args[3]<0)throw new RangeError('native radius');this.path.push(['ellipse',args.slice(),this.state.transform.slice()]);}
  paint(name:string,args:unknown[]){if(!this.lost)this.paints.push({name,args:copy(args),state:copy(this.state),path:name==='fill'||name==='stroke'?copy(this.path):null});}
  fill(){this.paint('fill',[]);}
  stroke(){this.paint('stroke',[]);}
  fillRect(...args:number[]){this.paint('fillRect',args);}
  fillText(...args:unknown[]){this.paint('fillText',args);}
  strokeText(...args:unknown[]){this.paint('strokeText',args);}
  clearRect(..._args:number[]){this.paints=[];}
  drawImage(image:{width:number;height:number;version:number}){if(!image.width||!image.height)throw new RangeError('native empty image');this.paint('background',[image.version]);}
  getImageData(){return copy(this.paints);}
  reset(){const replacement=new Native();this.state=replacement.state;this.paints=[];this.path=[];this.stack=[];}
  snapshot(){return copy({state:this.state,path:this.path,stack:this.stack,paints:this.paints});}
  asContext(){return this as unknown as CanvasRenderingContext2D;}
}
for(const name of ['fillStyle','strokeStyle','font','textAlign','lineWidth','globalAlpha'])Object.defineProperty(Native.prototype,name,{
  get(this:Native){return this.state[name];},
  set(this:Native,value:unknown){
    if(name==='lineWidth'&&!(typeof value==='number'&&Number.isFinite(value)&&value>0))return;
    if(name==='globalAlpha'&&!(typeof value==='number'&&value>=0&&value<=1))return;
    if(name==='textAlign'&&!['start','end','left','right','center'].includes(String(value)))return;
    if((name==='fillStyle'||name==='strokeStyle')&&typeof value==='string'&&/^#[\da-f]{3}$/i.test(value))value='#'+[...value.slice(1)].map(x=>x+x).join('').toLowerCase();
    this.state[name]=value;
  }
});
type Journal=ReturnType<typeof createLegacyMinimapForeground>;
const image=()=>({width:420,height:290,version:1});
function background(ctx:Native,source:ReturnType<typeof image>,journal?:Journal){ctx.clearRect(0,0,420,290);journal?.backgroundCleared();ctx.drawImage(source);}
function foreground(ctx:CanvasRenderingContext2D,x=20){
  ctx.strokeStyle='#c3c98e';ctx.lineWidth=.65;ctx.fillStyle='#abc';ctx.beginPath();ctx.arc(x,12,4,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.save();ctx.setLineDash([]);ctx.globalAlpha=.42;ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+4,8);ctx.closePath();ctx.stroke();ctx.restore();
  ctx.save();ctx.translate(x,31);ctx.rotate(.3);ctx.fillStyle='#a5fff0';ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(-4,-4);ctx.lineTo(4,-4);ctx.fill();ctx.restore();
  ctx.fillStyle='#fff';ctx.fillRect(x,20,4,4);ctx.font='12px system-ui';ctx.fillText('N ↑',10,18);
  ctx.save();ctx.font='bold 11px system-ui';ctx.textAlign='right';const tx=ctx.textAlign==='right'?x-9:x+9;
  assert.equal(ctx.canvas.width,420);ctx.beginPath();ctx.ellipse(x,15,7,5,0,0,Math.PI*2);ctx.stroke();ctx.strokeText('YOU · GPS',tx,12);ctx.fillText('YOU · GPS',tx,12);ctx.restore();
}
function pair(cap?:number){const a=new Native(),b=new Native(),journal=createLegacyMinimapForeground(b.asContext(),cap);return {a,b,journal,source:image()};}

test('visible draw uses the original context and sampling once',()=>{
  const {a,b,journal,source}=pair();background(a,source);background(b,source,journal);foreground(a.asContext());let calls=0;
  journal.draw(false,ctx=>{assert.equal(ctx,b.asContext());calls++;foreground(ctx);});
  assert.equal(calls,1);assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('hidden capture keeps immediate background, exact native state/path, and one latest foreground',()=>{
  const {a,b,journal,source}=pair();let calls=0;
  for(const x of [11,22,33]){background(a,source);foreground(a.asContext(),x);background(b,source,journal);journal.draw(true,ctx=>{calls++;foreground(ctx,x);});
    assert.equal(b.paints.length,1);assert.deepEqual(b.state,a.state);assert.deepEqual(b.path,a.path);assert.deepEqual(b.stack,a.stack);}
  assert.equal(calls,3);journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot());
  journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot());assert.equal(calls,3);journal.dispose();
});
test('a cached source rebuild materializes the old complete frame before a failing write',()=>{
  const {a,b,journal,source}=pair();background(a,source);foreground(a.asContext());background(b,source,journal);journal.draw(true,foreground);
  const error=new Error('base producer failed');let writes=0;
  assert.throws(()=>{journal.materialize();writes++;source.version=2;throw error;},e=>e===error);
  assert.equal(writes,1);assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('the first background generation defers; every later rebuild drains old paint before mutation and permanently stays native',()=>{
  const {a,b,journal,source}=pair();let samples=0;
  journal.beforeBackgroundRebuild();
  for(const x of [11,22]){
    background(a,source);foreground(a.asContext(),x);background(b,source,journal);
    journal.draw(true,ctx=>{samples++;assert.notEqual(ctx,b.asContext());foreground(ctx,x);});
    assert.equal(b.paints.length,1,'First-generation foreground stays deferred');
  }
  assert.equal(samples,2);
  const oldFrame=a.snapshot(),failure=new Error('later base write failed');let mutations=0;
  assert.throws(()=>{
    journal.beforeBackgroundRebuild();assert.deepEqual(b.snapshot(),oldFrame,'Old foreground precedes the base write');
    mutations++;source.version=2;throw failure;
  },error=>error===failure);
  assert.equal(mutations,1);assert.deepEqual(b.snapshot(),oldFrame);
  for(const version of [2,3]){
    journal.beforeBackgroundRebuild();source.version=version;
    background(a,source);foreground(a.asContext(),version*20);background(b,source,journal);
    const before:number=samples;
    journal.draw(true,ctx=>{samples++;assert.equal(ctx,b.asContext());foreground(ctx,version*20);});
    assert.equal(samples,before+1);assert.deepEqual(b.snapshot(),a.snapshot());
    journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot(),'No later deferred packet survives');
  }
  journal.dispose();
});
test('successful clear retires old markers before a native image exception; source reset after blit is irrelevant',()=>{
  const {a,b,journal,source}=pair();background(a,source);foreground(a.asContext());background(b,source,journal);journal.draw(true,foreground);
  source.width=0;assert.throws(()=>background(a,source),/native empty image/);assert.throws(()=>background(b,source,journal),/native empty image/);
  journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot());
  source.width=420;background(a,source);foreground(a.asContext(),44);background(b,source,journal);journal.draw(true,ctx=>foreground(ctx,44));
  source.width=0;source.version=99;journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('an unbalanced exception prefix preserves original exception, pixels, native save stack and current path',()=>{
  const {a,b,journal,source}=pair();const error=new Error('producer failed');let calls=0;
  const producer=(ctx:CanvasRenderingContext2D)=>{calls++;ctx.save();ctx.translate(12,8);ctx.rotate(.6);ctx.fillStyle='#f00';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(8,0);ctx.lineTo(0,8);ctx.fill();throw error;};
  background(a,source);background(b,source,journal);assert.throws(()=>producer(a.asContext()),e=>e===error);
  assert.throws(()=>journal.draw(true,producer),e=>e===error);assert.equal(calls,2);assert.deepEqual(b.snapshot(),a.snapshot());
  a.restore();b.restore();a.lineWidth=3;b.lineWidth=3;a.stroke();b.stroke();assert.deepEqual(b.snapshot(),a.snapshot());
  journal.draw(true,ctx=>ctx.fillText('after failure',-0,3));a.fillText('after failure',-0,3);assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('native path exceptions occur on the original call and materialize only successful prefix',()=>{
  const {a,b,journal,source}=pair();const errors:unknown[]=[];let samples=0;
  const producer=(ctx:CanvasRenderingContext2D)=>{samples++;ctx.save();ctx.translate(4,5);ctx.fillRect(0,0,5,5);ctx.beginPath();ctx.arc(0,0,-1,0,1);};
  background(a,source);background(b,source,journal);try{producer(a.asContext());}catch(e){errors.push(e);}try{journal.draw(true,producer);}catch(e){errors.push(e);}
  assert.equal(errors.length,2);assert.equal((errors[0] as Error).message,'native radius');assert.equal((errors[1] as Error).message,'native radius');
  assert.equal(samples,2);assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('cap fallback replays the prefix once and executes the remaining original producer without resampling',()=>{
  const {a,b,journal,source}=pair(9);background(a,source);foreground(a.asContext());background(b,source,journal);let calls=0;
  journal.draw(true,ctx=>{calls++;foreground(ctx);});assert.equal(calls,1);assert.deepEqual(b.snapshot(),a.snapshot());
  journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('unsupported readback/reset runs after its prefix, then the remaining commands stay immediate',()=>{
  for(const reset of [false,true]){
    const {a,b,journal,source}=pair();background(a,source);background(b,source,journal);const reads:unknown[]=[];
    const producer=(ctx:CanvasRenderingContext2D)=>{ctx.fillRect(1,2,3,4);reads.push(ctx.getImageData(0,0,1,1));if(reset)ctx.reset();foreground(ctx);};
    producer(a.asContext());journal.draw(true,producer);assert.deepEqual(reads[1],reads[0]);assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
  }
});
test('dash arrays are copied, ignored numeric setters retain canonical getters, and negative zero is not normalized',()=>{
  const {a,b,journal,source}=pair();background(a,source);background(b,source,journal);const dash=[2,4];
  const producer=(ctx:CanvasRenderingContext2D)=>{ctx.lineWidth=2;ctx.lineWidth=-1;ctx.globalAlpha=2;assert.equal(ctx.lineWidth,2);assert.equal(ctx.globalAlpha,1);ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(4,8);ctx.stroke();ctx.fillText('x',-0,2);};
  producer(a.asContext());journal.draw(true,producer);dash[0]=99;journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot());
  assert(Object.is((b.paints.at(-1) as {args:unknown[]}).args[1],-0));journal.dispose();
});
test('unsupported accessor dash is not read until the original native fallback call',()=>{
  const {a,b,journal,source}=pair();background(a,source);background(b,source,journal);let reads=0;
  const dash=[0];Object.defineProperty(dash,0,{get(){reads++;return 3;}});
  const producer=(ctx:CanvasRenderingContext2D)=>{ctx.fillRect(1,2,3,4);ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(4,5);ctx.stroke();};
  producer(a.asContext());assert.equal(reads,1);journal.draw(true,producer);assert.equal(reads,2);assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('ordinary background/draw cannot leave an older deferred foreground to reappear',()=>{
  const {a,b,journal,source}=pair();background(a,source);foreground(a.asContext(),1);background(b,source,journal);journal.draw(true,ctx=>foreground(ctx,1));
  background(a,source);foreground(a.asContext(),99);background(b,source,journal);journal.draw(false,ctx=>foreground(ctx,99));
  journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('modeled target loss discards pending work and cannot resume stale paints after restoration',()=>{
  const {a,b,journal,source}=pair();background(a,source);foreground(a.asContext());background(b,source,journal);journal.draw(true,foreground);
  for(const ctx of [a,b]){ctx.reset();ctx.lost=true;ctx.canvas.dispatchEvent(new Event('contextlost'));}
  journal.materialize();assert.deepEqual(b.snapshot(),a.snapshot());
  for(const ctx of [a,b]){ctx.lost=false;ctx.canvas.dispatchEvent(new Event('contextrestored'));}
  background(a,source);foreground(a.asContext());background(b,source,journal);journal.draw(true,foreground);assert.deepEqual(b.snapshot(),a.snapshot());journal.dispose();
});
test('dispose materializes once and future draws stay native',()=>{
  const {a,b,journal,source}=pair();background(a,source);foreground(a.asContext());background(b,source,journal);journal.draw(true,foreground);
  journal.dispose();journal.dispose();assert.deepEqual(b.snapshot(),a.snapshot());let context:unknown;
  journal.draw(true,ctx=>{context=ctx;});assert.equal(context,b.asContext());
});
test('actual presentation apply materializes before exposure and preserves reduced-motion behavior',()=>{
  const originals=new Map<string,PropertyDescriptor|undefined>();
  const install=(key:string,value:unknown)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
  const events:string[]=[];
  const control=(value='',checked=false)=>({value,checked,disabled:false,listeners:new Map<string,()=>void>(),addEventListener(name:string,fn:()=>void){this.listeners.set(name,fn);},removeEventListener(){}});
  const preset=control('exploration'),compact=control('',true),motion=control('',true),quality=control('high'),sunset=control();
  const field={id:'',innerHTML:'',isConnected:true,querySelector(selector:string){return ({'#hud-preset':preset,'#compact-cockpit':compact,'#belle-sunset':sunset} as Record<string,unknown>)[selector]??null;}};
  const dataset=new Proxy({hudPreset:'cinematic'} as Record<string,string>,{set(target,key,value){events.push(String(key)+':'+value);target[String(key)]=value;return true;}});
  try{
    install('document',{body:{dataset},getElementById(id:string){return id==='settings'?{querySelector(){return {insertAdjacentElement(){}};},append(){}}:null;},createElement(){return field;},querySelector(selector:string){return selector==='#motion'?motion:selector==='#quality'?quality:null;},addEventListener(){},removeEventListener(){}});
    install('window',{addEventListener(){},removeEventListener(){}});install('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));install('localStorage',{getItem(){return null;},setItem(){}});
    installCinematicPresentation({configure(){}},()=>events.push('materialize'));
    assert.deepEqual(events.slice(0,2),['materialize','hudPreset:exploration']);assert.equal(dataset.presentationMotion,'reduced');
    events.length=0;preset.value='cinematic';preset.listeners.get('change')!();assert(!events.includes('materialize'));
    events.length=0;preset.value='racing';preset.listeners.get('change')!();assert.deepEqual(events.slice(0,2),['materialize','hudPreset:racing']);
  }finally{for(const [key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
