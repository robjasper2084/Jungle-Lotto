import * as T from 'three';

/** Keep the animated body, but remove eye-level geometry from the wearer's view.
 * Filtering indices leaves the shared asset, skin weights and rig untouched. */
export class RiderVisibility {
 private meshes:{mesh:T.Mesh;full:T.BufferGeometry;body:T.BufferGeometry;arms:T.BufferGeometry;visible:boolean}[]=[];
 private attachments:{object:T.Object3D;visible:boolean;head:boolean;arm:boolean}[]=[];
 private mode:'full'|'vr'|'arms'='full';
 constructor(rider:T.Object3D,head?:T.Object3D){
  const headBones=new Set<T.Object3D>();head?.traverse(o=>headBones.add(o));
  // Camera-only mask starts at the elbow: shoulder pads sit behind the real
  // eyes and must not appear as giant spheres in a sight-mounted FPS camera.
  const armBones=new Set<T.Object3D>();for(const side of ['Left','Right'])rider.getObjectByName(side+'ForeArm')?.traverse(o=>armBones.add(o));
  rider.traverse(o=>{
   const mesh=o as T.SkinnedMesh;
   if(!mesh.isMesh)return;
   if(!mesh.isSkinnedMesh){this.attachments.push({object:o,visible:o.visible,head:headBones.has(o),arm:armBones.has(o)});return;}
   const full=mesh.geometry,skin=full.getAttribute('skinIndex'),weights=full.getAttribute('skinWeight');
   if(!skin||!weights)return;
   const mask=new Uint8Array(skin.count),armMask=new Uint8Array(skin.count);
   for(let i=0;i<skin.count;i++){
    let weight=0;for(let c=0;c<4;c++)if(headBones.has(mesh.skeleton.bones[skin.getComponent(i,c)]))weight+=weights.getComponent(i,c);
    mask[i]=weight>=.45?1:0;
    let armWeight=0;for(let c=0;c<4;c++)if(armBones.has(mesh.skeleton.bones[skin.getComponent(i,c)]))armWeight+=weights.getComponent(i,c);
    armMask[i]=armWeight>=.35?1:0;
   }
   const index=full.index,count=index?.count??skin.count,body=full.clone(),kept:number[]=[];
   body.clearGroups();
   const groups=full.groups.length?full.groups:[{start:0,count,materialIndex:0}];
   for(const group of groups){const start=kept.length;
    for(let i=group.start;i<Math.min(count,group.start+group.count);i+=3){
     const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
     if(!mask[a]&&!mask[b]&&!mask[c])kept.push(a,b,c);
    }
    body.addGroup(start,kept.length-start,group.materialIndex);
   }
   body.setIndex(kept);
   const arms=full.clone(),armIndices:number[]=[];arms.clearGroups();
   for(const group of groups){const start=armIndices.length;for(let i=group.start;i<Math.min(count,group.start+group.count);i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;if(armMask[a]&&armMask[b]&&armMask[c])armIndices.push(a,b,c);}arms.addGroup(start,armIndices.length-start,group.materialIndex);}
   arms.setIndex(armIndices);this.meshes.push({mesh,full,body,arms,visible:mesh.visible});
  });
 }
 setVR(enabled:boolean){
  this.setMode(enabled?'vr':'full');
 }
 /** Render the hero's animated, skinned arm rig without face/torso occlusion. */
 setFirstPerson(enabled:boolean){this.setMode(enabled?'arms':'full');}
 private setMode(mode:'full'|'vr'|'arms'){
  if(mode===this.mode)return;this.mode=mode;
  for(const e of this.meshes){const geometry=mode==='arms'?e.arms:mode==='vr'?e.body:e.full;e.mesh.geometry=geometry;e.mesh.visible=e.visible&&(mode==='full'||!!geometry.index?.count);}
  for(const e of this.attachments)e.object.visible=e.visible&&(mode==='full'||mode==='arms'&&e.arm||mode==='vr'&&!e.head);
 }
 dispose(){this.setVR(false);for(const entry of this.meshes){entry.body.dispose();entry.arms.dispose();}}
}
