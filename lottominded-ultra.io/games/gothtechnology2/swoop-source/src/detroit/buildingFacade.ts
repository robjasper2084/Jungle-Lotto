import * as T from 'three';
/** Render-only walls. The original collision envelope and roof elevation stay authoritative. */
export function buildingFacade(source:T.BufferGeometry,points:number[][],ground:(x:number,z:number)=>number){
 source.computeBoundingBox();
 const bounds=source.boundingBox!,bottom=bounds.min.y,top=bounds.max.y;
 let grade=Number(source.userData.streetBase??bottom);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4));
  for(let j=0;j<=steps;j++)grade=Math.max(grade,ground(a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps));
 }
 const base=Math.min(top-.5,grade+.24),facade=source.clone(),position=facade.getAttribute('position');
 for(let i=0;i<position.count;i++)if(position.getY(i)<base)position.setY(i,base);
 position.needsUpdate=true;facade.computeBoundingBox();facade.computeBoundingSphere();
 const foundation=base>bottom+.01?source.clone():undefined;
 if(foundation){
  const p=foundation.getAttribute('position'),uv=foundation.getAttribute('uv'),normal=foundation.getAttribute('normal');
  for(let i=0;i<p.count;i++){p.setY(i,Math.min(p.getY(i),base));uv.setXY(i,(Math.abs(normal.getX(i))>.5?p.getZ(i):p.getX(i))/4,(p.getY(i)-bottom)/4);}
  p.needsUpdate=true;uv.needsUpdate=true;foundation.clearGroups();foundation.computeBoundingBox();foundation.computeBoundingSphere();
 }
 return {facade,foundation,base,top};
}
/** Whole window bays per wall; vertical repeats begin at the building's own sill datum. */
export function alignBuildingFacade(geometry:T.BufferGeometry,base:number,top:number,rows=3,bayWidth=2.4,floorHeight=3){
 const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal');
 const repeats=Math.max(1,Math.round((top-base)/(rows*floorHeight)));
 for(const group of geometry.groups){
  if(group.materialIndex!==1)continue;
  // ExtrudeGeometry emits six consecutive vertices for each straight wall.
  for(let start=group.start;start<group.start+group.count;start+=6){
   const end=Math.min(start+6,p.count),nx=normal.getX(start),nz=normal.getZ(start);
   let lo=Infinity,hi=-Infinity;
   for(let i=start;i<end;i++){const u=p.getX(i)*nz-p.getZ(i)*nx;lo=Math.min(lo,u);hi=Math.max(hi,u);}
   const bays=Math.max(1,Math.round((hi-lo)/bayWidth));
   for(let i=start;i<end;i++)uv.setXY(i,(p.getX(i)*nz-p.getZ(i)*nx-lo)/Math.max(.001,hi-lo)*bays/4,(p.getY(i)-base)/Math.max(.001,top-base)*repeats);
  }
 }
 uv.needsUpdate=true;
}
