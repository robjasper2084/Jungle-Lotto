import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {blockingFiles,blockingMime,blockingSize,validateShot,type BlockingShot} from './blockingPack.ts';
const shot:BlockingShot={start:2,end:8,aspect:'9:16',guides:false,notes:'Preserve the rider and Detroit skyline.',camera:'drone',subject:'Rider 1'};
test('blocking export rejects empty, reversed, out-of-range and excessive shots',()=>{
 assert.equal(validateShot(shot,12),6);
 for(const [start,end]of [[NaN,8],[-1,6],[7,6],[2,4],[0,31],[0,13]])assert.throws(()=>validateShot({...shot,start,end},12));
});
test('portrait and landscape dimensions are encoder-friendly and MP4 is preferred',()=>{
 assert.deepEqual(blockingSize('9:16'),{width:720,height:1280});assert.deepEqual(blockingSize('16:9'),{width:1280,height:720});
 assert.equal(blockingMime(m=>['video/mp4','video/webm'].includes(m)),'video/mp4');assert.equal(blockingMime(m=>m==='video/webm'),'video/webm');assert.equal(blockingMime(()=>false),undefined);
});
test('portable ZIP contains readable motion, prompt and format-specific instructions',()=>{
 const samples=[{time:0,sourceTime:2,camera:{position:[1,2,3],quaternion:[0,0,0,1],fov:56,aspect:9/16},actors:[{name:'Companion 1',position:[4,5,6],quaternion:[0,0,0,1],scale:[1,1,1]}]}];
 const files=blockingFiles('Elmwood Explorer',shot,'blocking.webm',samples,[{file:'reference-1.jpg',time:0}]);
 const encoded=Object.fromEntries(Object.entries(files).map(([key,value])=>[key,strToU8(value)]));const decoded=unzipSync(zipSync(encoded,{level:0}));
 const manifest=JSON.parse(strFromU8(decoded['blocking.json']));assert.equal(manifest.video.width,720);assert.equal(manifest.video.audio,false);assert.equal(manifest.samples[0].sourceTime,2);assert.equal(manifest.sourceRange.end,8);
 assert.match(strFromU8(decoded['README.md']),/ffmpeg -i blocking.webm/);assert.match(strFromU8(decoded['prompt.txt']),/Boerboel/);assert.match(strFromU8(decoded['camera.csv']),/0,2,1,2,3,0,0,0,1,56,0.5625/);
 assert.doesNotMatch(blockingFiles('Swoop Detroit',shot,'blocking.mp4',samples,[])['README.md'],/ffmpeg -i/);
});
