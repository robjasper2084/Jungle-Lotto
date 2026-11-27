import * as T from 'three';

type Tuple=[number,number,number];
export type TriangleSweepHit={distance:number;point:Tuple;feature:'face'|'edge'|'vertex'|'initial-overlap';featureIndex:number};
export type VisibleTriangleHit=TriangleSweepHit&{mesh:string;meshUuid:string;faceIndex:number;instanceId:number|null;vertexIndices:Tuple;triangle:Tuple[]};
const tuple=(v:T.Vector3):Tuple=>[v.x,v.y,v.z];
const finite=(v:T.Vector3)=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);

function quadratic(a:number,b:number,c:number){
 if(Math.abs(a)<1e-20)return Math.abs(b)>1e-20?[-c/b]:[];
 const discriminant=b*b-4*a*c;if(discriminant<0)return[];
 const root=Math.sqrt(discriminant),q=-.5*(b+(b>=0?root:-root));
 return q===0?[-b/(2*a)]:[q/a,c/q];
}

/** Continuous sphere contact with a triangle's face, finite edges and vertices.
 * This observes geometry; it is never used to move the actor or replace terrain
 * collision. Distances are world metres because direction must be a unit vector.
 * The triangle is a physical surface on either side, including its finite rim. */
export function sweepSphereTriangle(origin:T.Vector3,direction:T.Vector3,radius:number,maxDistance:number,a:T.Vector3,b:T.Vector3,c:T.Vector3):TriangleSweepHit|null{
 if(![origin,direction,a,b,c].every(finite)||!Number.isFinite(radius)||radius<=0||!Number.isFinite(maxDistance)||maxDistance<0||Math.abs(direction.lengthSq()-1)>1e-10)
  throw new Error('Invalid visible sphere sweep inputs');
 const triangle=new T.Triangle(a,b,c),normal=new T.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a));
 if(normal.lengthSq()<1e-24)return null;
 normal.normalize();const closest=triangle.closestPointToPoint(origin,new T.Vector3());
 if(closest.distanceToSquared(origin)<=radius*radius)return{distance:0,point:tuple(closest),feature:'initial-overlap',featureIndex:-1};
 let best:TriangleSweepHit|null=null;
 const accept=(distance:number,point:T.Vector3,feature:TriangleSweepHit['feature'],featureIndex:number)=>{
  if(Number.isFinite(distance)&&distance>=0&&distance<=maxDistance&&(!best||distance<best.distance))best={distance,point:tuple(point),feature,featureIndex};
 };
 const offset=origin.clone().sub(a),signedDistance=normal.dot(offset),normalSpeed=normal.dot(direction);
 if(Math.abs(normalSpeed)>1e-20)for(const side of[-1,1]){
  const distance=(side*radius-signedDistance)/normalSpeed;
  const point=origin.clone().addScaledVector(direction,distance).addScaledVector(normal,-side*radius);
  if(triangle.containsPoint(point))accept(distance,point,'face',-1);
 }
 const vertices=[a,b,c];
 for(let i=0;i<3;i++){
  const start=vertices[i],edge=vertices[(i+1)%3].clone().sub(start),length=edge.length();if(length===0)continue;
  const axis=edge.divideScalar(length),fromStart=origin.clone().sub(start),along=fromStart.dot(axis),velocity=direction.dot(axis);
  const radial=fromStart.clone().addScaledVector(axis,-along),slope=direction.clone().addScaledVector(axis,-velocity);
  for(const distance of quadratic(slope.lengthSq(),2*radial.dot(slope),radial.lengthSq()-radius*radius)){
   const projection=along+velocity*distance;
   if(projection>=0&&projection<=length)accept(distance,start.clone().addScaledVector(axis,projection),'edge',i);
  }
  for(const distance of quadratic(direction.lengthSq(),2*fromStart.dot(direction),fromStart.lengthSq()-radius*radius))accept(distance,start,'vertex',i);
 }
 return best;
}

const worldVisible=(object:T.Object3D)=>{for(let node:T.Object3D|null=object;node;node=node.parent)if(!node.visible)return false;return true;};

/** Read only the current loaded vertex data and world/instance transforms.
 * Respect native draw ranges, indexed/nonindexed geometry, material groups and
 * visibility. A copied receipt names the actual triangle that the same-radius
 * sphere reaches; a nearby point without a forward sweep intersection is null.
 * Unsupported rendered displacement/alpha masks/batching fail closed in the
 * coverage receipt, rather than pretending their undeformed triangles were seen.
 */
