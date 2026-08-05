import { completedNetworks } from "./economy";
import type { Player } from "./state";
export interface ScoreBreakdown { legacy:number; networks:number; development:number; signals:number; focus:number; community:number; total:number }
export function scorePlayer(player: Player): ScoreBreakdown {
  const networks=completedNetworks(player)*15;
  const development=Object.values(player.ventures).reduce((sum,level)=>sum+level*2,0);
  const signals=new Set(player.signals).size===player.signals.length&&player.signals.length>=3?5:0;
  const focus=player.focus;
  const community=player.rebuild?0:2;
  return {legacy:player.legacy,networks,development,signals,focus,community,total:player.legacy+networks+development+signals+focus+community};
}
