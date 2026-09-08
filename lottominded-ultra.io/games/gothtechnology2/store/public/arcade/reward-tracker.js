import {bankGameProgress,readDiscountPreview,fighterReceipt,DISCOUNT_PREVIEW_KEY} from './rewards.js';
const game=document.querySelector('meta[name="goth-reward-game"]')?.content;
const debug=new URLSearchParams(location.search).has('debug');
window.GothGameRewardFlush=snapshot=>debug?Promise.resolve():bankGameProgress(game,{...snapshot});
let last='',busy=false;
async function sync(){
  if(debug||busy)return;
  const snapshot=game==='gothtechnology'?fighterReceipt(window.__gothTechnologyGame):window.RahbeArcadeGame?.getStats();
  if(!snapshot)return;
  const key=[snapshot.runId,snapshot.score,snapshot.seconds>0,snapshot.mode].join('|');if(key===last)return;
  busy=true;
  try{const state=await bankGameProgress(game,snapshot);last=key;const button=document.getElementById('discount-info');if(button)button.textContent=`ALL GAMES · ${state.percent}% PREVIEW`;}finally{busy=false;}
}
let timer=setInterval(sync,250);
window.addEventListener('pageshow',event=>{if(event.persisted){clearInterval(timer);timer=setInterval(sync,250);void sync();}});
window.addEventListener('gothtechnology:state',sync);
window.addEventListener('pagehide',()=>{void sync();clearInterval(timer);});
document.addEventListener('visibilitychange',sync);
const button=document.getElementById('discount-info');if(button)button.textContent=`ALL GAMES · ${readDiscountPreview().percent}% PREVIEW`;
window.addEventListener('storage',event=>{if(button&&(event.key===DISCOUNT_PREVIEW_KEY||event.key===null))button.textContent=`ALL GAMES · ${readDiscountPreview().percent}% PREVIEW`;});
