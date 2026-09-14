// Browser-only discount estimates. These receipts never authorize redemption.
import {REWARD_GAMES} from './games.js';
export const DISCOUNT_PREVIEW_KEY='gothtechnology.arcade.discount-preview.v2';
export const LEGACY_DISCOUNT_KEY='gothtechnology.underground.discount-preview.v1';
export const DISCOUNT_TIERS=Object.freeze([{points:12000,percent:5},{points:30000,percent:10},{points:60000,percent:15},{points:120000,percent:20}].map(tier=>Object.freeze(tier)));
const ids=new Set(REWARD_GAMES.map(game=>game.id));
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
export function validScore(value){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;}
export function discountProgress(value){const totalPoints=validScore(value),percent=DISCOUNT_TIERS.reduce((n,t)=>totalPoints>=t.points?t.percent:n,0),next=DISCOUNT_TIERS.find(t=>t.points>totalPoints)??null;return {totalPoints,percent,next,remaining:next?next.points-totalPoints:0};}
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} PreviewStorage */
/** @returns {PreviewStorage|null} */
export function previewStorage(){try{return window.localStorage;}catch{return null;}}
const empty=()=>({version:2,carriedPoints:0,runs:{}});
let session=empty();
const unsaved=new WeakMap();
const migrations=new WeakMap();
function sanitize(raw){
  const out=empty();if(raw?.version!==2)return out;
  out.carriedPoints=validScore(raw.carriedPoints);
  for(const [key,run] of Object.entries(raw.runs??{})){
    if(!run||!ids.has(run.game)||!safeId(run.runId)||key!==run.game+':'+run.runId)continue;
    out.runs[key]={game:run.game,runId:run.runId,score:validScore(run.score),baseline:validScore(run.baseline)};
  }
  return out;
}
function migrate(storage){
  const out=empty();
  let legacy=null;
  try{legacy=storage?.getItem(LEGACY_DISCOUNT_KEY)??null;const cached=storage&&migrations.get(storage);if(cached&&cached.legacy===legacy)return structuredClone(cached.record);const old=JSON.parse(legacy??'null');out.carriedPoints=old?.version===1?validScore(old.bestScore):0;}catch{}
  // A continued legacy checkpoint was already reflected in the old best score.
  if(out.carriedPoints)try{const run=JSON.parse(storage?.getItem('rahbe-underground-v1-arcade-run')??'null');if(safeId(run?.runId)){const score=validScore(run.score);out.runs['underground:'+run.runId]={game:'underground',runId:run.runId,score,baseline:score};}}catch{}
  if(storage)migrations.set(storage,{legacy,record:structuredClone(out)});
  return out;
}
function readRecord(storage){
  if(!storage)return {record:session,saved:false};
  if(unsaved.has(storage))return {record:unsaved.get(storage),saved:false};
  try{const raw=storage.getItem(DISCOUNT_PREVIEW_KEY);return {record:raw?sanitize(JSON.parse(raw)):migrate(storage),saved:true};}
  catch{return {record:session,saved:false};}
}
function summarize(record,saved){
  const games=Object.fromEntries(REWARD_GAMES.map(game=>[game.id,{points:0,runs:0}]));
  let total=record.carriedPoints;
  for(const run of Object.values(record.runs)){const points=Math.max(0,run.score-run.baseline);games[run.game].points+=points;games[run.game].runs++;total+=points;}
  return {...discountProgress(Math.min(Number.MAX_SAFE_INTEGER,total)),games,carriedPoints:record.carriedPoints,saved};
}
export function readDiscountPreview(storage=previewStorage()){const {record,saved}=readRecord(storage);return summarize(record,saved);}
export function validRun(game,snapshot){
  return ids.has(game)&&snapshot&&safeId(snapshot.runId)&&validScore(snapshot.score)===snapshot.score&&Number.isFinite(snapshot.seconds)&&snapshot.seconds>=0&&(snapshot.score>0||snapshot.seconds>=1)&&['playing','paused','dead','won','results','gameover','victory','matchEnd'].includes(snapshot.mode)&&snapshot.debug!==true&&snapshot.training!==true&&snapshot.replay!==true;
}
// Synchronous reducer for tests and non-browser environments. Browser writers use
// bankGameProgress, which serializes read/modify/write across tabs with Web Locks.
export function recordGameProgress(game,snapshot,storage=previewStorage()){
  const {record,saved:wasSaved}=readRecord(storage);if(!validRun(game,snapshot))return summarize(record,wasSaved);
  const key=game+':'+snapshot.runId,previous=record.runs[key];
  if(previous&&snapshot.score<=previous.score)return summarize(record,wasSaved);
  record.runs[key]={game,runId:snapshot.runId,score:Math.max(snapshot.score,previous?.score??0),baseline:previous?.baseline??0};
  let saved=false;try{if(storage){storage.setItem(DISCOUNT_PREVIEW_KEY,JSON.stringify(record));saved=true;}}catch{}
  if(storage){if(saved)unsaved.delete(storage);else unsaved.set(storage,record);}
  session=record;return summarize(record,saved);
}
export async function bankGameProgress(game,snapshot){
  const copy={...snapshot};
  const write=()=>recordGameProgress(game,copy);
  let state;
  try{state=globalThis.navigator?.locks?await navigator.locks.request(DISCOUNT_PREVIEW_KEY,write):write();}catch{state=write();}
  if(typeof document!=='undefined')document.dispatchEvent(new CustomEvent('store:discount-preview',{detail:state}));
  if(typeof document!=='undefined'&&validRun(game,copy))document.dispatchEvent(new CustomEvent('store:game-progress',{detail:{game,runId:copy.runId,mode:copy.mode}}));
  return state;
}
export function fighterReceipt(game){
  if(!game||game.phase!=='matchEnd'||game.training||game.isReplay||game.debug||game.rewardTotalTicks<1800||!(game.rewardMatchActions>=1)||!game.matchWinner)return null;
  return {runId:game.rewardMatchKey,mode:'matchEnd',seconds:Math.floor(game.rewardTotalTicks/60),score:game.matchWinner===game.fighters?.[0]?5000:2500};
}
export function discountEstimate(score,subtotal){const amount=validScore(subtotal),percent=discountProgress(score).percent,saving=Math.floor(amount/100)*percent+Math.round((amount%100)*percent/100);return {percent,saving,total:amount-saving};}
