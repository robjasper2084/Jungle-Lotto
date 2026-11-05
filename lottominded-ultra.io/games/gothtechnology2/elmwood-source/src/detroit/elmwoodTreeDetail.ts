/** Existing authored tree LODs retain their species, materials and placement. */
export const TREE_LODS=new Set(['american-elm','red-maple','white-oak','white-pine','weeping-willow']);
export const treeDetail=(quality:string|undefined)=>quality==='high'||quality==='ultra'?'full':'compact';
export const treeModel=(id:string,detail:string)=>detail==='compact'&&TREE_LODS.has(id)?id+'_LOD1':id;
