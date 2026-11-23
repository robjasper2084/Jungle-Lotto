import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** The EUC's bolt, tire and case pieces are rigid within each articulated
 * pivot. Keep the authored originals for contacts, lights and ray queries. */
export function batchWheelDisplay(vehicle:T.Object3D,actor:T.Object3D,clips:readonly T.AnimationClip[]){
 if(!vehicle.getObjectByName('EUC_ROOT'))return;
 const animated=new Set(clips.flatMap(clip=>clip.tracks.map(track=>T.PropertyBinding.parseTrackName(track.name).nodeName)));
 const release:(()=>void)[]=[];
 for(const joint of ['Body_Suspension','Wheel_Pivot','Pedal_L_Pivot','Pedal_R_Pivot']){
  const pivot=vehicle.getObjectByName(joint);
  if(!pivot)continue;
  const groups=new Map<string,T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]>();
  for(const piece of pivot.children){
   if(!(piece instanceof T.Mesh)||!(piece.material instanceof T.MeshStandardMaterial)||piece.children.length||animated.has(piece.name)||
      piece instanceof T.SkinnedMesh||piece instanceof T.InstancedMesh||!piece.visible||piece.material.transparent||
      !piece.geometry.index||Object.keys(piece.geometry.morphAttributes).length||piece.geometry.drawRange.start!==0||
      piece.geometry.drawRange.count<piece.geometry.index.count)continue;
   piece.updateMatrix();
   if(piece.matrix.determinant()<=0)continue;
   const key=[piece.material.uuid,piece.castShadow,piece.receiveShadow,piece.renderOrder,piece.layers.mask,
    ...Object.keys(piece.geometry.attributes).sort()].join('|');
   const group=groups.get(key);if(group)group.push(piece);else groups.set(key,[piece]);
  }
  for(const parts of groups.values()){
   if(parts.length<2)continue;
   const first=parts[0],original=first.material,surface=!!original.userData.realisticSurface;
   const inputs=parts.map(piece=>{
    const g=piece.geometry.clone();
    if(surface){
     g.setAttribute('originalSurfacePosition',g.getAttribute('position').clone());
     g.setAttribute('originalSurfaceNormal',g.getAttribute('normal').clone());
    }
    return g.applyMatrix4(piece.matrix);
   });
   const geometry=mergeGeometries(inputs);
   inputs.forEach(g=>g.dispose());
   if(!geometry)continue;
   const material=surface?original.clone():original;
   if(surface){
    material.onBeforeCompile=original.onBeforeCompile.bind(original);
    material.customProgramCacheKey=()=>original.customProgramCacheKey();
    material.defines={...material.defines,BELLE_ORIGINAL_SURFACE_COORDS:1};
   }
   const batch=new T.Mesh(geometry,material),hidden=new T.MeshBasicMaterial({side:original.side});
   hidden.visible=false;
   batch.name=joint+' · '+original.name;batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
   batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;batch.userData.presentationOnly=true;
   batch.raycast=()=>{};pivot.add(batch);
   // A hidden material leaves the individual geometry and its raycast active.
   for(const piece of parts)(piece as T.Mesh).material=hidden;
   const index=geometry.getIndex()!,visible=parts.map(()=>true);
   let all:typeof index.array|undefined;
   const select=(camera:T.Camera,shadows:boolean,varianceShadows=false)=>{
    let changed=false;
    for(let i=0;i<parts.length;i++){
     const piece=parts[i],caster=piece.castShadow||(varianceShadows&&piece.receiveShadow);
     const show=piece.parent===pivot&&piece.visible&&piece.layers.test(camera.layers)&&(!shadows||caster);
     if(show!==visible[i]){visible[i]=show;changed=true;}
    }
    if(!changed)return;
    all??=index.array.slice();let start=0,target=0;
    for(let i=0;i<parts.length;i++){
     const n=parts[i].geometry.index!.count;
     if(visible[i]){index.array.set(all.subarray(start,start+n),target);target+=n;}
     start+=n;
    }
    geometry.setDrawRange(0,target);index.clearUpdateRanges();
    if(target)index.addUpdateRange(0,target);
    index.needsUpdate=true;
   };
   batch.onBeforeRender=(_r,_s,camera)=>select(camera,false);
   batch.onBeforeShadow=(renderer,_o,camera)=>select(camera,true,renderer.shadowMap.type===T.VSMShadowMap);
   release.push(()=>{
    for(const piece of parts)piece.material=original;
    batch.removeFromParent();geometry.dispose();hidden.dispose();if(surface)material.dispose();
   });
  }
 }
 const dispose=()=>{actor.removeEventListener('removed',dispose);for(const clean of release)clean();};
 if(release.length)actor.addEventListener('removed',dispose);
}
