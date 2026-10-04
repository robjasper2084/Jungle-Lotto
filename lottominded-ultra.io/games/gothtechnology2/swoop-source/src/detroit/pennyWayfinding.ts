import * as T from 'three';
import {pennyMap,PENNY_SHOP} from './pennyShopSite.ts';
import {studioMap,MACK_STUDIO} from './mackStudioSite.ts';
import {toLocal} from './geo-profile.ts';
import type {DetroitWorld} from './world.ts';
export async function addPennyAdvertisements(scene:T.Scene,building:T.Object3D,world:DetroitWorld,products:{image:string}[]){
 const photos=await Promise.all(products.slice(0,3).map(p=>new T.TextureLoader().loadAsync('/exports/boutique/'+p.image)));
 function poster(travel=false){const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=864;const c=canvas.getContext('2d')!;
  c.fillStyle='#0c2028';c.fillRect(0,0,1536,864);c.strokeStyle='#e1bd74';c.lineWidth=12;c.strokeRect(20,20,1496,824);
  c.fillStyle='#6af0d2';c.font='bold 32px sans-serif';c.fillText('GOTHTECHNOLOGY / DETROIT MERCH',64,88);
  c.fillStyle='#fff2d3';c.font='900 94px sans-serif';c.fillText('PENNY EXCHANGE',60,198);
  for(let i=0;i<photos.length;i++){const image=photos[i].image as HTMLImageElement;const x=64+i*480;c.fillStyle='#24393d';c.fillRect(x,232,450,330);const w=image.width,h=image.height,ratio=Math.min(450/w,330/h);c.drawImage(image,x+(450-w*ratio)/2,232+(330-h*ratio)/2,w*ratio,h*ratio);}
  c.fillStyle='#fff2d3';c.font='bold 47px sans-serif';c.fillText('HOODIES  •  HATS  •  CHARMS  •  MORE',64,627);
  c.fillStyle='#e1bd74';c.font='bold 46px sans-serif';c.fillText(travel?'NEXT TO LOTTOMIND / MACK AVENUE':'ENTER BELOW  ↓  BROWSE + TRY A BID',64,705);
  c.fillStyle='#b8d1d1';c.font='31px sans-serif';c.fillText('FREE PRACTICE BIDS  /  Real auctions are not open yet',64,790);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:texture});
 }
 const nearby=poster(),route=poster(true),frameMat=new T.MeshStandardMaterial({color:0x211e17,metalness:.5,roughness:.4});
 function board(parent:T.Object3D,u:number,y:number,v:number,width:number,rotation:number,material:T.Material){const root=new T.Group();root.name='Penny Exchange merchandise billboard';root.position.set(u,y,v);root.rotation.y=rotation;const backing=new T.Mesh(new T.BoxGeometry(width+.14,width*.5625+.14,.12),frameMat);root.add(backing);const face=new T.Mesh(new T.PlaneGeometry(width,width*.5625),material);face.position.z=.067;root.add(face);parent.add(root);return root;}
 board(building,0,6.0,9.62,6.2,0,nearby);board(building,0,6.0,-9.62,6.2,Math.PI,nearby);
 const p=studioMap(-20,26.7),local=toLocal(p.x,MACK_STUDIO.floor,p.z),sign=new T.Group();sign.position.set(local.x,local.y,local.z);sign.rotation.y=MACK_STUDIO.heading;scene.add(sign);board(sign,0,2.35,0,3.8,0,route);
 for(const u of [-1.5,1.5]){const pole=new T.Mesh(new T.BoxGeometry(.075,2.55,.075),frameMat);pole.position.set(u,1.275,0);pole.castShadow=true;sign.add(pole);const q=studioMap(-20+u,26.7);world.addBox({x:q.x,y:MACK_STUDIO.floor+1.275,z:q.z,hx:.06,hy:1.275,hz:.06,yaw:-MACK_STUDIO.heading,kind:'Penny Exchange wayfinding post'});}
 return {sign,update(x:number,z:number){sign.visible=Math.hypot(x-local.x,z-local.z)<220;},mapPosition:pennyMap(0,0),floor:PENNY_SHOP.floor};
}
