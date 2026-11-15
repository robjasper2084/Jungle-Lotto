/** Mapped Detroit Boat Club footprint, with game berths on its river side.
 * Local +Z faces the river; all coordinates are metres, +Y up. */
export const BOAT_CLUB={id:'107192915',x:657.085,z:737.947,heading:-2.757994,width:54.4,depth:25};
export function clubWorld(u:number,v:number){const c=Math.cos(BOAT_CLUB.heading),s=Math.sin(BOAT_CLUB.heading);return{x:BOAT_CLUB.x+c*u+s*v,z:BOAT_CLUB.z-s*u+c*v};}
export function clubLocal(x:number,z:number){const c=Math.cos(BOAT_CLUB.heading),s=Math.sin(BOAT_CLUB.heading),dx=x-BOAT_CLUB.x,dz=z-BOAT_CLUB.z;return{u:c*dx-s*dz,v:s*dx+c*dz};}
export const CLUB_PIERS=[{u:-23,v:22,width:2,length:18},{u:23,v:22,width:2,length:18}];
export const CLUB_BERTHS={offshore:{...clubWorld(-17.5,24),heading:BOAT_CLUB.heading},hydroplane:{...clubWorld(17,24),heading:BOAT_CLUB.heading}};
export function clubPierDeck(x:number,z:number){const p=clubLocal(x,z);return CLUB_PIERS.some(d=>Math.abs(p.u-d.u)<=d.width/2&&Math.abs(p.v-d.v)<=d.length/2);}
export function clubQuay(x:number,z:number){const p=clubLocal(x,z);return p.u>=-34&&p.u<=28&&p.v>=-30&&p.v<=14.2;}
