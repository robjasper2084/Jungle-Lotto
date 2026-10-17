export type RoomInvite={code:string;testCode?:string;server?:string};
/** Invitations may select a public HTTPS game server or a loopback development server. Never carry credentials. */
function inviteServer(value:string|null|undefined){
 if(!value)return;try{const u=new URL(value);if(u.username||u.password||u.search||u.hash||u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))return;return u.href.replace(/\/$/,'');}catch{return;}
}
/** Accept the code or the whole invite, including old query-string invitations. */
export function parseRoomInvitation(value:string,length:8|32):RoomInvite|undefined{
 const raw=value.trim();let code=raw,testCode:string|undefined,server:string|undefined;
 try{const url=new URL(raw);if(!['http:','https:'].includes(url.protocol))return;const hash=new URLSearchParams(url.hash.slice(1));code=hash.get('room')??url.searchParams.get('room')??'';const access=hash.get('test');if(access&&/^[a-f0-9]{64}$/i.test(access))testCode=access.toLowerCase();server=inviteServer(hash.get('server'));}catch{}
 code=code.replace(/[\s-]/g,'');if(!new RegExp('^[a-f0-9]{'+length+'}$','i').test(code))return;
 return {code:length===8?code.toUpperCase():code.toLowerCase(),...(testCode?{testCode}:server?{server}:{})};
}
/** Temporary game access stays in the fragment, which is not sent in HTTP requests. */
export function roomInvitationLink(page:string,code:string,testCode?:string,endpoint?:string){
 const server=inviteServer(endpoint),url=new URL(page);url.searchParams.delete('room');url.hash=new URLSearchParams({room:code,...(testCode&&/^[a-f0-9]{64}$/i.test(testCode)?{test:testCode}:server?{server}:{})}).toString();return url.href;
}
