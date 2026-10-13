export const DEFAULT_VOICE_ICE=[{urls:'stun:stun.l.google.com:19302'}];
/** Only ICE URLs are accepted; room messages cannot inject arbitrary requests. */
export function voiceIce(value:unknown):RTCIceServer[]|undefined{
 if(!Array.isArray(value)||!value.length||value.length>6)return;
 const result:RTCIceServer[]=[];
 for(const item of value){if(!item||typeof item!=='object')return;const urls=typeof item.urls==='string'?[item.urls]:item.urls;
  if(!Array.isArray(urls)||!urls.length||urls.length>6||urls.some(u=>typeof u!=='string'||u.length>300||!/^turns?:[a-z0-9.[\]:-]+(?:\?transport=(?:udp|tcp))?$/i.test(u)&&!/^stuns?:[a-z0-9.[\]:-]+$/i.test(u)))return;
  if(urls.some(u=>/^turns?:/i.test(u))&&(typeof item.username!=='string'||!item.username||item.username.length>160||typeof item.credential!=='string'||!item.credential||item.credential.length>256))return;
  result.push({urls,...(typeof item.username==='string'?{username:item.username,credential:item.credential}:{})});
 }return result;
}
