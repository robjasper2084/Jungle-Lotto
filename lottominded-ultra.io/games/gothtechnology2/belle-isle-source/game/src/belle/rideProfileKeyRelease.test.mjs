import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:[fileURLToPath(new URL('./rideProfile.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',logLevel:'error'});
const {RideProfile}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.hidden=false;this.open=false;this.attributes={};}
 append(child){this.children.push(child);child.parentElement=this;}
 setAttribute(key,value){this.attributes[key]=value;}
}
function fixture(hostname='127.0.0.1',search='?profile=1'){
 const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 const oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
 const callbacks=new Map(),settings=new Element('dialog');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{
  hidden:false,createElement:name=>new Element(name),
  getElementById:id=>id==='settings'?settings:null,
  addEventListener:(name,callback)=>callbacks.set(name,[...(callbacks.get(name)||[]),callback])
 }});
 Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname,search}});
 Object.assign(globalThis,{innerWidth:1440,innerHeight:900,devicePixelRatio:1});
 const profile=new RideProfile(()=>({quality:'high'}));
 const emit=(name,event)=>{for(const callback of callbacks.get(name)||[])callback(event);};
 const restore=()=>{
  if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else delete globalThis.document;
  if(oldLocation)Object.defineProperty(globalThis,'location',oldLocation);else delete globalThis.location;
 };
 return {profile,settings,emit,restore};
}
test('only a trusted physical-browser W release ends local capture before report extraction',()=>{
 const f=fixture();
 try{
  f.profile.start();f.profile.sample(.1,[1,2,3,4,5],12,120,4,3,0,0,2,'MacArthur Bridge',true);
  f.emit('keyup',{code:'KeyW',isTrusted:false});assert.equal(f.profile.enabled,true);
  f.emit('keyup',{code:'KeyS',isTrusted:true});assert.equal(f.profile.enabled,true);
  f.emit('keyup',{code:'KeyW',isTrusted:true});assert.equal(f.profile.enabled,false);
  const report=JSON.parse(f.settings.children[0].children[2].value);
  assert.equal(report.stopReason,'trusted-W-keyup');assert.equal(report.frames,1);
  assert.equal(report.over100ms,0);assert.equal(report.activeSeconds,.1);
 }finally{f.restore();}
});
test('local profile stopper never installs on a hosted page or ordinary ride URL',()=>{
 for(const [host,search] of [['robjasper2084.github.io','?profile=1'],['127.0.0.1',''],['example.com','?perfProbe=1']]){
  const f=fixture(host,search);
  try{f.profile.start();f.emit('keyup',{code:'KeyW',isTrusted:true});assert.equal(f.profile.enabled,true);f.profile.finish();}
  finally{f.restore();}
 }
});
