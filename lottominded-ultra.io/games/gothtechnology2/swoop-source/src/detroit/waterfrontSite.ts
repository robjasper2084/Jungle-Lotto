import data from './waterfront-data.json' with {type:'json'};
import {VALADE} from './valadeSite.ts';
export const WATERFRONT=data;
export const ARETHA={x:-211,z:-1625,osmId:'60624913',name:'Aretha Franklin Amphitheatre / Chene Park'};
export const waterfrontCorridor=(x:number,z:number)=>x> -360&&x<450&&z> -1950&&z<220;
export function polygonContains(points:number[][],x:number,z:number){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export const inWaterfrontPond=(x:number,z:number)=>WATERFRONT.ponds.some(p=>polygonContains(p.points,x,z));
/** The Riverwalk detours inland around the venue. It cannot define the shoreline. */
export function mappedShorelineAt(z:number){
 if(z< -1950||z>220)return undefined;let edge=Infinity;
 // The inlet shoreline doubles back inland. Its open mouth still separates the
 // Detroit River from park terrain; omitting it culled an entire 100 m land tile.
 const mouthA=VALADE.inlet[0],mouthB=VALADE.inlet.at(-1)!;
 if(z<=mouthA[1]&&z>=mouthB[1])edge=mouthA[0]+(mouthB[0]-mouthA[0])*(z-mouthA[1])/(mouthB[1]-mouthA[1]);
 for(const w of WATERFRONT.shoreline)for(let i=1;i<w.points.length;i++){const a=w.points[i-1],b=w.points[i];if(z<Math.min(a[1],b[1])||z>Math.max(a[1],b[1])||Math.abs(b[1]-a[1])<.001)continue;const x=a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);if(x> -650&&x<100)edge=Math.min(edge,x);}
 return Number.isFinite(edge)?edge:undefined;
}
export const waterfrontBuildings=(existing:{id:string;name:string;height:number;points:number[][]}[])=>{const ids=new Set(WATERFRONT.buildings.map(b=>b.id));return [...existing.filter(b=>!ids.has(b.id)),...WATERFRONT.buildings];};
