import {registerRetailShell} from './tagSceneryCollisions.ts';
import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {toLocal,toMap} from './geo-profile.ts';
import {LOTTO_SHOP,lottoCoordinates} from './lottoShopSite.ts';
import {CITY} from './geography.ts';
import {PENNY_SHOP,pennyMap,pennyNear} from './pennyShopSite.ts';
import {PennyAuction} from './pennyAuction.ts';
import {addPennyAdvertisements} from './pennyWayfinding.ts';
import type {DetroitWorld} from './world.ts';
export async function buildPennyShop(scene:T.Scene,world:DetroitWorld,entered:()=>void,left:()=>void){
 const loader=new GLTFLoader(),building=(await loader.loadAsync('/exports/atwater/penny-exchange.glb')).scene;
 const at=pennyMap(0,0),local=toLocal(at.x,PENNY_SHOP.floor,at.z);building.name='Penny Exchange / connected LottoMind building';building.position.set(local.x,local.y,local.z);building.rotation.y=PENNY_SHOP.heading;scene.add(building);
 building.traverse(o=>{const m=o as T.Mesh;if(m.isMesh){m.receiveShadow=true;m.castShadow=true;}});
 registerRetailShell(world,'penny');
 for(const v of [-5,5]){const light=new T.PointLight(0xffe5c9,60,15,2);light.position.set(0,3.7,v);building.add(light);}
 // Preserve the irregular mapped upper footprint instead of expanding into the road.
 const mapped=CITY.buildings.find(b=>b.id===PENNY_SHOP.osmId)!;const upper=new T.ExtrudeGeometry(new T.Shape(mapped.points.map(([x,z])=>{const p=lottoCoordinates(x,z);return new T.Vector2(p.u-PENNY_SHOP.u,-p.v);})),{depth:5.6,bevelEnabled:false});upper.rotateX(-Math.PI/2);upper.translate(0,4.3,0);const eastFace=new T.Mesh(upper,new T.MeshStandardMaterial({color:0x7c6457,roughness:.9}));building.add(eastFace);
 const catalog: {image:string;category:string}[]=await (await fetch('/exports/boutique/catalog.json')).json();const art=await Promise.all(catalog.slice(0,8).map(p=>new T.TextureLoader().loadAsync('/exports/boutique/'+p.image)));for(const [i,texture]of art.entries()){texture.colorSpace=T.SRGBColorSpace;const side=i<4?-1:1,v=[-6,-2,2,6][i%4],frame=new T.Mesh(new T.BoxGeometry(.08,1.8,1.4),new T.MeshStandardMaterial({color:0xc6ad68,metalness:.65,roughness:.4}));frame.position.set(side*3.83,2.55,v);building.add(frame);const face=new T.Mesh(new T.PlaneGeometry(1.30,1.7),new T.MeshBasicMaterial({map:texture}));face.position.set(side*3.775,2.55,v);face.rotation.y=side<0?Math.PI/2:-Math.PI/2;building.add(face);}
 for(const side of [-1,1])for(const u of [-2.8,0,2.8]){const window=new T.Mesh(new T.PlaneGeometry(1.55,2.1),new T.MeshStandardMaterial({color:0x253942,metalness:.35,roughness:.26}));window.position.set(u,7.4,side*9.415);if(side<0)window.rotation.y=Math.PI;building.add(window);}
 const advertisements=await addPennyAdvertisements(scene,building,world,catalog);
 const desk=new PennyAuction(entered,left),arrival=document.createElement('button');arrival.className='penny-arrival';arrival.textContent='🛍 Penny Exchange · browse & try a bid';arrival.hidden=true;arrival.onclick=()=>void desk.open();document.body.append(arrival);
 const kiosk=(await loader.loadAsync('/exports/atwater/lotto-game-kiosk.glb')).scene;kiosk.position.set(3.4,0,5.25);kiosk.name='LottoMind playable game kiosk';
 return {building,kiosk,desk,get active(){return desk.active;},close(){desk.close();},update(x:number,z:number,visible:boolean){advertisements.update(x,z);const m=toMap(x,0,z);building.visible=Math.hypot(m.x-at.x,m.z-at.z)<250;arrival.hidden=!visible||!pennyNear(m.x,m.z)||desk.active;if(!visible&&desk.active)desk.close();},floor:LOTTO_SHOP.floor};
}
