import type {Money} from '../commerce/types';
import {formatMoney} from '../commerce/money';
import {DISCOUNT_TIERS,DISCOUNT_PREVIEW_KEY,discountEstimate,readDiscountPreview} from '../public/arcade/rewards.js';
import {escape as e} from './dom';
import {href} from '../utilities/paths';

const maximum=DISCOUNT_TIERS.at(-1)!;
export function gamePriceMarkup(price:Money){
  if(price.amount<=0)return '';
  const estimate=discountEstimate(maximum.points,price.amount);
  return `<div class="game-price-preview" data-game-price-preview data-price-amount="${price.amount}" data-price-currency="${e(price.currency)}"><p><span data-game-price-label>With ${maximum.percent}% game discount</span><strong data-game-price-value>${e(formatMoney({...price,amount:estimate.total}))}</strong></p><small data-game-price-note>${maximum.points.toLocaleString('en-US')} points required · Discount preview</small><small>Not redeemable yet · <a href="${e(href('#underground-rewards'))}">Play all games →</a></small></div>`;
}

export function refreshGamePricePreviews(root:ParentNode=document){
  const state=readDiscountPreview();
  for(const node of root.querySelectorAll<HTMLElement>('[data-game-price-preview]')){
    const amount=Number(node.dataset.priceAmount),currency=node.dataset.priceCurrency!;
    const estimate=discountEstimate(state.percent?state.totalPoints:maximum.points,amount);
    const label=node.querySelector('[data-game-price-label]'),value=node.querySelector('[data-game-price-value]'),note=node.querySelector('[data-game-price-note]');
    if(label)label.textContent=`With ${state.percent?'your ':''}${estimate.percent}% game discount`;
    if(value)value.textContent=formatMoney({amount:estimate.total,currency});
    if(note)note.textContent=state.percent?`${state.totalPoints.toLocaleString('en-US')} total points · ${state.percent}% discount preview`:`${maximum.points.toLocaleString('en-US')} points required · Discount preview`;
  }
}

export function initGamePricePreviews(){
  refreshGamePricePreviews();
  document.addEventListener('store:discount-preview',()=>refreshGamePricePreviews());
  window.addEventListener('storage',event=>{if(event.key===DISCOUNT_PREVIEW_KEY||event.key===null)refreshGamePricePreviews();});
}
