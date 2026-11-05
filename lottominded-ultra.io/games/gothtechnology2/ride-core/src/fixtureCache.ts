/** Cache only immutable, verified physics downloads. Restricted/private storage
 * must never stop a game from loading through its normal network path. */
const CACHE='digital-static-physics-v1';
export async function cachedPhysics(url:string):Promise<Response|undefined>{
 try{if(typeof caches==='undefined')return;const cache=await caches.open(CACHE);return await cache.match(url)??undefined;}catch{return;}
}
export async function forgetPhysics(url:string){
 try{if(typeof caches!=='undefined')await(await caches.open(CACHE)).delete(url);}catch{}
}
export async function savePhysics(url:string,bytes:Uint8Array){
 try{
  if(typeof caches==='undefined')return;
  const cache=await caches.open(CACHE);
  // Retain at most the current immutable version of each map. The two maps can
  // coexist so switching games does not evict the player's other city download.
  const product=new URL(url).pathname.match(/\/([-a-z]+)\.physics-/)?.[1];
  if(!product)return;
  for(const key of await cache.keys())if(key.url!==url&&new URL(key.url).pathname.includes('/'+product+'.physics-'))await cache.delete(key);
  const body=bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength?bytes.buffer:bytes.slice().buffer;
  await cache.put(url,new Response(body as ArrayBuffer,{headers:{'Content-Type':'application/octet-stream'}}));
 }catch{}
}
