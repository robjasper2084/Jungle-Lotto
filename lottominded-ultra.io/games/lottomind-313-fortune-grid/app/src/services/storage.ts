import { RULESET_VERSION, type GameState } from "../engine/state";
const KEY="lottomind.fortune-grid.save.v1";
export function saveGame(state:GameState){localStorage.setItem(KEY,JSON.stringify(state));}
export function loadGame():GameState|null{try{const parsed=JSON.parse(localStorage.getItem(KEY)||"null");return parsed?migrateState(parsed):null;}catch{return null;}}
export function clearSave(){localStorage.removeItem(KEY);}
export function migrateState(value:any):GameState{const priorVersion=value.rulesetVersion;if(!value.settings)value.settings={reducedMotion:false,particles:true,highContrast:false,textScale:1,muted:true};for(const player of value.players||[]){if(!Array.isArray(player.lockedSignals))player.lockedSignals=[];if(typeof player.bonusRoll!=="boolean")player.bonusRoll=false;}if(priorVersion!==RULESET_VERSION&&(value.phase==="route"||value.phase==="moving")){value.phase="roll";value.pendingRoll=null;}if(value.pendingRoll&&!Array.isArray(value.pendingRoll.movementDice))value.pendingRoll.movementDice=[value.pendingRoll.movement,0];value.rulesetVersion=RULESET_VERSION;return value as GameState;}
