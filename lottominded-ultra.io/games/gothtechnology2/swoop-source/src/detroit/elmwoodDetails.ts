import {elmPoint,elmHeight,elmDistance,inPond,elmInside} from './elmwood.ts';

/** Reference-inspired footprints, approximate placement in the existing plan frame. */
export const ELM_BUILDINGS=[
  {name:'Gothic chapel',px:580,pz:290,w:9,d:16,eave:4.4,rise:5.1},
  {name:'Entrance lodge',px:1108,pz:453,w:10,d:8,eave:3.5,rise:3.5},
] as const;
export function buildingSite(building:typeof ELM_BUILDINGS[number]){
  const p=elmPoint(building.px,building.pz);
  return {...p,y:elmHeight(p.x,p.z),...building};
}
export function nearElmBuilding(x:number,z:number,margin=3){
  return ELM_BUILDINGS.some(b=>{const p=buildingSite(b);return Math.abs(x-p.x)<b.w/2+margin&&Math.abs(z-p.z)<b.d/2+margin;});
}
/** Keep bulky scenery outside the lane and pond, including its full footprint. */
export function clearElmPlot(x:number,z:number,radius:number){
  return elmInside(x,z)&&!inPond(x,z)&&elmDistance(x,z)>3.5+radius&&!nearElmBuilding(x,z,radius+1);
}

/** Subdivide across the lane as well as along it, so hills cannot poke through. */
export function elmLaneVertices(samples:readonly {x:number;z:number}[]){
  const pos:number[]=[];
  const origin=elmPoint(0,100);
  type Point=number[];
  // Clip each road face to the exact ground grid and its diagonal. Sampling
  // only the corners let the hill poke through the middle of a road face.
  function clip(poly:Point[],distance:(p:Point)=>number){
    const result:Point[]=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);
      if(da>=-1e-9)result.push(a);
      if((da>0&&db<0)||(da<0&&db>0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,0,a[2]+(b[2]-a[2])*t]);}
    }return result;
  }
  function emit(triangle:Point[]){
    const minX=Math.floor((Math.min(...triangle.map(p=>p[0]))-origin.x)/2),maxX=Math.floor((Math.max(...triangle.map(p=>p[0]))-origin.x)/2);
    const minZ=Math.floor((Math.min(...triangle.map(p=>p[2]))-origin.z)/2),maxZ=Math.floor((Math.max(...triangle.map(p=>p[2]))-origin.z)/2);
    for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++){
      const x=origin.x+ix*2,z=origin.z+iz*2;
      let poly=clip(triangle,p=>p[0]-x);poly=clip(poly,p=>x+2-p[0]);poly=clip(poly,p=>p[2]-z);poly=clip(poly,p=>z+2-p[2]);
      for(const sign of [-1,1]){
        const face=clip(poly,p=>sign*(p[0]-x+p[2]-z-2));
        for(let i=1;i<face.length-1;i++){
          const [a,b,c]=[face[0],face[i],face[i+1]],normal=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
          if(Math.abs(normal)<1e-9)continue;
          for(const p of normal>0?[a,b,c]:[a,c,b])pos.push(p[0],elmHeight(p[0],p[2])+.035,p[2]);
        }
      }
    }
  }
  const closed=Math.hypot(samples[0].x-samples.at(-1)!.x,samples[0].z-samples.at(-1)!.z)<.01;
  const normals=samples.map((p,i)=>{const a=samples[i-1]??(closed?samples.at(-2)!:p),b=samples[i+1]??(closed?samples[1]:p),len=Math.hypot(b.x-a.x,b.z-a.z);return{x:-(b.z-a.z)/len,z:(b.x-a.x)/len};});
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.001)continue;
    const na=normals[i-1],nb=normals[i],steps=Math.ceil(len/.75);
    for(let j=0;j<steps;j++)for(let k=0;k<8;k++){
      const points=[[j/steps,-3+k*.75],[(j+1)/steps,-3+k*.75],[j/steps,-3+(k+1)*.75],[(j+1)/steps,-3+(k+1)*.75]];
      const quad=points.map(([t,lateral])=>{const nx=na.x+(nb.x-na.x)*t,nz=na.z+(nb.z-na.z)*t,x=a.x+dx*t+nx*lateral,z=a.z+dz*t+nz*lateral;return[x,elmHeight(x,z)+.035,z];});
      for(const ids of [[0,2,1],[2,3,1]]){
        const [a,b,c]=ids.map(n=>quad[n]),normal=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
        if(Math.abs(normal)<1e-10)continue;emit([a,b,c]);
      }
    }
  }
  return pos;
}
