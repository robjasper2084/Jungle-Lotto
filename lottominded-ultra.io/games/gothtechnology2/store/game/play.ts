import { acceptGameMessage, cosmeticReward, type GameStoreMessage } from './messages';
import { characters } from '../content/catalog';
import { analytics } from '../state/analytics';
import { config } from '../config';
import { href } from '../utilities/paths';
import { $, save, saved } from '../ui/dom';
import {initUndergroundDiscount} from '../ui/underground-discount';
import {rewardGameForURL} from '../public/arcade/games.js';
export function initPlay() {
  initUndergroundDiscount();
  const host=$('[data-game-host]')!,launch=$<HTMLButtonElement>('#launch-game')!,notice=$('#game-connection')!,reward=$('#game-reward-status')!;
  let frame:HTMLIFrameElement|null=null,timer:ReturnType<typeof setTimeout>|undefined,ready=false;
  const requested=new URLSearchParams(location.search).get('character'),character=characters.find(c=>c.id===requested);
  if(character)$('#requested-character')!.textContent='Starting character: '+character.name+'. You can change your fighter inside the game.';
  const badge=saved('gothtechnology.armory.badge');if(badge&&characters.some(c=>`signal-${c.id}`===badge))reward.textContent='Local signal badge saved on this device. Cosmetic only; no discount or monetary value.';
  const fighterPrompt=$('#requested-character')!.textContent,fighterReward=reward.textContent;
  let activeGame='gothtechnology';
  function syncGame(){
    try{
      const url=frame?.contentWindow?.location.href;
      const game=url&&rewardGameForURL(url,new URL(href(),location.href).href);
      if(!game||!frame)return;
      activeGame=game.id;
      frame.title=game.title+' game';
      $<HTMLAnchorElement>('#game-standalone-link')!.href=url;
      $('#requested-character')!.textContent=game.id==='gothtechnology'?fighterPrompt:game.help;
      $('#game-collection-link')!.hidden=game.id!=='gothtechnology';
      reward.textContent=game.id==='gothtechnology'?fighterReward:`${game.title} points build your shared discount preview. Saved on this browser; not redeemable yet.`;
      if(game.id!=='gothtechnology'){
        ready=true;clearTimeout(timer);
        notice.textContent=game.title+' ready. Use the in-game controls. Back to Store remains above the game.';
        (frame.contentWindow as any).RahbeArcadeGame?.applySettings({sound:false,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches||document.documentElement.dataset.reducedMotion==='true'});
      }else if(!ready)notice.textContent='Game loaded. Preparing the character systems…';
    }catch{/* Only recognized same-origin game pages can update the toolbar. */}
  }
  launch.addEventListener('click',()=>{
    if(frame)return;frame=document.createElement('iframe');frame.title='GOTHTECHNOLOGY fighting game';frame.allow='fullscreen; gamepad';frame.allowFullscreen=true;
    frame.src=href('legacy-game/')+(character?`?character=${character.id}`:'');frame.id='game-frame';
    frame.addEventListener('load',syncGame);
    host.append(frame);launch.hidden=true;$('#game-launch-cover')!.hidden=true;notice.textContent='Loading the preserved game…';document.dispatchEvent(new Event('store:game-launch'));
    timer=setTimeout(()=>{notice.textContent='The game is taking longer than expected. You can reload this page or open the standalone game link.';},45000);
  });
  window.addEventListener('message',event=>{
    if(activeGame!=='gothtechnology'||!acceptGameMessage(event,location.origin,frame?.contentWindow??null))return;
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
