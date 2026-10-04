import {CITY,pointOnCut} from './geography.ts';
import {surfaceAt} from './world.ts';
import {terrainVisualSurface} from './parkPaths.ts';
import {dryStreetSite} from './dryStreetSite.ts';
import {hasStreetCurb} from './streetCurbs.ts';
import {sidewalkHalfWidth} from './streetFurnitureLayout.ts';
import {segmentDistance} from './roadsidePlacement.ts';
import {polygonContains} from './waterfrontSite.ts';
import {inValadeBeach} from './valadeSite.ts';

const segments=CITY.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,edge:r.width/2+(hasStreetCurb(r)?2*sidewalkHalfWidth(r):0)})));
const cells=new Map<string,typeof segments>();
for(const s of segments){const m=s.edge+4;for(let x=Math.floor((Math.min(s.a[0],s.b[0])-m)/64);x<=Math.floor((Math.max(s.a[0],s.b[0])+m)/64);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-m)/64);z<=Math.floor((Math.max(s.a[1],s.b[1])+m)/64);z++){const key=x+','+z,list=cells.get(key)??[];list.push(s);cells.set(key,list);}}
const buildings=CITY.buildings.map(b=>({points:b.points,minX:Math.min(...b.points.map(p=>p[0])),maxX:Math.max(...b.points.map(p=>p[0])),minZ:Math.min(...b.points.map(p=>p[1])),maxZ:Math.max(...b.points.map(p=>p[1]))}));
/** The full trunk/root footprint must be in lawn beyond every sidewalk and path. */
export function grassTreeSite(x:number,z:number,radius=.9){
 if(!dryStreetSite(x,z,radius)||inValadeBeach(x,z))return false;
 for(const [dx,dz] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]])if(terrainVisualSurface(x+dx,z+dz,surfaceAt(x+dx,z+dz))!=='grass')return false;
 if((cells.get(Math.floor(x/64)+','+Math.floor(z/64))??[]).some(s=>segmentDistance({x,z},s.a,s.b)<s.edge+radius))return false;
 return !buildings.some(b=>x>=b.minX-radius&&x<=b.maxX+radius&&z>=b.minZ-radius&&z<=b.maxZ+radius&&(polygonContains(b.points,x,z)||b.points.some((a,i)=>segmentDistance({x,z},a,b.points[(i+1)%b.points.length])<radius)));
}
export function nearestGrassTreeSite(x:number,z:number,allowed:(x:number,z:number)=>boolean=()=>true){
 const valid=(px:number,pz:number)=>allowed(px,pz)&&grassTreeSite(px,pz,1.1);
 if(valid(x,z))return{x,z};
 for(let radius=2;radius<=36;radius+=2)for(let i=0;i<24;i++){const a=i*Math.PI/12,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;if(valid(px,pz))return{x:px,z:pz};}
 return null;
}
export function cherryTreeSites(allowed:(x:number,z:number)=>boolean=()=>true){
 return [35,150,390,640,940,1290,1640].flatMap((d,i)=>{const desired=pointOnCut(d,i%2?7:-7),p=nearestGrassTreeSite(desired.x,desired.z,allowed);return p?[{...p,scale:.95+i%3*.1}]:[];});
}
