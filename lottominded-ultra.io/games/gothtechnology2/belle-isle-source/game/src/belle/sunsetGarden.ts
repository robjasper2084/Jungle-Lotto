import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ParkMap,ParkTerrain} from './terrain.ts';
import {yieldStartupTask} from './startupWork.ts';
import {roadIndex} from './streetPlan.ts';
import {mapleDetail,useDistantMaple} from './distantMaple.ts';
import {inSunsetGarden,SUNSET_GARDEN} from './sunsetReferencePolicy.ts';
/** Original bounded scenery, kept clear of mapped roads, paths and buildings. */
export async function addSunsetGarden(scene:T.Scene,map:ParkMap,terrain:ParkTerrain,options?:{name:string;x:number;z:number;radius:number;trees:number;seed:number;shore:boolean},occupied=roadIndex(map.roads,true)){
 const center=options??SUNSET_GARDEN,inside=(x:number,z:number)=>Math.hypot(x-center.x,z-center.z)<center.radius&&(!options||!inSunsetGarden(x,z));
 const root=new T.Group();root.name=(options?.name??'Sunset Point')+' reference garden';scene.add(root);
 let seed=options?.seed??209584;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const dummy=new T.Object3D(),color=new T.Color();
 const standard=(name:string,value:number,roughness=.85)=>new T.MeshStandardMaterial({name,color:value,roughness});
 const bark=standard('Reference warm oak bark',0x73503c),stone=standard('Reference shoreline limestone',0xb9a190),wood=standard('Reference cedar bench',0x81503a),metal=standard('Reference bronze park fittings',0x293239,.50),leafMat=standard('Reference autumn leaves',0xffffff);
 leafMat.side=T.DoubleSide;leafMat.emissive.set(0xa84e0e);leafMat.emissiveIntensity=.02;
 const glow=new T.MeshStandardMaterial({name:'Reference lantern glass',color:0xffdc8b,emissive:0xffad49,emissiveIntensity:1.8,roughness:.4});
 const staticParts=new T.Group();root.add(staticParts);
 const mesh=(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,p:T.Vector3)=>{const o=new T.Mesh(g,m);o.position.copy(p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 function rod(a:T.Vector3,b:T.Vector3,r1:number,r2:number,m=bark,parent:T.Object3D=staticParts){const o=mesh(parent,new T.CylinderGeometry(r2,r1,a.distanceTo(b),7),m,a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return o;}
 const roads=map.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,width:r.width,foot:r.foot})));
 const clear=(x:number,z:number,pad=3)=>terrain.land(x,z)&&!terrain.obstructed(x,z,1.6)&&!occupied(x,z,null,pad);
 const sites:{x:number;z:number;h:number;r:number}[]=[];
 for(let i=0;i<6000&&sites.length<(options?.trees??95);i++){
  const x=-170+rand()*490,z=1220+rand()*450;
  if(!inside(x,z)||!clear(x,z,3.5)||sites.some(p=>Math.hypot(x-p.x,z-p.z)<11))continue;
  if(x<-130&&Math.abs(z-1491)<65)continue;
  sites.push({x,z,h:11+rand()*7,r:5.2+rand()*2.5});
 }
 const leafShape=new T.Shape();const outline=[[-.04,-.28],[-.09,-.12],[-.29,-.18],[-.20,-.015],[-.37,.08],[-.19,.12],[-.22,.31],[-.08,.23],[0,.43],[.09,.23],[.24,.31],[.19,.12],[.37,.08],[.20,-.015],[.29,-.18],[.09,-.12],[.04,-.28]];
 outline.forEach((p,i)=>i?leafShape.lineTo(p[0],p[1]):leafShape.moveTo(p[0],p[1]));leafShape.closePath();const leafGeo=new T.ShapeGeometry(leafShape);leafGeo.rotateX(-Math.PI/2);const pos=leafGeo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,Math.abs(pos.getX(i))*.13);leafGeo.computeVertexNormals();
 // Each tile has its own conservative instance bounds. Colour and shadow
 // cameras can then reject whole groves without uploading or drawing them.
 const perTree=2400,leaves=new T.Group();leaves.name='Reference full autumn maple canopies';root.add(leaves);
 const tileKey=(p:{x:number;z:number})=>Math.floor(p.x/64)+','+Math.floor(p.z/64);
 const tileSizes=new Map<string,number>(),tiles=new Map<string,T.InstancedMesh>();
 for(const site of sites){const key=tileKey(site);tileSizes.set(key,(tileSizes.get(key)??0)+perTree);}
 const canopyDetail=tileSizes.size?mapleDetail(leafGeo):null;
 for(const [key,size] of tileSizes){
  const batch=new T.InstancedMesh(canopyDetail!.geometry,leafMat,size);
  useDistantMaple(batch,canopyDetail!);
  batch.name='Sunset Point maple leaves '+key;batch.castShadow=true;batch.receiveShadow=true;batch.count=0;
  tiles.set(key,batch);leaves.add(batch);
 }
 const tones=[0xeaae25,0x76933b,0xc28019,0x9f9b2f,0xf1b730,0x658441];let leafCount=0;
 const crownMat=standard('Reference shaded inner canopy',0xffffff);const crowns=new T.InstancedMesh(new T.IcosahedronGeometry(1,2),crownMat,sites.length*10);crowns.castShadow=true;crowns.receiveShadow=true;root.add(crowns);let crownCount=0;
 for(const [index,p] of sites.entries()){
  if(index%4===0)await yieldStartupTask();
  const leafBatch=tiles.get(tileKey(p))!;
  const y=terrain.height(p.x,p.z),base=new T.Vector3(p.x,y,p.z),tip=base.clone().add(new T.Vector3((rand()-.5)*.8,p.h*.85,(rand()-.5)*.8));rod(base,tip,.32,.10);
  terrain.flightSolids.add({x:p.x,z:p.z,bottom:y,top:y+p.h,radius:.35,kind:'tree'});
  const lobes:T.Vector3[]=[];
  for(let j=0;j<9;j++){const a=j/9*Math.PI*2+index*.8,c=base.clone().add(new T.Vector3(Math.cos(a)*p.r*.54,p.h*.67+rand()*p.h*.24,Math.sin(a)*p.r*.54));lobes.push(c);rod(base.clone().lerp(tip,.42+j*.035),c,.12,.025);}
  lobes.push(base.clone().add(new T.Vector3(0,p.h*.94,0)));
  for(const c of lobes){dummy.position.copy(c);dummy.rotation.set(rand(),rand()*6,rand());dummy.scale.set(p.r*.33,p.r*.29,p.r*.33);dummy.updateMatrix();crowns.setMatrixAt(crownCount,dummy.matrix);crowns.setColorAt(crownCount++,color.setHex(tones[index%tones.length]).multiplyScalar(.50));}
  for(let j=0;j<perTree;j++){
   const c=lobes[j%lobes.length],a=rand()*Math.PI*2,vy=rand()*2-1,s=Math.sqrt(1-vy*vy),r=Math.pow(rand(),.48)*p.r*.65;
   dummy.position.set(c.x+Math.cos(a)*s*r,c.y+vy*r*.76,c.z+Math.sin(a)*s*r);dummy.rotation.set((rand()-.5)*1.5,rand()*Math.PI*2,(rand()-.5)*1.3);const size=1.0+rand()*1.2;dummy.scale.set(size,size,size);dummy.updateMatrix();leafBatch.setMatrixAt(leafBatch.count,dummy.matrix);
   color.setHex(tones[(index+Math.floor(rand()*2.3))%tones.length]).multiplyScalar(.82+rand()*.33);leafBatch.setColorAt(leafBatch.count++,color);leafCount++;
  }
 }
 for(const batch of tiles.values())batch.computeBoundingSphere();
 // Natural rock revetment follows the actual island perimeter.
 const rocks:T.Matrix4[]=[];for(let j=1;j<map.island.length;j++){
  const a=map.island[j-1],b=map.island[j],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(let d=0;d<length;d+=1.7){const t=d/length,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;if(options?.shore===false||Math.hypot(x-center.x,z-center.z)>center.radius+80||options&&inSunsetGarden(x,z))continue;
   for(let k=0;k<2;k++){dummy.position.set(x+(rand()-.5)*2,.5+rand()*.8,z+(rand()-.5)*2);dummy.scale.set(.65+rand()*.8,.45+rand()*.55,.6+rand()*.9);dummy.rotation.set(rand(),rand()*6,rand());dummy.updateMatrix();rocks.push(dummy.matrix.clone());}
  }
 }
 const shore=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),stone,rocks.length);rocks.forEach((m,i)=>{shore.setMatrixAt(i,m);shore.setColorAt(i,color.setHSL(.075,.13,.52+rand()*.22));});shore.receiveShadow=true;root.add(shore);
 // Benches and lamps are offset from route shoulders, never across travel space.
 const decor:{x:number;z:number}[]=[];const flowers:{x:number;y:number;z:number}[]=[];
 let sliceStart=performance.now();
 for(const r of roads){
  if(performance.now()-sliceStart>16){await yieldStartupTask();sliceStart=performance.now();}
  const length=Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1]);if(length<5)continue;const nx=-(r.b[1]-r.a[1])/length,nz=(r.b[0]-r.a[0])/length;
  for(let d=6;d<length;d+=42){const t=d/length,cx=r.a[0]+(r.b[0]-r.a[0])*t,cz=r.a[1]+(r.b[1]-r.a[1])*t;if(!inside(cx,cz))continue;
   for(const sign of[-1,1]){const x=cx+nx*(r.width*.5+2.5)*sign,z=cz+nz*(r.width*.5+2.5)*sign;if(!clear(x,z,1.7)||decor.some(p=>Math.hypot(x-p.x,z-p.z)<25))continue;decor.push({x,z});const y=terrain.height(x,z);terrain.flightSolids.add({x,z,bottom:y,top:y+3.8,radius:.22,kind:'lamp'});const group=new T.Group();group.position.set(x,y,z);group.rotation.y=Math.atan2(nx*sign,nz*sign);staticParts.add(group);
    rod(new T.Vector3(0,0,0),new T.Vector3(0,3.3,0),.065,.045,metal,group);mesh(group,new T.CylinderGeometry(.13,.22,.18,8),metal,new T.Vector3(0,.09,0));mesh(group,new T.BoxGeometry(.25,.40,.25),glow,new T.Vector3(0,3.4,0));mesh(group,new T.ConeGeometry(.27,.2,4),metal,new T.Vector3(0,3.7,0)).rotation.y=Math.PI/4;
    for(const dx of[-.14,.14])for(const dz of[-.14,.14])rod(new T.Vector3(dx,3.18,dz),new T.Vector3(dx,3.63,dz),.014,.014,metal,group);
    if(decor.length%2===0&&clear(x+Math.cos(group.rotation.y)*2,z-Math.sin(group.rotation.y)*2,1.2)){terrain.flightSolids.add({x:x+Math.cos(group.rotation.y)*2,z:z-Math.sin(group.rotation.y)*2,bottom:y,top:y+1.15,radius:.95,kind:'rock'});for(let k=0;k<5;k++){mesh(group,new T.BoxGeometry(1.8,.07,.075),wood,new T.Vector3(2,.48,k*.09-.18));mesh(group,new T.BoxGeometry(1.8,.085,.05),wood,new T.Vector3(2,.69+k*.1,-.24));}for(const dx of[1.28,2.72]){rod(new T.Vector3(dx,0,-.16),new T.Vector3(dx,1.08,-.26),.027,.027,metal,group);rod(new T.Vector3(dx,0,.16),new T.Vector3(dx,.48,.16),.027,.027,metal,group);}}
    for(let n=0;n<22;n++){const fx=x+(rand()-.5)*5,fz=z+(rand()-.5)*5;if(clear(fx,fz,.7))flowers.push({x:fx,y:terrain.height(fx,fz),z:fz});}
   }
  }
 }
 const flowerGeo=new T.SphereGeometry(1,7,4),flowerMat=standard('Reference late-summer flower heads',0xffcf54);const blooms=new T.InstancedMesh(flowerGeo,flowerMat,flowers.length*5);const stemMat=standard('Reference flower stems',0x58662e);const stems=new T.InstancedMesh(new T.CylinderGeometry(.009,.015,1,4),stemMat,flowers.length);
 // Each 16 cm petal keeps its color and transform at distance. Use fewer
 // triangles once even the nearest flower in this garden is subpixel.
 const distantPetal=new T.SphereGeometry(1,4,2),flowerBounds=new T.Box2();
 const flowerPosition=new T.Vector2();
 for(const p of flowers)flowerBounds.expandByPoint(flowerPosition.set(p.x,p.z));
 flowers.forEach((p,i)=>{const h=.25+rand()*.25;dummy.position.set(p.x,p.y+h*.5,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,h,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);for(let k=0;k<5;k++){const a=k/5*Math.PI*2;dummy.position.set(p.x+Math.cos(a)*.065,p.y+h,p.z+Math.sin(a)*.065);dummy.scale.set(.065,.025,.055);dummy.rotation.y=a;dummy.updateMatrix();blooms.setMatrixAt(i*5+k,dummy.matrix);blooms.setColorAt(i*5+k,color.setHex(i%4===0?0xffe5b5:0xffbf28));}});root.add(blooms,stems);
 // Small fallen leaves create a readable path edge without expensive particles.
 const litter=new T.InstancedMesh(leafGeo,new T.MeshStandardMaterial({color:0xffb54a,roughness:1,side:T.DoubleSide}),sites.length*12);
 let count=0;sites.forEach(p=>{for(let i=0;i<12;i++){const x=p.x+(rand()-.5)*p.r*2,z=p.z+(rand()-.5)*p.r*2;if(!terrain.land(x,z))continue;dummy.position.set(x,terrain.height(x,z)+.045,z);dummy.rotation.set(0,rand()*6,0);dummy.scale.setScalar(.32+rand()*.22);dummy.updateMatrix();litter.setMatrixAt(count++,dummy.matrix);}});litter.count=count;root.add(litter);
 // Flatten the small architectural parts into one mesh per material.
 staticParts.updateMatrixWorld(true);const batches=new Map<T.Material,T.BufferGeometry[]>();staticParts.traverse(o=>{if(!(o instanceof T.Mesh))return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),m=o.material as T.Material;const list=batches.get(m)||[];list.push(g);batches.set(m,list);});staticParts.clear();for(const [m,parts]of batches){const g=mergeGeometries(parts);if(g)mesh(staticParts,g,m,new T.Vector3());for(const p of parts)p.dispose();}
 return{setQuality(q:string){leaves.visible=q!=='smooth';},stats:{trees:sites.length,leaves:leafCount,rocks:rocks.length,lamps:decor.length,flowers:flowers.length},update(x:number,z:number,eyeX=x,eyeZ=z){
  root.visible=Math.hypot(x-center.x,z-center.z)<center.radius+610;
  if(root.visible&&flowers.length){
   const distance=flowerBounds.distanceToPoint(flowerPosition.set(eyeX,eyeZ));
   if(distance>200)blooms.geometry=distantPetal;
   else if(distance<170)blooms.geometry=flowerGeo;
  }
 },root};
}
