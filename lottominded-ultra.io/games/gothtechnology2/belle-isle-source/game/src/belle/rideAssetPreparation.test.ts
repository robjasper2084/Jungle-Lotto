import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRideAssets} from './rideAssetPreparation.ts';

function deferred<T>(){
 let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;
 const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}

test('selected asset loading starts before camera preparation and handoff waits for both',async()=>{
 const assets=deferred<{model:string}>(),camera=deferred<void>(),order:string[]=[];
 let complete=false;
 const ready=prepareRideAssets(()=>{order.push('assets');return assets.promise;},()=>{order.push('camera');return camera.promise;});
 void ready.then(()=>{complete=true;});
 await Promise.resolve();assert.deepEqual(order,['assets','camera']);
 const selected={model:'selected Cadillac'};assets.resolve(selected);
 await Promise.resolve();await Promise.resolve();assert.equal(complete,false);
 camera.resolve();assert.equal(await ready,selected);
});

test('an asset failure is observed immediately but cannot release the graphics barrier early',async()=>{
 const assets=deferred<never>(),camera=deferred<void>(),failure=new Error('selected asset unavailable');
 let finished=false;
 const ready=prepareRideAssets(()=>assets.promise,()=>camera.promise);
 const result=ready.then(()=>{finished=true;return null;},error=>{finished=true;return error;});
 assets.reject(failure);await Promise.resolve();await Promise.resolve();assert.equal(finished,false);
 camera.resolve();assert.equal(await result,failure);
});

test('both synchronous failures are observed and retain camera-first error priority',async()=>{
 const assetsError=new Error('asset factory'),cameraError=new Error('camera preparation'),order:string[]=[];
 await assert.rejects(prepareRideAssets(()=>{order.push('assets');throw assetsError;},()=>{order.push('camera');throw cameraError;}),error=>error===cameraError);
 assert.deepEqual(order,['assets','camera']);
});

test('camera failure waits for selected asset completion and a cached ride needs no asset payload',async()=>{
 const assets=deferred<string>(),failure=new Error('camera failed');let finished=false;
 const ready=prepareRideAssets(()=>assets.promise,()=>{throw failure;});
 const result=ready.then(()=>{finished=true;return null;},error=>{finished=true;return error;});
 await Promise.resolve();await Promise.resolve();assert.equal(finished,false);
 assets.resolve('loaded');assert.equal(await result,failure);
 assert.equal(await prepareRideAssets(async()=>undefined,()=>undefined),undefined);
});
