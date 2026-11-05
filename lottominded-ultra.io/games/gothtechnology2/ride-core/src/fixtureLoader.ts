import {gunzipSync,strFromU8} from 'fflate';
import {setFixtureBytes} from './fixtureBytes.ts';
import {cachedPhysics,forgetPhysics,savePhysics} from './fixtureCache.ts';
async function inflate(response:Response){
 if(typeof DecompressionStream!=='undefined'&&response.body)return new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 return gunzipSync(new Uint8Array(await response.arrayBuffer()));
}
export async function loadFixture(url:string){
 const compactUrl=url.replace(/\.json([?#].*)?$/,'.browser.json.gz$1'),compact=await fetch(compactUrl);
 if(compact.ok){
  const data=JSON.parse(strFromU8(await inflate(compact)));
  if(![1,2].includes(data.version)||data.version===2&&data.encoding!=='colliders-v1'||!data.fixture||data.fixture.physics!==''||!/^[-a-z]+\.physics-[a-f0-9]{16}\.bin\.gz$/.test(data.physics)||!Number.isSafeInteger(data.physicsBytes)||data.physicsBytes<=0||data.physicsBytes>400_000_000||!/^[a-f0-9]{64}$/.test(data.physicsHash))throw Error('Invalid binary map manifest.');
  const physicsUrl=new URL(data.physics,url).href;
  const verify=async(response:Response)=>{
   const compressed=new Uint8Array(await response.arrayBuffer());
   const bytes=await inflate(new Response(compressed));if(bytes.length!==data.physicsBytes)throw Error('Incomplete map physics. Please retry.');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.buffer as ArrayBuffer)),v=>v.toString(16).padStart(2,'0')).join('');
   if(hash!==data.physicsHash)throw Error('Map physics integrity check failed. Please reload.');
   return {bytes,compressed};
  };
  let verified:Awaited<ReturnType<typeof verify>>|undefined;
  const cached=await cachedPhysics(physicsUrl);
  if(cached){try{verified=await verify(cached);console.info('Map physics loaded from verified local cache.');}catch{await forgetPhysics(physicsUrl);}}
  if(!verified){
   const response=await fetch(physicsUrl);if(!response.ok)throw Error('Map physics download failed. Please retry.');
   verified=await verify(response);await savePhysics(physicsUrl,verified.compressed);
  }
  const bytes=verified.bytes;
  setFixtureBytes(data.fixture,bytes,data.version===2?'colliders-v1':'snapshot');return data.fixture;
 }
 if(compact.status!==404)throw Error('Map metadata unavailable. Please retry.');
 const zipped=await fetch(url.replace(/([?#].*)?$/,'.gz$1'));
 if(zipped.ok)return JSON.parse(strFromU8(await inflate(zipped)));
 const r=await fetch(url);if(!r.ok)throw Error('Map unavailable. Rebuild this game package.');return r.json();
}
