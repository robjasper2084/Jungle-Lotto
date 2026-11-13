import type * as T from 'three';
/** Broaden cloned leaves/cards and fill leaf-island gaps without adding triangles. */
export const CANOPY_WIDTH=1.12,LEAF_PATCH_SCALE=1.28;
export function thickenLeafIslands(geometry:T.BufferGeometry){
 const p=geometry.getAttribute('position'),index=geometry.index;if(!p||!index||p.count===0)return 0;
 const parent=new Int32Array(p.count),count=new Uint32Array(p.count),sum=new Float64Array(p.count*3);for(let i=0;i<p.count;i++)parent[i]=i;
 const find=(v:number)=>{while(parent[v]!==v){parent[v]=parent[parent[v]];v=parent[v];}return v;};
 for(let i=0;i<index.count;i+=3){const a=find(index.getX(i)),b=find(index.getX(i+1)),c=find(index.getX(i+2));parent[b]=a;parent[c]=a;}
 for(let i=0;i<p.count;i++){const r=find(i);parent[i]=r;count[r]++;sum[r*3]+=p.getX(i);sum[r*3+1]+=p.getY(i);sum[r*3+2]+=p.getZ(i);}
 let islands=0;for(let i=0;i<count.length;i++)if(count[i]>=3&&count[i]<=12)islands++;
 for(let i=0;i<p.count;i++){const r=parent[i],n=count[r];if(n<3||n>12)continue;const x=sum[r*3]/n,y=sum[r*3+1]/n,z=sum[r*3+2]/n;p.setXYZ(i,x+(p.getX(i)-x)*LEAF_PATCH_SCALE,y+(p.getY(i)-y)*LEAF_PATCH_SCALE,z+(p.getZ(i)-z)*LEAF_PATCH_SCALE);}
 if(islands)p.needsUpdate=true;return islands;
}
export function fullerCanopy(geometry:T.BufferGeometry,leafIslands=false){if(leafIslands)thickenLeafIslands(geometry);geometry.computeBoundingBox();const box=geometry.boundingBox;if(!box||box.isEmpty())return;const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2,p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setXYZ(i,cx+(p.getX(i)-cx)*CANOPY_WIDTH,p.getY(i),cz+(p.getZ(i)-cz)*CANOPY_WIDTH);p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();}
export function gardenDetailFraction(distance:number){const safe=Number.isFinite(distance)?Math.max(0,distance):150,t=Math.max(0,Math.min(1,(safe-85)/65));return 1-.65*t*t*(3-2*t);}
