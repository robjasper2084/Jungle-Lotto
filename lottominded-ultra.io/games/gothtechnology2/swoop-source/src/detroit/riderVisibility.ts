import * as T from 'three';

/** Keep the animated body, but remove eye-level geometry from the wearer's view.
 * Filtering indices leaves the shared asset, skin weights and rig untouched. */
export class RiderVisibility {
 private meshes:{mesh:T.Mesh;full:T.BufferGeometry;body:T.BufferGeometry}[]=[];
 private attachments:{object:T.Object3D;visible:boolean}[]=[];
 private immersive=false;
 constructor(rider:T.Object3D,head?:T.Object3D){
  const headBones=new Set<T.Object3D>();head?.traverse(o=>headBones.add(o));
  rider.traverse(o=>{
   const mesh=o as T.SkinnedMesh;
   if(!mesh.isMesh)return;
   if(!mesh.isSkinnedMesh){if(headBones.has(o))this.attachments.push({object:o,visible:o.visible});return;}
   const full=mesh.geometry,skin=full.getAttribute('skinIndex'),weights=full.getAttribute('skinWeight');
   if(!skin||!weights)return;
   const mask=new Uint8Array(skin.count);
   for(let i=0;i<skin.count;i++){
    let weight=0;for(let c=0;c<4;c++)if(headBones.has(mesh.skeleton.bones[skin.getComponent(i,c)]))weight+=weights.getComponent(i,c);
    mask[i]=weight>=.45?1:0;
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
   body.setIndex(kept);this.meshes.push({mesh,full,body});
  });
 }
 setVR(enabled:boolean){
  if(enabled===this.immersive)return;this.immersive=enabled;
  for(const entry of this.meshes)entry.mesh.geometry=enabled?entry.body:entry.full;
  for(const entry of this.attachments)entry.object.visible=enabled?false:entry.visible;
 }
 dispose(){this.setVR(false);for(const entry of this.meshes)entry.body.dispose();}
}
