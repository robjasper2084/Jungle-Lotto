import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {ScenePreparationOwnership} from './scenePreparationOwnership.ts';

function deferred(){
 let resolve!:()=>void,reject!:(error:unknown)=>void;
 const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
 return{promise,resolve,reject};
}

test('nested and overlapping preparation releases cannot resume a different owner',()=>{
 const changed:boolean[]=[],ownership=new ScenePreparationOwnership(value=>changed.push(value));
 const startup=ownership.acquire(),lighting=ownership.acquire();
 lighting();assert.deepEqual(changed,[true]);
 const landmark=ownership.acquire();startup();startup();
 assert.deepEqual(changed,[true]);landmark();landmark();
 assert.deepEqual(changed,[true,false]);
 const retry=ownership.acquire();retry();assert.deepEqual(changed,[true,false,true,false]);
});

test('the actual warmup callback retains welcome ownership and duplicate inactive callbacks are harmless',()=>{
 const source=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const start=source.indexOf(' const preparationOwnership='),end=source.indexOf(' async function prepareRideShadows(',start);
 assert(start>=0&&end>start);
 const initialization=source.slice(start,end).replace(':(()=>void)|undefined','');
 const context=createContext({ScenePreparationOwnership,scenePreparing:false,resetFrameClock:false,renderer:{},scene:{},camera:{},clear(){},
  SceneWarmup:class{busy:(value:boolean)=>void;constructor(_renderer:unknown,_scene:unknown,_camera:unknown,busy:(value:boolean)=>void){this.busy=busy;}}});
 runInContext(initialization,context);
 runInContext('const releaseWelcome=preparationOwnership.acquire();sceneWarmup.busy(true);sceneWarmup.busy(false);sceneWarmup.busy(false);',context);
 assert.equal(context.scenePreparing,true);assert.equal(context.resetFrameClock,true);
 runInContext('releaseWelcome();',context);assert.equal(context.scenePreparing,false);
 runInContext('sceneWarmup.busy(true);sceneWarmup.busy(true);sceneWarmup.busy(false);',context);
 assert.equal(context.scenePreparing,false,'Repeated busy notifications cannot leak an owner');
});

function startFixture(){
 const source=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const start=source.indexOf('start.onclick=async()=>'),end=source.indexOf('\n let savedFirst=',start);
 assert(start>=0&&end>start,'Use the actual complete Start handler');
 const handler=source.slice(start,end).replaceAll('hover!','hover');
 const lights=deferred(),assets=deferred(),landmarks=deferred(),landmarksEntered=deferred();
 const changed:boolean[]=[],events:string[]=[];let busy=false;
 const ownership=new ScenePreparationOwnership(value=>{busy=value;changed.push(value);});
 const car={variant:'hydraulic-cadillac',model:{},start(){assert(busy,'Retain loading ownership until the selected ride is ready');events.push('start ride');}};
 const context=createContext({
  start:{},starting:false,prepared:true,resetHydraulicFrameTime(){},
  startup:{choice:{vehicle:'hydraulic-cadillac'},preparing(){},leave(){assert(!busy,'Release the loading owner before ordinary handoff');events.push('handoff');},retryRide(){events.push('retry');}},
  preparationOwnership:ownership,isCadillacVariant:(value:string)=>value==='hydraulic-cadillac',
  natureAudio:{unlock(){}},clear(){},status(){},
  prepareRideAssets:async(load:()=>Promise<unknown>)=>{assert(busy,'Own the loading lock before any selected assets start');await assets.promise;return load();},
  cadillac:car,realLocation:undefined,photo:undefined,
  sceneWarmup:{prepare:async()=>{const release=ownership.acquire();try{await lights.promise;}finally{release();}}},
  world:{prepareCadillacLandmarks:async()=>{assert(busy,'Shader completion must not resume preview submissions during landmark preparation');events.push('landmarks');landmarksEntered.resolve();await landmarks.promise;}},
  core:{current:{x:1,z:2}},camera:{},cameraPitch:0,
  console:{warn(_label:string,error:unknown){events.push('warning');assert(error instanceof Error);}}
 });
 runInContext(handler,context);
 return{context,ownership,assets,lights,landmarks,landmarksEntered,changed,events,busy:()=>busy,
  run:()=>runInContext('start.onclick()',context) as Promise<void>};
}

test('actual Cadillac Start holds the lock across assets, lighting and landmarks, then releases before handoff',async()=>{
 const f=startFixture(),run=f.run();assert(f.busy());
 const duplicate=f.run();await duplicate;assert.deepEqual(f.changed,[true],'The existing starting guard prevents reentry');
 f.assets.resolve();f.lights.resolve();await f.landmarksEntered.promise;
 assert(f.busy());assert.deepEqual(f.changed,[true],'Nested lighting completion must not expose an unlocked gap');
 f.landmarks.resolve();await run;
 assert.deepEqual(f.events,['landmarks','start ride','handoff']);assert.deepEqual(f.changed,[true,false]);
});

test('actual Cadillac Start releases after a rejected asset and allows the existing retry state',async()=>{
 const f=startFixture(),run=f.run(),error=new Error('asset failed');f.assets.reject(error);await run;
 assert.deepEqual(f.events,['retry','warning']);assert.deepEqual(f.changed,[true,false]);assert.equal(f.context.starting,false);
});

test('actual Cadillac Start releases its owner on landmark failure without releasing unrelated preparation',async()=>{
 const f=startFixture(),run=f.run();f.assets.resolve();f.lights.resolve();await f.landmarksEntered.promise;
 const unrelated=f.ownership.acquire();f.landmarks.reject(new Error('landmark failed'));await run;
 assert(f.busy());assert.deepEqual(f.changed,[true]);assert.deepEqual(f.events,['landmarks','retry','warning']);
 unrelated();assert.deepEqual(f.changed,[true,false]);assert.equal(f.context.starting,false);
});
