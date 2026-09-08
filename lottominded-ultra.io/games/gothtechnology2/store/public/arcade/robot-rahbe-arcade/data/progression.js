export const ACHIEVEMENTS=[
 {id:'first-signal',title:'First signal',description:'Defeat your first enemy.',metric:'kills',target:1},
 {id:'relic-runner',title:'Relic runner',description:'Recover 25 relics or shards.',metric:'shardsCollected',target:25},
 {id:'deep-detroit',title:'Deep Detroit',description:'Reach Underground depth 3.',metric:'depth',target:3},
 {id:'guardian-down',title:'Guardian down',description:'Defeat a boss in the arcade.',metric:'bosses',target:1},
 {id:'city-saved',title:'The city remembers',description:'Complete a campaign.',metric:'completions',target:1},
 {id:'one-hero',title:'One hero. Two worlds.',description:'Play two games in the arcade.',metric:'gamesPlayed',target:2}
];
ACHIEVEMENTS.push(
 {id:'vr-first-run',title:'First Rush',description:'Finish a Vault Rush run.',metric:'runnerRuns',target:1},
 {id:'vr-city-runner',title:'City Runner',description:'Reach 1,000 m in Vault Rush.',metric:'runnerBestDistance',target:1000},
 {id:'vr-neon-miles',title:'Neon Miles',description:'Reach 5,000 m in Vault Rush.',metric:'runnerBestDistance',target:5000},
 {id:'vr-ten-k',title:'Ten K',description:'Reach 10,000 m in Vault Rush.',metric:'runnerBestDistance',target:10000},
 {id:'vr-perfect',title:'Perfect Flow',description:'Perform 25 perfect actions in one run.',metric:'runnerPerfect',target:25},
 {id:'vr-digits',title:'Number Runner',description:'Collect every digit from 0 to 9 in one run.',metric:'runnerDigitMask',target:1023},
 {id:'vr-vault',title:'Vault Breaker',description:'Open a qualified Vault Rush drop.',metric:'runnerVaults',target:1},
 {id:'vr-untouched',title:'Untouchable',description:'Reach 2,500 m without damage.',metric:'runnerUntouched',target:2500},
 {id:'vr-overdrive',title:'Overdrive',description:'Spend 20 seconds in Overdrive in one run.',metric:'runnerOverdrive',target:20}
);
export const CHALLENGES=[
 {id:'daily-vr-chips',game:'vault-rush',period:'day',title:'Digits of Detroit',description:'Collect five number chips in Vault Rush today.',metric:'chips',target:5,xp:100,shards:40,keys:0},
 {id:'weekly-vr-distance',game:'vault-rush',period:'week',title:'Run the City',description:'Travel 10,000 meters in Vault Rush this week.',metric:'distance',target:10000,xp:250,shards:100,keys:1},
 {id:'daily-relics',period:'day',title:'Detroit salvage',description:'Collect 20 relics or shards today.',metric:'shardsCollected',target:20,xp:100,shards:50,keys:1},
 {id:'weekly-signal',period:'week',title:'Silence the signal',description:'Defeat 50 enemies this week.',metric:'kills',target:50,xp:250,shards:150,keys:1}
];
export function periodKey(period,now=new Date()) {const d=new Date(now);if(period==='week')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
