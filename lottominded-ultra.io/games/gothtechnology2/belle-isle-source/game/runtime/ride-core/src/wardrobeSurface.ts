import * as T from 'three';

/** Snapshot the posed garment surface in rider coordinates for fitting decals.
 * Temporary geometry is discarded after fitting; no per-frame raycasts. */
export function wardrobeSurface(root:T.Object3D,accept:(material:T.Material)=>boolean,minY=-Infinity,maxY=Infinity){
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),points:number[]=[],indices:number[]=[],weights:number[]=[],bones:T.Bone[]=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 root.traverse(o=>{if((o as T.Bone).isBone)bones.push(o as T.Bone);});
 root.traverse(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh)return;
  const geometry=mesh.geometry,index=geometry.index,count=index?.count??geometry.attributes.position.count;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const groups=geometry.groups.length?geometry.groups:[{start:0,count,materialIndex:0}];
  const matrix=inverse.clone().multiply(mesh.matrixWorld);
  for(const group of groups){if(!accept(materials[group.materialIndex??0]))continue;
   for(let i=group.start;i<Math.min(count,group.start+group.count);i+=3){
    mesh.getVertexPosition(index?index.getX(i):i,a).applyMatrix4(matrix);
    mesh.getVertexPosition(index?index.getX(i+1):i+1,b).applyMatrix4(matrix);
    mesh.getVertexPosition(index?index.getX(i+2):i+2,c).applyMatrix4(matrix);
    if(Math.min(a.y,b.y,c.y)<minY||Math.max(a.y,b.y,c.y)>maxY)continue;
    points.push(...a.toArray(),...b.toArray(),...c.toArray());
    for(let k=0;k<3;k++)for(let component=0;component<4;component++){
     const vertex=index?index.getX(i+k):i+k,skin=mesh as T.SkinnedMesh;
     const bone=skin.isSkinnedMesh?bones.indexOf(skin.skeleton.bones[geometry.attributes.skinIndex.getComponent(vertex,component)]):0;
     indices.push(Math.max(0,bone));weights.push(skin.isSkinnedMesh?geometry.attributes.skinWeight.getComponent(vertex,component):component===0?1:0);
    }
   }
  }
 });
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const material=new T.MeshBasicMaterial({side:T.DoubleSide}),mesh=new T.Mesh(geometry,material);mesh.updateMatrixWorld(true);
 const ray=new T.Raycaster(),direction=new T.Vector3(),origin=new T.Vector3();
 return {bounds:geometry.boundingBox!,boneNames:bones.map(b=>b.name),
  sample(from:T.Vector3,toward:T.Vector3,clearance=.003){
   direction.copy(toward).sub(from).normalize();ray.set(from,direction);const hit=ray.intersectObject(mesh,false)[0];if(!hit?.face)return;
   const triangle=[hit.face.a,hit.face.b,hit.face.c],p=geometry.attributes.position;
   const bary=T.Triangle.getBarycoord(hit.point,new T.Vector3().fromBufferAttribute(p,triangle[0]),new T.Vector3().fromBufferAttribute(p,triangle[1]),new T.Vector3().fromBufferAttribute(p,triangle[2]),new T.Vector3())!;
   const contributions=new Map<number,number>();
   triangle.forEach((vertex,k)=>{for(let component=0;component<4;component++){const at=vertex*4+component,bone=indices[at],weight=weights[at]*bary.getComponent(k);contributions.set(bone,(contributions.get(bone)??0)+weight);}});
   const strongest=[...contributions].sort((a,b)=>b[1]-a[1]).slice(0,4),total=strongest.reduce((sum,p)=>sum+p[1],0)||1;
   return {point:hit.point.clone().addScaledVector(direction,-clearance),indices:Array.from({length:4},(_,i)=>strongest[i]?.[0]??0),weights:Array.from({length:4},(_,i)=>(strongest[i]?.[1]??0)/total)};
  },
  project(from:T.Vector3,toward:T.Vector3,clearance=.003){
   direction.copy(toward).sub(from).normalize();ray.set(from,direction);
   const hit=ray.intersectObject(mesh,false)[0];return hit?hit.point.clone().addScaledVector(direction,-clearance):undefined;
  },
  fit(g:T.BufferGeometry,center:T.Vector3){
   const p=g.attributes.position;
   for(let i=0;i<p.count;i++){
    const target=new T.Vector3().fromBufferAttribute(p,i);direction.copy(target).sub(center).normalize();origin.copy(center).addScaledVector(direction,1);
    const point=this.project(origin,center);if(point)p.setXYZ(i,point.x,point.y,point.z);
   }
   g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  },
  dispose(){geometry.dispose();material.dispose();}
 };
}
