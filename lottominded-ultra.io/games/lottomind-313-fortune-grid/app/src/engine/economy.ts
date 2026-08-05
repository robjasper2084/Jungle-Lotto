import { districts } from "../content/districts";
import { ventures } from "../content/ventures";
import type { GameState, Player } from "./state";

export function ventureOwner(state: GameState, ventureId: number): Player | undefined { return state.players.find((player)=>player.ventures[ventureId]); }
export function upgradeCost(ventureId: number, level: number, player: Player): number { const discount=hasNetwork(player,"innovation")?20:0; return Math.max(70, ventures[ventureId].launchCost + level*55-discount); }
export function collaborationFee(ventureId: number, level: number): number { return ventures[ventureId].baseFee * level; }
export function districtVentureIds(districtId: string): number[] { return ventures.filter((v)=>v.district===districtId).map((v)=>v.id); }
export function hasNetwork(player: Player, districtId: string): boolean { return districtVentureIds(districtId).every((id)=>Boolean(player.ventures[id])); }
export function completedNetworks(player: Player): number { return districts.filter((d)=>hasNetwork(player,d.id)).length; }
