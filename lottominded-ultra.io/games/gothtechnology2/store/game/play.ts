import { acceptGameMessage, cosmeticReward, type GameStoreMessage } from './messages';
import { characters } from '../content/catalog';
import { analytics } from '../state/analytics';
import { config } from '../config';
import { href } from '../utilities/paths';
import { $, save, saved } from '../ui/dom';
export function initPlay() {
  const host=$('[data-game-host]')!,launch=$<HTMLButtonElement>('#launch-game')!,notice=$('#game-connection')!,reward=$('#game-reward-status')!;
  let frame:HTMLIFrameElement|null=null,timer:ReturnType<typeof setTimeout>|undefined,ready=false;
  const requested=new URLSearchParams(location.search).get('character'),character=characters.find(c=>c.id===requested);
  if(character)$('#requested-character')!.textContent='Starting character: '+character.name+'. You can change your fighter inside the game.';
  const badge=saved('gothtechnology.armory.badge');if(badge&&characters.some(c=>`signal-${c.id}`===badge))reward.textContent='Local signal badge saved on this device. Cosmetic only; no discount or monetary value.';
  launch.addEventListener('click',()=>{
    if(frame)return;frame=document.createElement('iframe');frame.title='GOTHTECHNOLOGY fighting game';frame.allow='fullscreen; gamepad';frame.allowFullscreen=true;
    frame.src=href('legacy-game/')+(character?`?character=${character.id}`:'');frame.id='game-frame';
    frame.addEventListener('load',()=>{if(!ready)notice.textContent='Game loaded. Preparing the character systems…';});
    host.append(frame);launch.hidden=true;$('#game-launch-cover')!.hidden=true;notice.textContent='Loading the preserved game…';document.dispatchEvent(new Event('store:game-launch'));
    timer=setTimeout(()=>{notice.textContent='The game is taking longer than expected. You can reload this page or open the standalone game link.';},45000);
  });
  window.addEventListener('message',event=>{
    if(!acceptGameMessage(event,location.origin,frame?.contentWindow??null))return;
    const data=event.data as GameStoreMessage;
    if(data.type==='GOTHTECH_MATCH_COMPLETED')analytics.trackEvent('game_match_complete',{character:data.characterId,result:data.result,duration:data.durationSeconds});
    if(data.type==='GOTHTECH_GAME_READY'){ready=true;clearTimeout(timer);notice.textContent='Game ready. Use the in-game controls or keyboard. Back to Store remains above the game.';}
    if(data.type==='GOTHTECH_CHARACTER_SELECTED'){
      const selected=characters.find(c=>c.id===data.characterId)!;const link=$<HTMLAnchorElement>('#game-collection-link')!;link.href=href(`collections/${selected.collection}/`);link.textContent='View '+selected.name+' collection';
    }
    if(data.type==='GOTHTECH_MATCH_COMPLETED'&&config.features.enableGameRewards){const badge=cosmeticReward(data);if(badge){save('gothtechnology.armory.badge',badge.id);reward.textContent='Local signal badge unlocked. Saved on this device only. Cosmetic, unverified, and worth no money.';}}
    if(data.type==='GOTHTECH_OPEN_COLLECTION'){const link=$<HTMLAnchorElement>('#game-collection-link')!;link.href=href(`collections/${data.collectionHandle}/`);link.textContent='Open character collection';link.focus();}
  });
  window.addEventListener('pagehide',()=>{clearTimeout(timer);frame?.remove();},{once:true});
}
