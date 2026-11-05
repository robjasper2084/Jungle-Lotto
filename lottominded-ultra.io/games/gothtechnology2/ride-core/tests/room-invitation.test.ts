import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoomInvitation,roomInvitationLink} from '../src/roomInvitation.ts';
test('invites round-trip with access in the fragment and tolerate pasted code formatting',()=>{
 const code='ABCDEF12',access='a'.repeat(64),link=roomInvitationLink('https://example.test/royale.html?room=OLD&reducedMotion',code,access),url=new URL(link);
 assert.equal(url.searchParams.has('room'),false);assert.equal(url.search.includes(access),false);assert.equal(url.searchParams.has('reducedMotion'),true);assert.deepEqual(parseRoomInvitation(link,8),{code,testCode:access});assert.deepEqual(parseRoomInvitation('ab cd-ef12',8),{code});
});
test('both games accept old links and reject incomplete or unsafe invitations',()=>{
 const code='b'.repeat(32);assert.deepEqual(parseRoomInvitation('https://example.test/#room='+code,32),{code});assert.deepEqual(parseRoomInvitation('https://example.test/royale.html?room=abcdef12',8),{code:'ABCDEF12'});
 for(const value of ['','abcdef','javascript://example.test/#room=abcdef12','https://example.test/?room=wrong'])assert.equal(parseRoomInvitation(value,8),undefined);
 assert.deepEqual(parseRoomInvitation('https://example.test/#room=abcdef12&test=invalid',8),{code:'ABCDEF12'});assert.equal(parseRoomInvitation(code,8),undefined);
});