export function sweepVisibleMeshTriangles(meshes:readonly T.Mesh[],origin:T.Vector3,direction:T.Vector3,radius:number,maxDistance:number,layers?:T.Layers){
 if(![origin,direction].every(finite)||!Number.isFinite(radius)||radius<=0||!Number.isFinite(maxDistance)||maxDistance<0||Math.abs(direction.lengthSq()-1)>1e-10)
  throw new Error('Invalid visible sphere sweep inputs');
 let hit:VisibleTriangleHit|null=null,checkedTriangles=0;
 const unsupported=new Set<string>(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),instance=new T.Matrix4(),world=new T.Matrix4();
 for(const mesh of new Set(meshes)){
  if(!worldVisible(mesh)||layers&&!mesh.layers.test(layers))continue;
  const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!materials.some(material=>material.visible&&material.colorWrite&&material.opacity!==0))continue;
  const batched=(mesh as T.BatchedMesh).isBatchedMesh,instanced=mesh as T.InstancedMesh;
  if(batched||instanced.isInstancedMesh&&instanced.morphTexture||!position){unsupported.add(mesh.name||mesh.uuid);continue;}
  const instances=instanced.isInstancedMesh?instanced.count:1;
  const count=index?.count??position.count,start=Math.max(0,geometry.drawRange.start),end=Math.min(count,geometry.drawRange.start+geometry.drawRange.count);
  const groups=Array.isArray(mesh.material)?geometry.groups:[{start:0,count,materialIndex:0}];
  for(let instanceId=0;instanceId<instances;instanceId++){
   if(instanced.isInstancedMesh){instanced.getMatrixAt(instanceId,instance);world.multiplyMatrices(mesh.matrixWorld,instance);}else world.copy(mesh.matrixWorld);
   if(!world.elements.every(Number.isFinite)){unsupported.add(mesh.name||mesh.uuid);continue;}
   // Existing bounds only: observation never computes or rewrites scene data.
   if(geometry.boundingSphere&&!(mesh as T.SkinnedMesh).isSkinnedMesh&&!Object.keys(geometry.morphAttributes).length){
    const bound=geometry.boundingSphere.clone(),e=world.elements;
    bound.center.applyMatrix4(world);
    // The Frobenius norm is an upper bound even when nested nonuniform scales
    // produce shear; max column length alone could reject a real triangle hit.
    bound.radius*=Math.hypot(e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]);
    const projection=T.MathUtils.clamp(bound.center.clone().sub(origin).dot(direction),0,maxDistance);
    if(bound.center.distanceToSquared(origin.clone().addScaledVector(direction,projection))>(bound.radius+radius)**2)continue;
   }
   for(const group of groups){
    const material=materials[group.materialIndex??0];if(!material||!material.visible||!material.colorWrite||material.opacity===0)continue;
    if(material.alphaTest>0||material.alphaHash||(material as T.MeshStandardMaterial).wireframe||(material as T.MeshStandardMaterial).displacementMap){unsupported.add(mesh.name||mesh.uuid);continue;}
    const first=Math.max(start,group.start),last=Math.min(end,group.start+group.count);
    for(let i=first;i+2<last;i+=3){
     const ids:Tuple=index?[index.getX(i),index.getX(i+1),index.getX(i+2)]:[i,i+1,i+2];
     mesh.getVertexPosition(ids[0],a).applyMatrix4(world);mesh.getVertexPosition(ids[1],b).applyMatrix4(world);mesh.getVertexPosition(ids[2],c).applyMatrix4(world);
     checkedTriangles++;
     const contact=sweepSphereTriangle(origin,direction,radius,Math.min(maxDistance,hit?.distance??maxDistance),a,b,c);
     if(contact&&(!hit||contact.distance<hit.distance))hit={...contact,mesh:mesh.name,meshUuid:mesh.uuid,faceIndex:Math.floor(i/3),instanceId:instanced.isInstancedMesh?instanceId:null,vertexIndices:ids,triangle:[tuple(a),tuple(b),tuple(c)]};
    }
   }
  }
 }
 return{origin:tuple(origin),direction:tuple(direction),radius,maxDistance,checkedTriangles,unsupportedMeshes:[...unsupported],hit};
}
