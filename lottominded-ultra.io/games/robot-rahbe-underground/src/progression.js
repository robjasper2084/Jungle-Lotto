export const UPGRADES=[
 {id:'piercing',name:'Piercing pulse',price:250,description:'Each pulse passes through a second enemy.'},
 {id:'shield',name:'Signal shield',price:200,description:'Absorbs one hit. Recharge at each access beacon.'},
 {id:'grip',name:'Rope grip',price:150,description:'A wider rope grab and a stronger release jump.'}
];
export const COSTUMES={original:'Original RAHBE',riverwalk:'Riverwalk teal','vault-gold':'Vault gold'};
export function readProfile(value){
 const source=value&&typeof value==='object'?value:{};
 const unlocks=['original',...Object.keys(COSTUMES).filter(id=>id!=='original'&&Array.isArray(source.unlocks)&&source.unlocks.includes(id))];
 const result=r=>r&&Number.isFinite(r.seconds)&&r.seconds>=0?{...r,medals:Array.isArray(r.medals)?r.medals.filter(m=>['Expedition complete','No signal lost','Detroit explorer','Five-minute descent'].includes(m)):[]}:null;
 return {runs:Math.max(0,Math.floor(Number(source.runs)||0)),best:result(source.best),last:result(source.last),unlocks,costume:unlocks.includes(source.costume)?source.costume:'original',daily:Object.fromEntries(Object.entries(source.daily&&typeof source.daily==='object'?source.daily:{}).filter(([key,r])=>/^\d+$/.test(key)&&result(r)).map(([key,r])=>[key,result(r)]))};
}
export function buyUpgrade(s,id){const u=UPGRADES.find(u=>u.id===id);if(!u||s.upgrades[id]||s.coins<u.price)return false;s.coins-=u.price;s.upgrades[id]=true;if(id==='shield')s.shield=1;s.saveRevision++;return true;}
export function seedForDay(day=new Date().toISOString().slice(0,10)){let seed=2166136261;for(const c of day)seed=Math.imul(seed^c.charCodeAt(0),16777619);return seed>>>0;}
export function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function runMedals(s){return ['Expedition complete',...(s.deaths===0?['No signal lost']:[]),...(s.secrets===2?['Detroit explorer']:[]),...(s.time<300?['Five-minute descent']:[])];}
export function recordRun(s,old={runs:0,best:null,unlocks:['original']}){
 const result={seconds:Math.round(s.time*10)/10,relics:s.coins,kills:s.kills,secrets:s.secrets,deaths:s.deaths,mode:s.runMode,seed:s.seed,medals:runMedals(s)};
 const best=!old.best||result.seconds<old.best.seconds?result:old.best;
 const unlocks=[...new Set([...old.unlocks,'riverwalk',...(s.secrets===2?['vault-gold']:[])])];
 const daily={...(old.daily||{})};if(s.runMode==='daily'){const id=String(s.seed);if(!daily[id]||result.seconds<daily[id].seconds)daily[id]=result;}
 return {...old,runs:(old.runs||0)+1,best,last:result,unlocks,daily};
}
