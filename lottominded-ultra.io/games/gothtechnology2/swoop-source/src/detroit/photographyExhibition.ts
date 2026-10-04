import * as T from 'three';
import {SUPPLIED_PHOTOGRAPHY} from './suppliedPhotography.ts';
let textures:Promise<T.Texture[]>|undefined;
const originals=()=>textures??=Promise.all(SUPPLIED_PHOTOGRAPHY.map(async photo=>{
 const map=await new T.TextureLoader().loadAsync(photo.url);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
}));
export function fitPhotograph(width:number,height:number,maxWidth:number,maxHeight:number){
 const scale=Math.min(maxWidth/width,maxHeight/height);return {width:width*scale,height:height*scale};
}
/** Only blank wall spaces; existing frames and floor collision stay untouched. */
export function photographyPlaces(room:'serengeti'|'penny'){
 return SUPPLIED_PHOTOGRAPHY.map((_photo,i)=>{
  if(room==='serengeti'){const side=i<8?-1:1,index=i%8;return {x:side*8.76,y:1.85+Math.floor(index/4)*1.4,z:[-4.2,-1.4,1.4,4.2][index%4],yaw:side<0?Math.PI/2:-Math.PI/2,maxWidth:2.18,maxHeight:1.08};}
  // Merch posters at z=-6,-2,2,6, y=2.55 remain in their original positions.
  const side=i<8?-1:1,index=i%8,upper=index>=5;
  return {x:side*3.75,y:upper?3.81:2.45,z:upper?[-6,-2,2][index-5]:[-8,-4,0,4,8][index],yaw:side<0?Math.PI/2:-Math.PI/2,maxWidth:upper?1.6:1.65,maxHeight:upper?.52:1.12};
 });
}
export async function addPhotographyExhibition(building:T.Object3D,room:'serengeti'|'penny'){
 const maps=await originals(),exhibition=new T.Group();exhibition.name='Eyefilmlife original photography / '+room;
 const brass=new T.MeshStandardMaterial({color:0xbba26b,metalness:.62,roughness:.4}),mat=new T.MeshStandardMaterial({color:0x171d1d,roughness:.9}),places=photographyPlaces(room);
 SUPPLIED_PHOTOGRAPHY.forEach((photo,i)=>{
  const place=places[i],size=fitPhotograph(photo.width,photo.height,place.maxWidth,place.maxHeight),frame=new T.Group();frame.name=photo.title+' / eyefilmlife';frame.userData.photograph=photo.id;frame.position.set(place.x,place.y,place.z);frame.rotation.y=place.yaw;
  const backing=new T.Mesh(new T.BoxGeometry(size.width+.11,size.height+.11,.035),mat);backing.position.z=-.02;frame.add(backing);
  const face=new T.Mesh(new T.PlaneGeometry(size.width,size.height),new T.MeshBasicMaterial({map:maps[i]}));face.name='Original photograph / full composition';face.position.z=.01;frame.add(face);
  for(const sign of [-1,1]){const upright=new T.Mesh(new T.BoxGeometry(.025,size.height+.05,.045),brass);upright.position.set(sign*(size.width+.025)/2,0,0);frame.add(upright);const bar=new T.Mesh(new T.BoxGeometry(size.width+.05,.025,.045),brass);bar.position.set(0,sign*(size.height+.025)/2,0);frame.add(bar);}
  exhibition.add(frame);
 });building.add(exhibition);return exhibition;
}
/** Display collection; actual auction prices and lots remain server-owned. */
export function photographyCollection(){
 const section=document.createElement('section');section.className='penny-photography';section.setAttribute('aria-label','Eyefilmlife photography collection');
 const heading=document.createElement('h2');heading.textContent='Eyefilmlife · Detroit, family & companions';
 const intro=document.createElement('p');intro.textContent='Original photography from the Serengeti collection. Explore the photographs hanging in Penny Exchange.';
 const grid=document.createElement('div');grid.className='penny-photo-grid';
 for(const photo of SUPPLIED_PHOTOGRAPHY){const card=document.createElement('a');card.className='penny-photo';card.href=photo.url;card.target='_blank';card.rel='noopener noreferrer';card.setAttribute('aria-label','View '+photo.title+' photograph');const img=document.createElement('img');img.src=photo.url;img.alt=photo.title+' · eyefilmlife';img.width=photo.width;img.height=photo.height;img.loading='lazy';const title=document.createElement('strong');title.textContent=photo.title;const credit=document.createElement('span');credit.textContent='eyefilmlife · View photograph ↗';card.append(img,title,credit);grid.append(card);}
 section.append(heading,intro,grid);return section;
}
