export type RoomInvitation={code:string;link:string;title:string};
export function invitationText(invite:RoomInvitation){
 return `Join me in ${invite.title}!\nRoom code: ${invite.code}\n${invite.link}\nOpen the game, choose Online, and select Join room.`;
}
/** Compose links leave sending and posting to the player. The hash carries the room code. */
export function invitationShareUrl(service:'gmail'|'facebook'|'twitter'|'tiktok',invite:RoomInvitation){
 const urls={gmail:'https://mail.google.com/mail/',facebook:'https://www.facebook.com/sharer/sharer.php',twitter:'https://twitter.com/intent/tweet',tiktok:'https://www.tiktok.com/'};
 const url=new URL(urls[service]);
 if(service==='gmail')url.search=new URLSearchParams({view:'cm',fs:'1',su:`Join my ${invite.title} ride`,body:invitationText(invite)}).toString();
 if(service==='facebook')url.search=new URLSearchParams({u:invite.link}).toString();
 if(service==='twitter')url.search=new URLSearchParams({text:`Join my ${invite.title} ride! Room code: ${invite.code}`,url:invite.link}).toString();
 return url.href;
}
export function inviteSharing(read:()=>RoomInvitation|undefined,status:(text:string)=>void){
 const group=document.createElement('div');group.className='onlineInviteSharing';
 const title=document.createElement('p');title.textContent='Share your invitation';
 const actions=document.createElement('div');actions.className='onlineActions';actions.setAttribute('role','group');actions.setAttribute('aria-label','Share room invitation');
 const buttons:HTMLButtonElement[]=[];
 for(const [service,label]of [['gmail','Gmail'],['facebook','Facebook'],['tiktok','TikTok'],['twitter','Twitter / X']] as const){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',`Share invitation with ${label}`);
  button.onclick=()=>{
   const invite=read();if(!invite)return;
   const url=invitationShareUrl(service,invite);
   // Open during the click: awaiting clipboard first would block the new tab on mobile.
   window.open(url,'_blank','noopener,noreferrer');
   if(service==='tiktok'){
    status('TikTok opened. Copy the invitation above and paste it into a message or post.');
    if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(invitationText(invite)).then(()=>status('Invitation copied. Paste it into a TikTok message or post.')).catch(()=>status('Copy the invitation link above, then paste it into TikTok.'));
   }else status(`${label} share draft opened. Review it, then send when you are ready.`);
  };
  buttons.push(button);actions.append(button);
 }
 const hint=document.createElement('p');hint.textContent='TikTok copies your code and link for you to paste. You choose who to invite.';
 group.append(title,actions,hint);
 return {element:group,update(enabled:boolean){for(const button of buttons)button.disabled=!enabled;}};
}
