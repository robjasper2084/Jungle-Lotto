import {DISCOUNT_PREVIEW_KEY,DISCOUNT_TIERS,readDiscountPreview,bankGameProgress} from '../public/arcade/rewards.js';
import { $$ } from './dom';
import { initRewardMotion } from './reward-motion';

export function initUndergroundDiscount(){
  const cards=$$<HTMLElement>('[data-underground-reward]');
  initRewardMotion();
  let state=readDiscountPreview();
  function render(){
    for(const card of cards){
      const score=card.querySelector('[data-reward-score]');
      const percent=card.querySelector('[data-reward-percent]');
      const next=card.querySelector('[data-reward-next]');
      const saved=card.querySelector('[data-reward-saved]');
      const progress=card.querySelector<HTMLProgressElement>('progress');
      if(score)score.textContent=state.totalPoints.toLocaleString('en-US');
      if(percent)percent.textContent=`${state.percent}%`;
      if(next)next.textContent=state.next?`${state.remaining.toLocaleString('en-US')} points to ${state.next.percent}%`:'Maximum 20% discount preview reached';
      if(saved)saved.textContent=state.saved?'Points from all games and new runs add together on this browser.':'Session only — browser storage is unavailable.';
      if(progress){progress.max=state.next?.points??DISCOUNT_TIERS.at(-1)!.points;progress.value=Math.min(state.totalPoints,progress.max);progress.setAttribute('aria-valuetext',`${state.percent}% preview. ${next?.textContent??''}`);}
      card.dataset.rewardLevel=String(state.percent);
      card.querySelectorAll<HTMLElement>('[data-signal-tier]').forEach((tier,index)=>{
        const target=Number(tier.dataset.signalTier);
        const previous=DISCOUNT_TIERS[index-1]?.points??0;
        const fill=Math.max(0,Math.min(1,(state.totalPoints-previous)/(target-previous)));
        const reached=state.totalPoints>=target;
        const active=state.next?.points===target;
        tier.style.setProperty('--signal-fill',String(fill));
        tier.dataset.reached=String(reached);
        tier.dataset.active=String(active);
        const label=tier.querySelector('[data-signal-state]');
        if(label)label.textContent=reached?'Reached':active?'Next milestone':'Target';
      });
      card.querySelectorAll<HTMLElement>('[data-game-points]').forEach(node=>{node.textContent=(state.games[node.dataset.gamePoints!]?.points??0).toLocaleString('en-US');});
      const carried=card.querySelector<HTMLElement>('[data-reward-carried]');if(carried){carried.hidden=!state.carriedPoints;carried.textContent=`Includes ${state.carriedPoints.toLocaleString('en-US')} points carried over from your earlier Underground reward.`;}
      card.querySelectorAll<HTMLElement>('[data-tier-points]').forEach(tier=>{
        const reached=state.totalPoints>=Number(tier.dataset.tierPoints);
        tier.dataset.reached=String(reached);
        const label=tier.querySelector('[data-tier-state]');if(label)label.textContent=reached?'Reached':'Target';
      });
    }
  }
  async function update(game:string,snapshot:object){state=await bankGameProgress(game,snapshot);render();}
  window.addEventListener('storage',event=>{if(event.key===DISCOUNT_PREVIEW_KEY||event.key===null){state=readDiscountPreview();render();}});
  document.addEventListener('store:discount-preview',()=>{state=readDiscountPreview();render();});
  window.addEventListener('pageshow',()=>{state=readDiscountPreview();render();});
  render();
  return {update};
}
