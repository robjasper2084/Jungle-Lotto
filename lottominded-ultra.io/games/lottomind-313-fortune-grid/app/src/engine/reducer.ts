import { boardNodes } from "../content/board";
import { cityPulseCards, oracleCards } from "../content/cards";
import { ventures } from "../content/ventures";
import { collaborationFee, hasNetwork, upgradeCost, ventureOwner } from "./economy";
import { isLegalRoute, findRoutes } from "./movement";
import { randomInt } from "./rng";
import { appendSignal, reorderSignal, replaceSignal, sortSignal } from "./signals";
import type { GameAction } from "./actions";
import type { GameState, MatchEvent, Player } from "./state";

function clone(state:GameState):GameState { return structuredClone(state); }
function log(state:GameState, action:GameAction, message:string, payload?:Record<string,unknown>) { state.actionLog.push(JSON.stringify(action)); const event:MatchEvent={id:state.eventLog.length+1,type:action.type,message,playerId:state.players[state.currentPlayer]?.id,payload}; state.eventLog.push(event); }
function current(state:GameState):Player { return state.players[state.currentPlayer]; }
function applyCard(state:GameState, type:"pulse"|"oracle", cardIndex:number) { const card=(type==="pulse"?cityPulseCards:oracleCards)[cardIndex%24]; const player=current(state); if(card.effect==="dollars")player.dollars+=card.amount;if(card.effect==="legacy")player.legacy+=card.amount;if(card.effect==="focus")player.focus+=card.amount;state.activeCard={type,id:card.id};log(state,{type:"DISMISS_CARD"},`${card.title}: ${card.text}`,{cardId:card.id}); }

