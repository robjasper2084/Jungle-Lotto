import type { NodeKind } from "../engine/state";
import { detroitStops, projectDetroit } from "./detroitGeo";
export interface BoardNode { id: number; x: number; y: number; kind: NodeKind; label: string; street: string; spot: string; ventureId?: number; edges: number[] }
const specials: Record<number, [NodeKind,string]> = {
  0:["hub","LottoMind 313 Hub"], 4:["transit","Transit Junction"], 9:["pulse","City Pulse"], 13:["signal","LottoMind Signal"],
  17:["oracle","Dream Oracle"], 18:["lab","Number Lab"], 21:["studio","Beat Studio"], 24:["grant","Community Grant"],
  27:["transit","Transit Junction"], 29:["pulse","City Pulse"], 32:["signal","LottoMind Signal"], 35:["transit","Transit Junction"]
};
const edgePairs = Array.from({ length: detroitStops.length }, (_, id) => [id, (id + 1) % detroitStops.length] as const);
const edges = Array.from({length:36},()=>[] as number[]);
edgePairs.forEach(([a,b])=>{edges[a].push(b);edges[b].push(a)});
let ventureId=0;
export const boardNodes: BoardNode[] = detroitStops.map((stop, id) => {
  const { x, y } = projectDetroit(stop);
  const special = specials[id];
  if (special) return { id,x,y,kind:special[0],label:special[1],street:stop.street,spot:stop.spot,edges:edges[id] };
  const current=ventureId++;
  return { id,x,y,kind:"venture",label:`Venture ${current+1}`,street:stop.street,spot:stop.spot,ventureId:current,edges:edges[id] };
});
export const specialNodeCount = boardNodes.filter((node)=>node.kind!=="venture").length;
