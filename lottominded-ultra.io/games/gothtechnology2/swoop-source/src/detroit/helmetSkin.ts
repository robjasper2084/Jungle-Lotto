import * as T from 'three';
import './helmetSkin.css';
const decalUrl=new URL('../../art/helmet-ghoulies-20261004/ghoulies-decal.webp',import.meta.url).href;
const key='digital-static-helmet-skin-v1',event='digital-static-helmet-skin';
export type HelmetSkin='ghoulies'|'plain';
function selected():HelmetSkin{try{return localStorage.getItem(key)==='plain'?'plain':'ghoulies';}catch{return 'ghoulies';}}
let texture:Promise<T.Texture>|undefined;
function map(){return texture??=new T.TextureLoader().loadAsync(decalUrl).then(t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;});}
/** Fits the authored Night Sentinel shell and follows its head bone. */
export class HelmetSkinDecal{
 readonly root=new T.Group();private material=new T.MeshStandardMaterial({transparent:true,alphaTest:.25,roughness:.72,metalness:0,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});private disposed=false;
 private update=()=>{this.root.visible=selected()==='ghoulies';};
 constructor(rider:T.Object3D){
  this.root.name='GothTech Ghoulies / helmet skin';rider.add(this.root);
  // Helmet center and radii come from build_armored_rider.py, converted to Y-up.
  for(const [center,halfU,halfV]of [[0,.67,.65],[Math.PI/2,.42,.42],[-Math.PI/2,.42,.42]]){
   const g=new T.PlaneGeometry(1,1,20,16),p=g.getAttribute('position'),uv=g.getAttribute('uv');
   for(let i=0;i<p.count;i++){const u=center-(uv.getX(i)-.5)*2*halfU,v=(uv.getY(i)-.5)*2*halfV;p.setXYZ(i,.1445*Math.sin(u)*Math.cos(v),1.705+.159*Math.sin(v),-.018-.152*Math.cos(u)*Math.cos(v));}g.computeVertexNormals();
   const face=new T.Mesh(g,this.material);face.name='Ghoulies curved helmet decal';this.root.add(face);
  }
  rider.updateWorldMatrix(true,true);(rider.getObjectByName('Head')??rider).attach(this.root);this.update();
  if(typeof window!=='undefined'){window.addEventListener(event,this.update);
   void map().then(t=>{if(!this.disposed){this.material.map=t;this.material.needsUpdate=true;}}).catch(()=>{this.root.visible=false;});}
 }
 dispose(){this.disposed=true;if(typeof window!=='undefined')window.removeEventListener(event,this.update);this.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.material.dispose();this.root.removeFromParent();}
}
export function makeHelmetSkinPicker(){
 const root=document.createElement('section');root.className='helmet-skin-picker';root.setAttribute('aria-label','Hero helmet skin');
 root.innerHTML='<h3>Hero helmet</h3><p>Pick a skin for the armored rider.</p><div role="group" aria-label="Helmet skins"></div><p role="status"></p>';
 const group=root.querySelector('div')!,status=root.querySelector<HTMLElement>('[role="status"]')!,buttons=new Map<HelmetSkin,HTMLButtonElement>();
 for(const [id,label]of [['ghoulies','GothTech Ghoulies'],['plain','Plain black']] as const){
  const b=document.createElement('button');b.type='button';const text=document.createElement('strong');text.textContent=label;
  if(id==='ghoulies'){const img=document.createElement('img');img.src=decalUrl;img.alt='';img.width=48;img.height=48;b.append(img);}b.append(text);
  b.onclick=()=>{try{localStorage.setItem(key,id);}catch{}window.dispatchEvent(new Event(event));};buttons.set(id,b);group.append(b);
 }
 const update=()=>{const skin=selected();for(const [id,b]of buttons)b.setAttribute('aria-pressed',String(id===skin));status.textContent=skin==='ghoulies'?'Ghoulies skin selected.':'Plain black helmet selected.';};window.addEventListener(event,update);update();return root;
}
