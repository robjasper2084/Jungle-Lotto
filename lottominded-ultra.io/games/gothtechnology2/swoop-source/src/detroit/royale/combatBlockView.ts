import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CombatBlockTerrain,COMBAT_BLOCK_BOXES} from '../../../../ride-core/src/royale/combatBlock.ts';

/** Original deterministic surfaces; UVs below are measured in metres. */
function surface(kind:'brick'|'asphalt'|'concrete'){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d')!;
 let seed=71;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 g.fillStyle=kind==='brick'?'#524940':kind==='asphalt'?'#53595a':'#92938b';g.fillRect(0,0,512,512);
 if(kind==='brick')for(let row=0;row<16;row++)for(let col=-1;col<9;col++){
  const v=Math.floor(88+random()*38);g.fillStyle=`rgb(${v+18},${v-13},${v-26})`;g.fillRect(col*64+(row%2)*32+1.5,row*32+1.5,61,29);
  g.fillStyle='#d1ad8533';g.fillRect(col*64+(row%2)*32+2,row*32+2,60,1);
 }
 for(let i=0;i<38000;i++){const light=random()>.5;g.fillStyle=light?'#ffffff0b':'#00000010';g.fillRect(random()*512,random()*512,1+random()*3,1+random()*2);}
 if(kind==='asphalt'){
  g.strokeStyle='#151e2450';g.lineWidth=1.2;
  for(let i=0;i<6;i++){let x=random()*512,y=random()*512;g.beginPath();g.moveTo(x,y);for(let j=0;j<9;j++){x+=random()*30-10;y+=random()*26;g.lineTo(x,y);}g.stroke();}
 }
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;
}
function boxGeometry(w:number,h:number,d:number){
 const g=new T.BoxGeometry(w,h,d),uv=g.getAttribute('uv'),position=g.getAttribute('position'),normal=g.getAttribute('normal');
 for(let i=0;i<uv.count;i++){
  const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i));
  uv.setXY(i,(nx>.5?position.getZ(i):position.getX(i))/2,(ny>.5?position.getZ(i):position.getY(i))/2);
 }
 return g;
}
export class CombatBlockView {
 readonly root=new T.Group();private notice=document.createElement('aside');
 constructor(scene:T.Scene,readonly terrain:CombatBlockTerrain){
  this.root.name='Detroit combat training block';scene.add(this.root);
  const brick=surface('brick'),concrete=surface('concrete'),asphalt=surface('asphalt');
  const relief=(t:T.Texture)=>{const r=t.clone();r.colorSpace=T.NoColorSpace;r.needsUpdate=true;return r;};
  const mats={
   brick:new T.MeshStandardMaterial({color:'#dbc5ac',map:brick,bumpMap:relief(brick),bumpScale:.022,roughness:.91}),
   roof:new T.MeshStandardMaterial({color:'#334449',roughness:.64,metalness:.35}),
   concrete:new T.MeshStandardMaterial({color:'#b1ad9d',map:concrete,bumpMap:relief(concrete),bumpScale:.015,roughness:.91}),
   car:new T.MeshStandardMaterial({color:'#416573',metalness:.65,roughness:.29}),
  };
  const dark=new T.MeshStandardMaterial({color:'#1b282d',roughness:.74}),trim=new T.MeshStandardMaterial({color:'#9d9987',roughness:.69,metalness:.18}),
   glass=new T.MeshStandardMaterial({color:'#244148',metalness:.72,roughness:.22}),chrome=new T.MeshStandardMaterial({color:'#adbdc1',metalness:.9,roughness:.26}),
   rubber=new T.MeshStandardMaterial({color:'#141b1e',roughness:.96}),paint=new T.MeshStandardMaterial({color:'#bcae77',roughness:.9}),
   amber=new T.MeshStandardMaterial({color:'#ffe2a7',emissive:'#ffbd68',emissiveIntensity:1.25}),
   mint=new T.MeshStandardMaterial({color:'#a1e7d9',emissive:'#48b6a4',emissiveIntensity:.65}),red=new T.MeshStandardMaterial({color:'#742b21',emissive:'#be4129',emissiveIntensity:.4});
  // Merge static details by material: hundreds of facade pieces cost only a few draws.
  const batches=new Map<T.Material,T.BufferGeometry[]>();
  const add=(g:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,rotation?:T.Euler)=>{
   if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}
   if(rotation)g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(rotation));g.translate(x,y,z);
   const list=batches.get(mat)??[];list.push(g);batches.set(mat,list);
  };
  const mesh=(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material,rounded=false)=>add(rounded?new RoundedBoxGeometry(w,h,d,2,Math.min(.1,w*.15,h*.15,d*.15)):boxGeometry(w,h,d),mat,x,y,z);
  const cylinder=(r:number,h:number,x:number,y:number,z:number,mat:T.Material,rotation?:T.Euler)=>add(new T.CylinderGeometry(r,r,h,12),mat,x,y,z,rotation);
  mesh(58,.2,76,0,-.1,0,new T.MeshStandardMaterial({color:'#999fa2',map:asphalt,bumpMap:relief(asphalt),bumpScale:.018,roughness:.82,metalness:.04}));
  for(const b of COMBAT_BLOCK_BOXES)mesh(b.w,b.h,b.d,b.x,b.y,b.z,mats[b.kind],b.kind==='car');
  // Road markings, gutter channels and drains stay flush with the playable floor.
  for(let z=-34;z<36;z+=6)mesh(.105,.008,2.5,0,.012,z,paint);
  for(const x of [-26.9,26.9]){
   mesh(.38,.01,74,x,.013,0,mats.concrete);
   for(let z=-30;z<35;z+=12){mesh(.5,.02,.85,x,.025,z,dark);for(let i=0;i<6;i++)mesh(.47,.023,.025,x,.029,z-.33+i*.13,trim);}
  }
  for(const x of [-23,23])for(let z=-31;z<35;z+=7){mesh(3.8,.008,.09,x,.016,z,paint);}
  // Concrete has expansion joints, a weathered base and a capped edge.
  for(const b of COMBAT_BLOCK_BOXES.filter(b=>b.kind==='concrete')){
   mesh(b.w+.035,.13,b.d+.035,b.x,b.y+b.h/2-.065,b.z,trim);
   if(b.h===4){
    mesh(b.w+.018,.42,b.d+.018,b.x,.21,b.z,dark);
    if(b.w>b.d)for(let x=-26;x<=26;x+=4)mesh(.035,3.55,.51,x,2.2,b.z,dark);
    else for(let z=-34;z<=34;z+=4)mesh(.51,3.55,.035,b.x,2.2,z,dark);
   }else{
    // Inset safety stripe is decorative; cover silhouette and collision stay exact.
    mesh(b.w,.09,b.d+.025,b.x,.95,b.z,paint);
    for(const s of [-1,1])mesh(.12,.08,.07,b.x+s*(b.w/2-.16),.67,b.z-b.d/2-.016,mint);
   }
  }
  const sign=(text:string,x:number,y:number,z:number,width:number,height:number,color='#a1e7d9',face=Math.PI)=>{
   const c=document.createElement('canvas');c.width=1024;c.height=128;const g=c.getContext('2d')!;
   g.fillStyle='#16292e';g.fillRect(0,0,1024,128);g.fillStyle=color;g.fillRect(24,19,5,90);g.fillRect(995,19,5,90);g.font='700 64px sans-serif';g.textAlign='center';g.fillText(text,512,87);
   const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
   const m=new T.MeshStandardMaterial({map:t,roughness:.6,emissive:'#829a8a',emissiveMap:t,emissiveIntensity:.5});
   add(new T.PlaneGeometry(width,height),m,x,y,z,new T.Euler(0,face,0));
  };
  for(const [x,z,name,index]of [[-12,1,'STATIC SUPPLY',0],[12,13,'DETROIT GARAGE',1]] as const){
   // Stone plinths and cornices follow the existing wall boxes; doors stay open.
   for(const side of [-1,1]){
    mesh(.45,.32,14.25,x+side*6,.16,z,dark);mesh(.48,.16,14.5,x+side*6,3.29,z,trim);
    mesh(.11,3.25,.13,x+side*6.23,1.65,z+5.8,mats.roof);
    // Match the physical open side window. No glass or security bars cover it.
    for(const edge of [-1,1])mesh(.45,2.4,.08,x+side*6,1.95,z+edge*1.15,trim);
    mesh(.5,.06,2.3,x+side*6,.75,z,trim);mesh(.5,.06,2.3,x+side*6,3.16,z,trim);
    sign('VAULT',x+side*6.19,.42,z,1.5,.25,'#a1e7d9',side*Math.PI/2);
    for(const edge of [-7,7]){
     mesh(4.5,.32,.45,x+side*3.75,.16,z+edge,dark);
     mesh(.15,2.5,.45,x+side*1.47,1.25,z+edge,mats.roof);
     mesh(4.0,.1,.49,x+side*3.8,.66,z+edge,trim);
     // Recessed dark shop windows, mullions and steel security bars.
     mesh(3.45,1.45,.385,x+side*3.8,1.53,z+edge,glass);
     for(const dx of [-1.78,0,1.78])mesh(.065,1.59,.45,x+side*3.8+dx,1.53,z+edge,mats.roof);
     for(const y of [.77,2.3])mesh(3.62,.065,.45,x+side*3.8,y,z+edge,trim);
     for(let dx=-1.4;dx<1.5;dx+=.35)mesh(.025,1.39,.48,x+side*3.8+dx,1.53,z+edge,dark);
    }
   }
   for(const edge of [-7,7]){
    mesh(12.6,.15,.6,x,3.4,z+edge,trim);mesh(12.7,.08,.65,x,3.53,z+edge,mats.roof);
    mesh(2.8,.04,.28,x,2.47,z+edge,amber);
    sign(name,x,2.96,z+edge+(edge<0?-.195:.195),8,.74,index?'#e4c595':'#a1e7d9',edge<0?Math.PI:0);
   }
   // Interior floor joints and beams create readable indoor depth without added obstacles.
   mesh(11.8,.012,13.8,x,.014,z,mats.concrete);
   for(let dz=-6;dz<7;dz+=2)mesh(11.65,.009,.018,x,.027,z+dz,dark);
   for(const dx of [-4,-2,0,2,4])mesh(.018,.009,13.7,x+dx,.027,z,dark);
   for(const dz of [-4,0,4]){mesh(11.7,.14,.16,x,3.33,z+dz,mats.roof);mesh(2,.045,.15,x,3.22,z+dz,amber);}
   // Roof machinery is beyond the original solid roof, not in the walking lanes.
   mesh(2.4,.6,1.5,x+3,3.99,z+3,mats.roof,true);
   for(let dz=-.5;dz<=.5;dz+=.2)mesh(2.2,.04,.055,x+3,4.31,z+3+dz,dark);
   cylinder(.13,1.1,x-3,4.18,z-3,chrome);cylinder(.24,.13,x-3,4.75,z-3,mats.roof);
   const lamp=new T.PointLight('#ffd39a',18,11,2);lamp.position.set(x,2.8,z);this.root.add(lamp);
  }
  for(const b of COMBAT_BLOCK_BOXES.filter(b=>b.kind==='car'&&b.h===.8)){
   for(const side of [-1,1]){
    mesh(1.55,.42,.025,b.x,1.3,b.z+side*1.087,glass);
    mesh(.026,.42,1.78,b.x+side*.936,1.3,b.z,glass);
    mesh(.038,.45,.08,b.x+side*.96,1.28,b.z,mats.roof);
    mesh(.07,.075,.29,b.x+side*1.06,1.02,b.z+.3,chrome,true);
    mesh(1.95,.13,.14,b.x,.44,b.z+side*2.32,chrome,true);
    mesh(1.06,.21,.04,b.x,.64,b.z+side*2.318,dark);
    for(const x of [-.72,.72])mesh(.34,.15,.03,b.x+x,.8,b.z+side*2.31,side===-1?amber:red);
    for(const dz of [-1.45,1.45]){
     cylinder(.38,.22,b.x+side,.38,b.z+dz,rubber,new T.Euler(0,0,Math.PI/2));
     cylinder(.235,.235,b.x+side,.38,b.z+dz,chrome,new T.Euler(0,0,Math.PI/2));
     cylinder(.075,.25,b.x+side,.38,b.z+dz,dark,new T.Euler(0,0,Math.PI/2));
    }
    // Panel gaps and a lower rocker rail stop the cars reading as single boxes.
    mesh(.022,.53,.018,b.x+side*1.058,.79,b.z,dark);mesh(.026,.06,3.3,b.x+side*1.058,.43,b.z,dark);
   }
   mesh(1.5,.014,1.1,b.x,1.058,b.z-1.65,mats.car);
  }
  for(const x of [-25,25])for(const z of [-27,0,27]){
   cylinder(.072,5,x,2.5,z,mats.roof);cylinder(.14,.25,x,.125,z,trim);
   mesh(1.5,.1,.14,x+(x<0?.7:-.7),5,z,mats.roof);mesh(.5,.08,.25,x+(x<0?1.2:-1.2),4.9,z,amber);
  }
  // Distant architectural silhouettes are outside the closed training perimeter.
  const skyline=new T.MeshStandardMaterial({color:'#384f59',roughness:.92});
  for(let i=0;i<15;i++){
   const x=-72+i*10,z=57+(i%3)*9,h=7+(i*7%19),w=6+(i%3)*2;
   mesh(w,h,9,x,h/2,z,skyline);mesh(w+.3,.3,9.3,x,h,z,mats.roof);
   for(let y=2;y<h-1;y+=2.7)for(let dx=-w/2+1;dx<w/2;dx+=2){
    mesh(.68,1.05,.035,x+dx,y,z-4.52,(i+Math.floor(y)+Math.floor(dx))%4===0?amber:glass);
   }
  }
  // Soft contact decals keep objects grounded even on the shadows-off phone preset.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sg=shadowCanvas.getContext('2d')!;
  const gradient=sg.createRadialGradient(64,64,12,64,64,64);gradient.addColorStop(0,'#000000a0');gradient.addColorStop(.5,'#00000065');gradient.addColorStop(1,'#00000000');sg.fillStyle=gradient;sg.fillRect(0,0,128,128);
  const shadow=new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  for(const b of COMBAT_BLOCK_BOXES.filter(b=>b.kind==='car'&&b.h===.8||b.kind==='concrete'&&b.h<2))add(new T.PlaneGeometry(b.w+1.4,b.d+1.8),shadow,b.x,.025,b.z,new T.Euler(-Math.PI/2,0,0));
  for(const [mat,list]of batches){
   const geometry=mergeGeometries(list,false)!;list.forEach(g=>g.dispose());const object=new T.Mesh(geometry,mat);
   object.castShadow=!mat.transparent;object.receiveShadow=!mat.transparent;this.root.add(object);
  }
  this.root.userData.graphics={version:'detroit-materials-2',staticBatches:batches.size,contactShadows:true};
  this.notice.className='combat-block-note';this.notice.textContent='COMBAT BLOCK · Y: vault low cover / open side windows · L: roll · M: smoke';Object.assign(this.notice.style,{position:'fixed',bottom:'12px',left:'50%',transform:'translateX(-50%)',padding:'6px 12px',background:'#10272ce0',color:'#c8eee6',borderRadius:'6px',font:'11px system-ui',pointerEvents:'none',zIndex:'5',maxWidth:'70vw'});document.body.append(this.notice);
 }
 dispose(){
  this.notice.remove();this.root.removeFromParent();const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>(),textures=new Set<T.Texture>();
  this.root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  for(const m of materials){for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);m.dispose();}
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());this.terrain.dispose();
 }
}
