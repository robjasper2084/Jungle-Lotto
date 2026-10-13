import * as T from 'three';
import {CombatBlockTerrain,COMBAT_BLOCK_BOXES} from '../../../../ride-core/src/royale/combatBlock.ts';
function surface(kind:'brick'|'asphalt'){
 const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d')!;
 let seed=71;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 g.fillStyle=kind==='brick'?'#343a39':'#3c4546';g.fillRect(0,0,512,256);
 if(kind==='brick')for(let row=0;row<8;row++)for(let col=-1;col<9;col++){const v=Math.floor(77+random()*28);g.fillStyle=`rgb(${v+30},${v+5},${v-7})`;g.fillRect(col*64+(row%2)*32+2,row*32+2,60,28);}
 else for(let i=0;i<22000;i++){const v=35+Math.floor(random()*36);g.fillStyle=`rgba(${v},${v+6},${v+8},.45)`;g.fillRect(random()*512,random()*256,1+random()*2,1+random()*2);}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(kind==='brick'?3:12,kind==='brick'?2:16);return t;
}
export class CombatBlockView {
 readonly root=new T.Group();private notice=document.createElement('aside');
 constructor(scene:T.Scene,readonly terrain:CombatBlockTerrain){
  this.root.name='Detroit combat training block';scene.add(this.root);
  const mats={brick:new T.MeshStandardMaterial({color:'#c8b6a4',map:surface('brick'),roughness:.92}),roof:new T.MeshStandardMaterial({color:'#2c363b',roughness:.8}),concrete:new T.MeshStandardMaterial({color:'#78817f',roughness:.95}),car:new T.MeshStandardMaterial({color:'#346679',metalness:.45,roughness:.38})};
  const mesh=(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;this.root.add(o);return o;};
  mesh(58,.2,76,0,-.1,0,new T.MeshStandardMaterial({color:'#b4bcc0',map:surface('asphalt'),roughness:.95}));
  const paint=new T.MeshStandardMaterial({color:'#d6c999',roughness:.8});for(let z=-34;z<36;z+=6)mesh(.13,.015,2.5,0,.01,z,paint);
  for(const b of COMBAT_BLOCK_BOXES)mesh(b.w,b.h,b.d,b.x,b.y,b.z,mats[b.kind]);
  const glass=new T.MeshStandardMaterial({color:'#112b35',metalness:.6,roughness:.14}),chrome=new T.MeshStandardMaterial({color:'#a5b5b6',metalness:.85,roughness:.25}),white=new T.MeshStandardMaterial({color:'#f5eaca',emissive:'#dac494',emissiveIntensity:.15}),red=new T.MeshStandardMaterial({color:'#813827',roughness:.5});
  for(const b of COMBAT_BLOCK_BOXES.filter(b=>b.kind==='car'&&b.h===.8)){
   for(const side of [-1,1]){mesh(1.55,.42,.025,b.x,1.3,b.z+side*1.087,glass);mesh(.026,.42,1.78,b.x+side*.936,1.3,b.z,glass);mesh(1.95,.13,.14,b.x,.44,b.z+side*2.32,chrome);for(const x of [-.72,.72])mesh(.34,.15,.03,b.x+x,.8,b.z+side*2.31,side===-1?white:red);}
  }
  for(const x of [-25,25])for(const z of [-27,0,27]){mesh(.10,5,.10,x,2.5,z,mats.roof);mesh(1.5,.12,.16,x+(x<0?.7:-.7),5,z,mats.roof);mesh(.45,.08,.23,x+(x<0?1.2:-1.2),4.9,z,white);}
  const wood=new T.MeshStandardMaterial({color:'#625345',roughness:.95});for(const [x,z,name]of [[-12,1,'STATIC SUPPLY'],[12,13,'DETROIT GARAGE']] as const){
   mesh(11.8,.02,13.8,x,.012,z,wood);
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#14292d';c.fillRect(0,0,768,128);c.fillStyle='#a5edda';c.font='bold 62px sans-serif';c.textAlign='center';c.fillText(name,384,88);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
   const sign=new T.Mesh(new T.PlaneGeometry(8,.9),new T.MeshStandardMaterial({map:texture,emissive:'#396055',emissiveIntensity:.2}));sign.position.set(x,2.95,z-7.19);sign.rotation.y=Math.PI;this.root.add(sign);
   const lamp=new T.PointLight('#f5d6ad',9,13,2);lamp.position.set(x,2.9,z);this.root.add(lamp);
  }
  const rubber=new T.MeshStandardMaterial({color:'#101617',roughness:.95});for(const b of COMBAT_BLOCK_BOXES.filter(b=>b.kind==='car'&&b.h===.8))for(const dx of [-1,1])for(const dz of [-1.45,1.45]){const tire=new T.Mesh(new T.CylinderGeometry(.38,.38,.22,12),rubber);tire.rotation.z=Math.PI/2;tire.position.set(b.x+dx,.38,b.z+dz);tire.castShadow=true;this.root.add(tire);}
  this.notice.className='combat-block-note';this.notice.textContent='COMBAT BLOCK · Local training · J: get off / on · R: reload';Object.assign(this.notice.style,{position:'fixed',bottom:'12px',left:'50%',transform:'translateX(-50%)',padding:'6px 12px',background:'#10272ce0',color:'#c8eee6',borderRadius:'6px',font:'11px system-ui',pointerEvents:'none',zIndex:'5',maxWidth:'70vw'});document.body.append(this.notice);
 }
 dispose(){this.notice.remove();this.root.removeFromParent();const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();this.root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials){(m as T.MeshStandardMaterial).map?.dispose();m.dispose();}this.terrain.dispose();}
}
