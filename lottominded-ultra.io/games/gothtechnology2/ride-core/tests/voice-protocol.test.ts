import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceSignal,voiceRecipient,type VoiceMember} from '../src/voiceProtocol.ts';
const peers:VoiceMember[]=[{id:'a',name:'A',channel:'all'},{id:'b',name:'B',channel:'all'},{id:'c',name:'C',channel:'squad-a'}];
test('voice signals cannot target a different room, channel or self',()=>{
 for(const [from,to,expected]of [['a','b',true],['a','c',false],['a','x',false],['x','b',false],['a','a',false]] as const)assert.equal(voiceRecipient(from,{to},peers),expected);
});
test('only bounded audio SDP and ICE pass; claimed sender is discarded',()=>{
 assert.deepEqual(voiceSignal({from:'spoof',to:'b',description:{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'}}),{to:'b',description:{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'}});
 for(const sdp of ['v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 111','m=audio 9\r\nm=application 9','m=audio '+'.'.repeat(16000)])assert.equal(voiceSignal({to:'b',description:{type:'offer',sdp}}),undefined);
 assert.equal(voiceSignal({to:'b',candidate:{candidate:'.'.repeat(2001)}}),undefined);
 assert.equal(voiceSignal({to:'b',candidate:{candidate:'candidate:1',sdpMLineIndex:-1}}),undefined);
 assert.deepEqual(voiceSignal({to:'b',candidate:{candidate:'candidate:1',sdpMid:'0',sdpMLineIndex:0}}),{to:'b',candidate:{candidate:'candidate:1',sdpMid:'0',sdpMLineIndex:0}});
});
