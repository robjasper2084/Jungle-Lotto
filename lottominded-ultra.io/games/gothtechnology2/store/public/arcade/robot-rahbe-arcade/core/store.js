import {ACHIEVEMENTS,CHALLENGES,periodKey} from '../data/progression.js';
import {PLAYABLE_IDS} from '../data/games.js';
import {FORMATS,generateNumbers} from './numbers.js';
export const STORAGE_KEY='lottomind-rahbe-arcade-v1';
const finite=(v,max=1e9)=>Math.min(max,Math.max(0,Math.floor(Number(v)||0)));
const safeId=v=>typeof v==='string'&&!['__proto__','constructor','prototype'].includes(v)&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)?v:null;
const metrics=['score','kills','shards','seconds','bosses','depth','seals','completions','distance','chips','perfectActions','maxCombo','dashBreaks','vaultTokens','damageTaken','overdriveSeconds','completedRuns','missions','digitMask'];
export function defaults(){return {version:1,profile:{name:'DETROIT EXPLORER',xp:0,kills:0,shardsCollected:0,seconds:0,bosses:0,depth:0,completions:0,runs:0,streak:0,lastPlayed:'',gamesPlayed:0,runnerBestDistance:0,runnerPerfect:0,runnerRuns:0,runnerChips:0,runnerVaults:0,runnerDigitMask:0,runnerBestCombo:0,runnerUntouched:0,runnerOverdrive:0},wallet:{credits:0,shards:0,keys:0},settings:{sound:true,music:true,volume:.65,reducedMotion:false,reducedShake:false,highContrast:false,crt:false,particles:true,reducedFlashing:false,largeHUD:false,warnings:true,quality:'high',sfxVolume:1,musicVolume:.5},games:{},ledger:{},achievements:[],challenges:{},vaults:[],history:[]};}
export function sanitize(data){
 if(!data||data.version!==1)throw new Error('This save format is not supported.');
 const out=defaults();out.profile.name=String(data.profile?.name||out.profile.name).slice(0,28).replace(/[<>\u0000-\u001f]/g,'');
 for(const key of Object.keys(out.profile))if(typeof out.profile[key]==='number')out.profile[key]=finite(data.profile?.[key]);
 out.profile.lastPlayed=/^\d{4}-\d{2}-\d{2}$/.test(data.profile?.lastPlayed)?data.profile.lastPlayed:'';
 for(const key of Object.keys(out.wallet))out.wallet[key]=finite(data.wallet?.[key]);
 for(const key of Object.keys(out.settings))if(key!=='volume'&&typeof data.settings?.[key]==='boolean')out.settings[key]=data.settings[key];
 out.settings.volume=Math.min(1,Math.max(0,Number.isFinite(data.settings?.volume)?data.settings.volume:.65));
 for(const k of ['sfxVolume','musicVolume'])out.settings[k]=Math.min(1,Math.max(0,Number.isFinite(data.settings?.[k])?data.settings[k]:out.settings[k]));out.settings.quality=['low','medium','high'].includes(data.settings?.quality)?data.settings.quality:'high';
 for(const id of PLAYABLE_IDS)if(data.games?.[id]){const v=data.games[id];out.games[id]={best:finite(v.best),runs:finite(v.runs),seconds:finite(v.seconds),lastPlayed:String(v.lastPlayed||'').slice(0,10),bestDistance:finite(v.bestDistance),highestCombo:finite(v.highestCombo),vaultsOpened:finite(v.vaultsOpened),daily:{period:String(v.daily?.period||'').slice(0,10),distance:finite(v.daily?.distance)},weekly:{period:String(v.weekly?.period||'').slice(0,10),distance:finite(v.weekly?.distance)},tutorialComplete:v.tutorialComplete===true};}
 for(const [id,v] of Object.entries(data.ledger||{}).slice(-1000)){if(!safeId(id)||!PLAYABLE_IDS.includes(v.game))continue;out.ledger[id]={game:v.game,...Object.fromEntries(metrics.map(k=>[k,finite(v[k])])),dropClaimed:v.dropClaimed===true};}
 out.achievements=(Array.isArray(data.achievements)?data.achievements:[]).filter(id=>ACHIEVEMENTS.some(a=>a.id===id));
 for(const [id,v] of Object.entries(data.challenges||{})){if(!CHALLENGES.some(c=>c.id===id)||!/^\d{4}-\d{2}-\d{2}$/.test(v.period))continue;out.challenges[id]={period:v.period,value:finite(v.value),claimed:v.claimed===true};}
 out.vaults=(Array.isArray(data.vaults)?data.vaults:[]).slice(0,100).filter(v=>safeId(v.id)&&FORMATS[v.format]&&Array.isArray(v.numbers)&&v.numbers.length===FORMATS[v.format].count&&v.numbers.every(n=>Number.isInteger(n)&&n>=(FORMATS[v.format].digits?0:1)&&n<=FORMATS[v.format].max)&&(!FORMATS[v.format].bonus||Number.isInteger(v.bonus)&&v.bonus>=1&&v.bonus<=FORMATS[v.format].bonus)).map(v=>({id:v.id,format:v.format,numbers:v.numbers,bonus:v.bonus??null,created:String(v.created||'').slice(0,10),source:PLAYABLE_IDS.includes(v.source)?v.source:'arcade',score:finite(v.score)}));
 out.history=(Array.isArray(data.history)?data.history:[]).slice(0,30).filter(v=>safeId(v.id)&&PLAYABLE_IDS.includes(v.game)).map(v=>({id:v.id,game:v.game,score:finite(v.score),seconds:finite(v.seconds),outcome:['won','dead','results'].includes(v.outcome)?v.outcome:'saved',date:String(v.date||'').slice(0,10)}));
 return out;
}
export class ArcadeStore {
 constructor(storage=globalThis.localStorage,key=STORAGE_KEY){this.storage=storage;this.key=key;this.error='';try{const raw=storage.getItem(key);this.state=raw?sanitize(JSON.parse(raw)):defaults();}catch{this.state=defaults();this.error='Your saved profile could not be read. Existing save data has been left untouched.';this.readFailed=true;}}
 save(){if(this.readFailed)return false;try{this.storage.setItem(this.key,JSON.stringify(this.state));this.error='';return true;}catch{this.error='Browser storage is unavailable. This session can still be played.';return false;}}
 updateSettings(values){Object.assign(this.state.settings,sanitize({...this.state,settings:{...this.state.settings,...values}}).settings);this.save();}
 rename(name){this.state.profile.name=String(name).replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,28)||'DETROIT EXPLORER';this.save();}
 import(raw){if(raw.length>2e6)throw new Error('Save file is too large.');this.state=sanitize(JSON.parse(raw));this.readFailed=false;this.save();}
 record(game,snapshot,now=new Date()){
  if(!PLAYABLE_IDS.includes(game)||!safeId(snapshot?.runId)||snapshot.seconds<=0)return null;
  const s=this.state,id=snapshot.runId,previous=s.ledger[id];if(previous&&previous.game!==game)return null;
  const next={game,dropClaimed:previous?.dropClaimed===true,...Object.fromEntries(metrics.map(k=>[k,Math.max(finite(snapshot[k]),previous?.[k]||0)]))};
  const delta=Object.fromEntries(metrics.map(k=>[k,next[k]-(previous?.[k]||0)]));
  if(previous&&metrics.every(k=>delta[k]===0))return null;
  const p=s.profile,day=periodKey('day',now);
  if(!previous){p.runs++;s.games[game]??={best:0,runs:0,seconds:0,lastPlayed:''};s.games[game].runs++;if(p.lastPlayed!==day){const yesterday=new Date(now);yesterday.setUTCDate(yesterday.getUTCDate()-1);p.streak=p.lastPlayed===periodKey('day',yesterday)?p.streak+1:1;p.lastPlayed=day;}}
  p.gamesPlayed=Object.values(s.games).filter(g=>g.runs>0).length;
  p.kills+=delta.kills;p.shardsCollected+=delta.shards;p.seconds+=delta.seconds;p.bosses+=delta.bosses;p.completions+=delta.completions;p.depth=Math.max(p.depth,next.depth);
  if(game==='vault-rush'){p.runnerBestDistance=Math.max(p.runnerBestDistance,next.distance);p.runnerPerfect=Math.max(p.runnerPerfect,next.perfectActions);p.runnerBestCombo=Math.max(p.runnerBestCombo,next.maxCombo);p.runnerRuns+=delta.completedRuns;p.runnerChips+=delta.chips;p.runnerDigitMask=Math.max(p.runnerDigitMask,next.digitMask);p.runnerOverdrive=Math.max(p.runnerOverdrive,next.overdriveSeconds);if(next.damageTaken===0)p.runnerUntouched=Math.max(p.runnerUntouched,next.distance);}
  const earned={xp:delta.kills*5+delta.shards+delta.depth*25+delta.bosses*100+delta.completions*250+delta.missions*75+delta.vaultTokens*150,shards:delta.shards+delta.missions*20,credits:delta.kills+Math.floor(next.score/1000)-Math.floor((previous?.score||0)/1000)+delta.completions*50,keys:delta.vaultTokens+delta.bosses+Math.floor(next.seals/3)-Math.floor((previous?.seals||0)/3)};
  const unlocked=[];for(const a of ACHIEVEMENTS)if(!s.achievements.includes(a.id)&&p[a.metric]>=a.target){s.achievements.push(a.id);unlocked.push(a.title);earned.xp+=50;}
  const completed=[];for(const c of CHALLENGES){const period=periodKey(c.period,now);let progress=s.challenges[c.id];if(progress?.period!==period)progress=s.challenges[c.id]={period,value:0,claimed:false};progress.value+=c.game&&c.game!==game?0:c.metric==='shardsCollected'?delta.shards:delta[c.metric]||0;if(progress.value>=c.target&&!progress.claimed){progress.claimed=true;earned.xp+=c.xp;earned.shards+=c.shards;earned.keys+=c.keys;completed.push(c.title);}}
  p.xp+=earned.xp;for(const k of ['credits','shards','keys'])s.wallet[k]+=earned[k];
  if(game==='vault-rush'){const g=s.games[game];g.bestDistance=Math.max(g.bestDistance||0,next.distance);g.highestCombo=Math.max(g.highestCombo||0,next.maxCombo);for(const period of ['day','week']){const k=period==='day'?'daily':'weekly',current=periodKey(period,now);if(g[k]?.period!==current)g[k]={period:current,distance:0};g[k].distance=Math.max(g[k].distance,next.distance);}}
  s.games[game].best=Math.max(s.games[game].best,next.score);s.games[game].seconds+=delta.seconds;s.games[game].lastPlayed=day;s.ledger[id]=next;
  // Local gameplay receipts prevent repeated settlement on polling, exit, or reload.
  // These are untrusted browser saves, never a source of real account credits.
  this.save();return {...earned,unlocked,completed};
 }
 finish(game,snapshot){this.record(game,snapshot);if(!snapshot?.runId||!snapshot.seconds)return;const entry={id:snapshot.runId,game,score:finite(snapshot.score),seconds:finite(snapshot.seconds),outcome:snapshot.mode||'saved',date:periodKey('day')};this.state.history=[entry,...this.state.history.filter(v=>v.id!==entry.id)].slice(0,30);this.save();}
 openVault(format,source='arcade',score=0,persist=true){if(!FORMATS[format])throw new Error('Choose a number format.');if(this.state.wallet.keys<1)throw new Error('Earn a vault key by completing a challenge or defeating a boss.');const card={id:crypto.randomUUID(),...generateNumbers(format),source,score:finite(score),created:periodKey('day')};this.state.wallet.keys--;this.state.vaults.unshift(card);this.state.vaults=this.state.vaults.slice(0,100);if(persist)this.save();return card;}
 openRunVault(format,runId){const receipt=this.state.ledger[runId];if(!receipt||receipt.game!=='vault-rush'||receipt.vaultTokens<1||receipt.dropClaimed)throw new Error('This run has no unclaimed vault drop.');if(this.state.wallet.keys<1)throw new Error('The earned key has already been spent.');const card=this.openVault(format,'vault-rush',receipt.score,false);receipt.dropClaimed=true;this.state.profile.runnerVaults++;const g=this.state.games['vault-rush'];g.vaultsOpened=(g.vaultsOpened||0)+1;const a=ACHIEVEMENTS.find(a=>a.id==='vr-vault');if(!this.state.achievements.includes(a.id)){this.state.achievements.push(a.id);this.state.profile.xp+=50;}this.save();return card;}
 setTutorialComplete(game){if(!PLAYABLE_IDS.includes(game))return;this.state.games[game]??={best:0,runs:0,seconds:0,lastPlayed:''};this.state.games[game].tutorialComplete=true;this.save();}
}
