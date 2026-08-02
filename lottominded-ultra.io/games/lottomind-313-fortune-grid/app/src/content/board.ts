import type { NodeKind } from "../engine/state";
export interface BoardNode { id: number; x: number; y: number; kind: NodeKind; label: string; ventureId?: number; edges: number[] }
const coords = [
  [50,51],[40,48],[31,44],[23,38],[17,30],[14,21],[22,15],[31,19],[39,25],[48,21],[58,16],[69,18],[79,25],[86,34],[82,44],[73,50],[64,46],[56,40],
  [49,33],[39,34],[30,30],[25,24],[36,12],[48,11],[60,10],[71,12],[76,19],[89,22],[91,45],[86,55],[76,61],[65,59],[54,62],[43,60],[31,57],[20,52]
] as const;
const specials: Record<number, [NodeKind,string]> = {
  0:["hub","LottoMind 313 Hub"], 4:["transit","Transit Junction"], 9:["pulse","City Pulse"], 13:["signal","LottoMind Signal"],
  17:["oracle","Dream Oracle"], 18:["lab","Number Lab"], 21:["studio","Beat Studio"], 24:["grant","Community Grant"],
  27:["transit","Transit Junction"], 29:["pulse","City Pulse"], 32:["signal","LottoMind Signal"], 35:["transit","Transit Junction"]
};
const edgePairs = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,0],
  [1,19],[19,18],[18,17],[2,20],[20,19],[3,21],[21,20],[6,22],[22,23],[23,9],[23,24],[24,25],[25,11],[25,26],[26,12],
  [13,27],[27,28],[28,14],[28,29],[29,30],[30,15],[30,31],[31,16],[31,32],[32,33],[33,0],[33,34],[34,1],[34,35],[35,4],
  [19,8],[18,9],[20,7],[21,6],[24,10],[26,13],[29,16],[32,17],[35,5]
] as const;
const edges = Array.from({length:36},()=>[] as number[]);
edgePairs.forEach(([a,b])=>{edges[a].push(b);edges[b].push(a)});
let ventureId=0;
export const boardNodes: BoardNode[] = coords.map(([x,y], id) => {
  const special = specials[id];
  if (special) return { id,x,y,kind:special[0],label:special[1],edges:edges[id] };
  const current=ventureId++;
  return { id,x,y,kind:"venture",label:`Venture ${current+1}`,ventureId:current,edges:edges[id] };
});
export const specialNodeCount = boardNodes.filter((node)=>node.kind!=="venture").length;
