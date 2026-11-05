import type {TerrainChunk} from './world.ts';
import {nearestCut,CUT_METRES} from './geography.ts';
import {profileLevel} from './geo-profile.ts';

/** Distinct overlay heights keep a parallel walk from fighting the road depth.
 * The same triangles are registered for riding, so the curb-free seam is tiny. */
export const streetSurfaceLift=(road:{kind:string;name?:string})=>road.name==='Dequindre Cut Greenway'?.075:['footway','pedestrian'].includes(road.kind)?.06:['cycleway','path'].includes(road.kind)?.055:.035;

export function streetElevation(road:{kind:string;bridge?:boolean},x:number,z:number,terrain:number){
  const c=nearestCut(x,z),walk=['cycleway','footway','path','pedestrian'].includes(road.kind);
  // Mapped waterfront walks and bridges keep a dry support surface above the
  // basin cutout. The marina area includes some edge paths as well as water.
  if(walk&&x<30&&z<-1000&&terrain<0)return 0;
  return c.d>280&&c.d<=CUT_METRES&&Math.abs(c.u)<35&&(!walk||road.bridge)?profileLevel(c.d,'street'):terrain;
}

export type StreetPoint={x:number;z:number};
type Point=StreetPoint;
export type StreetRibbon={a:Point;b:Point;half:number;offset:number;lift:number;maxSpan?:number;joinA?:Point;joinB?:Point;exclude?:Point[][];boundary?:Point[]};
export function insideStreetFootprint(p:Point,poly:Point[]){
 let positive=false,negative=false;
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],cross=(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);positive ||= cross>1e-8;negative ||= cross< -1e-8;}
 return poly.length>=3&&!(positive&&negative);
}
/** One miter per shared vertex keeps offset sidewalks/curbs joined at bends.
 * Limit acute corners rather than extruding a long spike into the junction. */
export function streetVertexNormal(points:number[][],index:number):Point{
 const normal=(a:number[],b:number[])=>{const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;return {x:-dz/length,z:dx/length};};
 const p=points[index],before=points[index-1],after=points[index+1];
 if(!before)return normal(p,after);if(!after)return normal(before,p);
 const a=normal(before,p),b=normal(p,after),den=1+a.x*b.x+a.z*b.z;
 if(den<.25)return b;
 return {x:(a.x+b.x)/den,z:(a.z+b.z)/den};
}
/** Intersect the strip with its two join planes. Joining the four offset
 * corners directly can make a bow-tie when a bend is wider than its segment.
 * A convex footprint trims that folded inner corner without painting a
 * backwards triangle across the adjoining sidewalk. */
