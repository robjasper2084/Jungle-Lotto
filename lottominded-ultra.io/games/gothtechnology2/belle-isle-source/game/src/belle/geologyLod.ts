/** View-dependent visual mineral LOD. All colliders remain registered even
 * when a mesh is omitted from a camera; never alter race/flight physics. */
export type GeologyTier='smooth'|'automatic'|'high';
export const GEOLOGY_BUDGET={
 smooth:{nearRange:62,farRange:175,nearMax:12,farMax:24},
 automatic:{nearRange:95,farRange:290,nearMax:24,farMax:42},
 high:{nearRange:135,farRange:425,nearMax:40,farMax:54}
} as const;
export type PositionedRock={x:number;z:number;shape:number};
export function selectGeology<T extends PositionedRock>(rocks:readonly T[],x:number,z:number,quality:GeologyTier){
 if(!Number.isFinite(x)||!Number.isFinite(z))return {near:[] as T[],far:[] as T[]};
 const b=GEOLOGY_BUDGET[quality],items=rocks
  .map((rock,index)=>({rock,index,d:Math.hypot(rock.x-x,rock.z-z)}))
  .filter(p=>p.d<=b.farRange)
  .sort((a,b)=>a.d-b.d||a.index-b.index);
 const near=items.filter(i=>i.d<=b.nearRange).slice(0,b.nearMax).map(i=>i.rock);
 const nearSet=new Set(near),far=items.filter(i=>!nearSet.has(i.rock)).slice(0,b.farMax).map(i=>i.rock);
 return{near,far};
}
