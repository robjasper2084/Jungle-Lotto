import * as T from 'three';

// End index (exclusive) and the min/max corners in local coordinates.
export type GroundRange=[number,number,number,number,number,number,number];
export type GroundRangeSelection={start:number;count:number};
export type GroundRangeOwner=Readonly<{
 geometry:T.BufferGeometry;
 before:T.Object3D['onBeforeRender'];after:T.Object3D['onAfterRender'];
 /** The identical native-camera selector, without changing any geometry. */
 select:(camera:T.Camera,out:GroundRangeSelection)=>void;
}>;

/** Used by the offline asset builder. Joined road polygons do not overlap. */
export function orderPavementIndices(indices:number[],position:T.BufferAttribute|T.InterleavedBufferAttribute){
 const ranges:GroundRange[]=[];
 if(indices.length<3000)return ranges;
 const point=new T.Vector3(),cellSize=192;
 const cells=new Map<string,{x:number;z:number;indices:number[];box:T.Box3}>();
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i],b=indices[i+1],c=indices[i+2];
  const x=Math.floor((position.getX(a)+position.getX(b)+position.getX(c))/(3*cellSize));
  const z=Math.floor((position.getZ(a)+position.getZ(b)+position.getZ(c))/(3*cellSize));
  const key=x+','+z;let cell=cells.get(key);
  if(!cell){cell={x,z,indices:[],box:new T.Box3()};cells.set(key,cell);}
  cell.indices.push(a,b,c);
  cell.box.expandByPoint(point.fromBufferAttribute(position,a));
  cell.box.expandByPoint(point.fromBufferAttribute(position,b));
  cell.box.expandByPoint(point.fromBufferAttribute(position,c));
 }
 let offset=0;
 for(const cell of [...cells.values()].sort((a,b)=>a.z-b.z||a.x-b.x)){
  for(const i of cell.indices)indices[offset++]=i;
  const {min,max}=cell.box;
  ranges.push([offset,Math.floor(min.x*100)/100,Math.floor(min.y*100)/100,Math.floor(min.z*100)/100,
   Math.ceil(max.x*100)/100,Math.ceil(max.y*100)/100,Math.ceil(max.z*100)/100]);
 }
 return ranges;
}

/** Trim the two ends of a large static index buffer for each camera. Any
 * offscreen geometry between visible runs is left in the single draw. */
export function limitGroundDrawRange(mesh:T.Mesh,bounds?:GroundRange[]):GroundRangeOwner|undefined{
 const g=mesh.geometry;if(!bounds?.length||!g.index||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity)return;
 const ranges=bounds.map(([end,x,y,z,hx,hy,hz],i)=>({
  start:i?bounds[i-1][0]:0,end,box:new T.Box3(new T.Vector3(x,y,z),new T.Vector3(hx,hy,hz)).expandByScalar(.02)
 }));
 const projection=new T.Matrix4(),frustum=new T.Frustum();
 function select(camera:T.Camera,out:GroundRangeSelection){
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld);
  frustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);
  let first=0,last=ranges.length-1;
  while(first<=last&&!frustum.intersectsBox(ranges[first].box))first++;
  while(last>=first&&!frustum.intersectsBox(ranges[last].box))last--;
  const start=first<=last?ranges[first].start:0;
  out.start=start;out.count=first<=last?ranges[last].end-start:0;
 }
 const selected:GroundRangeSelection={start:0,count:Infinity};
 function apply(camera:T.Camera){select(camera,selected);g.setDrawRange(selected.start,selected.count);}
 const before=mesh.onBeforeRender,after=mesh.onAfterRender;
 mesh.onBeforeRender=function(...args){before.apply(this,args);apply(args[2]);};
 mesh.onAfterRender=function(...args){
  g.setDrawRange(0,Infinity);
  after.apply(this,args);
 };
 if(mesh.castShadow){
  const beforeShadow=mesh.onBeforeShadow,afterShadow=mesh.onAfterShadow;
  mesh.onBeforeShadow=function(...args){beforeShadow.apply(this,args);apply(args[3]);};
  mesh.onAfterShadow=function(...args){g.setDrawRange(0,Infinity);afterShadow.apply(this,args);};
 }
 return Object.freeze({geometry:g,before:mesh.onBeforeRender,after:mesh.onAfterRender,select});
}
