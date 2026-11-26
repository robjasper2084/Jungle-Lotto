import * as T from 'three';

/** Place the fixture caster on a real in-view asphalt triangle. A fixed 24 m
 * horizontal offset sat below the far camera's view. Only the fixture caster
 * moves; camera, authored pavement, its native range and original shaders stay.
 * Full geometry is inspected temporarily and every range is restored on throw. */
export function pavementProofShadowAnchor(camera:T.Camera,sources:T.Mesh[]){
 const ray=new T.Raycaster(),saved=sources.map(source=>({geometry:source.geometry,...source.geometry.drawRange}));
 if(!(camera instanceof T.PerspectiveCamera))throw Error('A native perspective fixture camera is required');
 ray.near=camera.near;ray.far=camera.far;
 try{
  for(const {geometry}of saved)geometry.setDrawRange(0,Infinity);
  for(const y of [-.35,-.55,-.15,.05])for(const x of [0,-.2,.2,-.4,.4,-.6,.6,-.8,.8]){
   ray.setFromCamera(new T.Vector2(x,y),camera);
   const hit=ray.intersectObjects(sources,false).find(hit=>hit.face&&hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y>.8);
   if(hit)return{point:hit.point.toArray(),distance:hit.distance,sourceId:hit.object.id,faceIndex:hit.faceIndex!,ndc:[x,y],size:T.MathUtils.clamp(hit.distance*.015,3,12)};
  }
  throw Error('No actual visible asphalt triangle for the shadow positive control');
 }finally{for(const {geometry,start,count}of saved)geometry.setDrawRange(start,count);}
}
