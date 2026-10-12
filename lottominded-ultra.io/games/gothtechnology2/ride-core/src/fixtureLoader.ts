import {gunzipSync,strFromU8} from 'fflate';
import {setFixtureBytes} from './fixtureBytes.ts';
async function inflate(response:Response){
 if(typeof DecompressionStream!=='undefined'&&response.body)return new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 return gunzipSync(new Uint8Array(await response.arrayBuffer()));
}
export async function loadFixture(url:string){
 const compactUrl=url.replace(/\.json([?#].*)?$/,'.browser.json.gz$1'),compact=await fetch(compactUrl);
 if(compact.ok){
  const data=JSON.parse(strFromU8(await inflate(compact)));
  if(data.version!==1||!data.fixture||data.fixture.physics!==''||!/^[-a-z]+\.physics-[a-f0-9]{16}\.bin\.gz$/.test(data.physics)||!Number.isSafeInteger(data.physicsBytes)||data.physicsBytes<=0||data.physicsBytes>400_000_000||!/^[a-f0-9]{64}$/.test(data.physicsHash))throw Error('Invalid binary map manifest.');
  const response=await fetch(new URL(data.physics,url));if(!response.ok)throw Error('Map physics download failed. Please retry.');
  const bytes=await inflate(response);if(bytes.length!==data.physicsBytes)throw Error('Incomplete map physics. Please retry.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.buffer as ArrayBuffer)),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==data.physicsHash)throw Error('Map physics integrity check failed. Please reload.');
  setFixtureBytes(data.fixture,bytes);return data.fixture;
 }
 if(compact.status!==404)throw Error('Map metadata unavailable. Please retry.');
 const zipped=await fetch(url.replace(/([?#].*)?$/,'.gz$1'));
 if(zipped.ok)return JSON.parse(strFromU8(await inflate(zipped)));
 const r=await fetch(url);if(!r.ok)throw Error('Map unavailable. Rebuild this game package.');return r.json();
}
