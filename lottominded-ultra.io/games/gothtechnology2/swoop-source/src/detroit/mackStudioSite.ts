/** 2000 Mack: OSM way 379485664, checked against Google Maps and the
 * O'Connor exterior/aerial brochure. Parcel edges and elevations are estimated. */
export const MACK_STUDIO={osmId:'379485664',x:2482.6025,z:-1488.715,width:48.533,depth:43.912,floor:3.1,heading:-Math.PI/2-Math.atan2(3.16,48.43)} as const;
const a=3.16/Math.hypot(3.16,48.43),b=48.43/Math.hypot(3.16,48.43);
/** Asset +Z is out toward Mack; +X runs along the street facade. */
export function studioMap(u:number,v:number){return{x:MACK_STUDIO.x+a*u+b*v,z:MACK_STUDIO.z+b*u-a*v};}
export function studioCoordinates(x:number,z:number){const dx=x-MACK_STUDIO.x,dz=z-MACK_STUDIO.z;return{u:a*dx+b*dz,v:b*dx-a*dz};}
export function studioLot(x:number,z:number){const {u,v}=studioCoordinates(x,z);return u>=-102&&u<=46&&v>=-96&&v<=40;}
export function studioGrade(x:number,z:number,terrain:number){const {u,v}=studioCoordinates(x,z),distance=Math.max(Math.abs(u)-26,-24-v,v-34,0),t=Math.max(0,1-distance/10),blend=t*t*(3-2*t);return terrain+(MACK_STUDIO.floor-terrain)*blend;}
export function studioRoom(store:boolean){return{u:store?12:-12,v:3};}
/** A shared loading entrance gives both interiors a clear, unobstructed aisle. */
export function studioWalk(store:boolean){const r=studioRoom(store);return[studioMap(0,27),studioMap(0,18),studioMap(r.u,18),studioMap(r.u,r.v+(store?3:5))];}
