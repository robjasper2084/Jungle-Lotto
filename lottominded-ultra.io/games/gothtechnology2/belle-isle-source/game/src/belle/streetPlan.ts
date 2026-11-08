import {ParkTerrain,segment,inside,type ParkMap,type Point} from './terrain.ts';
import {greenhouseLocal} from './conservatory.ts';
import {mappedCrossings,type MappedCrossing} from './mappedCrossings.ts';
type Road=ParkMap['roads'][number];
export type StreetBox={x:number;y:number;z:number;w:number;h:number;l:number;yaw:number;grade?:number;material:'white'|'yellow'|'curb'|'gutter'|'metal'|'green'|'tactile';road?:string};
export type StreetSign={x:number;y:number;z:number;yaw:number;title:string;subtitle:string;kind:'park'|'street'|'stop'|'speed'|'crossing';w:number;h:number};
export type StreetPlan={boxes:StreetBox[];signs:StreetSign[];stats:Record<string,number>;notes:string[];crossings?:MappedCrossing[]};
export function pathSamples(points:Point[],step:number){
 const samples:{x:number;z:number;dx:number;dz:number;s:number}[]=[];let length=0,next=step*.5;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)continue;
  const dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
  for(;next<length+len;next+=step){const f=next-length;samples.push({x:a[0]+dx*f,z:a[1]+dz*f,dx,dz,s:next});}
  length+=len;
 }
 return samples;
}
// Split solid strokes at source corners and share bounded miter endpoints.
// A six-metre box centered on a bend otherwise jumps sideways into the next box.
export function strokePieces(points:Point[],from:number,to:number,offset:number){
 const closed=points.length>2&&Math.hypot(points[0][0]-points.at(-1)![0],points[0][1]-points.at(-1)![1])<.001;
 const shifted=points.map((p,i)=>{
  const a=points[i===0&&closed?points.length-2:Math.max(0,i-1)],b=points[i===points.length-1&&closed?1:Math.min(points.length-1,i+1)];
  const before=Math.hypot(p[0]-a[0],p[1]-a[1]),after=Math.hypot(b[0]-p[0],b[1]-p[1]);
  const ax=before?(p[1]-a[1])/before:(b[1]-p[1])/(after||1),az=before?-(p[0]-a[0])/before:-(b[0]-p[0])/(after||1);
  const bx=after?(b[1]-p[1])/after:ax,bz=after?-(b[0]-p[0])/after:az;
  const n=Math.hypot(ax+bx,az+bz),nx=n?(ax+bx)/n:ax,nz=n?(az+bz)/n:az;
  const m=Math.min(1.8,1/Math.max(.01,nx*bx+nz*bz));
  return [p[0]+nx*offset*m,p[1]+nz*offset*m] as Point;
 });
 const pieces:{a:Point;b:Point}[]=[];let s=0;
 for(let i=1;i<points.length;i++){
  const len=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  const lo=Math.max(from,s),hi=Math.min(to,s+len);
  if(len>.001&&hi>lo){const a=shifted[i-1],b=shifted[i],at=(v:number)=>[a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v] as Point;pieces.push({a:at((lo-s)/len),b:at((hi-s)/len)});}
  s+=len;if(s>=to)break;
 }
 return pieces;
}
// Index all corridors once during the offline build. Side furniture must clear
// the UNION of road/path corridors, not just the route it belongs to.
export function roadIndex(roads:Road[]){
 const grid=new Map<string,{a:Point;b:Point;r:Road}[]>(),cell=32;
 for(const r of roads)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],pad=r.width/2+5;
  for(let x=Math.floor((Math.min(a[0],b[0])-pad)/cell);x<=Math.floor((Math.max(a[0],b[0])+pad)/cell);x++)
   for(let z=Math.floor((Math.min(a[1],b[1])-pad)/cell);z<=Math.floor((Math.max(a[1],b[1])+pad)/cell);z++){
    const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k)!.push({a,b,r});
   }
 }
 return (x:number,z:number,ignore='',margin=0)=> (grid.get(Math.floor(x/cell)+','+Math.floor(z/cell))||[]).some(s=>s.r.id!==ignore&&segment(x,z,s.a,s.b).d<s.r.width/2+margin);
}
export function createStreetPlan(data:ParkMap):StreetPlan{
 const terrain=new ParkTerrain(data),occupied=roadIndex(data.roads),boxes:StreetBox[]=[],signs:StreetSign[]=[],usedSigns:Point[]=[];
 const roads=data.roads.filter(r=>!r.foot&&r.highway!=='corridor');
 const resolvedCrossings=mappedCrossings(data);
 const add=(x:number,z:number,yaw:number,w:number,l:number,material:StreetBox['material'],h=.012,dy=.084,road?:string)=>{const dx=Math.sin(yaw)*l*.5,dz=Math.cos(yaw)*l*.5,grade=(terrain.height(x+dx,z+dz)-terrain.height(x-dx,z-dz))/l;boxes.push({x:+x.toFixed(3),z:+z.toFixed(3),y:+(terrain.height(x,z)+dy).toFixed(3),yaw:+yaw.toFixed(5),grade:+grade.toFixed(6),w,h,l,material,road});};
 const inDetailArea=(x:number,z:number)=>inside(x,z,data.island)||(data.outerIslets||[]).some(i=>inside(x,z,i.points))||Math.hypot(x,z)<850;
 const landClear=(x:number,z:number)=>inDetailArea(x,z)&&terrain.land(x,z)&&!data.buildings.some(b=>inside(x,z,b.points));
 const plazas=data.areas.filter(a=>a.kind==='pedestrian');
 const curbClear=(x:number,z:number)=>landClear(x,z)&&!plazas.some(a=>inside(x,z,a.points)&&!(a.holes||[]).some(h=>inside(x,z,h)));
 const namedSigns=new Set<string>();
 function sign(x:number,z:number,yaw:number,title:string,subtitle:string,kind:StreetSign['kind'],w=2.6,h=.8){
  if(!landClear(x,z)||occupied(x,z,'',.9)||usedSigns.some(p=>Math.hypot(x-p[0],z-p[1])<12))return false;
  signs.push({x,y:terrain.height(x,z)+2.4,z,yaw,title,subtitle,kind,w,h});usedSigns.push([x,z]);return true;
 }
 for(const r of roads){
  if(r.bridge&&r.points.some(p=>terrain.bridge(...p).active))continue;
  const samples=pathSamples(r.points,6),total=samples.at(-1)?.s||0;
  // Do not guess arrows for Central Avenue: dated OSM conflicts with DNR's 2026 plan.
  const uncertainDirection=r.name==='Central Avenue';
  const oneWay=!!r.oneway&&!uncertainDirection;
  for(let i=0;i<samples.length;i++){
   const p=samples[i],yaw=Math.atan2(p.dx,p.dz),nx=p.dz,nz=-p.dx;
   const run=(offset:number,w:number,l:number,material:StreetBox['material'],h=.012,dy=.084,road?:string)=>{
    for(const {a,b} of strokePieces(r.points,p.s-l/2,p.s+l/2,offset)){
     const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.005)continue;
     // Tight loops can overlap their own corridor after widening. Keep the entire
     // curb outside that union as well as leaving gaps at other routes.
     if(road&&[a,b,[(a[0]+b[0])/2,(a[1]+b[1])/2] as Point].some(q=>!curbClear(...q)||occupied(q[0],q[1],r.id,.45)||occupied(q[0],q[1],'',w/2-.02)))continue;
     add((a[0]+b[0])/2,(a[1]+b[1])/2,Math.atan2(b[0]-a[0],b[1]-a[1]),w,length,material,h,dy,road);
    }
   };
   if(!inDetailArea(p.x,p.z)||terrain.bridge(p.x,p.z).active)continue;
   const crossing=resolvedCrossings.some(n=>Math.hypot(n.point[0]-p.x,n.point[1]-p.z)<4);
   const clearCenter=!occupied(p.x,p.z,r.id,1.5)&&!crossing;
   const motorOffset=r.cycleTrack?-1.7:0;
   if(clearCenter&&r.width>=6&&!uncertainDirection&&r.highway!=='service'){
    if(oneWay){if(i%2===0)run(motorOffset,.12,2.7,'white');}
    else for(const d of[-.13,.13])run(d+motorOffset,.1,5.97,'yellow');
   }
   if(clearCenter&&r.cycleTrack){
    const divider=r.width/2-3.4;
    for(const d of[divider-.18,divider+.18])run(d,.12,5.97,'white');
    if(i%2===0)run(divider+1.7,.1,2.4,'yellow');
    if(i%20===10)for(const side of[-1,1]){
     const offset=divider+1.7+side*.78,ax=p.x+nx*offset,az=p.z+nz*offset;
     add(ax,az,yaw,.12,1.25,'white');
     for(const s of[-1,1])add(ax+p.dx*side*.5+nx*s*.18,az+p.dz*side*.5+nz*s*.18,yaw+side*s*.65,.1,.6,'white');
    }
   }
   for(const side of[-1,1]){
    const edge=r.width/2-.22,x=p.x+nx*edge*side,z=p.z+nz*edge*side;
    if(clearCenter&&r.highway!=='service'&&!occupied(x,z,r.id,.4))run(edge*side,.12,5.97,'white');
    // 15 cm curb with flush gaps at entrances/crossings; bridge curb is separate.
    const d=r.width/2+.16,cx=p.x+nx*d*side,cz=p.z+nz*d*side;
    const ends=[-3.2,0,3.2];
    if(!r.bridge&&!crossing&&ends.every(e=>curbClear(cx+p.dx*e,cz+p.dz*e)&&!occupied(cx+p.dx*e,cz+p.dz*e,r.id,.45))){
     run(d*side,.30,6,'curb',.15,.14,r.id);
     run((d-.38)*side,.43,6,'gutter',.012,.076);
     // Drains follow the gutter at generous intervals; no dynamic lights/shadows.
     if(i%32===12){
      add(cx-nx*.42*side,cz-nz*.42*side,yaw,.4,.65,'metal',.016,.09);
      for(let j=-2;j<=2;j++)add(cx-nx*.42*side+p.dx*j*.1,cz-nz*.42*side+p.dz*j*.1,yaw,.36,.026,'gutter',.008,.102);
     }
    }
   }
   if(clearCenter&&oneWay&&i%50===20){
    const direction=r.oneway||1,ax=p.x+nx*(motorOffset+1.5),az=p.z+nz*(motorOffset+1.5);
    add(ax,az,yaw,.19,2.2,'white');
    for(const side of[-1,1])add(ax+p.dx*direction*.92+nx*side*.32,az+p.dz*direction*.92+nz*side*.32,yaw+direction*side*.65,.18,1.05,'white');
   }
   if(r.name!=='Park path'&&!namedSigns.has(r.name)&&i>=Math.floor(samples.length/2)&&total>80){
    for(const side of[1,-1]){
     const d=r.width/2+1.6;
     if(sign(p.x+nx*d*side,p.z+nz*d*side,yaw+Math.PI,r.name,'BELLE ISLE','street',2.7,.48)){namedSigns.add(r.name);break;}
    }
   }
   if(r.maxspeed==='25 mph'&&!namedSigns.has('speed '+r.name)&&i===15&&total>300&&sign(p.x+nx*(r.width/2+1.6),p.z+nz*(r.width/2+1.6),yaw+Math.PI,'25','SPEED LIMIT','speed',.63,.83))namedSigns.add('speed '+r.name);
  }
 }
 // Bridge markings follow its continuous crowned support, never the lower shore.
 const bridgeSamples=pathSamples([data.bridge.a,data.bridge.b],6);
 for(let i=0;i<bridgeSamples.length;i++){
  const p=bridgeSamples[i],yaw=Math.atan2(p.dx,p.dz),nx=p.dz,nz=-p.dx;
  for(const d of[-.13,.13])add(p.x+nx*d,p.z+nz*d,yaw,.1,5.97,'yellow');
  for(const side of[-1,1]){
   add(p.x+nx*9.55*side,p.z+nz*9.55*side,yaw,.12,5.97,'white');
   if(i%2===0)add(p.x+nx*3.25*side,p.z+nz*3.25*side,yaw,.12,2.7,'white');
   add(p.x+nx*10.18*side,p.z+nz*10.18*side,yaw,.30,5.96,'curb',.15,.14);
  }
 }
 // Mapped marked crossings only. Unmarked nodes do not acquire invented paint.
 const crossings:MappedCrossing[]=[];
 for(const n of resolvedCrossings){
  if(!inDetailArea(...n.point)||terrain.bridge(...n.point).active)continue;
  const [x,z]=n.point,[dx,dz]=n.direction,yaw=Math.atan2(dx,dz),r={width:n.width};
  crossings.push(n);
  for(let d=-r.width/2+.55;d<r.width/2-.3;d+=.95)add(x+dz*d,z-dx*d,yaw,.47,2.7,'white');
  for(const side of[-1,1]){
   const d=(r.width/2+.5)*side,cx=x+dz*d,cz=z-dx*d;
   if(landClear(cx,cz)){add(cx,cz,yaw,.8,2.4,'curb',.012,.071);add(cx,cz,yaw,.55,1.65,'tactile',.018,.083);}
  }
 }
 // Facility-name boards placed beside an existing path, oriented toward it.
 for(const lm of data.landmarks.filter(l=>/Casino|Aquarium|Conservatory|Museum|Nature Center|Fountain|Beach|Boat House|Lighthouse|Garden/.test(l.name))){
  const candidates=data.roads.flatMap(r=>pathSamples(r.points,12).map(p=>({...p,r,d:Math.hypot(p.x-lm.x,p.z-lm.z)}))).filter(p=>p.d>18&&p.d<90&&(!data.conservatory||lm.id!==data.conservatory.id||greenhouseLocal(data.conservatory,p.x,p.z).u< -22)).sort((a,b)=>a.d-b.d);
  for(const p of candidates){
   let made=false;for(const side of[-1,1]){
    const nx=p.dz*side,nz=-p.dx*side,d=p.r.width/2+1.7;
    if(sign(p.x+nx*d,p.z+nz*d,Math.atan2(-nx,-nz),lm.name,'BELLE ISLE PARK','park',3.0,1.0)){made=true;break;}
   }if(made)break;
  }
 }
 // A welcome sign on the shoulder of the mainland approach.
 const b=data.bridge,dx=(b.b[0]-b.a[0])/b.length,dz=(b.b[1]-b.a[1])/b.length;
 if(!data.entranceSign)sign(b.a[0]-dx*120+dz*12,b.a[1]-dz*120-dx*12,Math.atan2(-dx,-dz),'BELLE ISLE','DETROIT RIVER · PARK ENTRANCE','park',3.8,1.35);
 return {boxes,signs,crossings,stats:{boxes:boxes.length,signs:signs.length,crossings:crossings.length,roads:roads.length},notes:['Generated from mapped corridors; curb extents and sign positions are a reconstruction, not a survey.','Central Avenue direction arrows omitted pending confirmation of the 2026 segment boundaries.','Marked crossings follow mapped OSM nodes and connected crossing-footway intersections; no unmarked crossing is painted. Small bridge markings are preserved.']};
}
