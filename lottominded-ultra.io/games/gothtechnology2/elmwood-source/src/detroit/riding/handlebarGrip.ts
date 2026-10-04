import * as T from 'three';

/** These supplied rigs have wrist bones, but no finger joints. Bend only their
 * hand-weighted vertices in bind space; the shared character asset stays intact. */
export function curlHandlebarHands(rider:T.Object3D){
 const owned:T.BufferGeometry[]=[];
 rider.traverse(o=>{
  const mesh=o as T.SkinnedMesh;if(!mesh.isSkinnedMesh)return;
  const hands=mesh.skeleton.bones.map((bone,index)=>({bone,index})).filter(h=>/^(Left|Right)Hand$/.test(h.bone.name));
  if(!hands.length)return;
  const geometry=mesh.geometry.clone(),position=geometry.getAttribute('position'),indices=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  if(!indices||!weights){geometry.dispose();return;}
  const changed=new Set<number>(),originalNormal=geometry.getAttribute('normal')?.clone();
  for(const {bone,index}of hands){
   const side=bone.name==='LeftHand'?1:-1;
   const toHand=mesh.skeleton.boneInverses[index].clone().multiply(mesh.bindMatrix),fromHand=toHand.clone().invert();
   for(let i=0;i<position.count;i++){
    let weight=0;for(let k=0;k<4;k++)if(indices.getComponent(i,k)===index)weight+=weights.getComponent(i,k);
    if(weight<.05)continue;
    const original=new T.Vector3().fromBufferAttribute(position,i),p=original.clone().applyMatrix4(toHand);
    // Preserve the palm and wrist seam. Fingers curl around the transverse grip.
    const reach=Math.max(0,p.y-.09);if(!reach)continue;
    const angle=Math.min(2.9,reach/.036),radius=.032;
    p.y=.09+Math.sin(angle)*radius;p.x-=side*(1-Math.cos(angle))*radius;
    original.lerp(p.applyMatrix4(fromHand),weight);position.setXYZ(i,original.x,original.y,original.z);changed.add(i);
   }
  }
  if(!changed.size){geometry.dispose();return;}
  geometry.computeVertexNormals();
  // Keep authored shading everywhere outside the fingers.
  const normals=geometry.getAttribute('normal');if(originalNormal)for(let i=0;i<normals.count;i++)if(!changed.has(i))normals.setXYZ(i,originalNormal.getX(i),originalNormal.getY(i),originalNormal.getZ(i));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;owned.push(geometry);
 });
 return()=>owned.forEach(g=>g.dispose());
}

/** Palm faces down, fingers forward, wrist behind and just above the bar. */
export function handlebarHandRotation(side:number){
 return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,side,0),new T.Vector3(0,0,1),new T.Vector3(side,0,0)));
}
export const HANDLEBAR_WRIST_OFFSET=new T.Vector3(0,.028,-.09);
