import {canopyTint} from './sunsetCanopy.ts';
import {NatureViewSelection} from './natureViewSelection.ts';
import type {ParkTerrain} from './terrain.ts';
import {seasonalMaterial} from './seasonalMaterial.ts';
import {treeBlend,seasonLook} from './seasonModel.ts';
import * as T from 'three';
import {trunkRootHeight,replacedByCherry,cherryTreeSite} from './treeGrounding.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {natureBudget,type Plant,type NaturePlan} from './naturePlan.ts';
type Entry={id:string;meshes?:string[];cardSize?:number;cardCenter?:number[];card?:string;triangles:number};
type Manifest={trees:Entry[];ground:Entry[]};
type Pool={id:string;meshes:T.InstancedMesh[];far?:T.InstancedMesh[];card?:T.InstancedMesh;plants:Plant[]};
export async function addNature(scene:T.Scene,status:(s:string)=>void,terrain?:ParkTerrain){
 const base='./belle/nature/',loader=new GLTFLoader(),textures=new T.TextureLoader();
 const json=async(name:string)=>{const r=await fetch(base+name);if(!r.ok)throw Error('Nature asset '+name+': '+r.status);return r.json();};
 const manifest:Manifest=await json('manifest.json'),plan:NaturePlan=await json('placements.json');
 status('Loading varied trees');
 const treeSource=await loader.loadAsync(base+'seasonal-trees.glb');treeSource.scene.updateMatrixWorld(true);
 const month={value:Math.min(12,Math.max(1,Number(localStorage.getItem('belle-season-month'))||7))},seasons:ReturnType<typeof seasonalMaterial>[]=[];
 const pools:Pool[]=[],dummy=new T.Object3D(),tint=new T.Color();
 function instance(source:T.Mesh,count:number,name:string,shadow:boolean,rootOffset=0){
  const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);geometry.translate(0,-rootOffset,0);
  const materials=Array.isArray(source.material)?source.material:[source.material];
  for(const material of materials){const m=material as T.MeshStandardMaterial;
   m.side=T.DoubleSide;m.roughness=Math.max(.78,m.roughness);m.metalness=0;
   if(m.transparent||m.alphaTest>0){m.transparent=false;m.alphaTest=.45;m.depthWrite=true;}
   if(m.map)m.map.anisotropy=4;
  }
  const mesh=new T.InstancedMesh(geometry,source.material,count);mesh.name=name;mesh.count=0;
  mesh.castShadow=shadow;mesh.userData.seasonalLeaf=/leaves/.test(name);mesh.receiveShadow=true;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);return mesh;
 }
 function plantTint(p:Plant){const c=canopyTint(p.tint,p.canopyTone);return tint.setRGB(c[0],c[1],c[2]);}
 function matrix(p:Plant,hidden=false){dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(hidden?0:p.scale,hidden?0:p.scale*(p.heightScale??1),hidden?0:p.scale);dummy.updateMatrix();return dummy.matrix;}
 for(const entry of manifest.trees){
  const plants=plan.trees.filter(p=>p.id===entry.id&&!replacedByCherry(p));
  const trunk=treeSource.scene.getObjectByName(entry.id+'__trunk') as T.Mesh;
  const rootOffset=trunk?trunkRootHeight(trunk.geometry.attributes.position.array,trunk.matrixWorld.elements[13]):0;
  const meshes:T.InstancedMesh[]=[],far:T.InstancedMesh[]=[];
  for(const low of [false,true])for(const part of ['trunk','leaves']){
   const source=treeSource.scene.getObjectByName(entry.id+'__'+part+(low?'__lod':'')) as T.Mesh;
   if(!source)throw Error('Missing seasonal tree '+entry.id+part);
   const mesh=instance(source,low?plants.length:natureBudget.high.trees,(low?'Distant ':'Nearby ')+entry.id+' '+part,!low,rootOffset);
   const season=seasonalMaterial(Array.isArray(source.material)?source.material[0]:source.material,part==='leaves',low,entry.id==='pine',month);seasons.push(season);mesh.material=season.material;
   mesh.geometry.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array(low?plants.length:natureBudget.high.trees),1));(low?far:meshes).push(mesh);
  }
  for(const p of plants)terrain?.flightSolids.add({x:p.x,z:p.z,bottom:p.y,top:p.y+Math.max(4,(entry.cardCenter?.[1]??8)*1.3*p.scale),radius:.28*p.scale,kind:'tree'});
  const size=entry.cardSize!,center=entry.cardCenter!,a=new T.PlaneGeometry(size,size),b=a.clone().rotateY(Math.PI/2),cards=mergeGeometries([a,b])!;a.dispose();b.dispose();cards.translate(center[0],center[1],center[2]);
  const image=await textures.loadAsync(base+entry.card);image.colorSpace=T.SRGBColorSpace;
  const cardSeason=seasonalMaterial(new T.MeshBasicMaterial({map:image,alphaTest:.35,side:T.DoubleSide,toneMapped:true}),false,true,entry.id==='pine',month);cardSeason.material.alphaTest=.35;seasons.push(cardSeason);
  const card=new T.InstancedMesh(cards,cardSeason.material,plants.length);card.name='Split distant '+entry.id;card.visible=false;
  cards.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array(plants.length),1).setUsage(T.DynamicDrawUsage));
  plants.forEach((p,i)=>{card.setMatrixAt(i,matrix(p));card.setColorAt(i,plantTint(p));});card.computeBoundingSphere();scene.add(card);
  pools.push({id:entry.id,meshes,far,card,plants});
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
 const cherry=await loader.loadAsync(base+'cherry.glb?v=blossom-20261110');cherry.scene.name='Peacock Sundial flowering cherry';cherry.scene.position.set(cherryTreeSite.x,cherryTreeSite.y,cherryTreeSite.z);cherry.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;const m=o.material as T.MeshStandardMaterial;if(/blossom|leaf/.test(m.name))m.side=T.DoubleSide;}});scene.add(cherry.scene);
 const calendar=document.createElement('label');calendar.textContent='Island season';const monthSelect=document.createElement('select');monthSelect.id='season-month';monthSelect.setAttribute('aria-label','Island season month');['January','February','March','April','May','June','July','August','September','October','November','December'].forEach((name,i)=>monthSelect.add(new Option(name,String(i+1))));monthSelect.value=String(month.value);calendar.append(monthSelect);document.querySelector('#settings .settings-body')?.append(calendar);if(!calendar.isConnected)document.getElementById('settings')?.append(calendar);monthSelect.onchange=()=>{month.value=Number(monthSelect.value);localStorage.setItem('belle-season-month',String(month.value));lastX=Infinity;};
 let quality:keyof typeof natureBudget='automatic',lastX=Infinity,lastZ=Infinity,splitDetail=false,lastSplit=false,lastMonth=-1;
 const stats={treeVariants:manifest.trees.length,groundVariants:manifest.ground.length,trees:plan.trees.length,ground:plan.ground.length,visibleTrees:0,visibleGround:0};
 function select(x:number,z:number){
  cherry.scene.visible=Math.hypot(x-cherryTreeSite.x,z-cherryTreeSite.z)<900;
  // Offline summer impostors retain the full canopy silhouette in smaller panes.
  // Other seasons keep the seasonal geometry so bare branches are not replaced by leaves.
  const cardsActive=splitDetail&&month.value>=6&&month.value<=9;
  if(Math.hypot(x-lastX,z-lastZ)<6&&lastSplit===cardsActive)return;
  lastSplit=cardsActive;
  lastX=x;lastZ=z;const budget=natureBudget[quality];
  const d=(p:Plant)=>(p.x-x)**2+(p.z-z)**2;
  const nearTrees=plan.trees.filter(p=>!replacedByCherry(p)&&d(p)<budget.treeRadius**2).sort((a,b)=>d(a)-d(b)).slice(0,budget.trees);
  const nearGround=plan.ground.filter(p=>d(p)<(p.id.startsWith('rock')?budget.groundRadius*1.65:budget.groundRadius)**2).sort((a,b)=>d(a)-d(b)).slice(0,budget.ground);
  const selected=new Set([...nearTrees,...nearGround]);const cutoff=nearTrees.length>=budget.trees?Math.min(budget.treeRadius,Math.sqrt(d(nearTrees[nearTrees.length-1]))):budget.treeRadius;stats.visibleTrees=nearTrees.length;stats.visibleGround=nearGround.length;
  for(const pool of pools){
   const near=pool.plants.filter(p=>selected.has(p));
   for(const mesh of pool.meshes){mesh.count=near.length;near.forEach((p,i)=>{mesh.setMatrixAt(i,matrix(p));mesh.setColorAt(i,plantTint(p));});mesh.instanceMatrix.needsUpdate=true;const weights=mesh.geometry.getAttribute('lodWeight') as T.InstancedBufferAttribute|undefined;if(weights){near.forEach((p,i)=>weights.setX(i,treeBlend(Math.sqrt(d(p)),cutoff)));weights.needsUpdate=true;}if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
   if(pool.far)for(const far of pool.far){const visible=pool.plants.filter(p=>d(p)<(cardsActive?145:quality==='smooth'?850:1300)**2&&(!selected.has(p)||treeBlend(Math.sqrt(d(p)),cutoff)<1));far.count=visible.length;const weights=far.geometry.getAttribute('lodWeight') as T.InstancedBufferAttribute;visible.forEach((p,i)=>{far.setMatrixAt(i,matrix(p));far.setColorAt(i,plantTint(p));const distance=Math.sqrt(d(p));weights.setX(i,(selected.has(p)?1-treeBlend(distance,cutoff):1)*(cardsActive?Math.max(0,Math.min(1,(145-distance)/50)):1));});weights.needsUpdate=true;far.instanceMatrix.needsUpdate=true;if(far.instanceColor)far.instanceColor.needsUpdate=true;}
   if(pool.card){pool.card.visible=cardsActive;if(cardsActive){const weights=pool.card.geometry.getAttribute('lodWeight') as T.InstancedBufferAttribute;pool.plants.forEach((p,i)=>weights.setX(i,Math.max(0,Math.min(1,(Math.sqrt(d(p))-95)/50))));weights.needsUpdate=true;}}
  }
 }
 function update(x:number,z:number,night=0,golden=0){
  if(lastMonth!==month.value){lastMonth=month.value;lastX=Infinity;for(const season of seasons)season.update();
   for(const pool of pools)for(const mesh of pool.meshes)if(mesh.userData.seasonalLeaf)mesh.castShadow=month.value>=4&&month.value<=10;
   const look=seasonLook(month.value);cherry.scene.traverse(o=>{if(o instanceof T.Mesh){const name=(o.material as T.Material).name;o.visible=/blossom/i.test(name)?month.value>=3&&month.value<=5:/leaf/i.test(name)?look.density>.25:true;}});
  }
  const warm=Math.max(0,Math.min(1,golden));
  for(const pool of pools)if(pool.card)(pool.card.material as T.MeshBasicMaterial).color.setRGB(1,1-.075*warm,1-.16*warm).multiplyScalar(1-night*.70);
  view.prepare(x,z);
 }
 const view=new NatureViewSelection(select),eye=new T.Vector3(),before=scene.onBeforeRender;
 scene.onBeforeRender=(...args)=>{before.apply(scene,args);args[2].getWorldPosition(eye);view.render(eye.x,eye.z);};
 return{stats,update,setSplitDetail(value:boolean){splitDetail=value;},setQuality(value:string){quality=value in natureBudget?value as keyof typeof natureBudget:'automatic';lastX=Infinity;}};
}
