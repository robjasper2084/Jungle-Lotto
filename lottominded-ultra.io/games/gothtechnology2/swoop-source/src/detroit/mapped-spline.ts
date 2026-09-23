import * as T from 'three';
/** Smooth cartographic vertices, constrained to a 60 cm corridor around them. */
export function mappedSpline(points:number[][]){
  const source=points.map(p=>new T.Vector3(p[0],0,p[1]));
  const curve=new T.CatmullRomCurve3(source,false,'centripetal');
  const samples=curve.getSpacedPoints(Math.max(2,Math.ceil(curve.getLength()/2)));
  for(const p of samples){
    let distance=Infinity,closest=p.clone();
    for(let i=1;i<source.length;i++){
      const a=source[i-1],b=source[i],v=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(v)/v.lengthSq(),0,1),q=a.clone().addScaledVector(v,t),d=q.distanceToSquared(p);
      if(d<distance){distance=d;closest=q;}
    }
    if(distance>.36)p.copy(closest.addScaledVector(p.clone().sub(closest),.6/Math.sqrt(distance)));
  }
  const distances=[0];for(let i=1;i<samples.length;i++)distances.push(distances[i-1]+samples[i].distanceTo(samples[i-1]));
  function sample(distance:number,offset=0){
    const d=T.MathUtils.clamp(distance,0,distances.at(-1)!);let lo=1,hi=distances.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(distances[mid]<d)lo=mid+1;else hi=mid;}
    const i=lo,a=samples[i-1],b=samples[i],t=(d-distances[i-1])/(distances[i]-distances[i-1]),direction=b.clone().sub(a).normalize();
    return{x:a.x+(b.x-a.x)*t-direction.z*offset,z:a.z+(b.z-a.z)*t+direction.x*offset,heading:Math.atan2(direction.x,direction.z)};
  }
  return{samples,length:distances.at(-1)!,sample};
}
