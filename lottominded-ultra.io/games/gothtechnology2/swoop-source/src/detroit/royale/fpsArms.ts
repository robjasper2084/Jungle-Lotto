import * as T from 'three';
import type {Hero} from '../actors.ts';

/** View-only sleeves join the selected rider's real animated fingers to the
 * off-screen elbows. World actor geometry and skeleton weights remain untouched. */
export class FpsArms {
 private masks:T.BufferGeometry[]=[];
 private sleeves:T.Mesh[]=[];private cuffs:T.Mesh[]=[];
 private sleeveGeometry=new T.CylinderGeometry(.053,.087,1,12,4);
 private cuffGeometry=new T.CylinderGeometry(.054,.059,.062,12);
 private cloth:T.MeshStandardMaterial;private cuffMaterial:T.MeshStandardMaterial;
 constructor(private hero:Hero,private root:T.Group){
  const hands=new Set<T.Object3D>();for(const side of ['Left','Right'])hero.rider.getObjectByName(side+'Hand')?.traverse(o=>hands.add(o));
  let sleeveColor=new T.Color('#344044');
  hero.visibility.setFirstPerson(true);
  hero.rider.traverse(o=>{
   if(!(o instanceof T.Mesh))return;
   for(const material of Array.isArray(o.material)?o.material:[o.material])if(material instanceof T.MeshStandardMaterial&&/garment|nylon|suit|hoodie/i.test(material.name))sleeveColor=material.color.clone();
   if(!(o instanceof T.SkinnedMesh)){o.visible=o.visible&&hands.has(o);return;}
   const source=o.geometry,skin=source.getAttribute('skinIndex'),weight=source.getAttribute('skinWeight'),index=source.index;
   if(!skin||!weight||!index)return;
   const included=new Uint8Array(skin.count);
   for(let v=0;v<skin.count;v++){let w=0;for(let i=0;i<4;i++)if(hands.has(o.skeleton.bones[skin.getComponent(v,i)]))w+=weight.getComponent(v,i);included[v]=w>=.45?1:0;}
   const geometry=source.clone(),indices:number[]=[];geometry.clearGroups();
   for(const group of source.groups.length?source.groups:[{start:0,count:index.count,materialIndex:0}]){
    const start=indices.length;for(let i=group.start;i<group.start+group.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(included[a]&&included[b]&&included[c])indices.push(a,b,c);}
    geometry.addGroup(start,indices.length-start,group.materialIndex);
   }
   geometry.setIndex(indices);this.masks.push(geometry);o.geometry=geometry;o.visible=o.visible&&indices.length>0;
  });
  this.cloth=new T.MeshStandardMaterial({color:sleeveColor,roughness:.88,metalness:0});
  this.cuffMaterial=new T.MeshStandardMaterial({color:sleeveColor.clone().multiplyScalar(.66),roughness:.74});
  for(let i=0;i<2;i++){const sleeve=new T.Mesh(this.sleeveGeometry,this.cloth),cuff=new T.Mesh(this.cuffGeometry,this.cuffMaterial);sleeve.name='First-person fitted sleeve';cuff.name='First-person wrist cuff';sleeve.receiveShadow=cuff.receiveShadow=true;root.add(sleeve,cuff);this.sleeves.push(sleeve);this.cuffs.push(cuff);}
 }
 update(camera:T.Camera,scale:number,viewScale:number){
  const forward=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion),right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  for(let i=0;i<2;i++){
   const hand=this.hero.arms[i]?.foot,sleeve=this.sleeves[i],cuff=this.cuffs[i];sleeve.visible=cuff.visible=!!hand;if(!hand)continue;
   const wrist=this.root.worldToLocal(hand.getWorldPosition(new T.Vector3()));
   const elbow=this.root.worldToLocal(camera.position.clone().addScaledVector(right,(i===0?-.36:.38)*scale).addScaledVector(up,-.57*scale).addScaledVector(forward,-.06*scale));
   const direction=wrist.clone().sub(elbow),length=direction.length();direction.normalize();
   sleeve.position.copy(elbow).addScaledVector(direction,length/2);sleeve.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);sleeve.scale.set(scale/viewScale,length,scale/viewScale);
   cuff.position.copy(wrist).addScaledVector(direction,-.025*scale/viewScale);cuff.quaternion.copy(sleeve.quaternion);cuff.scale.setScalar(scale/viewScale);
  }
 }
 dispose(){for(const geometry of this.masks)geometry.dispose();for(const mesh of [...this.sleeves,...this.cuffs])mesh.removeFromParent();this.sleeveGeometry.dispose();this.cuffGeometry.dispose();this.cloth.dispose();this.cuffMaterial.dispose();}
}
