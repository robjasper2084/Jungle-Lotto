import type {ParkMap,Point} from './terrain.ts';

/** Mapped links, not an invented count of unique physical bridges. Parallel
 * sidewalks and consecutive boardwalk pieces retain their source way IDs. */
export type SmallBridge={id:string;name:string;points:Point[];width:number;surface:string;foot:boolean;style:'iron'|'timber'|'concrete'|'brick';source:string};
export type BridgePart={id:string;kind:'slab'|'rail';a:Point;b:Point;width:number;bottom:number;top:number;style:SmallBridge['style']};
export type SmallBridgePlan={links:SmallBridge[];parts:BridgePart[];notes:readonly string[]};
export const DEDICATED_BRIDGE_IDS=new Set(['58465724','660010940','660010941','515099309']);
const distance=(x:number,z:number,a:Point,b:Point)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};

/** Use an indexed union of ALL roads, including sidewalks, to leave side exits
 * open. Never add a rail across a crossing path or between overlapping ways. */
function corridorIndex(roads:ParkMap['roads']){
 const grid=new Map<string,{id:string;a:Point;b:Point;r:number}[]>(),cell=32;
 for(const r of roads)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],pad=r.width/2+.2;
  for(let x=Math.floor((Math.min(a[0],b[0])-pad)/cell);x<=Math.floor((Math.max(a[0],b[0])+pad)/cell);x++)for(let z=Math.floor((Math.min(a[1],b[1])-pad)/cell);z<=Math.floor((Math.max(a[1],b[1])+pad)/cell);z++){
   const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key)!.push({id:r.id,a,b,r:pad});
  }
 }
 return (p:Point,ignore:string)=>(grid.get(Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell))??[]).some(s=>distance(p[0],p[1],s.a,s.b)<=(s.id===ignore?s.r-.22:s.r));
}
export function makeSmallBridgePlan(map:ParkMap,height:(x:number,z:number)=>number=()=>2):SmallBridgePlan{
 for(const r of map.roads)if(!Number.isFinite(r.width)||r.width<=0||r.width>200||r.points.some(p=>p.length!==2||!p.every(Number.isFinite)))throw Error('Invalid mapped corridor '+r.id);
 const occupied=corridorIndex(map.roads),links:SmallBridge[]=[],parts:BridgePart[]=[];
 for(const r of map.roads){
  if(!r.bridge||DEDICATED_BRIDGE_IDS.has(r.id)||r.points.length<2)continue;
  if(!Number.isFinite(r.width)||r.width<=0||r.width>40||r.points.some(p=>p.length!==2||!p.every(Number.isFinite)))throw Error('Invalid mapped bridge '+r.id);
  const length=r.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-r.points[i][0],p[1]-r.points[i][1]),0);
  if(length<.1||length>250)continue; // Long river bridges keep their own authored system.
  const style=['60929039','755770242','755770243'].includes(r.id)?'brick':r.surface==='wood'?'timber':r.id==='107196454'?'iron':!r.foot?'concrete':'iron';
  const link:SmallBridge={id:r.id,name:r.name,points:r.points.map(p=>[...p]),width:r.width,surface:r.surface,foot:r.foot,style,source:'https://www.openstreetmap.org/way/'+r.id};links.push(link);
  for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.05)continue;
   const floor=height((a[0]+b[0])/2,(a[1]+b[1])/2)+.055;
   if(!Number.isFinite(floor))throw Error('Invalid bridge support height '+r.id);
   // Existing joined pavement is the wearing surface at ground + .065.
   parts.push({id:r.id,kind:'slab',a:[...a],b:[...b],width:r.width,bottom:floor-.30,top:floor,style});
   const nx=dz/len,nz=-dx/len,steps=Math.max(1,Math.ceil(len/1));
   for(const side of [-1,1]){
    const railWidth=style==='brick'?.60:.12,offset=side*(r.width/2+(style==='brick'?.40:.16));let start:Point|undefined,end:Point|undefined;
    const flush=()=>{if(start&&end)parts.push({id:r.id,kind:'rail',a:start,b:end,width:railWidth,bottom:floor+.01,top:floor+1.08,style});start=end=undefined;};
    for(let j=0;j<steps;j++){
     const point=(t:number):Point=>[a[0]+dx*t+nx*offset,a[1]+dz*t+nz*offset],p=point(j/steps),q=point((j+1)/steps),mid=point((j+.5)/steps);
     if([p,mid,q].some(v=>occupied(v,r.id))){flush();continue;}
     if(!start)start=p;end=q;
    }
    flush();
   }
  }
 }
 return {links,parts,notes:['Source: existing OSM bridge/layer-tagged way geometry; parallel pieces are not separate surveyed bridges.','Structure, rail style and dimensions are bounded game reconstructions; source alignments, widths and existing floor levels are preserved.','MacArthur and Blue Heron dedicated structures are excluded; crossings through other road/path corridors remain open.']};
}
function hitBox(part:BridgePart,o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half:number){
 const dx=part.b[0]-part.a[0],dz=part.b[1]-part.a[1],len=Math.hypot(dx,dz);if(len<1e-7)return null;
 const ux=dx/len,uz=dz/len,x=o.x-(part.a[0]+part.b[0])/2,z=o.z-(part.a[1]+part.b[1])/2;let low=0,high=max;
 for(const [p,v,a,b]of [[x*ux+z*uz,d.x*ux+d.z*uz,-len/2-half,len/2+half],[-x*uz+z*ux,-d.x*uz+d.z*ux,-part.width/2-half,part.width/2+half],[o.y,d.y,part.bottom,part.top]]){
  if(Math.abs(v)<1e-8){if(p<a||p>b)return null;}else{const t=(a-p)/v,u=(b-p)/v;low=Math.max(low,Math.min(t,u));high=Math.min(high,Math.max(t,u));if(low>high)return null;}
 }
 return low<=max?low:null;
}
/** Same boxes drive the visible structure and physical rails; no invisible end cap. */
export class SmallBridgeCollision{
 readonly plan:SmallBridgePlan;private grid=new Map<string,BridgePart[]>();private readonly cell=32;
 constructor(plan:SmallBridgePlan){this.plan=plan;for(const p of plan.parts){const pad=p.width/2+.1;for(let x=Math.floor((Math.min(p.a[0],p.b[0])-pad)/32);x<=Math.floor((Math.max(p.a[0],p.b[0])+pad)/32);x++)for(let z=Math.floor((Math.min(p.a[1],p.b[1])-pad)/32);z<=Math.floor((Math.max(p.a[1],p.b[1])+pad)/32);z++){const key=x+','+z;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key)!.push(p);}}}
 private nearby(x:number,z:number,x2:number,z2:number,pad:number){const cells=(Math.ceil((Math.abs(x2-x)+pad*2)/this.cell)+2)*(Math.ceil((Math.abs(z2-z)+pad*2)/this.cell)+2);if(cells>4096)return new Set(this.plan.parts);const found=new Set<BridgePart>();for(let gx=Math.floor((Math.min(x,x2)-pad)/this.cell);gx<=Math.floor((Math.max(x,x2)+pad)/this.cell);gx++)for(let gz=Math.floor((Math.min(z,z2)-pad)/this.cell);gz<=Math.floor((Math.max(z,z2)+pad)/this.cell);gz++)for(const p of this.grid.get(gx+','+gz)??[])found.add(p);return found;}
 blocked(x:number,z:number,margin=0){if(![x,z,margin].every(Number.isFinite)||margin<0)return false;for(const p of this.nearby(x,z,x,z,Math.max(0,margin)))if(p.kind==='rail'&&distance(x,z,p.a,p.b)<p.width/2+margin)return true;return false;}
 ray(o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half=.4){
  if(![o.x,o.y,o.z,d.x,d.y,d.z,max,half].every(Number.isFinite)||max<0||half<0)return null;
  let hit=max+1;for(const p of this.nearby(o.x,o.z,o.x+d.x*max,o.z+d.z*max,half)){const t=hitBox(p,o,d,max,half);if(t!==null&&t<hit)hit=t;}return hit<=max?hit:null;
 }
}
