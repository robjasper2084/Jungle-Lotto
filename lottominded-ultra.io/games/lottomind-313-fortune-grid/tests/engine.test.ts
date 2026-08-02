import { describe, expect, it } from "vitest";
import { boardNodes, specialNodeCount } from "../app/src/content/board";
import { cityPulseCards, oracleCards } from "../app/src/content/cards";
import { districts } from "../app/src/content/districts";
import { ventures } from "../app/src/content/ventures";
import { chooseCpuAction, chooseRoute } from "../app/src/engine/ai";
import { reducer } from "../app/src/engine/reducer";
import { completedNetworks } from "../app/src/engine/economy";
import { findRoutes, isLegalRoute } from "../app/src/engine/movement";
import { randomInt } from "../app/src/engine/rng";
import { scorePlayer } from "../app/src/engine/scoring";
import { appendSignal, reorderSignal, replaceSignal, signalMatches, sortSignal } from "../app/src/engine/signals";
import { createInitialState, RULESET_VERSION } from "../app/src/engine/state";
import { migrateState } from "../app/src/services/storage";
import { createRewardClaim } from "../app/src/services/rewards";

describe("Fortune Grid content",()=>{
  it("has 36 nodes, 24 ventures, and exactly 12 special nodes",()=>{expect(boardNodes).toHaveLength(36);expect(ventures).toHaveLength(24);expect(specialNodeCount).toBe(12);expect(districts).toHaveLength(8)});
  it("contains 24 original safe cards in each deck",()=>{expect(cityPulseCards).toHaveLength(24);expect(oracleCards).toHaveLength(24);expect(new Set(cityPulseCards.map(c=>c.title)).size).toBe(24);expect(new Set(oracleCards.map(c=>c.title)).size).toBe(24)});
});
describe("deterministic rules",()=>{
  it("reproduces seeded values",()=>{let a=313,b=313;for(let i=0;i<50;i++){const x=randomInt(a,0,9),y=randomInt(b,0,9);expect(x).toEqual(y);a=x.state;b=y.state}});
  it("produces legal route and intersection choices",()=>{const routes=findRoutes(4,3,4);expect(routes.length).toBeGreaterThan(1);routes.forEach(route=>expect(isLegalRoute(route,4)).toBe(true))});
  it("prevents double roll activation",()=>{const start=createInitialState({mode:"quick313",playerCount:2,localPlayers:1,seed:313});const rolled=reducer(start,{type:"ROLL"});expect(reducer(rolled,{type:"ROLL"})).toEqual(rolled)});
  it("launches and upgrades a venture",()=>{let s=createInitialState({mode:"quick313",playerCount:2,localPlayers:1,seed:313});const node=boardNodes.find(n=>n.kind==="venture")!;s.players[0].nodeId=node.id;s.phase="action";s=reducer(s,{type:"LAUNCH_VENTURE"});expect(s.players[0].ventures[node.ventureId!]).toBe(1);s.players[0].dollars=9999;s=reducer(s,{type:"UPGRADE_VENTURE",ventureId:node.ventureId!});expect(s.players[0].ventures[node.ventureId!]).toBe(2)});
  it("charges collaboration fees without infinite negative balance",()=>{let s=createInitialState({mode:"quick313",playerCount:2,localPlayers:2,seed:313});const node=boardNodes.find(n=>n.kind==="venture")!;s.players[1].ventures[node.ventureId!]=2;s.players[0].nodeId=0;s.players[0].dollars=20;s.phase="moving";s.pendingRoll={movement:1,signal:3,routes:[[0,node.id]]};s=reducer(s,{type:"COMPLETE_MOVEMENT",route:[0,node.id]});expect(s.players[0].dollars).toBe(0);expect(s.players[1].dollars).toBe(1333)});
  it("completes district networks",()=>{const s=createInitialState({mode:"quick313",playerCount:2,localPlayers:2,seed:313});ventures.filter(v=>v.district===districts[0].id).forEach(v=>s.players[0].ventures[v.id]=1);expect(completedNetworks(s.players[0])).toBe(1)});
  it("supports trade, sponsorship, partnership, and sell back",()=>{let s=createInitialState({mode:"quick313",playerCount:2,localPlayers:2,seed:313});s.phase="action";s.players[0].ventures[0]=1;s=reducer(s,{type:"SPONSOR_VENTURE",ventureId:0});expect(s.players[0].legacy).toBe(3);s=reducer(s,{type:"PARTNER_VENTURE",ventureId:0});expect(s.players[0].dollars).toBeGreaterThan(1313);s=reducer(s,{type:"TRADE_VENTURE",ventureId:0,targetPlayer:1});expect(s.players[1].ventures[0]).toBe(1);s.currentPlayer=1;s=reducer(s,{type:"SELL_VENTURE",ventureId:0});expect(s.players[1].ventures[0]).toBeUndefined()});
  it("enters and recovers from Rebuild Mode",()=>{let s=createInitialState({mode:"quick313",playerCount:2,localPlayers:1,seed:313});const grant=boardNodes.find(n=>n.kind==="grant")!;const start=grant.edges[0];s.players[0].nodeId=start;s.players[0].dollars=0;s.players[0].rebuild=true;s.phase="moving";s.pendingRoll={movement:1,signal:3,routes:[[start,grant.id]]};s=reducer(s,{type:"COMPLETE_MOVEMENT",route:[start,grant.id]});expect(s.players[0].dollars).toBe(160);expect(s.players[0].rebuild).toBe(true);s.players[0].dollars=180;s.phase="moving";s.pendingRoll={movement:1,signal:4,routes:[[grant.id,start]]};s=reducer(s,{type:"COMPLETE_MOVEMENT",route:[grant.id,start]});expect(s.players[0].rebuild).toBe(false)});
  it("supports signal strip operations and reproducible draw comparison",()=>{expect(appendSignal([1,2,3,4],5)).toEqual([2,3,4,5]);expect(reorderSignal([1,2,3],0,2)).toEqual([2,3,1]);expect(replaceSignal([1,2,3],1,9)).toEqual([1,9,3]);expect(sortSignal([8,2,5])).toEqual([2,5,8]);expect(signalMatches([3,1,3],[3,1,4])).toBe(2)});
  it("selects legal CPU routes and actions",()=>{let s=createInitialState({mode:"quick313",playerCount:2,localPlayers:0,seed:313});s=reducer(s,{type:"ROLL"});const route=chooseRoute(s);expect(isLegalRoute(route,s.pendingRoll!.movement)).toBe(true);s.phase="action";expect(["LAUNCH_VENTURE","UPGRADE_VENTURE","END_TURN"]).toContain(chooseCpuAction(s).type)});
  it("ends after thirteen rounds and scores each component",()=>{let s=createInitialState({mode:"standard",playerCount:2,localPlayers:2,seed:313});s.round=13;s.currentPlayer=1;s.phase="action";s=reducer(s,{type:"END_TURN"});expect(s.phase).toBe("ended");expect(scorePlayer(s.players[0]).total).toBeGreaterThanOrEqual(0)});
  it("serializes, resumes, and migrates state",()=>{const s=createInitialState({mode:"standard",playerCount:2,localPlayers:1,seed:313});expect(JSON.parse(JSON.stringify(s)).seed).toBe(313);const old:any={...s,rulesetVersion:"0",settings:undefined};expect(migrateState(old).rulesetVersion).toBe(RULESET_VERSION)});
  it("builds stable reward idempotency client data without issuing credits",async()=>{const s=createInitialState({mode:"daily",playerCount:2,localPlayers:1,seed:313});const a=await createRewardClaim(s,"user-1",42);const b=await createRewardClaim(s,"user-1",42);expect(a.idempotencyKey).toBe(b.idempotencyKey);expect(a.actionLogHash).toBe(b.actionLogHash)});
});
