import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invitationShareUrl,invitationText} from './inviteSharing.ts';
const invite={code:'c23d1019cb52c70f87e50581028d844a',title:'Swoop . Detroit',link:'https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/?mode=free&from=invite#room=c23d1019cb52c70f87e50581028d844a'};
test('share drafts preserve the complete invitation including query and room fragment',()=>{
 const gmail=new URL(invitationShareUrl('gmail',invite));assert.equal(gmail.hostname,'mail.google.com');assert.equal(gmail.searchParams.get('view'),'cm');assert.equal(gmail.searchParams.get('body'),invitationText(invite));assert.equal(gmail.searchParams.has('to'),false);
 const facebook=new URL(invitationShareUrl('facebook',invite));assert.equal(facebook.searchParams.get('u'),invite.link);
 const twitter=new URL(invitationShareUrl('twitter',invite));assert.equal(twitter.searchParams.get('url'),invite.link);assert.ok(twitter.searchParams.get('text')?.includes(invite.code));
});
test('TikTok opens its site while the copyable text contains the code and join instructions',()=>{
 assert.equal(invitationShareUrl('tiktok',invite),'https://www.tiktok.com/');assert.ok(invitationText(invite).includes(invite.code));assert.ok(invitationText(invite).includes(invite.link));assert.ok(invitationText(invite).includes('Join room'));
});
