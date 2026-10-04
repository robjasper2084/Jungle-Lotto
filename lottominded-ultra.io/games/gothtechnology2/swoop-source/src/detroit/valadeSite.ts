import data from './valade-data.json' with {type:'json'};
export const VALADE=data;
function contains(points:number[][],x:number,z:number){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export const inValadePark=(x:number,z:number)=>contains(VALADE.park,x,z);
export const inValadeInlet=(x:number,z:number)=>contains(VALADE.inlet,x,z);
export const inValadeBeach=(x:number,z:number)=>contains(VALADE.beach,x,z);
export const valadeTerrainDetail=(x:number,z:number)=>x+50>-280&&x-50<-115&&z+50>-1920&&z-50<-1770;
