import { RULESET_VERSION, type GameState } from "../engine/state";
const KEY="lottomind.fortune-grid.save.v1";
export function saveGame(state:GameState){localStorage.setItem(KEY,JSON.stringify(state));}
export function loadGame():GameState|null{try{const parsed=JSON.parse(localStorage.getItem(KEY)||"null");return parsed?migrateState(parsed):null;}catch{return null;}}
export function clearSave(){localStorage.removeItem(KEY);}
export function migrateState(value:any):GameState{if(!value.settings)value.settings={reducedMotion:false,particles:true,highContrast:false,textScale:1,muted:true};for(const player of value.players||[])if(!Array.isArray(player.lockedSignals))player.lockedSignals=[];value.rulesetVersion=RULESET_VERSION;return value as GameState;}
