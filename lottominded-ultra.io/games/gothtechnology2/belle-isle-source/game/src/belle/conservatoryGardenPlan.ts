import type {ParkMap} from './terrain.ts';
import {greenhouseLocal, greenhouseWorld} from './conservatory.ts';

// Photo-informed additions within the existing glasshouses. Dimensions are metres.
export const CONSERVATORY_SEATS = [
  {u: 0, v: 35.15, yaw: 0, width: 1.9, depth: .62},
  {u: 0, v: -31.65, yaw: Math.PI, width: 1.9, depth: .62},
] as const;
export const CONSERVATORY_POTS = CONSERVATORY_SEATS.flatMap(s => [-1, 1].map(side => ({u: side * 1.48, v: s.v, radius: .34})));

export function conservatoryFurnitureBlocked(u: number, v: number, margin: number) {
  return CONSERVATORY_SEATS.some(s => Math.abs(u-s.u) < s.width/2+margin && Math.abs(v-s.v) < s.depth/2+margin)
    || CONSERVATORY_POTS.some(p => Math.hypot(u-p.u, v-p.v) < p.radius+margin);
}
function inside(x: number, y: number, ring: number[][]) {
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function distance(x:number,y:number,a:number[],b:number[]){
  const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
  const t=d?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/d)):0;
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
}

/** Shore planting follows hydro-6, with a full foliage radius outside paths. */
export function conservatoryPondPlan(map: ParkMap) {
  const cfg=map.conservatory,pond=map.water.find(w=>w.id==='hydro-6');
  const banks:{u:number;v:number;radius:number;fern:boolean}[]=[],reeds:{u:number;v:number;radius:number}[]=[];
  if(!cfg||!pond)return{banks,reeds};
  const ring=pond.points.map(p=>{const q=greenhouseLocal(cfg,p[0],p[1]);return[q.u,q.v];});
  for(let i=0;i<ring.length-1;i++){
    const a=ring[i],b=ring[i+1],dx=b[0]-a[0],dv=b[1]-a[1],length=Math.hypot(dx,dv);
    if(length<.4)continue;
    let nx=dv/length,nv=-dx/length;const u=(a[0]+b[0])/2,v=(a[1]+b[1])/2;
    if(inside(u+nx*.2,v+nv*.2,ring)){nx=-nx;nv=-nv;}
    const pu=u+nx*.95,pv=v+nv*.95,p=greenhouseWorld(cfg,pu,pv),radius=.62;
    const clear=!map.roads.some(r=>r.points.slice(1).some((b,j)=>distance(p.x,p.z,r.points[j],b)<r.width/2+radius+.25));
    const outside=!inside(pu,pv,cfg.outline)&&!cfg.walls.some(w=>distance(pu,pv,w.a,w.b)<radius+.2);
    const monumentClear=!(map.monuments||[]).some(m=>Math.hypot(p.x-m.x,p.z-m.z)<m.radius+radius+.4);
    const furnitureClear=!(cfg.gardenWalls||[]).some(w=>distance(pu,pv,w.a,w.b)<radius+.3);
    if(clear&&outside&&monumentClear&&furnitureClear&&!inside(pu,pv,ring))banks.push({u:pu,v:pv,radius,fern:i%3===0});
    if(i%5===0){
      const ru=u-nx*.6,rv=v-nv*.6;
      if(inside(ru,rv,ring)&&ring.every((a,j)=>distance(ru,rv,a,ring[(j+1)%ring.length])>.32))reeds.push({u:ru,v:rv,radius:.28});
    }
  }
  return {banks,reeds};
}
