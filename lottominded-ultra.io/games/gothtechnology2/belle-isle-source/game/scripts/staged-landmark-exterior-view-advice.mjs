import assert from 'node:assert/strict';

const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
function entry(origin,target,box){
 let first=0,last=1;
 for(let axis=0;axis<3;axis++){
  const delta=target[axis]-origin[axis];
  if(Math.abs(delta)<1e-14){if(origin[axis]<box.min[axis]||origin[axis]>box.max[axis])return null;continue;}
  const a=(box.min[axis]-origin[axis])/delta,b=(box.max[axis]-origin[axis])/delta;
  first=Math.max(first,Math.min(a,b));last=Math.min(last,Math.max(a,b));if(first>last)return null;
 }
 return first;
}

/** Sparse bound rays rank existing legal viewpoint candidates. They never
 * accept an image, mutate a scene, or replace the original terrain/body checks.
 * Sample base, middle, wings and roof; stop at the first target-bound surface
 * so geometry behind the target cannot masquerade as a foreground obstruction. */
export function createExteriorViewScorer(observation){
 const target=observation?.target;
 assert(target&&finitePoint(target.min)&&finitePoint(target.max)&&target.min.every((n,i)=>n<=target.max[i]),'Invalid view advice bounds');
 assert(Array.isArray(observation.boxes)&&observation.boxes.length<=40000,'Invalid bounded view advice');
 for(const box of observation.boxes)assert(finitePoint(box.min)&&finitePoint(box.max)&&box.min.every((n,i)=>n<=box.max[i]),'Invalid blocker bounds');
 const points=[];for(const x of[0,.5,1])for(const y of[0,.5,1])for(const z of[0,.5,1])points.push([x,y,z].map((f,i)=>target.min[i]+f*(target.max[i]-target.min[i])));
 return position=>{
 assert(finitePoint(position),'Invalid view advice origin');
 const candidates=observation.boxes.filter(box=>box.min.every((n,i)=>n<=Math.max(position[i],target.max[i]))&&box.max.every((n,i)=>n>=Math.min(position[i],target.min[i])));
 let blocked=0;const hits=new Map();
 for(const point of points){
  const stop=entry(position,point,target);assert(stop!==null,'Target bound sample cannot be missed');
  let nearest=null,distance=stop;
  for(const box of candidates){
   const at=entry(position,point,box);
   if(at!==null&&at<distance-1e-8){nearest=box;distance=at;}
  }
  if(nearest){blocked++;const key=nearest.uuid+':'+nearest.instanceId+':'+nearest.material;const row=hits.get(key)??{mesh:nearest.mesh,instanceId:nearest.instanceId,material:nearest.material,samples:0,conservativeAlpha:nearest.conservativeAlpha,deformationUnresolved:nearest.deformationUnresolved};row.samples++;hits.set(key,row);}
 }
 return{blockedSamples:blocked,totalSamples:points.length,obstructionBounds:[...hits.values()].sort((a,b)=>b.samples-a.samples),
  unsupported:observation.unsupported??[],scope:observation.scope,visualAcceptance:null};
 };
}

export const scoreExteriorViewpoint=(observation,position)=>createExteriorViewScorer(observation)(position);
