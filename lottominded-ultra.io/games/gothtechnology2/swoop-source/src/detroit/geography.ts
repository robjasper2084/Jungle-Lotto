import data from './city-data.json' with {type:'json'};
export const CITY=data;
type Point=number[];
export const CUT_LINE=data.cut;
export const CUT_DIST=[0];
for(let i=1;i<CUT_LINE.length;i++)CUT_DIST.push(CUT_DIST[i-1]+Math.hypot(CUT_LINE[i][0]-CUT_LINE[i-1][0],CUT_LINE[i][1]-CUT_LINE[i-1][1]));
export const CUT_METRES=CUT_DIST.at(-1)!;
export function pointOnCut(distance:number,u=0){
  const d=Math.max(0,Math.min(CUT_METRES,distance));let i=1;while(i<CUT_DIST.length-1&&CUT_DIST[i]<d)i++;
  const a=CUT_LINE[i-1],b=CUT_LINE[i],len=CUT_DIST[i]-CUT_DIST[i-1],t=(d-CUT_DIST[i-1])/len,dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
  return{x:a[0]+(b[0]-a[0])*t-dz*u,z:a[1]+(b[1]-a[1])*t+dx*u,heading:Math.atan2(dx,dz)};
}
export function nearestCut(x:number,z:number){
  let best=Infinity,d=0,u=0;
  for(let i=1;i<CUT_LINE.length;i++){
    const a=CUT_LINE[i-1],b=CUT_LINE[i],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2));
    const qx=x-a[0]-dx*t,qz=z-a[1]-dz*t,dist=qx*qx+qz*qz;
    if(dist<best){best=dist;d=CUT_DIST[i-1]+Math.sqrt(l2)*t;u=(qx*-dz+qz*dx)/Math.sqrt(l2);}
  }
  // Retain real distance past Mack so the terrain can join the city gradually.
  // A sentinel distance here used to turn a one-metre step into a three-metre cliff.
  const first=CUT_LINE[0],last=CUT_LINE.at(-1)!;
  if(d===0&&Math.hypot(x-first[0],z-first[1])>Math.abs(u)+2)d=-1;
  if(d===CUT_METRES){
    const previous=CUT_LINE.at(-2)!,dx=last[0]-previous[0],dz=last[1]-previous[1],len=Math.hypot(dx,dz);
    d+=Math.max(0,((x-last[0])*dx+(z-last[1])*dz)/len);
  }
  return{d,u,distance:Math.sqrt(best)};
}
type Segment={a:Point;b:Point;width:number;name:string;kind:string};
const cells=new Map<string,Segment[]>();
for(const road of data.roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],s={a,b,width:road.width,name:road.name,kind:road.kind};
  for(let x=Math.floor((Math.min(a[0],b[0])-20)/64);x<=Math.floor((Math.max(a[0],b[0])+20)/64);x++)
    for(let z=Math.floor((Math.min(a[1],b[1])-20)/64);z<=Math.floor((Math.max(a[1],b[1])+20)/64);z++){
      const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(s);
    }
}
export function roadAt(x:number,z:number){
  let nearest:Segment|undefined,best=Infinity;
  for(const s of cells.get(Math.floor(x/64)+','+Math.floor(z/64))??[]){
    const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],l2=dx*dx+dz*dz;if(l2<.01)continue;
    const t=Math.max(0,Math.min(1,((x-s.a[0])*dx+(z-s.a[1])*dz)/l2));
    const dist=Math.hypot(x-s.a[0]-dx*t,z-s.a[1]-dz*t);
    if(dist<s.width/2+1&&dist<best){nearest=s;best=dist;}
  }
  return nearest;
}
const riverPoints=data.roads.filter(r=>r.name==='Detroit Riverwalk').flatMap(r=>r.points);
export function riverEdge(z:number){
  let min=Infinity;
  for(const p of riverPoints)if(Math.abs(p[1]-z)<55)min=Math.min(min,p[0]);
  return Number.isFinite(min)?min-13:-160;
}
export function nearestRiverPoint(z:number){
  let best=Infinity,p=riverPoints[0];
  for(const q of riverPoints){const d=Math.abs(q[1]-z);if(d<best){best=d;p=q;}}
  return{x:p[0],z:p[1]};
}
export function inCity(x:number,z:number){
  const east=-z*.8660254-x*.5,north=-z*.5+x*.8660254;
  const lat=42.3283+north/111320,lon=-83.0399+east/(111320*Math.cos(42.3283*Math.PI/180));
  return lat>=42.324&&lat<=42.362&&lon>=-83.053&&lon<=-83.015&&x>riverEdge(z)-40;
}
