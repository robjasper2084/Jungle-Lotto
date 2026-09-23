import type {TerrainChunk} from './world.ts';
import {nearestCut,CUT_METRES} from './geography.ts';
import {profileLevel} from './geo-profile.ts';

export function streetElevation(road:{kind:string;bridge?:boolean},x:number,z:number,terrain:number){
  const c=nearestCut(x,z),walk=['cycleway','footway','path','pedestrian'].includes(road.kind);
  return c.d>280&&c.d<=CUT_METRES&&Math.abs(c.u)<35&&(!walk||road.bridge)?profileLevel(c.d,'street'):terrain;
}

type Point={x:number;z:number};
export type StreetRibbon={a:Point;b:Point;half:number;offset:number;lift:number};
/** Clip a mapped road onto the actual terrain triangles. This prevents both
 * buried asphalt on coarse terrain and a long street belonging to one distant tile. */
export function drapeStreet(r:StreetRibbon,chunks:TerrainChunk[],height:(x:number,z:number,terrain:number)=>number){
  const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,len=Math.hypot(dx,dz);
  if(len<.001)return [];
  const nx=-dz/len,nz=dx/len;
  const poly=[
    {x:r.a.x+nx*(r.offset-r.half),z:r.a.z+nz*(r.offset-r.half)},
    {x:r.b.x+nx*(r.offset-r.half),z:r.b.z+nz*(r.offset-r.half)},
    {x:r.b.x+nx*(r.offset+r.half),z:r.b.z+nz*(r.offset+r.half)},
    {x:r.a.x+nx*(r.offset+r.half),z:r.a.z+nz*(r.offset+r.half)}
  ];
  return drapePolygon(poly,chunks,height,r.lift);
}
export function drapeJunction(x:number,z:number,radius:number,chunks:TerrainChunk[],height:(x:number,z:number,terrain:number)=>number,lift:number){
  return drapePolygon(Array.from({length:16},(_,i)=>({x:x+Math.cos(i*Math.PI/8)*radius,z:z+Math.sin(i*Math.PI/8)*radius})),chunks,height,lift);
}
function drapePolygon(poly:Point[],chunks:TerrainChunk[],height:(x:number,z:number,terrain:number)=>number,lift:number){
  const minX=Math.min(...poly.map(p=>p.x)),maxX=Math.max(...poly.map(p=>p.x)),minZ=Math.min(...poly.map(p=>p.z)),maxZ=Math.max(...poly.map(p=>p.z));
  const result:{chunk:TerrainChunk;positions:number[]}[]=[];
  for(const chunk of chunks){
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
