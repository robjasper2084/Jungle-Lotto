import * as T from 'three';
export const WARDROBE_CHOICES=[
 {id:'DS_Ghoulies_Rider',label:'Ghoulies · Cyborg green'},
 {id:'DS_Detroit_Rider',label:'Detroit · Skyline stitch'},
 {id:'DS_Neural_Rider',label:'Neural · Silver circuit'},
 {id:'DS_Vampire_Rider',label:'Vampire · Crimson camo'},
] as const;
export function baseRiderId(id:string){return WARDROBE_CHOICES.some(c=>c.id===id)?'DS_Armored_Rider_01':id;}
const themes:Record<string,{shell:string;cloth:string;trim:string;visor:string;metal:string;image:string;mobile:string}>={
 DS_Ghoulies_Rider:{shell:'#295b29',cloth:'#1b2920',trim:'#c7d126',visor:'#506324',metal:'#747b76',image:new URL('../art/hero-wardrobe/ghoulies-1024.webp',import.meta.url).href,mobile:new URL('../art/hero-wardrobe/ghoulies-512.webp',import.meta.url).href},
 DS_Detroit_Rider:{shell:'#132b4c',cloth:'#14191f',trim:'#a52329',visor:'#163950',metal:'#bd8c42',image:new URL('../art/hero-wardrobe/detroit-1024.webp',import.meta.url).href,mobile:new URL('../art/hero-wardrobe/detroit-512.webp',import.meta.url).href},
 DS_Neural_Rider:{shell:'#3c566b',cloth:'#0d1d32',trim:'#36bacc',visor:'#166d86',metal:'#b5c8cc',image:new URL('../art/hero-wardrobe/neural-1024.webp',import.meta.url).href,mobile:new URL('../art/hero-wardrobe/neural-512.webp',import.meta.url).href},
 DS_Vampire_Rider:{shell:'#39422b',cloth:'#201a20',trim:'#aa1226',visor:'#6e1027',metal:'#695a51',image:new URL('../art/hero-wardrobe/vampire-1024.webp',import.meta.url).href,mobile:new URL('../art/hero-wardrobe/vampire-512.webp',import.meta.url).href},
};
const maps=new Map<string,Promise<T.Texture>>();
// A tiny shared weave map adds textile relief without another network request.
const weaveBytes=new Uint8Array(64*64*4);
for(let y=0;y<64;y++)for(let x=0;x<64;x++){const n=(y*64+x)*4,v=120+((x%4<2)===(y%4<2)?22:-22);weaveBytes[n]=weaveBytes[n+1]=weaveBytes[n+2]=v;weaveBytes[n+3]=255;}
const weave=new T.DataTexture(weaveBytes,64,64);weave.wrapS=weave.wrapT=T.RepeatWrapping;weave.repeat.set(24,24);weave.magFilter=T.LinearFilter;weave.needsUpdate=true;
function texture(url:string){let pending=maps.get(url);if(!pending){pending=new T.TextureLoader().loadAsync(url).then(t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=2;return t;});maps.set(url,pending);}return pending;}
/** Stable outfit IDs travel through the existing player/AI roster protocol. */
export class RiderWardrobe{
 private materials:T.Material[]=[];private patches:T.Mesh[]=[];private geometry:T.BufferGeometry[]=[];private disposed=false;
 constructor(rider:T.Object3D,id:string){
  const theme=themes[id];if(!theme)return;
  const copies=new Map<T.Material,T.Material>();let badge:T.MeshStandardMaterial|undefined;
  rider.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;
   const style=(source:T.Material)=>{
    if(!(source as T.MeshStandardMaterial).isMeshStandardMaterial)return source;
    if(copies.has(source))return copies.get(source)!;
    const m=(source as T.MeshStandardMaterial).clone(),name=source.name;
    if(/protective shell/.test(name))m.color.set(theme.shell);
    else if(/garments|nylon/.test(name)){m.color.set(theme.cloth);m.bumpMap=weave;m.bumpScale=.0007;m.roughness=.88;}
    else if(/safety trim/.test(name))m.color.set(theme.trim);
    else if(/visor/.test(name))m.color.set(theme.visor);
    else if(/titanium|fasteners/.test(name))m.color.set(theme.metal);
    else if(/Back plate/.test(name)){badge=m;m.color.set('#ffffff');m.metalness=.05;m.roughness=.82;}
    copies.set(source,m);this.materials.push(m);return m;
   };mesh.material=Array.isArray(mesh.material)?mesh.material.map(style):style(mesh.material);
   // Theme-specific plate finishes follow the existing fitted armor geometry.
   // Shared source vertices/materials remain untouched for other riders.
   const material=mesh.material as T.MeshStandardMaterial;
   if(!Array.isArray(mesh.material)&&/protective shell/.test(material.name)){
    const g=mesh.geometry.clone(),p=g.attributes.position,colors=new Float32Array(p.count*3),color=new T.Color(),base=new T.Color(theme.shell);
    for(let i=0;i<p.count;i++){
     const x=p.getX(i),y=p.getY(i),z=p.getZ(i);color.copy(base);
     if(id==='DS_Ghoulies_Rider'&&x<0)color.set('#535b5d');
     if(id==='DS_Neural_Rider')color.set(Math.abs(x)>.09?'#aabdc6':'#405b72');
     if(id==='DS_Vampire_Rider'){
      const noise=Math.sin(x*67+Math.sin(y*43))*Math.cos(z*71-y*19);
      color.set(noise>.35?'#64704a':noise<-.25?'#202c24':'#444d30');
     }
     color.toArray(colors,i*3);
    }
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));mesh.geometry=g;this.geometry.push(g);material.color.set('#ffffff');material.vertexColors=true;
   }
  });
  const print=new T.MeshStandardMaterial({name:id+' / helmet artwork',transparent:true,opacity:0,roughness:.82,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});this.materials.push(print);
  for(const [center,halfU,halfV]of [[0,.60,.45],[1.15,.26,.30],[-1.15,.26,.30]]){
   const g=new T.PlaneGeometry(1,1,12,10),p=g.attributes.position,uv=g.attributes.uv;
   for(let i=0;i<p.count;i++){const u=center-(uv.getX(i)-.5)*2*halfU,v=.08+(uv.getY(i)-.5)*2*halfV;p.setXYZ(i,.147*Math.sin(u)*Math.cos(v),1.705+.161*Math.sin(v),-.018-.154*Math.cos(u)*Math.cos(v));}
   g.computeVertexNormals();const patch=new T.Mesh(g,print);patch.name=id+' curved helmet badge';patch.visible=true;rider.add(patch);rider.updateWorldMatrix(true,true);(rider.getObjectByName('Head')??rider).attach(patch);this.patches.push(patch);
  }
  if(id==='DS_Ghoulies_Rider'||id==='DS_Vampire_Rider'){
   const enamel=new T.MeshStandardMaterial({name:id+' / fang enamel',color:'#e4e6c7',roughness:.42,metalness:.08,side:T.DoubleSide});this.materials.push(enamel);
   for(const side of [-1,1]){
    const x=side*.034,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x-.009,1.659,.134,x+.009,1.659,.134,x,1.634,.143],3));g.computeVertexNormals();
    const fang=new T.Mesh(g,enamel);fang.name=id+' chin-guard fang';rider.add(fang);rider.updateWorldMatrix(true,true);(rider.getObjectByName('Head')??rider).attach(fang);this.patches.push(fang);
   }
  }
  rider.userData.wardrobe=id;
  if(typeof document!=='undefined')void texture(matchMedia("(pointer:coarse)").matches||new URLSearchParams(location.search).get("safe")==="1"?theme.mobile:theme.image).then(map=>{if(this.disposed)return;print.map=map;print.opacity=1;print.transparent=false;print.needsUpdate=true;for(const p of this.patches)p.visible=true;if(badge){badge.map=map;badge.needsUpdate=true;}}).catch(()=>{rider.userData.wardrobeArtwork='unavailable';});
 }
 dispose(){this.disposed=true;for(const p of this.patches){p.removeFromParent();p.geometry.dispose();}for(const g of this.geometry)g.dispose();for(const m of this.materials)m.dispose();this.materials=[];this.patches=[];}
}
