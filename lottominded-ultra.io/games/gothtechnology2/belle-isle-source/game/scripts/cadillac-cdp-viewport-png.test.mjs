import assert from 'node:assert/strict';
import {test} from 'node:test';
import {captureCadillacViewportPng,exactViewportPng} from './cadillac-cdp-viewport-png.mjs';

// A real, encoded, lossless one-pixel PNG; mocked CDP transport only, not a
// substitute for the unchanged real Chrome gameplay and screenshot CI suite.
const SOURCE=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XOG0AAAAASUVORK5CYII=','base64');
const viewport={width:1,height:1};
test('one compositor capture preserves the exact PNG bytes and viewport',async()=>{
 const calls=[],writes=[];
 const client={send:async(...args)=>{calls.push(args);return{data:SOURCE.toString('base64')}}};
 const bytes=await captureCadillacViewportPng({client,viewport,path:'capture.png',write:async(...args)=>{writes.push(args)}});
 assert.deepEqual(bytes,SOURCE);
 assert.deepEqual(calls,[['Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false}]]);
 assert.equal(writes.length,1);
 assert.equal(writes[0][0],'capture.png');
 assert.deepEqual(writes[0][1],SOURCE);
});
test('incorrect dimensions or invalid frames fail closed without saving an image',async()=>{
 const malformed=[SOURCE.subarray(0,20).toString('base64'),'invalid',Buffer.alloc(60).toString('base64')];
 for(const data of malformed)assert.throws(()=>exactViewportPng(data,viewport),Error);
 assert.throws(()=>exactViewportPng(SOURCE.toString('base64'),{width:2,height:1}),/width changed/);
 assert.throws(()=>exactViewportPng(SOURCE.toString('base64'),{width:1,height:2}),/height changed/);
 let writes=0,calls=0;
 const client={send:async()=>{calls++;return{data:SOURCE.toString('base64')}}};
 await assert.rejects(captureCadillacViewportPng({client,viewport:{width:3,height:4},path:'bad.png',write:async()=>{writes++}}),/width changed/);
 assert.equal(calls,1);assert.equal(writes,0);
});
test('browser capture and disk errors retain their identity without retries',async()=>{
 const failure=Error('native compositor failed');let calls=0,writes=0;
 await assert.rejects(captureCadillacViewportPng({client:{send:async()=>{calls++;throw failure}},viewport,path:'capture.png',write:async()=>{writes++}}),e=>e===failure);
 assert.equal(calls,1);assert.equal(writes,0);
 const disk=Error('disk failed');calls=0;
 await assert.rejects(captureCadillacViewportPng({client:{send:async()=>{calls++;return{data:SOURCE.toString('base64')}}},viewport,path:'capture.png',write:async()=>{throw disk}}),e=>e===disk);
 assert.equal(calls,1);
});
