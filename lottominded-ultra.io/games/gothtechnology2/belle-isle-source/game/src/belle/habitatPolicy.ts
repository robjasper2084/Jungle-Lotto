/** Deterministic botanical structure for the existing mapped tree placements.
 * Species names refer to the game's artistic models, not surveyed trees.
 * Patches vary on a 42 m scale instead of every instance flickering randomly.
 */
export type TreeHabitat='riparian'|'flatwoods'|'forest-edge'|'upland'|'understory';
export type HabitatTree={id:string;x:number;z:number;scale:number};
export type CanopyProfile={habitat:TreeHabitat;density:number;height:number;width:number;tint:number};

function hash(x:number,z:number,salt:number){
 let n=Math.imul(Math.floor(x)^salt,0x27d4eb2d)^Math.imul(Math.floor(z)+salt,0x165667b1);
 n=Math.imul(n^(n>>>15),0x85ebca6b);return ((n^(n>>>13))>>>0)/4294967296;
}
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function canopyProfile(p:HabitatTree):CanopyProfile{
 const patch=hash(p.x/42,p.z/42,811),individual=hash(p.x*2,p.z*2,291);
 const type:TreeHabitat=p.id==='willow'?'riparian':p.id==='birch'?'forest-edge':p.id==='pine'?'upland':p.id==='maple'?'flatwoods':'understory';
 const group=type==='riparian'?[.95,1.06,.83,1.10,1.13]:
  type==='forest-edge'?[.74,.94,1.12,1.00,1.01]:
  type==='upland'?[.83,1.00,1.09,.99,.96]:
  type==='flatwoods'?[.88,1.07,1.01,1.15,1.02]:
  [1,1,1,1,1];
 const grove=mix(0.25,0.75,patch),variance=mix(-1,1,individual);
 return {habitat:type,
  density:Math.min(1.12,Math.max(.48,mix(group[0],group[1],grove)+variance*.09)),
  height:group[2]*(1+variance*.065),
  width:group[3]*(1-variance*.055),
  tint:group[4]*(.97+patch*.045)};
}
