import {createHmac} from 'node:crypto';
/** Coturn REST credentials, scoped to a joined seat and valid for one hour.
 * The shared TURN secret stays exclusively on the match server. */
export function roomVoiceIce(sessionId:string,env:NodeJS.ProcessEnv=process.env,now=Date.now()){
 const iceServers:{urls:string|string[];username?:string;credential?:string}[]=[{urls:'stun:stun.l.google.com:19302'}];
 const urls=(env.TURN_URLS??'').split(',').map(s=>s.trim()).filter(s=>/^turns?:[a-z0-9.[\]:-]+(?:\?transport=(?:udp|tcp))?$/i.test(s)).slice(0,6);
 if(!env.TURN_SECRET||env.TURN_SECRET.length<24||!urls.length)return {iceServers,relay:false};
 const expires=Math.floor(now/1000)+3600,username=expires+':'+sessionId.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80),credential=createHmac('sha1',env.TURN_SECRET).update(username).digest('base64');
 iceServers.push({urls,username,credential});return {iceServers,relay:true,expires};
}
