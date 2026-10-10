// AES-GCM protects each client independently even though the relay topics are public.
// Never send access codes, plaintext game state or reconnect tokens on those topics.
const enc=new TextEncoder(),dec=new TextDecoder();
export const hex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export function unhex(s:string){if(!/^(?:[a-f0-9]{2})+$/i.test(s))throw Error('Invalid key');return Uint8Array.from(s.match(/../g)!,x=>parseInt(x,16));}
export const randomKey=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function importKey(key:string){return crypto.subtle.importKey('raw',unhex(key),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(key:CryptoKey,value:unknown,aad:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},key,enc.encode(JSON.stringify(value)));return {iv:hex(iv),data:btoa(String.fromCharCode(...new Uint8Array(data)))};}
export async function open(key:CryptoKey,p:any,aad:string){if(!p||typeof p.data!=='string'||p.data.length>120000||typeof p.iv!=='string'||p.iv.length!==24)throw Error('Invalid packet');const data=Uint8Array.from(atob(p.data),c=>c.charCodeAt(0));return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(p.iv),additionalData:enc.encode(aad)},key,data)));}
