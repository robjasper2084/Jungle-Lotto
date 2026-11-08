import type {ParkMap,Point} from './terrain.ts';
type Road=ParkMap['roads'][number];
export type MappedCrossing={id:string;roadId:string;roadName:string;point:Point;direction:Point;width:number;bridge:boolean;evidence:'on-carriageway'|'connected-footway';sourcePoint:Point};
const near=(p:Point,a:Point,b:Point)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l)):0;const point:Point=[a[0]+t*dx,a[1]+t*dz];return {point,d:Math.hypot(point[0]-p[0],point[1]-p[1])};};
function intersection(a:Point,b:Point,c:Point,d:Point):Point|undefined{
 const x=b[0]-a[0],z=b[1]-a[1],u=d[0]-c[0],v=d[1]-c[1],det=x*v-z*u;if(Math.abs(det)<1e-9)return;
 const px=c[0]-a[0],pz=c[1]-a[1],t=(px*v-pz*u)/det,s=(px*z-pz*x)/det;
 if(t< -1e-7||t>1+1e-7||s< -1e-7||s>1+1e-7)return;return [a[0]+t*x,a[1]+t*z];
}
/** Marked OSM nodes can be at the sidewalk end of a crossing way, not at
 * the street center. Follow that actual footway to its road intersection.
 * Never invent crossings from proximity alone or repaint unmarked nodes. */
export function mappedCrossings(map:ParkMap):MappedCrossing[]{
 const roads=map.roads.filter(r=>!r.foot&&r.highway!=='corridor'),out:MappedCrossing[]=[];
 for(const n of map.traffic??[]){
  if(n.kind!=='crossing'||['','no','unmarked'].includes(n.markings)||!n.p.every(Number.isFinite))continue;
  let best:{road:Road;a:Point;b:Point;point:Point;d:number;evidence:MappedCrossing['evidence']}|undefined;
  for(const road of roads)for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i];if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-6)continue;
   const q=near(n.p,a,b);if(q.d<=Math.max(3,road.width/2+.1)&&(!best||q.d<best.d))best={road,a,b,...q,evidence:'on-carriageway'};
  }
  if(!best){
   const footways=map.roads.filter(r=>r.foot&&!r.sidewalk&&r.points.some((p,i)=>i>0&&near(n.p,r.points[i-1],p).d<.06));
   for(const foot of footways)for(let j=1;j<foot.points.length;j++){
    const a=foot.points[j-1],b=foot.points[j];if(near(n.p,a,b).d>24)continue;
    for(const road of roads)for(let i=1;i<road.points.length;i++){
     const c=road.points[i-1],d=road.points[i],point=intersection(a,b,c,d);if(!point)continue;
     const distance=Math.hypot(point[0]-n.p[0],point[1]-n.p[1]);if(distance>24)continue;
     // Exclude tangential/shared alignments and bridge/road center coincidences.
     const cross=Math.abs((b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]));
     if(cross<.25*Math.hypot(b[0]-a[0],b[1]-a[1])*Math.hypot(d[0]-c[0],d[1]-c[1]))continue;
     if(!best||distance<best.d)best={road,a:c,b:d,point,d:distance,evidence:'connected-footway'};
    }
   }
  }
  if(!best||out.some(p=>Math.hypot(p.point[0]-best!.point[0],p.point[1]-best!.point[1])<6))continue;
  const len=Math.hypot(best.b[0]-best.a[0],best.b[1]-best.a[1]);if(len<1e-6)continue;
  out.push({id:n.id,roadId:best.road.id,roadName:best.road.name,point:best.point,direction:[(best.b[0]-best.a[0])/len,(best.b[1]-best.a[1])/len],width:best.road.width,bridge:best.road.bridge,evidence:best.evidence,sourcePoint:[...n.p]});
 }
 return out;
}
