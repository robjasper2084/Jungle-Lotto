export const MISSIONS=[{id:'city-runner',label:'Reach 1,500 m',metric:'distance',target:1500},{id:'relic-hunt',label:'Collect 200 shards',metric:'shards',target:200},{id:'signal-breaker',label:'Destroy 20 enemies',metric:'kills',target:20}];
export function score(s){return Math.floor(s.distance/10)*10+s.points;}
export function rank(s){const value=s.distance/10+s.kills*25+s.perfectActions*40+s.bestCombo*12-s.damageTaken*70;return value>=12000?'S+':value>=6500?'S':value>=3500?'A':value>=1500?'B':value>=450?'C':'D';}
export function missionState(s){return MISSIONS.map(m=>({...m,value:m.metric==='distance'?Math.floor(s.distance/10):s[m.metric],done:(m.metric==='distance'?s.distance/10:s[m.metric])>=m.target}));}
