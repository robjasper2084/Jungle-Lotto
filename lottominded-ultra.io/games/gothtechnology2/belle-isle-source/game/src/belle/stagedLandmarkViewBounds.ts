import * as T from 'three';

type Bounds={min:number[];max:number[];center:number[]};
type BoxReceipt={mesh:string;uuid:string;instanceId:number|null;material:number;min:number[];max:number[];conservativeAlpha:boolean;deformationUnresolved:boolean};
const visible=(object:T.Object3D)=>{for(let o:T.Object3D|null=object;o;o=o.parent)if(!o.visible)return false;return true;};

/** On-demand planning advice only. Copy attached, currently visible mesh and
 * instance bounds without updating transforms, invoking renderer callbacks, or
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
 const boxes:BoxReceipt[]=[],unsupported:{mesh:string;reason:string}[]=[],localCache=new Map<T.BufferGeometry,Map<string,T.Box3>>();
 const point=new T.Vector3(),instance=new T.Matrix4(),world=new T.Matrix4();let verticesRead=0,refinementVerticesRead=0,refinementSteps=0,refinedMeshGroups=0;
 const own=(object:T.Object3D)=>{for(let o:T.Object3D|null=object;o;o=o.parent)if(o===target||o.name.startsWith(id+'_'))return true;return false;};
 const localBounds=(mesh:T.Mesh,start:number,end:number)=>{
  const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
  if(!position)return null;
  const animated=(mesh as T.SkinnedMesh).isSkinnedMesh||Object.keys(geometry.morphAttributes).length>0;
  const cache=localCache.get(geometry)??new Map<string,T.Box3>();localCache.set(geometry,cache);
  const key=start+':'+end;if(!animated&&cache.has(key))return cache.get(key)!;
  const box=new T.Box3();
  for(let i=start;i<end;i++){
   const vertex=index?index.getX(i):i;
   if(!Number.isSafeInteger(vertex)||vertex<0||vertex>=position.count)throw Error('Invalid visible geometry index');
   if(animated)mesh.getVertexPosition(vertex,point);else point.fromBufferAttribute(position,vertex);
   if(![point.x,point.y,point.z].every(Number.isFinite))throw Error('Nonfinite visible geometry');
   box.expandByPoint(point);if(++verticesRead+refinementVerticesRead>20000000)throw Error('View observation exceeds bounded vertex work');
  }
  if(!animated)cache.set(key,box);return box;
 };
 // A whole sky sphere or island-wide merged road has a mostly empty AABB.
 // For broad geometry, retain nearby triangles in bounded spatial clusters.
 // This observes the original triangles; it does not hide any scene object.
 // Subdivision is affine, so the child triangles cover their parent exactly.
 const clusteredBounds=(mesh:T.Mesh,start:number,end:number,matrix:T.Matrix4)=>{
  const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
  const animated=(mesh as T.SkinnedMesh).isSkinnedMesh||Object.keys(geometry.morphAttributes).length>0;
  const clusters=new Map<string,T.Box3[]>(),triangleBox=new T.Box3(),vertex=new T.Vector3(),cellSize=16;
  const read=(i:number)=>{
   if(verticesRead+(++refinementVerticesRead)>20000000)throw Error('View observation exceeds bounded vertex work');
   const v=index?index.getX(i):i;if(animated)mesh.getVertexPosition(v,vertex);else vertex.fromBufferAttribute(position,v);
   const result=vertex.applyMatrix4(matrix).toArray();if(!result.every(Number.isFinite))throw Error('Nonfinite view refinement vertex');return result;
  };
  for(let i=start;i+2<end;i+=3){
   const pending:number[][][]=[[read(i),read(i+1),read(i+2)]];
   while(pending.length){
    if(++refinementSteps>1000000)throw Error('View observation exceeds bounded spatial refinement');
    const triangle=pending.pop()!;triangleBox.makeEmpty();for(const p of triangle)triangleBox.expandByPoint(vertex.fromArray(p));
    if(triangleBox.distanceToPoint(center)>range)continue;
    const size=triangleBox.getSize(new T.Vector3());
    if(Math.max(size.x,size.y,size.z)>cellSize){
     const lengths=triangle.map((a,n)=>a.reduce((sum,v,axis)=>sum+(v-triangle[(n+1)%3][axis])**2,0));
     const longest=lengths.indexOf(Math.max(...lengths)),a=triangle[longest],b=triangle[(longest+1)%3],c=triangle[(longest+2)%3],mid=a.map((v,axis)=>v*.5+b[axis]*.5);
     if(mid.every((v,axis)=>v===a[axis])||mid.every((v,axis)=>v===b[axis]))throw Error('View refinement cannot make finite progress');
     pending.push([a,mid,c],[mid,b,c]);continue;
    }
    const middle=triangle.reduce((sum,p)=>sum.map((v,axis)=>v+p[axis]/3),[0,0,0]);
    const key=middle.map(v=>Math.floor(v/cellSize)).join(',');
    const cells=clusters.get(key)??[];
    let cell=cells.find(value=>{
     const merged=value.clone().union(triangleBox).getSize(new T.Vector3());return Math.max(merged.x,merged.y,merged.z)<=cellSize*2;
    });
    if(!cell){cell=new T.Box3();cells.push(cell);}cell.union(triangleBox);clusters.set(key,cells);
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
   const local=localBounds(mesh,start,end);if(!local||local.isEmpty())continue;
   const box=local.clone().applyMatrix4(matrix);if(box.distanceToPoint(center)>range)continue;
   if(![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))throw Error('Nonfinite visible world bounds');
   const size=box.getSize(new T.Vector3()),broad=Math.max(size.x,size.y,size.z)>32;
   const parts=broad?clusteredBounds(mesh,start,end,matrix):[box];if(broad)refinedMeshGroups++;
   const standard=material as T.MeshStandardMaterial;
   for(const part of parts){
    boxes.push({mesh:mesh.name||mesh.uuid,uuid:mesh.uuid,instanceId,material:materialIndex,min:part.min.toArray(),max:part.max.toArray(),
     conservativeAlpha:material.transparent||material.alphaTest>0||material.alphaHash||!!standard.alphaMap,
     deformationUnresolved:!!standard.displacementMap||material.onBeforeCompile!==T.Material.prototype.onBeforeCompile||(material as T.ShaderMaterial).isShaderMaterial===true});
    if(boxes.length>40000)throw Error('View observation exceeds bounded instance work');
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
   for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,instance);world.multiplyMatrices(mesh.matrixWorld,instance);append(mesh,i,world,0,count);}
  }else append(mesh,null,mesh.matrixWorld,0,count);
 });
 return{version:1,id,target:{min:[...bounds.min],max:[...bounds.max],center:[...bounds.center]},range,boxes,unsupported,verticesRead,refinementVerticesRead,refinedMeshGroups,refinementSteps,
  scope:'On-demand current loaded-mesh bound advice only; transparent and alpha-tested surfaces are conservatively filled. No clear-pixel, future-LOD, surveyed-geometry or collision verdict. Actual native PNG review is required.'};
}