export function streetFootprint(r:StreetRibbon):Point[]{
 const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,len=Math.hypot(dx,dz);
 if(len<.001||r.half<=0)return [];
 const tx=dx/len,tz=dz/len,n={x:-tz,z:tx};
 const valid=(join:Point|undefined)=>join&&join.x*n.x+join.z*n.z>.1?join:n;
 const na=valid(r.joinA),nb=valid(r.joinB),low=r.offset-r.half,high=r.offset+r.half;
 const ext=Math.max(Math.abs(low),Math.abs(high))*Math.max(Math.hypot(na.x,na.z),Math.hypot(nb.x,nb.z))+1;
 let poly=[[-ext,low],[len+ext,low],[len+ext,high],[-ext,high]].map(([t,s])=>({x:r.a.x+tx*t+n.x*s,z:r.a.z+tz*t+n.z*s}));
 for(const [origin,join,sign] of [[r.a,na,-1],[r.b,nb,1]] as const){
  const input=poly;poly=[];
  const distance=(p:Point)=>sign*(join.x*(p.z-origin.z)-join.z*(p.x-origin.x));
  for(let i=0;i<input.length;i++){
   const a=input[i],b=input[(i+1)%input.length],da=distance(a),db=distance(b);
   if(da>=-1e-9)poly.push(a);
   if((da>0&&db<0)||(da<0&&db>0)){const t=da/(da-db);poly.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
  }
 }
 return poly.length>=3?poly:[];
}
/** Keep finely sampled curb ramps inside the original joined ribbon. */
function intersectStreetFootprints(poly:Point[],clip:Point[]):Point[]{
 if(clip.length<3)return [];
 const signed=clip.reduce((sum,p,i)=>sum+p.x*clip[(i+1)%clip.length].z-p.z*clip[(i+1)%clip.length].x,0),direction=signed>=0?1:-1;
 for(let edge=0;edge<clip.length&&poly.length;edge++){
  const a=clip[edge],b=clip[(edge+1)%clip.length],input=poly;poly=[];
  const side=(p:Point)=>direction*((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x));
  for(let i=0;i<input.length;i++){
   const p=input[i],q=input[(i+1)%input.length],sp=side(p),sq=side(q);
   if(sp>=-1e-9)poly.push(p);
   if((sp>0&&sq<0)||(sp<0&&sq>0)){const t=sp/(sp-sq);poly.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}
  }
 }
 return poly.length>=3?poly:[];
}
/** Subtract a convex road footprint from a convex surface. Outside pieces are
 * disjoint, retain winding, and are clipped BEFORE terrain tessellation. */
export function subtractStreetFootprint(poly:Point[],footprint:Point[]):Point[][]{
 if(footprint.length<3)return [poly];
 let signed=0;for(let i=0;i<footprint.length;i++){const a=footprint[i],b=footprint[(i+1)%footprint.length];signed+=a.x*b.z-a.z*b.x;}
 const direction=signed>=0?1:-1,out:Point[][]=[];let remaining=poly;
 for(let e=0;e<footprint.length&&remaining.length>=3;e++){
  const a=footprint[e],b=footprint[(e+1)%footprint.length],inside:Point[]=[],outside:Point[]=[];
  const side=(p:Point)=>direction*((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x));
  for(let i=0;i<remaining.length;i++){
   const p=remaining[i],q=remaining[(i+1)%remaining.length],sp=side(p),sq=side(q);
   // A vertex on the cut belongs to both halves. Dropping it from the outside
   // half deleted entire approach triangles when a nearby cap merely touched
   // a corner (including large faces nowhere inside the excluded street).
   if(sp>=-1e-8)inside.push(p);
   if(sp<=1e-8)outside.push(p);
   if((sp>1e-8&&sq<-1e-8)||(sp<-1e-8&&sq>1e-8)){const t=sp/(sp-sq),cut={x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t};inside.push(cut);outside.push(cut);}
  }
  if(outside.length>=3)out.push(outside);remaining=inside;
 }
 return out;
}
/** Clip a mapped road onto the actual terrain triangles. This prevents both
 * buried asphalt on coarse terrain and a long street belonging to one distant tile. */
export function drapeStreet(r:StreetRibbon,chunks:TerrainChunk[],height:(x:number,z:number,terrain:number)=>number):{chunk:TerrainChunk;positions:number[]}[]{
  const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,len=Math.hypot(dx,dz);
  if(len<.001)return [];
  // Curb cuts change height within a metre. Sampling only terrain triangle
  // corners stretches that ramp over an entire street and makes jagged wedges.
  if(r.maxSpan&&len>r.maxSpan){
    const count=Math.ceil(len/r.maxSpan),pieces:ReturnType<typeof drapeStreet>=[],cuts=new Set([0,count]),nx=-dz/len,nz=dx/len;
    const levels=(t:number)=>[-r.half,r.half].map(side=>height(r.a.x+dx*t+nx*(r.offset+side),r.a.z+dz*t+nz*(r.offset+side),0));
    let previous=levels(0);
    for(let i=1;i<=count;i++){
      const next=levels(i/count),mid=levels((i-.5)/count);
      if(next.some((v,k)=>Math.abs(v-previous[k])>.003||Math.abs(mid[k]-(v+previous[k])/2)>.003)){cuts.add(i-1);cuts.add(i);}
      previous=next;
    }
    // Keep flat stretches coarse; only ramp transitions need fine tessellation.
    // This avoids millions of unnecessary sidewalk triangles on weak devices.
    const stations=[...cuts].sort((a,b)=>a-b);
    const envelope=r.boundary?intersectStreetFootprints(streetFootprint(r),r.boundary):streetFootprint(r);
    for(let i=1;i<stations.length;i++){
      const sub=streetFootprint({...r,maxSpan:undefined,joinA:i===1?r.joinA:undefined,joinB:i===stations.length-1?r.joinB:undefined,a:{x:r.a.x+dx*stations[i-1]/count,z:r.a.z+dz*stations[i-1]/count},b:{x:r.a.x+dx*stations[i]/count,z:r.a.z+dz*stations[i]/count}});
      const poly=intersectStreetFootprints(sub,envelope);
      if(poly.length)pieces.push(...drapePolygon(poly,chunks,height,r.lift,r.exclude));
    }
    return pieces;
  }
  const poly=r.boundary?intersectStreetFootprints(streetFootprint(r),r.boundary):streetFootprint(r);
  if(!poly.length)return [];
  return drapePolygon(poly,chunks,height,r.lift,r.exclude);
}
export function drapeJunction(x:number,z:number,radius:number,chunks:TerrainChunk[],height:(x:number,z:number,terrain:number)=>number,lift:number,exclude?:Point[][]){
  return drapePolygon(Array.from({length:16},(_,i)=>({x:x+Math.cos(i*Math.PI/8)*radius,z:z+Math.sin(i*Math.PI/8)*radius})),chunks,height,lift,exclude);
}
// Cache resident terrain tiles by their 100 m grid. Road construction visits
// only intersecting tiles instead of scanning the full map for every strip.
const chunkIndexes=new WeakMap<TerrainChunk[],{length:number;cells:Map<string,TerrainChunk>;minX:number;maxX:number;minZ:number;maxZ:number}>();
function streetChunks(chunks:TerrainChunk[],minX:number,maxX:number,minZ:number,maxZ:number){
 let index=chunkIndexes.get(chunks);
 if(!index||index.length!==chunks.length){const cells=new Map<string,TerrainChunk>();let lowX=Infinity,highX=-Infinity,lowZ=Infinity,highZ=-Infinity;
  for(const c of chunks){const x=Math.floor((c.x-50)/100),z=Math.floor((c.z-50)/100);cells.set(x+','+z,c);lowX=Math.min(lowX,x);highX=Math.max(highX,x);lowZ=Math.min(lowZ,z);highZ=Math.max(highZ,z);}
  index={length:chunks.length,cells,minX:lowX,maxX:highX,minZ:lowZ,maxZ:highZ};chunkIndexes.set(chunks,index);
 }
 const result:TerrainChunk[]=[];
 for(let z=Math.max(index.minZ,Math.floor(minZ/100));z<=Math.min(index.maxZ,Math.floor(maxZ/100));z++)for(let x=Math.max(index.minX,Math.floor(minX/100));x<=Math.min(index.maxX,Math.floor(maxX/100));x++){const c=index.cells.get(x+','+z);if(c)result.push(c);}
 return result;
}
function drapePolygon(poly:Point[],chunks:TerrainChunk[],height:(x:number,z:number,terrain:number)=>number,lift:number,exclude?:Point[][]):{chunk:TerrainChunk;positions:number[]}[]{
  if(exclude?.length){let pieces=[poly];for(const footprint of exclude)pieces=pieces.flatMap(p=>subtractStreetFootprint(p,footprint));return pieces.flatMap(p=>drapePolygon(p,chunks,height,lift));}
  const minX=Math.min(...poly.map(p=>p.x)),maxX=Math.max(...poly.map(p=>p.x)),minZ=Math.min(...poly.map(p=>p.z)),maxZ=Math.max(...poly.map(p=>p.z));
  const result:{chunk:TerrainChunk;positions:number[]}[]=[];
  for(const chunk of streetChunks(chunks,minX,maxX,minZ,maxZ)){
    const x0=chunk.x-50,z0=chunk.z-50;
    if(maxX<x0||minX>x0+100||maxZ<z0||minZ>z0+100)continue;
    const n=Math.round(Math.sqrt(chunk.vertices.length/3))-1,step=100/n,out:number[]=[];
    const ix0=Math.max(0,Math.floor((minX-x0)/step)),ix1=Math.min(n-1,Math.floor((maxX-x0)/step));
    const iz0=Math.max(0,Math.floor((minZ-z0)/step)),iz1=Math.min(n-1,Math.floor((maxZ-z0)/step));
    for(let z=iz0;z<=iz1;z++)for(let x=ix0;x<=ix1;x++)for(let tri=0;tri<2;tri++){
      const start=(z*n+x)*6+tri*3;
      const corners=[0,1,2].map(k=>{const i=chunk.indices[start+k]*3;return {x:chunk.vertices[i],y:chunk.vertices[i+1],z:chunk.vertices[i+2]};});
      let clipped:Point[]=poly;
      // Terrain triangles have upward normals, hence clockwise winding in XZ.
      for(let edge=0;edge<3&&clipped.length;edge++){
        const a=corners[edge],b=corners[(edge+1)%3];
        const side=(p:Point)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
        const input=clipped;clipped=[];
        for(let i=0;i<input.length;i++){
          const p=input[i],q=input[(i+1)%input.length],sp=side(p),sq=side(q);
          if(sp<=1e-7)clipped.push(p);
          if((sp<0&&sq>0)||(sp>0&&sq<0)){const t=sp/(sp-sq);clipped.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}
        }
      }
      if(clipped.length<3)continue;
      const [a,b,c]=corners,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
      const y=(p:Point)=>{
        const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/den;
        const v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/den;
        const terrain=u*a.y+v*b.y+(1-u-v)*c.y;
        return Math.max(terrain,height(p.x,p.z,terrain))+lift;
      };
      for(let i=1;i<clipped.length-1;i++){
        const [a,b,c]=[clipped[0],clipped[i],clipped[i+1]];
        if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))<1e-9)continue;
        // Ribbon is counter-clockwise in XZ; reverse it for an upward-facing surface.
        for(const p of [a,c,b])out.push(p.x,y(p),p.z);
      }
    }
    if(out.length)result.push({chunk,positions:out});
  }
  return result;
}
