import { boardNodes } from "../content/board";
import { ventures } from "../content/ventures";
import { upgradeCost, ventureOwner } from "./economy";
import type { GameAction } from "./actions";
import type { GameState } from "./state";

export function chooseRoute(state:GameState):number[]{const player=state.players[state.currentPlayer];const routes=state.pendingRoll?.routes||[];return [...routes].sort((a,b)=>routeValue(state,b.at(-1)!,player.personality)-routeValue(state,a.at(-1)!,player.personality))[0]||[];}
function routeValue(state:GameState,nodeId:number,personality?:string):number{const node=boardNodes[nodeId];if(node.kind==="venture"&&!ventureOwner(state,node.ventureId!))return personality==="Builder"?8:5;if(node.kind==="oracle")return personality==="Visionary"?8:3;if(node.kind==="lab"||node.kind==="signal")return personality==="Analyst"?8:4;if(node.kind==="studio")return personality==="Creator"?8:4;return 2;}
export function chooseCpuAction(state:GameState):GameAction {const player=state.players[state.currentPlayer];const node=boardNodes[player.nodeId];if(node.kind==="venture"&&!ventureOwner(state,node.ventureId!)&&!player.rebuild&&player.dollars>=ventures[node.ventureId!].launchCost)return{type:"LAUNCH_VENTURE"};const upgrade=Object.entries(player.ventures).find(([id,level])=>level<4&&player.dollars>=upgradeCost(Number(id),level,player));if(upgrade)return{type:"UPGRADE_VENTURE",ventureId:Number(upgrade[0])};return{type:"END_TURN"};}
