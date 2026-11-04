import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {natureBudget,type Plant,type NaturePlan} from './naturePlan.ts';
type Entry={id:string;meshes?:string[];cardSize?:number;cardCenter?:number[];card?:string;triangles:number};
type Manifest={trees:Entry[];ground:Entry[]};
type Pool={id:string;meshes:T.InstancedMesh[];far?:T.InstancedMesh;plants:Plant[]};
export async function addNature(scene:T.Scene,status:(s:string)=>void){
 const base='./belle/nature/',loader=new GLTFLoader(),textures=new T.TextureLoader();
 const json=async(name:string)=>{const r=await fetch(base+name);if(!r.ok)throw Error('Nature asset '+name+': '+r.status);return r.json();};
 const manifest:Manifest=await json('manifest.json'),plan:NaturePlan=await json('placements.json');
 status('Loading varied trees');
 const treeSource=await loader.loadAsync(base+'trees.glb');treeSource.scene.updateMatrixWorld(true);
 const pools:Pool[]=[],dummy=new T.Object3D(),tint=new T.Color();
 function instance(source:T.Mesh,count:number,name:string,shadow:boolean){
  const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
  const materials=Array.isArray(source.material)?source.material:[source.material];
  for(const material of materials){const m=material as T.MeshStandardMaterial;
   m.side=T.DoubleSide;m.roughness=Math.max(.78,m.roughness);m.metalness=0;
   if(m.transparent||m.alphaTest>0){m.transparent=false;m.alphaTest=.45;m.depthWrite=true;}
   if(m.map)m.map.anisotropy=4;
  }
  const mesh=new T.InstancedMesh(geometry,source.material,count);mesh.name=name;mesh.count=0;
  mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);return mesh;
 }
 function matrix(p:Plant,hidden=false){dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(hidden?0:p.scale,hidden?0:p.scale*(p.heightScale??1),hidden?0:p.scale);dummy.updateMatrix();return dummy.matrix;}
 for(const entry of manifest.trees){
  const meshes:T.InstancedMesh[]=[];
  for(const name of entry.meshes||[]){const source=treeSource.scene.getObjectByName(name) as T.Mesh;
   if(!source?.isMesh)throw Error('Missing generated tree part '+name);
   meshes.push(instance(source,natureBudget.high.trees,'Nearby '+entry.id,true));
  }
  const plants=plan.trees.filter(p=>p.id===entry.id),center=entry.cardCenter!,size=entry.cardSize!;
  const a=new T.PlaneGeometry(size,size),b=a.clone().rotateY(Math.PI/2),cards=mergeGeometries([a,b])!;
  cards.translate(center[0],center[1],center[2]);a.dispose();b.dispose();
  // These impostors were rendered offline in Blender, not on the user's GPU
  // while the match starts. Only one pair of cards per distant tree.
  const image=await textures.loadAsync(base+entry.card);image.colorSpace=T.SRGBColorSpace;
  const far=new T.InstancedMesh(cards,new T.MeshBasicMaterial({map:image,alphaTest:.35,side:T.DoubleSide,toneMapped:false}),plants.length);
  far.name='Distant '+entry.id;plants.forEach((p,i)=>{far.setMatrixAt(i,matrix(p));far.setColorAt(i,tint.setScalar(p.tint));});far.computeBoundingSphere();scene.add(far);
  pools.push({id:entry.id,meshes,far,plants});
 }
 // Ground cover is a separate, smaller stage. Source LOD2 models and shared
 // texture atlases avoid the provider's multi-million-polygon scatter setup.
 status('Loading rocks, grass and flowers');
 const ground=await loader.loadAsync(base+'groundcover.glb');ground.scene.updateMatrixWorld(true);
 for(const entry of manifest.ground){const source=ground.scene.getObjectByName(entry.id) as T.Mesh;
  if(!source?.isMesh)throw Error('Missing ground-cover variant '+entry.id);
  pools.push({id:entry.id,meshes:[instance(source,natureBudget.high.ground,'Nearby '+entry.id,false)],plants:plan.ground.filter(p=>p.id===entry.id)});
 }
 // Source objects never enter the scene. Pool geometries are the only copies
 // retained; textures and materials stay shared between instances.
 for(const source of [treeSource.scene,ground.scene])source.traverse(o=>{if((o as T.Mesh).isMesh)(o as T.Mesh).geometry.dispose();});
 let quality:keyof typeof natureBudget='automatic',lastX=Infinity,lastZ=Infinity;
 const stats={treeVariants:manifest.trees.length,groundVariants:manifest.ground.length,trees:plan.trees.length,ground:plan.ground.length,visibleTrees:0,visibleGround:0};
 function update(x:number,z:number,night=0){
  for(const pool of pools)if(pool.far)(pool.far.material as T.MeshBasicMaterial).color.setScalar(1-night*.70);
  if(Math.hypot(x-lastX,z-lastZ)<6)return;
  lastX=x;lastZ=z;const budget=natureBudget[quality];
  const d=(p:Plant)=>(p.x-x)**2+(p.z-z)**2;
  const nearTrees=plan.trees.filter(p=>d(p)<budget.treeRadius**2).sort((a,b)=>d(a)-d(b)).slice(0,budget.trees);
  const nearGround=plan.ground.filter(p=>d(p)<(p.id.startsWith('rock')?budget.groundRadius*1.65:budget.groundRadius)**2).sort((a,b)=>d(a)-d(b)).slice(0,budget.ground);
  const selected=new Set([...nearTrees,...nearGround]);stats.visibleTrees=nearTrees.length;stats.visibleGround=nearGround.length;
  for(const pool of pools){
   const near=pool.plants.filter(p=>selected.has(p));
   for(const mesh of pool.meshes){mesh.count=near.length;near.forEach((p,i)=>{mesh.setMatrixAt(i,matrix(p));mesh.setColorAt(i,tint.setScalar(p.tint));});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
   if(pool.far){pool.plants.forEach((p,i)=>pool.far!.setMatrixAt(i,matrix(p,selected.has(p))));pool.far.instanceMatrix.needsUpdate=true;}
  }
 }
 return{stats,update,setQuality(value:string){quality=value in natureBudget?value as keyof typeof natureBudget:'automatic';lastX=Infinity;}};
}
