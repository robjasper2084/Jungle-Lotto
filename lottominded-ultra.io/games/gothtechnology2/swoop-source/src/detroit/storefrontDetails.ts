import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {DetroitWorld} from './world.ts';
import {heightAt} from './world.ts';
import {MACK_STUDIO,studioMap} from './mackStudioSite.ts';
import {LOTTO_SHOP,LOTTO_STREET_ENTRY,lottoMap} from './lottoShopSite.ts';

/** Original Higgsfield campaign artwork on real metre-scale hardware. */
export async function storefrontDetails(building:T.Object3D,world:DetroitWorld,lotto=false){
 const root=new T.Group();root.name=lotto?'LottoMind entry and street sign':'Mack storefront signs and arrival forecourt';building.add(root);
 const site=lotto?LOTTO_SHOP:MACK_STUDIO,map=lotto?lottoMap:studioMap,bins=new Map<T.Material,T.BufferGeometry[]>();
 const metal=new T.MeshStandardMaterial({color:0x202927,metalness:.65,roughness:.48}),brass=new T.MeshStandardMaterial({color:0xc6ad68,metalness:.7,roughness:.42}),stone=new T.MeshStandardMaterial({color:0xb9b3a2,roughness:.87}),green=new T.MeshStandardMaterial({color:0x3c5440,roughness:.98});
 const glow=new T.MeshStandardMaterial({color:0xffe2ac,emissive:0xffd19b,emissiveIntensity:.5,roughness:.35});
 const binsAdd=(g:T.BufferGeometry,m:T.Material)=>{const parts=bins.get(m)??[];parts.push(g);bins.set(m,parts);};
 function box(u:number,y:number,v:number,w:number,h:number,d:number,m:T.Material){const g=new T.BoxGeometry(w,h,d);g.translate(u,y,v);binsAdd(g,m);}
 function pole(u:number,v:number,y:number,r:number,h:number,m:T.Material){const g=new T.CylinderGeometry(r,r,h,12);g.translate(u,y,v);binsAdd(g,m);}
 function collider(u:number,v:number,w:number,h:number,d:number,y=h/2){const p=map(u,v);world.addBox({x:p.x,y:site.floor+y,z:p.z,hx:w/2,hy:h/2,hz:d/2,yaw:-site.heading,kind:'storefront fixture'});}
 const textureLoader=new T.TextureLoader();
 const keys=lotto?['lotto-fascia','lotto-billboard']:['gothtech-fascia','gothtech-billboard','serengeti-fascia','serengeti-billboard'];
 const maps=await Promise.all(keys.map(key=>textureLoader.loadAsync('/exports/polish/store-signs/'+key+'.jpg')));
 maps.forEach(t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;});
 function face(texture:T.Texture,u:number,y:number,v:number,w:number,h:number,back=false){const m=new T.MeshStandardMaterial({map:texture,roughness:.5,metalness:.12,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.18});const p=new T.Mesh(new T.PlaneGeometry(w,h),m);p.position.set(u,y,v);if(back)p.rotation.y=Math.PI;root.add(p);}
 function sign(texture:T.Texture,u:number,y:number,v:number,w:number,back=false){const h=w*576/1344,d=back?-1:1;box(u,y,v,w+.16,h+.16,.18,metal);box(u,y,v+d*.105,w+.075,h+.075,.025,brass);face(texture,u,y,v+d*.123,w,h,back);for(const x of [-w*.38,w*.38]){box(u+x,y+h/2+.13,v+d*.22,.38,.10,.35,metal);box(u+x,y+h/2+.08,v+d*.36,.26,.03,.11,glow);}}
 function billboard(texture:T.Texture,u:number,v:number,w=6.4){const p=map(u,v),base=heightAt(p.x,p.z)-site.floor,h=w*752/1344,y=base+2.15+h/2;box(u,y,v,w+.18,h+.18,.28,metal);box(u,y,v+.155,w+.07,h+.07,.025,brass);face(texture,u,y,v+.175,w,h);face(texture,u,y,v-.155,w,h,true);
  for(const x of [-w*.33,w*.33]){pole(u+x,v,base+(2.15+h)/2,.085,2.15+h,metal);box(u+x,base+.08,v,.60,.16,.60,stone);collider(u+x,v,.24,2.15+h,.24,base+(2.15+h)/2);box(u+x,y+h/2+.16,v+.30,.42,.10,.55,metal);box(u+x,y+h/2+.105,v+.49,.32,.03,.17,glow);}
  collider(u,v,w+.18,h+.18,.28,y);
 }
 function planter(u:number,v:number,w=1.2){box(u,.30,v,w,.55,.76,metal);box(u,.58,v,w+.06,.05,.82,brass);for(let n=0;n<8;n++){const g=new T.IcosahedronGeometry(.25,1);g.scale(.75,1.45,.65);g.translate(u+(n%4-1.5)*w/4,.75+(n%3)*.09,v+(n<4?-.15:.15));binsAdd(g,green);}collider(u,v,w,.7,.8);}
 function bikeRack(u:number,v:number){for(const dx of [-.55,0,.55]){pole(u+dx,v,.48,.035,.9,metal);pole(u+dx,v+.65,.48,.035,.9,metal);box(u+dx,.92,v+.325,.07,.07,.72,metal);}collider(u,v,1.25,.95,.75);}
 if(lotto){
  sign(maps[0],0,5.77,9.72,8.35);billboard(maps[1],-5.9,15.1,4.6);
  box(0,-.25,0,13.65,.58,19.0,stone); // Foundation stays below the finished retail floor.
  // Recessed, already-open double doors leave a 2.4 m route through the portal.
  const glass=new T.MeshPhysicalMaterial({color:0xadc3bc,transparent:true,opacity:.18,roughness:.2,metalness:.12,depthWrite:false,side:T.DoubleSide});
  function portal(center:number,v:number,d:number){
   for(const side of [-1,1]){const u=center+side*1.32;box(u,1.47,v-d*.56,.075,2.82,1.3,brass);box(u,1.47,v-d*1.20,.075,2.82,.075,brass);box(u,2.84,v-d*.56,.075,.075,1.3,brass);box(u,.11,v-d*.56,.075,.075,1.3,brass);const pane=new T.Mesh(new T.PlaneGeometry(1.20,2.63),glass);pane.position.set(u,1.47,v-d*.56);pane.rotation.y=Math.PI/2;root.add(pane);pole(u-side*.08,v-d*.78,1.18,.018,.35,metal);box(center+side*1.48,1.48,v+d*.16,.12,2.98,.22,metal);}
   box(center,2.99,v+d*.18,3.08,.18,.27,metal);box(center,2.88,v+d*.28,2.7,.035,.055,glow);box(center,3.12,v+d*.67,3.5,.14,1.42,metal);
  }
  portal(0,9.35,1);portal(LOTTO_STREET_ENTRY.u,LOTTO_STREET_ENTRY.v,-1);
  sign(maps[0],0,5.77,-9.72,8.35,true);
  for(const u of [-5.95,5.95]){planter(u,10.5,.95);box(u,2.3,9.63,.15,.60,.16,metal);box(u,2.3,9.73,.11,.42,.055,glow);}
  bikeRack(4.7,13.7);
  for(const u of [-6.2,5.95]){planter(u,-10.5,.85);box(u,2.3,-9.63,.15,.60,.16,metal);box(u,2.3,-9.73,.11,.42,.055,glow);}
  bikeRack(4.7,-13.7);
  const entryLight=new T.PointLight(0xc3e4ff,1.2,8,2);entryLight.position.set(LOTTO_STREET_ENTRY.u,2.8,-10.1);root.add(entryLight);
  for(const [start,end]of [[9.42,16.42],[-12.42,-9.42]]){
   const vertices:number[]=[],ground:number[]=[];
   for(let u=-7;u<7;u+=.5)for(let v=start;v<end;v+=.5){const q=[[u,v],[u+.5,v],[u+.5,v+.5],[u,v+.5]].map(([x,z])=>{const p=map(x,z);return {u:x,v:z,p,y:heightAt(p.x,p.z)+.055};});for(const i of [0,2,1,0,3,2]){vertices.push(q[i].u,q[i].y-site.floor,q[i].v);ground.push(q[i].p.x,q[i].y,q[i].p.z);}}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();const apron=new T.Mesh(g,stone);apron.receiveShadow=true;root.add(apron);world.addRideSurface(new Float32Array(ground),true);
  }
 }else{
  sign(maps[0],12,3.18,22.30,10.2);sign(maps[2],-12,3.18,22.30,10.2);
  billboard(maps[1],20.5,31.2);billboard(maps[3],-20.5,31.2);
  for(const u of [-8,8])planter(u,24.3,2.25);for(const u of [-5.4,5.4]){pole(u,25.5,.55,.07,1.10,metal);box(u,1.03,25.5,.16,.12,.16,glow);collider(u,25.5,.18,1.1,.18);}
  bikeRack(5,28.6);bikeRack(-5,28.6);
 }
 for(const [m,parts]of bins){const g=mergeGeometries(parts);if(g){const mesh=new T.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}parts.forEach(p=>p.dispose());}
 root.traverse(o=>{const mesh=o as T.Mesh;if(mesh.isMesh){mesh.receiveShadow=true;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];mesh.castShadow=!materials.some(m=>m.transparent);}});
 return root;
}
