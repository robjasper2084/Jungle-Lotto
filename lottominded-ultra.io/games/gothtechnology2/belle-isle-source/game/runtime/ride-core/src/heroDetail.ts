import * as T from 'three';
import {surfaceFinish} from './surfaceFinish.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Fitted garment hardware. One skinned mesh, two material groups, no new textures.
 * Parts share the hero's bones, so hands, ADS and cosmetic scale stay consistent. */
export class HeroDetail {
 private mesh?:T.SkinnedMesh;
 private materials:T.MeshStandardMaterial[]=[];
 constructor(root:T.Object3D){
  const surfaceCopies=new Map<T.Material,T.Material>();
  root.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;
   const detail=(source:T.Material)=>{
    const body=/^(DS_Man_01_PBR|DS_Mascot_(Suit|Hoodie)_01_PBR|Material_1|Dark riding garments \/ original UV detail)$/.test(source.name),glove=source.name==='Articulated charcoal riding gloves';
    if(!(source as T.MeshStandardMaterial).isMeshStandardMaterial||!body&&!glove)return source;
    if(surfaceCopies.has(source))return surfaceCopies.get(source)!;
    const material=(source as T.MeshPhysicalMaterial).clone();material.metalness=0;material.metalnessMap=null;
    material.roughness=glove?.69:source.name.startsWith('Dark riding')?.87:.78;
    if(material.isMeshPhysicalMaterial){material.specularColor.setRGB(1,1,1);material.specularIntensity=.4;}
    surfaceFinish(material,'cloth');surfaceCopies.set(source,material);this.materials.push(material);return material;
   };
   mesh.material=Array.isArray(mesh.material)?mesh.material.map(detail):detail(mesh.material);
  });
  root.updateWorldMatrix(true,true);
  const bones:T.Bone[]=[];root.traverse(o=>{if((o as T.Bone).isBone)bones.push(o as T.Bone);});
  if(!bones.length)return;
  const position=(name:string)=>{const b=root.getObjectByName(name);return b?root.worldToLocal(b.getWorldPosition(new T.Vector3())):undefined;};
  const hips=position('Hips'),head=position('Head');if(!hips||!head)return;
  const scale=T.MathUtils.clamp((head.y-hips.y)/.65,.4,1.5),pieces:T.BufferGeometry[][]=[[],[]];
  const add=(boneName:string,center:T.Vector3,size:T.Vector3,rotation=new T.Quaternion(),material=0)=>{
   const bone=bones.findIndex(b=>b.name===boneName);if(bone<0)return;
   const shape=new RoundedBoxGeometry(1,1,1,1,.12),geometry=shape.index?shape.toNonIndexed():shape;
   if(geometry!==shape)shape.dispose();
   geometry.applyMatrix4(new T.Matrix4().compose(center,rotation,size));
   const n=geometry.attributes.position.count,indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
   for(let i=0;i<n;i++){indices[i*4]=bone;weights[i*4]=1;}
   geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
   pieces[material].push(geometry);
  };
  const size=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).multiplyScalar(scale);
  for(const side of ['Left','Right']){
   const hand=position(side+'Hand'),forearm=position(side+'ForeArm'),middle=position(side+'HandMiddle1');
   if(hand&&forearm){
    const axis=hand.clone().sub(forearm).normalize(),rot=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis);
    // Cuff seam, clasp, and individually articulated knuckle caps.
    add(side+'ForeArm',hand.clone().addScaledVector(axis,-.025*scale),size(.071,.012,.055),rot);
    add(side+'ForeArm',hand.clone().addScaledVector(axis,-.025*scale).add(new T.Vector3(0,0,.031*scale)),size(.025,.017,.008),rot,1);
    for(const finger of ['Index','Middle','Ring','Pinky']){
     const p=position(side+'Hand'+finger+'1');if(p)add(side+'Hand'+finger+'1',p.add(new T.Vector3(0,0,-.009*scale)),size(.014,.015,.009),rot);
    }
    if(middle)add(side+'Hand',hand.clone().lerp(middle,.65).add(new T.Vector3(0,0,-.015*scale)),size(.048,.024,.008),rot);
   }
   const foot=position(side+'Foot'),toe=position(side+'ToeBase');
   if(foot&&toe){
    const center=foot.clone().lerp(toe,.55);center.y+=.025*scale;
    for(let i=0;i<3;i++)add(side+'Foot',center.clone().add(new T.Vector3(0,.003*scale,i*.018*scale)),size(.058,.006,.004),new T.Quaternion(),1);
    // Short welt seams and a heel tab follow each foot, including crouch/ADS.
    for(const sign of [-1,1])for(let i=0;i<5;i++)add(side+'Foot',center.clone().add(new T.Vector3(sign*.035*scale,-.018*scale,(i-2)*.022*scale)),size(.003,.003,.012),new T.Quaternion(),1);
    add(side+'Foot',foot.clone().add(new T.Vector3(0,.045*scale,-.025*scale)),size(.025,.036,.008));
   }
  }
  // Place tailoring on the visible torso surface, not a guessed human chest depth.
  const chest=position('Spine'),lower=position('Spine02');
  if(chest&&lower){
   let front=-Infinity;root.traverse(o=>{const m=o as T.SkinnedMesh;if(!m.isMesh||!m.geometry.attributes.position)return;
    const p=new T.Vector3();for(let i=0;i<m.geometry.attributes.position.count;i++){
     root.worldToLocal(m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld));
     if(Math.abs(p.x-hips.x)<.10*scale&&p.y>lower.y&&p.y<chest.y)front=Math.max(front,p.z);
    }
   });
   if(Number.isFinite(front)){
    const height=chest.y-lower.y;
    for(let i=0;i<3;i++)add('Spine',new T.Vector3(hips.x,lower.y+height*(.35+i*.20),front+.004*scale),size(.009,.009,.004),new T.Quaternion(),1);
    add('Spine',new T.Vector3(hips.x+.09*scale,chest.y-.04*scale,front+.005*scale),size(.025,.012,.004),new T.Quaternion(),1);
   }
  }
  const groups=pieces.map(items=>items.length?mergeGeometries(items,false):null).filter((g):g is T.BufferGeometry=>!!g);
  if(!groups.length)return;
  const geometry=mergeGeometries(groups,true)!;
  geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
  for(const list of pieces)for(const g of list)g.dispose();for(const g of groups)g.dispose();
  const hardware=[new T.MeshStandardMaterial({name:'Hero detail / stitched charcoal',color:'#252d30',metalness:0,roughness:.86}),new T.MeshStandardMaterial({name:'Hero detail / brushed fasteners',color:'#6c7678',metalness:.65,roughness:.48})];this.materials.push(...hardware);
  const mesh=this.mesh=new T.SkinnedMesh(geometry,hardware);mesh.name='Fitted hero cuffs, knuckles and tailoring';mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  root.add(mesh);root.updateWorldMatrix(true,true);mesh.bind(new T.Skeleton(bones));
  root.userData.heroDetail={version:1,triangles:geometry.attributes.position.count/3,materialGroups:geometry.groups.length};
 }
 dispose(){this.mesh?.removeFromParent();this.mesh?.geometry.dispose();this.mesh?.skeleton.dispose();for(const m of this.materials)m.dispose();}
}
