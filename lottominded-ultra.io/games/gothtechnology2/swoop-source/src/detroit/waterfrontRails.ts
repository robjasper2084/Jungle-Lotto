import {CITY} from './geography.ts';
import {WATERFRONT} from './waterfrontSite.ts';
import {hasStreetCurb} from './streetCurbs.ts';
import {sidewalkHalfWidth} from './streetFurnitureLayout.ts';
type Point=readonly number[];
export type AccessOpening={a:Point;b:Point;width:number};
type Span={a:number[];b:number[]};
const cross=(ax:number,az:number,bx:number,bz:number)=>ax*bz-az*bx;
/** Split visuals and collision against the full path corridor, including ends.
 * Safety rails beside a path survive; rails inside its rideable width do not. */
export function clearRailSpans(a:Point,b:Point,openings:AccessOpening[]=[],gates:Point[]=WATERFRONT.gates.map(g=>g.point)):Span[]{
 const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)return [];
 const gaps:[number,number][]=[];
 for(const g of gates){
  const along=((g[0]-a[0])*dx+(g[1]-a[1])*dz)/len,away=Math.abs(cross(dx,dz,g[0]-a[0],g[1]-a[1]))/len;
  const radius=1.9;if(away>=radius)continue;const half=Math.sqrt(radius*radius-away*away);gaps.push([(along-half)/len,(along+half)/len]);
 }
 const circle=(center:Point,radius:number)=>{const along=((center[0]-a[0])*dx+(center[1]-a[1])*dz)/len,away=Math.abs(cross(dx,dz,center[0]-a[0],center[1]-a[1]))/len;if(away>=radius)return;const half=Math.sqrt(radius*radius-away*away);gaps.push([(along-half)/len,(along+half)/len]);};
 for(const p of openings){
  const px=p.b[0]-p.a[0],pz=p.b[1]-p.a[1],pl=Math.hypot(px,pz),radius=p.width/2+.35;
  if(!Number.isFinite(radius)||radius<=0)continue;
  circle(p.a,radius);circle(p.b,radius);if(pl<.01)continue;
  const ux=px/pl,uz=pz/pl,qx=a[0]-p.a[0],qz=a[1]-p.a[1];let lo=0,hi=1;
  const clip=(origin:number,slope:number,min:number,max:number)=>{if(Math.abs(slope)<1e-9)return origin>=min&&origin<=max;const t0=(min-origin)/slope,t1=(max-origin)/slope;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));return hi>lo;};
  if(clip(qx*ux+qz*uz,dx*ux+dz*uz,0,pl)&&clip(cross(ux,uz,qx,qz),cross(ux,uz,dx,dz),-radius,radius))gaps.push([lo,hi]);
 }
 let cursor=0;const spans:Span[]=[],point=(t:number)=>[a[0]+dx*t,a[1]+dz*t];
 for(const [start,end]of gaps.filter(g=>g[1]>0&&g[0]<1).sort((x,y)=>x[0]-y[0])){
  const next=Math.max(0,Math.min(1,start));if((next-cursor)*len>.08)spans.push({a:point(cursor),b:point(next)});cursor=Math.max(cursor,Math.min(1,end));
 }
 if((1-cursor)*len>.08)spans.push({a:point(cursor),b:point(1)});return spans;
}
export const MAPPED_ACCESS:AccessOpening[]=CITY.roads.filter(r=>!r.bridge&&r.kind!=='steps').flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,width:r.width+(hasStreetCurb(r)?2*(.15+2*sidewalkHalfWidth(r)):0)})));
/** Gate posts align with the mapped barrier, rather than a global X axis. */
export function gateDirection(g:Point){
 let nearest=Infinity,result=[1,0];
 for(const barrier of WATERFRONT.barriers)for(let i=1;i<barrier.points.length;i++){
  const a=barrier.points[i-1],b=barrier.points[i],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;if(l2<.01)continue;
  const t=Math.max(0,Math.min(1,((g[0]-a[0])*dx+(g[1]-a[1])*dz)/l2)),d=Math.hypot(g[0]-a[0]-dx*t,g[1]-a[1]-dz*t);
  if(d<nearest){nearest=d;result=[dx/Math.sqrt(l2),dz/Math.sqrt(l2)];}
 }
 return result;
}
