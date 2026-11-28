/** Source sidewalk/crossing centerlines protect a continuous central walking
 * band. Wider sidewalks retain an outer furnishing zone for signal supports.
 * This is a game-layout guard, not an accessibility or engineering survey. */
export type JeffersonWalkingCorridor={
 id:string;sourceIds:readonly (string|number)[];points:readonly (readonly [number,number])[];
 widthM:number;category:string;
};
const CELL=32,MAX_HALF_WALK=.9,FURNITURE_GAP=.1;
type Segment={ax:number;az:number;dx:number;dz:number;length2:number;halfWidth:number};

export function createJeffersonPedestrianClearance(corridors:readonly JeffersonWalkingCorridor[]){
 const cells=new Map<string,Segment[]>();
 for(const corridor of corridors){
  if(!Number.isFinite(corridor.widthM)||corridor.widthM<=0)throw Error('Invalid sidewalk corridor width: '+corridor.id);
  const halfWidth=Math.min(corridor.widthM/2,MAX_HALF_WALK);
  for(let i=1;i<corridor.points.length;i++){
   const a=corridor.points[i-1],b=corridor.points[i];
   if(![...a,...b].every(Number.isFinite))throw Error('Invalid sidewalk corridor point: '+corridor.id);
   const dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
   if(length2<1e-10)continue;
   const segment={ax:a[0],az:a[1],dx,dz,length2,halfWidth};
   // The query expands its cell search by the actual base radius, so source
   // indexing does not silently assume one fixture size.
   for(let x=Math.floor((Math.min(a[0],b[0])-halfWidth-FURNITURE_GAP)/CELL);x<=Math.floor((Math.max(a[0],b[0])+halfWidth+FURNITURE_GAP)/CELL);x++){
    for(let z=Math.floor((Math.min(a[1],b[1])-halfWidth-FURNITURE_GAP)/CELL);z<=Math.floor((Math.max(a[1],b[1])+halfWidth+FURNITURE_GAP)/CELL);z++){
     const key=x+','+z,list=cells.get(key)??[];list.push(segment);cells.set(key,list);
    }
   }
  }
 }
 return (x:number,z:number,baseRadius:number)=>{
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(baseRadius)||baseRadius<0)return false;
  for(let cx=Math.floor((x-baseRadius)/CELL);cx<=Math.floor((x+baseRadius)/CELL);cx++){
   for(let cz=Math.floor((z-baseRadius)/CELL);cz<=Math.floor((z+baseRadius)/CELL);cz++){
    for(const s of cells.get(cx+','+cz)??[]){
     const t=Math.max(0,Math.min(1,((x-s.ax)*s.dx+(z-s.az)*s.dz)/s.length2));
     const dx=x-s.ax-s.dx*t,dz=z-s.az-s.dz*t,clearance=s.halfWidth+FURNITURE_GAP+baseRadius;
     if(dx*dx+dz*dz<clearance*clearance)return false;
    }
   }
  }
  return true;
 };
}
