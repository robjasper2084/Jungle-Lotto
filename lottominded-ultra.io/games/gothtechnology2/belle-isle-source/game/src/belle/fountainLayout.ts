import type {ParkMap,Point} from './terrain.ts';
export const SCOTT_AUTHORED={x:172.23,z:1322.99,radius:24.74};
/** The circular upper basin is distinct from the relation's separate cascade polygons. */
export function scottLayout(map:ParkMap){
 const basin=map.waterSources?.find(w=>w.id==='107194067');
 const xs=basin?.points.map(p=>p[0])??[182.25,216.43],zs=basin?.points.map(p=>p[1])??[1293.47,1327.59];
 const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
 const radius=Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))/2;
 return {x,z,radius,scale:radius/SCOTT_AUTHORED.radius,yaw:-1.18};
}
export function alignScottMap(map:ParkMap){const p=scottLayout(map);for(const m of [...(map.monuments??[]),...map.landmarks])if(m.id==='9146545'){m.x=p.x;m.z=p.z;m.viewDistance=40;if('radius'in m)m.radius=p.radius;}}
export function cascadePoint(layout:ReturnType<typeof scottLayout>,side:number,along:number):Point{return [layout.x+Math.cos(layout.yaw)*side+Math.sin(layout.yaw)*along,layout.z-Math.sin(layout.yaw)*side+Math.cos(layout.yaw)*along];}
export const CASCADE_STEPS=6;
// The mapped cascade is beyond Fountain Drive, between radii 78 and 90 m.
export const CASCADE_START=78.5, CASCADE_RUN=1.75, CASCADE_SIDE=4, CASCADE_WIDTH=26;
export function cascadeLevel(i:number){return 2.65-i*.26;}
