import * as T from 'three';
import {copySelectedTreeSource} from './farTreeVisibility.ts';

type Bounds={min:number[];max:number[];center:number[]};
type BoxReceipt={mesh:string;uuid:string;instanceId:number|null;material:number;min:number[];max:number[];conservativeAlpha:boolean;deformationUnresolved:boolean};
type IndexBlock={start:number;end:number;box:T.Box3};
type LocalBounds={box:T.Box3;blocks:IndexBlock[]};
const visible=(object:T.Object3D)=>{for(let o:T.Object3D|null=object;o;o=o.parent)if(!o.visible)return false;return true;};

/** On-demand planning advice only. Copy attached mesh and instance bounds,
 * including the existing distance-selected tree sources before camera-frustum
 * compaction, without updating transforms, invoking renderer callbacks, or
 * populating Three's geometry/batch bounding caches. Boxes conservatively fill
 * alpha holes and transparent panes. Shader displacement, future LOD selection
 * and scenery changes are not certified by this observation: the actual native
 * PNG and its fresh loaded-view receipt remain required for visual acceptance. */
export function readStagedViewBounds(root:T.Object3D,id:string,camera:T.Camera,bounds:Bounds){
 const target=root.getObjectByName(id+'_STAGED_LODS');if(!target)throw Error('Missing staged view target');
 const perspective=camera as T.PerspectiveCamera,halfV=perspective.fov*Math.PI/360,halfH=Math.atan(Math.tan(halfV)*perspective.aspect);
 const center=new T.Vector3().fromArray(bounds.center),radius=Math.hypot(...bounds.max.map((n,i)=>n-bounds.min[i]))/2;
 const range=radius/Math.sin(Math.min(halfV,halfH))*1.22+60+radius;
 if(!Number.isFinite(range)||range<=0||range>2000)throw Error('Invalid bounded view observation');
 let scene=root;while(scene.parent)scene=scene.parent;
 const boxes:BoxReceipt[]=[],unsupported:{mesh:string;reason:string}[]=[],localCache=new Map<T.BufferGeometry,Map<string,LocalBounds>>();
 const point=new T.Vector3(),instance=new T.Matrix4(),world=new T.Matrix4();let verticesRead=0,refinementVerticesRead=0,refinementSteps=0,refinedMeshGroups=0,indexBlocksRead=0,indexBlocksRetained=0,clippingPlanesRead=0;
 let selectedTreePools=0,selectedTreeInstances=0,selectedTreeMatrixElements=0,currentRenderedTreeInstances=0;
 let context:{mesh:string;uuid:string;instanceId:number|null;material:number;start:number;end:number}|null=null;
 const fail=(reason:string):never=>{throw Error(reason+' '+JSON.stringify({context,range,verticesRead,refinementVerticesRead,refinementSteps,indexBlocksRead,indexBlocksRetained,clippingPlanesRead,boxes:boxes.length}));};
 const step=()=>{if(++refinementSteps>1000000)fail('View observation exceeds bounded spatial refinement');};
 const padding=1e-7*Math.max(1,range,Math.abs(center.x),Math.abs(center.y),Math.abs(center.z));
 const queryMin=center.toArray().map(n=>n-range-padding),queryMax=center.toArray().map(n=>n+range+padding);
 // Same-site legacy plants and exterior ornaments can share the landmark ID
 // prefix. Only the actual staged target subtree is self geometry.
 const own=(object:T.Object3D)=>{for(let o:T.Object3D|null=object;o;o=o.parent)if(o===target)return true;return false;};
 const localBounds=(mesh:T.Mesh,start:number,end:number)=>{
  const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
  if(!position)return null;
  const animated=(mesh as T.SkinnedMesh).isSkinnedMesh||Object.keys(geometry.morphAttributes).length>0;
  const cache=localCache.get(geometry)??new Map<string,LocalBounds>();localCache.set(geometry,cache);
  const key=start+':'+end;if(!animated&&cache.has(key))return cache.get(key)!;
  const box=new T.Box3(),blocks:IndexBlock[]=[];let block:IndexBlock|undefined;
  for(let i=start;i<end;i++){
   // Draw calls consume triangles from start. Every 96-index block preserves
   // that alignment and is bounded during the already charged vertex scan.
   if((i-start)%96===0){block={start:i,end:Math.min(i+96,end),box:new T.Box3()};blocks.push(block);}
   const vertex=index?index.getX(i):i;
   if(!Number.isSafeInteger(vertex)||vertex<0||vertex>=position.count)throw Error('Invalid visible geometry index');
   if(animated)mesh.getVertexPosition(vertex,point);else point.fromBufferAttribute(position,vertex);
   if(![point.x,point.y,point.z].every(Number.isFinite))throw Error('Nonfinite visible geometry');
   box.expandByPoint(point);block!.box.expandByPoint(point);if(++verticesRead+refinementVerticesRead>20000000)fail('View observation exceeds bounded vertex work');
  }
  const result={box,blocks};if(!animated)cache.set(key,result);return result;
 };
 // A whole sky sphere or island-wide merged road has a mostly empty AABB.
 // For broad geometry, retain nearby triangles in bounded spatial clusters.
 // This observes the original triangles; it does not hide any scene object.
 // Subdivision is affine, so the child triangles cover their parent exactly.
 const clusteredBounds=(mesh:T.Mesh,local:LocalBounds,matrix:T.Matrix4)=>{
  const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
  const animated=(mesh as T.SkinnedMesh).isSkinnedMesh||Object.keys(geometry.morphAttributes).length>0;
  const clusters=new Map<string,T.Box3[]>(),triangleBox=new T.Box3(),vertex=new T.Vector3(),cellSize=16;
  const read=(i:number)=>{
   if(verticesRead+(++refinementVerticesRead)>20000000)fail('View observation exceeds bounded vertex work');
   const v=index?index.getX(i):i;if(animated)mesh.getVertexPosition(v,vertex);else vertex.fromBufferAttribute(position,v);
   const result=vertex.applyMatrix4(matrix).toArray();if(!result.every(Number.isFinite))throw Error('Nonfinite view refinement vertex');return result;
  };
  const retain=(box:T.Box3,middle:number[])=>{
    const key=middle.map(v=>Math.floor(v/cellSize)).join(',');
    const cells=clusters.get(key)??[];
    let cell=cells.find(value=>{
     const merged=value.clone().union(box).getSize(new T.Vector3());return Math.max(merged.x,merged.y,merged.z)<=cellSize*2;
    });
    if(!cell){cell=new T.Box3();cells.push(cell);}cell.union(box);clusters.set(key,cells);
  };
  // The cube encloses the existing spherical query region. Clip only parts
  // that cannot meet any queried sightline, before subdividing long triangles.
  // Plane work is charged to the same refinement budget; it is never hidden.
  const clip=(triangle:number[][])=>{
   let polygon=triangle;
   for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
    if(!polygon.length)return polygon;
    step();clippingPlanesRead++;
    const boundary=side<0?queryMin[axis]:queryMax[axis],out:number[][]=[];
    let previous=polygon[polygon.length-1],previousInside=side<0?previous[axis]>=boundary:previous[axis]<=boundary;
    for(const current of polygon){
     const inside=side<0?current[axis]>=boundary:current[axis]<=boundary;
     if(inside!==previousInside){
      const fraction=(boundary-previous[axis])/(current[axis]-previous[axis]);
      const intersection=previous.map((value,n)=>n===axis?boundary:value+(current[n]-value)*fraction);
      if(!intersection.every(Number.isFinite))fail('Nonfinite clipped view triangle');out.push(intersection);
     }
     if(inside)out.push(current);previous=current;previousInside=inside;
    }
    polygon=out;
   }
   return polygon;
  };
  for(const block of local.blocks){
   step();indexBlocksRead++;
   const blockBox=block.box.clone().applyMatrix4(matrix);
   if(blockBox.distanceToPoint(center)>range)continue;
   const blockSize=blockBox.getSize(new T.Vector3());
   // Dense nearby foliage often consists of many tiny triangles. A copied
   // block no wider than 8 m is already tighter than the 16 m triangle leaves
   // and 32 m cluster limit. Keep every vertex without rereading its triangles.
   if(Math.max(blockSize.x,blockSize.y,blockSize.z)<=8){
    retain(blockBox,blockBox.getCenter(new T.Vector3()).toArray());indexBlocksRetained++;continue;
   }
   for(let i=block.start;i+2<block.end;i+=3){
    const original=[read(i),read(i+1),read(i+2)];step();
    triangleBox.makeEmpty();for(const p of original)triangleBox.expandByPoint(vertex.fromArray(p));
    if(triangleBox.distanceToPoint(center)>range)continue;
    const inside=triangleBox.min.toArray().every((n,axis)=>n>=queryMin[axis])&&triangleBox.max.toArray().every((n,axis)=>n<=queryMax[axis]);
    const polygon=inside?original:clip(original),pending:number[][][]=[];
    for(let n=1;n+1<polygon.length;n++)pending.push([polygon[0],polygon[n],polygon[n+1]]);
    // The original uncut triangle was charged above. Clipped fan triangles
    // and every subsequently created child receive their own work charge.
    let originalPending=inside;
    while(pending.length){
     if(originalPending)originalPending=false;else step();
     const triangle=pending.pop()!;triangleBox.makeEmpty();for(const p of triangle)triangleBox.expandByPoint(vertex.fromArray(p));
     if(triangleBox.distanceToPoint(center)>range)continue;
     const size=triangleBox.getSize(new T.Vector3());
     if(Math.max(size.x,size.y,size.z)>cellSize){
      const lengths=triangle.map((a,n)=>a.reduce((sum,v,axis)=>sum+(v-triangle[(n+1)%3][axis])**2,0));
      const longest=lengths.indexOf(Math.max(...lengths)),a=triangle[longest],b=triangle[(longest+1)%3],c=triangle[(longest+2)%3],mid=a.map((v,axis)=>v*.5+b[axis]*.5);
      if(mid.every((v,axis)=>v===a[axis])||mid.every((v,axis)=>v===b[axis]))fail('View refinement cannot make finite progress');
      pending.push([a,mid,c],[mid,b,c]);continue;
     }
     retain(triangleBox,triangle.reduce((sum,p)=>sum.map((v,axis)=>v+p[axis]/3),[0,0,0]));
    }
   }
  }
  return [...clusters.values()].flat();
 };
 const append=(mesh:T.Mesh,instanceId:number|null,matrix:T.Matrix4,first:number,last:number)=>{
  const geometry=mesh.geometry,count=geometry.index?.count??geometry.getAttribute('position')?.count??0;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const groups=Array.isArray(mesh.material)?geometry.groups:[{start:0,count,materialIndex:0}];
  for(const group of groups){
   const materialIndex=group.materialIndex??0,material=materials[materialIndex];
   if(!material?.visible||!material.colorWrite||material.opacity===0)continue;
   const start=Math.max(0,first,group.start,geometry.drawRange.start),end=Math.min(count,last,group.start+group.count,geometry.drawRange.start+geometry.drawRange.count);
   if(end<=start)continue;
   context={mesh:mesh.name||mesh.uuid,uuid:mesh.uuid,instanceId,material:materialIndex,start,end};
   const local=localBounds(mesh,start,end);if(!local||local.box.isEmpty())continue;
   const box=local.box.clone().applyMatrix4(matrix);if(box.distanceToPoint(center)>range)continue;
   if(![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))throw Error('Nonfinite visible world bounds');
   const size=box.getSize(new T.Vector3()),broad=Math.max(size.x,size.y,size.z)>32;
   const parts=broad?clusteredBounds(mesh,local,matrix):[box];if(broad)refinedMeshGroups++;
   const standard=material as T.MeshStandardMaterial;
   for(const part of parts){
    boxes.push({mesh:mesh.name||mesh.uuid,uuid:mesh.uuid,instanceId,material:materialIndex,min:part.min.toArray(),max:part.max.toArray(),
     conservativeAlpha:material.transparent||material.alphaTest>0||material.alphaHash||!!standard.alphaMap,
     deformationUnresolved:!!standard.displacementMap||material.onBeforeCompile!==T.Material.prototype.onBeforeCompile||(material as T.ShaderMaterial).isShaderMaterial===true});
    if(boxes.length>40000)fail('View observation exceeds bounded instance work');
   }
  }
 };
 scene.traverse(object=>{
  if(!(object instanceof T.Mesh)||own(object)||!visible(object)||!object.layers.test(camera.layers))return;
  const mesh=object,position=mesh.geometry.getAttribute('position');
  if(!position){unsupported.push({mesh:mesh.name||mesh.uuid,reason:'Missing readable position attribute'});return;}
  const count=mesh.geometry.index?.count??position.count;
  if(mesh instanceof T.BatchedMesh){
   if(mesh.maxInstanceCount>40000)throw Error('View observation exceeds bounded batch capacity');
   for(let i=0;i<mesh.maxInstanceCount;i++){
    // Unused/deleted capacity has no public active iterator. The accessors
    // reject it; valid slots expose copied ranges and transforms only.
    let active=false;try{active=mesh.getVisibleAt(i);}catch{continue;}if(!active)continue;
    const range=mesh.getGeometryRangeAt(mesh.getGeometryIdAt(i));if(!range)throw Error('Missing active batch geometry range');
    mesh.getMatrixAt(i,instance);world.multiplyMatrices(mesh.matrixWorld,instance);
    append(mesh,i,world,range.start,range.start+range.count);
   }
  }else if(mesh instanceof T.InstancedMesh){
   if(mesh.count>40000)throw Error('View observation exceeds bounded instance count');
   if(mesh.morphTexture)unsupported.push({mesh:mesh.name||mesh.uuid,reason:'Instance morph texture is not resolved by bound advice'});
   const selected=copySelectedTreeSource(mesh,40000-selectedTreeInstances);
   if(selected){selectedTreePools++;selectedTreeInstances+=selected.count;selectedTreeMatrixElements+=selected.matrices.length;currentRenderedTreeInstances+=mesh.count;}
   for(let i=0;i<(selected?.count??mesh.count);i++){
    if(selected)instance.fromArray(selected.matrices,i*16);else mesh.getMatrixAt(i,instance);
    world.multiplyMatrices(mesh.matrixWorld,instance);append(mesh,i,world,0,count);
   }
  }else append(mesh,null,mesh.matrixWorld,0,count);
 });
 return{version:1,id,target:{min:[...bounds.min],max:[...bounds.max],center:[...bounds.center]},range,boxes,unsupported,verticesRead,refinementVerticesRead,refinedMeshGroups,refinementSteps,indexBlocksRead,indexBlocksRetained,clippingPlanesRead,selectedTreePools,selectedTreeInstances,selectedTreeMatrixElements,currentRenderedTreeInstances,
  scope:'On-demand loaded-mesh bound advice includes existing distance-selected tree source matrices before camera-frustum compaction; transparent and alpha-tested surfaces are conservatively filled. No clear-pixel, future-LOD, surveyed-geometry or collision verdict. Actual native PNG review is required.'};
}
