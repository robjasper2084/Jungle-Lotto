import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {deriveDriver,blobHash,pinnedDriver,phoneStallBrowserObserver} from './phone-stall-observer.mjs';

test('pinned strict driver receives only reversible inserts and keeps its original route and gates',async()=>{
 assert(process.env.STRICT_DRIVER_PATH,'STRICT_DRIVER_PATH is required');
 const original=await readFile(process.env.STRICT_DRIVER_PATH,'utf8');
 assert.equal(blobHash(original),pinnedDriver);
 const observed=deriveDriver(original);
 for(const line of original.split('\n').filter(line=>/profile=1|waitForTimeout\(seconds|stats\.metrics|stats\.over250ms|releasePerformanceVerified|heartbeat=setInterval|450\);/.test(line)))assert(observed.includes(line),line);
 assert(!observed.includes('renderSubmission=1'));
 assert.equal(observed.split("await page.keyboard.down('w')").length,original.split("await page.keyboard.down('w')").length);
 assert.throws(()=>deriveDriver(original+'\n'),/identity changed/);
});

function fixture(){
 let now=100,raf=0;
 const documentListeners={},windowListeners={},observers=new Map();
 const document={hidden:false,visibilityState:'visible',hasFocus:()=>true,addEventListener:(type,handler)=>documentListeners[type]=handler};
 const window={addEventListener:(type,handler)=>windowListeners[type]=handler};
 class PerformanceObserver{
  constructor(callback){this.callback=callback;this.pending=[];}
  observe({type}){observers.set(type,this);}
  takeRecords(){const p=this.pending;this.pending=[];return p;}
  disconnect(){this.disconnected=true;}
 }
 const context=vm.createContext({window,document,performance:{now:()=>now,timeOrigin:1000000},PerformanceObserver,
  Element:class {},requestAnimationFrame:()=>++raf,cancelAnimationFrame:()=>{},Array,Error});
 vm.runInContext('('+phoneStallBrowserObserver.toString()+')()',context);
 return {api:window.__bellePhoneStallObserver,setNow:value=>now=value,
  emit:(type,event)=>documentListeners[type]?.(event),
  task:entry=>observers.get('longtask').callback({getEntries:()=>[entry]}),
  pending:entry=>observers.get('longtask').pending.push(entry),
  animation:entry=>observers.get('long-animation-frame').callback({getEntries:()=>[entry]})};
}

test('timestamps retain native input boundary, pending long tasks and script locations without rearming',()=>{
 const f=fixture();f.task({startTime:90,duration:400});
 assert.equal(f.api.start().nowMs,100);
 assert.throws(()=>f.api.start(),/rearm/);
 f.emit('keydown',{isTrusted:false,code:'KeyW'});
 f.setNow(120);f.emit('keydown',{isTrusted:true,code:'KeyW'});
 f.task({startTime:110,duration:267.6,name:'self',attribution:[]});
 f.animation({startTime:110,duration:267.6,scripts:[{sourceURL:'main.js',sourceFunctionName:'apply',sourceCharPosition:123,duration:254.2}]});
 f.setNow(90120);f.emit('keyup',{isTrusted:false,code:'KeyW'});
 f.setNow(90130);f.emit('keyup',{isTrusted:true,code:'KeyW'});
 f.pending({startTime:90120,duration:459,name:'self',attribution:[]});
 f.pending({startTime:90131,duration:800,name:'self',attribution:[]});
 const data=f.api.finish();
 assert.equal(data.firstTrustedWKeydownMs,120);assert.equal(data.trustedWKeyupMs,90130);
 assert.equal(data.nativeInputComplete,true);assert.equal(data.tasks.length,2);
 assert.equal(data.tasks[1].durationMs,459,'Boundary-overlapping duration must not be truncated');
 assert.equal(data.animationFrames[0].scripts[0].sourceCharPosition,123);
 assert.equal(data.tasks[0].startTimeMs,110);
});

test('bounded evidence exposes dropped rows and never invents missing native input',()=>{
 const f=fixture();f.api.start();
 for(let n=0;n<1030;n++)f.task({startTime:101+n,duration:60,name:'self',attribution:[]});
 const data=f.api.finish();
 assert.equal(data.tasks.length,1024);assert.equal(data.dropped.tasks,6);
 assert.equal(data.nativeInputComplete,false);assert.equal(data.trustedWKeyupMs,null);
});
