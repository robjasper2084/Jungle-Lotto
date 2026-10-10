export type VoiceChannel='all'|'squad-a'|'squad-b';
export type VoiceMember={id:string;name:string;channel:VoiceChannel};
export type VoiceSignal={to:string;description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit};
export const voiceChannel=(value:unknown):value is VoiceChannel=>value==='all'||value==='squad-a'||value==='squad-b';
/** Reject unrelated fields, video SDP, oversized input and cross-channel relays. */
export function voiceSignal(value:unknown):VoiceSignal|undefined{
 if(!value||typeof value!=='object')return;const v=value as VoiceSignal;
 if(typeof v.to!=='string'||!v.to||v.to.length>80)return;
 if(v.description){const {type,sdp}=v.description;if(!['offer','answer'].includes(type)||typeof sdp!=='string'||sdp.length>6000||!/\bm=audio /.test(sdp)||/\bm=(video|application) /.test(sdp))return;return {to:v.to,description:{type,sdp}};}
 if(v.candidate){const c=v.candidate;if(typeof c.candidate!=='string'||c.candidate.length>2000||c.sdpMid!=null&&(typeof c.sdpMid!=='string'||c.sdpMid.length>32)||c.sdpMLineIndex!=null&&(!Number.isInteger(c.sdpMLineIndex)||c.sdpMLineIndex<0||c.sdpMLineIndex>4))return;return {to:v.to,candidate:{candidate:c.candidate,sdpMid:c.sdpMid,sdpMLineIndex:c.sdpMLineIndex}};}
}
export function voiceRecipient(from:string,signal:VoiceSignal,members:readonly VoiceMember[]){const sender=members.find(m=>m.id===from),target=members.find(m=>m.id===signal.to);return !!sender&&!!target&&from!==signal.to&&sender.channel===target.channel;}
