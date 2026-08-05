import type { NodeKind } from "../engine/state";
import { detroitStops } from "./detroitGeo";
export interface BoardNode { id: number; x: number; y: number; kind: NodeKind; label: string; street: string; spot: string; ventureId?: number; edges: number[] }
// Preserve the selected illustrated circuit composition while keeping each stop's
// real Detroit street and landmark metadata available to rules and accessibility UI.
const coords = Array.from({ length: 36 }, (_, id): [number, number] => {
  const angle = Math.PI / 2 + (id / 36) * Math.PI * 2;
  const x = Math.sign(Math.cos(angle)) * Math.sqrt(Math.abs(Math.cos(angle)));
  const y = Math.sign(Math.sin(angle)) * Math.sqrt(Math.abs(Math.sin(angle)));
  return [50 + x * 40, 37 + y * 27];
});
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
  const [x, y] = coords[id];
  const special = specials[id];
  if (special) return { id,x,y,kind:special[0],label:special[1],street:stop.street,spot:stop.spot,edges:edges[id] };
  const current=ventureId++;
  return { id,x,y,kind:"venture",label:`Venture ${current+1}`,street:stop.street,spot:stop.spot,ventureId:current,edges:edges[id] };
});
export const specialNodeCount = boardNodes.filter((node)=>node.kind!=="venture").length;