export function reducer(state:GameState, action:GameAction):GameState {
  const next=clone(state); const player=current(next);
  if(action.type==="SETTINGS"){next.settings={...next.settings,...action.patch};return next;}
  if(next.phase==="ended")return next;
  switch(action.type){
    case "ROLL": { if(next.phase!=="roll"||next.pendingRoll)return state; const move=randomInt(next.rngState,1,6); const signal=randomInt(move.state,0,9); next.rngState=signal.state; const routes=findRoutes(player.nodeId,player.previousNodeId,move.value); next.pendingRoll={movement:move.value,signal:signal.value,routes};next.phase=routes.length>1&&!player.cpu?"route":"moving";log(next,action,`${player.name} rolled Movement ${move.value} and Signal ${signal.value}.`);return next; }
    case "CHOOSE_ROUTE": { if(next.phase!=="route"||!next.pendingRoll||!next.pendingRoll.routes.some((r)=>r.join()===action.route.join()))return state;next.phase="moving";log(next,action,`${player.name} selected a route.`);return next; }
    case "COMPLETE_MOVEMENT": { if(next.phase!=="moving"||!next.pendingRoll||!isLegalRoute(action.route,next.pendingRoll.movement))return state; const destination=action.route.at(-1)!;player.previousNodeId=action.route.at(-2)??player.previousNodeId;player.nodeId=destination;player.signals=appendSignal(player.signals,next.pendingRoll.signal);const node=boardNodes[destination];log(next,action,`${player.name} arrived at ${node.kind==="venture"?ventures[node.ventureId!].name:node.label}.`,{path:action.route,signal:next.pendingRoll.signal});
      if(node.kind==="venture"){const owner=ventureOwner(next,node.ventureId!);if(owner&&owner.id!==player.id){const fee=Math.min(player.dollars,collaborationFee(node.ventureId!,owner.ventures[node.ventureId!]));player.dollars-=fee;owner.dollars+=fee;log(next,action,`${player.name} paid ${fee} Detroit Dollars as a Collaboration Fee to ${owner.name}.`);}}
      if(node.kind==="pulse"||node.kind==="oracle"){const draw=randomInt(next.rngState,0,23);next.rngState=draw.state;applyCard(next,node.kind,draw.value);}
      if(node.kind==="signal"){player.focus+=1;player.legacy+=1;} if(node.kind==="grant"){player.dollars+=player.rebuild?160:70;player.legacy+=1;} if(node.kind==="hub"){player.dollars+=100;} if(node.kind==="transit"){player.focus+=1;} if(node.kind==="studio"){player.focus+=1;} if(node.kind==="lab"){player.focus+=1;}
      next.pendingRoll=null;next.phase="action";if(player.dollars<=0)player.rebuild=true;if(player.rebuild&&player.dollars>=180)player.rebuild=false;return next; }
    case "LAUNCH_VENTURE": {const node=boardNodes[player.nodeId];if(next.phase!=="action"||node.kind!=="venture"||ventureOwner(next,node.ventureId!)||player.rebuild)return state;const venture=ventures[node.ventureId!];if(player.dollars<venture.launchCost)return state;player.dollars-=venture.launchCost;player.ventures[venture.id]=1;player.legacy+=2;if(hasNetwork(player,venture.district))player.legacy+=8;log(next,action,`${player.name} launched ${venture.name} as a Pop-Up.`);return next;}
    case "UPGRADE_VENTURE": {const level=player.ventures[action.ventureId]||0;if(next.phase!=="action"||level<1||level>=4)return state;const cost=upgradeCost(action.ventureId,level,player);if(player.dollars<cost)return state;player.dollars-=cost;player.ventures[action.ventureId]=level+1;player.legacy+=2;log(next,action,`${player.name} upgraded ${ventures[action.ventureId].name}.`);return next;}
    case "SELL_VENTURE": {const level=player.ventures[action.ventureId];if(!level)return state;player.dollars+=Math.floor(upgradeCost(action.ventureId,level,player)*.6);delete player.ventures[action.ventureId];log(next,action,`${player.name} sold back ${ventures[action.ventureId].name}.`);return next;}
    case "SPONSOR_VENTURE": {if(!player.ventures[action.ventureId]||player.focus<1)return state;player.focus--;player.legacy+=3;log(next,action,`${player.name} sponsored a community program at ${ventures[action.ventureId].name}.`);return next;}
    case "PARTNER_VENTURE": {const level=player.ventures[action.ventureId];if(!level)return state;player.dollars+=60;player.legacy+=1;log(next,action,`${player.name} formed a temporary partnership at ${ventures[action.ventureId].name}.`);return next;}
    case "TRADE_VENTURE": {if(!player.ventures[action.ventureId]||!next.players[action.targetPlayer])return state;next.players[action.targetPlayer].ventures[action.ventureId]=player.ventures[action.ventureId];delete player.ventures[action.ventureId];player.dollars+=80;next.players[action.targetPlayer].dollars-=Math.min(80,next.players[action.targetPlayer].dollars);log(next,action,`${player.name} traded ${ventures[action.ventureId].name}.`);return next;}
    case "SIGNAL_REORDER": {player.signals=reorderSignal(player.signals,action.from,action.to);log(next,action,`${player.name} reordered the Signal Strip.`);return next;}
    case "SIGNAL_REPLACE": {if(player.focus<1||action.digit<0||action.digit>9)return state;player.signals=replaceSignal(player.signals,action.index,action.digit);player.focus--;log(next,action,`${player.name} replaced a Signal digit using Focus.`);return next;}
    case "SIGNAL_SORT": {player.signals=sortSignal(player.signals);log(next,action,`${player.name} sorted the Signal Strip.`);return next;}
    case "SAVE_SEQUENCE": {if(player.signals.length<3)return state;player.savedSequences.push([...player.signals]);log(next,action,`${player.name} saved an entertainment-only number idea.`);return next;}
    case "BEAT_RESULT": {const boost=Math.max(0,Math.min(4,action.hits));player.focus+=boost>=3?2:1;player.legacy+=boost;log(next,action,`${player.name} completed the Beat Studio with ${boost} timed hits.`);return next;}
    case "DISMISS_CARD": {next.activeCard=null;return next;}
    case "END_TURN": {if(next.phase!=="action")return state;next.activeCard=null;next.currentPlayer=(next.currentPlayer+1)%next.players.length;if(next.currentPlayer===0)next.round++;if(next.round>next.maxRounds){next.phase="ended";next.completedAt=Date.now();log(next,action,"The match is complete. Final scores are ready.");}else{const upcoming=current(next);if(hasNetwork(upcoming,"eastside"))upcoming.dollars+=25;if(next.currentPlayer===0&&hasNetwork(upcoming,"legacy"))upcoming.legacy+=2;next.phase="roll";log(next,action,`${upcoming.name}'s turn begins.`);}return next;}
    default:return state;
  }
}
