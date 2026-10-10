/** Authored Detroit source metres: Mack/Cut endpoint, all Cut bends, and the
 * entire Chene Park / Aretha footprint. Keep this independent of map rendering. */
export const DOWNTOWN_FIELD_REVISION='mack-chene-1';
export const DOWNTOWN_EXTENT={minX:-262.125,maxX:2535.75,minZ:-1796.201,maxZ:-1222.79};
export const DOWNTOWN_LANDMARKS={
 mack:{x:2535.75,z:-1395.43},chene:{x:-211,z:-1625},
};
export const DEFAULT_FIELD_RADII=[320,210,130,60,16,0] as const;
export function downtownExtent(t:{sx:number;tx:number;tz:number}){
 const e=DOWNTOWN_EXTENT;
 return [e.minX,e.maxX].flatMap(x=>[e.minZ,e.maxZ].map(z=>({x:(x-t.tx)/t.sx,z:z-t.tz})));
}
export function downtownRadii(zones:readonly {x:number;z:number}[],extent:readonly {x:number;z:number}[]){
 // Every seeded circle includes the entire corridor, with 60 m of riding room.
 const radius=Math.ceil((Math.max(...zones.flatMap(z=>extent.map(p=>Math.hypot(p.x-z.x,p.z-z.z))))+60)/25)*25;
 return [radius,radius*.8,radius*.5,Math.min(250,radius*.2),16,0];
}
