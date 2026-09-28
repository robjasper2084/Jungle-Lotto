/** Find a Grave memorial 2255 GPS, cross-checked with Elmwood's Hazel Dell tour stop 30.
 * WGS84 42.3492177, -83.0196698 -> EPSG:26917 minus the site's surveyed-data origin.
 * Contributor GPS is the placement anchor; it is not a survey guarantee. */
export const ELMWOOD_YOUNG={x:-153.6358,north:468.1876,latitude:42.3492177,longitude:-83.0196698,heading:.406,width:1.85,depth:.62};
export const ELMWOOD_GATE={x:-14.0,north:-34.0,heading:Math.atan2(8.968,-21.241),opening:5.4};
/** Approximate paved forecourt edges interpreted from Google satellite, north of gatehouse. */
export const ELMWOOD_PARKING=[[-19,7],[17,22],[10,39],[-27,23]];
export type ElmwoodFeature={id:string;kind:string;points:number[][];tags:Record<string,string>};
export type Curb={x:number;north:number;heading:number;length:number;width:number};
export function makeElmwoodCurbs(features:ElmwoodFeature[]):Curb[]{
 const paths=features.filter(f=>f.kind==='path'),curbs:Curb[]=[];
 for(const f of paths){if(f.tags.highway!=='service'||f.tags.bridge==='yes')continue;
  for(let j=1;j<f.points.length;j++){const a=f.points[j-1],b=f.points[j],dx=b[0]-a[0],dn=b[1]-a[1],len=Math.hypot(dx,dn);if(len<.5)continue;
   const count=Math.ceil(len/2.4);
   for(let k=0;k<count;k++){const t=(k+.5)/count,cx=a[0]+dx*t,cn=a[1]+dn*t;
    // References show low kerbs at the office drives and chapel forecourt, not every rural lane.
    if(Math.hypot(cx,cn)>85&&Math.hypot(cx+61.94,cn-331.29)>32)continue;
    for(const side of [-1,1]){const x=cx-dn/len*2.15*side,north=cn+dx/len*2.15*side;
     const junction=paths.some(other=>other.id!==f.id&&other.points.slice(1).some((q,i)=>segmentDistance(x,north,other.points[i],q)<2.65));
     if(!junction&&!inRing(x,north,ELMWOOD_PARKING))curbs.push({x,north,heading:Math.atan2(dx,-dn),length:len/count-.045,width:.23});
    }
   }
  }
 }
 return curbs;
}
export function segmentDistance(x:number,n:number,a:number[],b:number[]){const dx=b[0]-a[0],dn=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(n-a[1])*dn)/(dx*dx+dn*dn||1)));return Math.hypot(x-a[0]-t*dx,n-a[1]-t*dn);}
export function inRing(x:number,n:number,ring:number[][]){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>n)!==(b[1]>n)&&x<(b[0]-a[0])*(n-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function curbContains(c:Curb,x:number,n:number){const dx=x-c.x,dz=-(n-c.north),s=Math.sin(c.heading),co=Math.cos(c.heading);return Math.abs(dx*co-dz*s)<c.width/2&&Math.abs(dx*s+dz*co)<c.length/2;}
/** Face into a usable lane, respecting one-way drives instead of blindly inheriting OSM point order. */
export function chooseElmwoodSpawn(segments:{a:number[];b:number[];feature:ElmwoodFeature}[],x:number,north:number,view:{x:number;z:number}){
 let best={x,north,heading:0},bestScore=-Infinity;
 for(const seg of segments){const dx=seg.b[0]-seg.a[0],dn=seg.b[1]-seg.a[1],len=Math.hypot(dx,dn);if(len<3)continue;
  const t=Math.max(1.5/len,Math.min(1-1.5/len,((x-seg.a[0])*dx+(north-seg.a[1])*dn)/(len*len))),px=seg.a[0]+dx*t,pn=seg.a[1]+dn*t,dist=Math.hypot(px-x,pn-north);
  for(const sign of seg.feature.tags.oneway==='yes'?[1]:[1,-1]){const end=sign===1?seg.b:seg.a,remaining=(sign===1?1-t:t)*len;
   const linked=segments.some(s=>s!==seg&&[s.a,s.b].some(p=>Math.hypot(p[0]-end[0],p[1]-end[1])<1));
   const score=-dist*4+Math.min(remaining+(linked?20:0),30)+(view.x*dx-view.z*dn)/len*sign*4;
   if(score>bestScore){bestScore=score;best={x:px,north:pn,heading:Math.atan2(dx*sign,-dn*sign)};}
  }
 }
 return best;
}
