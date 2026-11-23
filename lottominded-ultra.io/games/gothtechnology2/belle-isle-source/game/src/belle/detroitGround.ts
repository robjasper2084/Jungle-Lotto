import raw from './detroitDistricts.json' with {type:'json'};
import type {Point,Landmark} from './terrain.ts';

export type Street={id:string;name:string;width:number;points:Point[]};
type DistrictData={
  greenway:[number,number,number][];bridges:{name:string;points:Point[]}[];
  models:{asset:string;point:Point;yaw:number;scale:number}[];
  routes:{cut:Point[];elmwood:Point[]}; land:Point[][][]; flat:Point[][][]; roads:Street[];
  buildings:{id:string;height:number;points:Point[]}[]; water:Point[][];
  trees:Point[]; stones:[number,number,number][]; gate:Point; cut:Point;
  grid:{x0:number;z0:number;nx:number;nz:number;step:number;heights:number[]}
};
export const districts=raw as unknown as DistrictData;
const grid=districts.grid;
export function districtHeight(x:number,z:number):number|undefined {
  const u=(x-grid.x0)/grid.step,v=(z-grid.z0)/grid.step;
  if(u<0||v<0||u>=grid.nx-1||v>=grid.nz-1)return undefined;
  const i=Math.floor(u),j=Math.floor(v),t=u-i,s=v-j,k=j*grid.nx+i;
  const a=grid.heights[k],b=grid.heights[k+1],c=grid.heights[k+grid.nx],d=grid.heights[k+grid.nx+1];
  // Both collision and the visual mesh use the same NW–SE diagonal.
  return 2+(t>=s?a+(b-a)*t+(d-b)*s:a+(d-c)*t+(c-a)*s)/100;
}
const trailCells=new Map<string,number[]>();
for(let i=1;i<districts.greenway.length;i++){
 const a=districts.greenway[i-1],b=districts.greenway[i];
 for(let cx=Math.floor((Math.min(a[0],b[0])-11)/32);cx<=Math.floor((Math.max(a[0],b[0])+11)/32);cx++){
  for(let cz=Math.floor((Math.min(a[1],b[1])-11)/32);cz<=Math.floor((Math.max(a[1],b[1])+11)/32);cz++){
   const key=cx+','+cz,cell=trailCells.get(key)??[];cell.push(i);trailCells.set(key,cell);
  }
 }
}
const trailEastBound=Math.max(...districts.greenway.map(p=>p[0]))+11;
export function greenwayHeight(x:number,z:number,referenceY?:number){
 if(x>trailEastBound)return undefined;
 const cell=trailCells.get(Math.floor(x/32)+','+Math.floor(z/32));if(!cell)return undefined;
 let nearest=10,depth=0;
 for(const i of cell){
  const a=districts.greenway[i-1],b=districts.greenway[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
  if(d<nearest){nearest=d;depth=a[2]+(b[2]-a[2])*t;}
 }
 if(nearest>=10)return undefined;
 if(referenceY===undefined||referenceY>1){
  for(const bridge of districts.bridges){
   let yes=false;
   for(let i=0,j=bridge.points.length-1;i<bridge.points.length;j=i++){
    const a=bridge.points[j],b=bridge.points[i];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
   }
   if(yes)return 2;
  }
 }
 return 2-depth*Math.min(1,(10-nearest)/6);
}
export const districtDestinations:Landmark[]=[
  {id:'greater-detroit-island',name:'Belle Isle · MacArthur Bridge island landing',kind:'trail',x:districts.routes.cut[0][0],z:districts.routes.cut[0][1]},
  {id:'greater-detroit-cut',name:'Swoop Detroit · Dequindre Cut at East Jefferson',kind:'trail',x:districts.cut[0],z:districts.cut[1]},
  {id:'greater-detroit-elmwood',name:'Elmwood Cemetery · entrance lane',kind:'trail',x:districts.gate[0],z:districts.gate[1]},
];
export function districtName(x:number,z:number){
  if(districtHeight(x,z)!==undefined)return 'Elmwood · cemetery district';
  if(greenwayHeight(x,z)!==undefined)return 'Swoop Detroit · Dequindre Cut';
  return x< -450&&x>=-2800&&z<1550?'Swoop Detroit · East Side':undefined;
}
