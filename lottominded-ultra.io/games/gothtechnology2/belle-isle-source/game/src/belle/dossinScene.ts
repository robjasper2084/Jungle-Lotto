import * as T from 'three';
import {dossinLocal,type DossinLayout} from './dossin.ts';
import type {LocalLightPool} from './localLighting.ts';
/** Small original repeating material maps; no reference photography is shipped. */
function surface(kind:'blue'|'floor'|'wood'){
 const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d')!;
 x.fillStyle=kind==='blue'?'#3b5865':kind==='floor'?'#92958a':'#5d3e22';x.fillRect(0,0,512,512);
 let seed=91;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 if(kind==='blue')for(let row=0;row<10;row++)for(let col=0;col<4;col++){
  x.fillStyle=`hsl(204,36%,${32+rand()*7}%)`;x.fillRect(col*128+2,row*51.2+2,124,47.2);
 }else if(kind==='floor')for(let i=0;i<9000;i++){const n=rand();x.fillStyle=n>.7?'#b3b6aa':n>.35?'#858b83':'#727973';x.fillRect(rand()*512,rand()*512,1+rand()*2,1+rand()*2);}
 else for(let i=0;i<250;i++){x.strokeStyle=`rgba(29,14,6,${.04+rand()*.12})`;x.beginPath();const a=rand()*512;x.moveTo(a,0);x.bezierCurveTo(a+rand()*10,160,a-rand()*10,360,a,512);x.stroke();}
 const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
export function prepareDossinMaterials(root:T.Object3D){
 const blue=surface('blue'),floor=surface('floor'),wood=surface('wood');
 root.traverse(o=>{if(!(o instanceof T.Mesh)||!o.name.startsWith('107205459_'))return;
  for(const m of(Array.isArray(o.material)?o.material:[o.material]) as T.MeshStandardMaterial[]){
   if(m.name==='Dossin glazed blue tile v2'){m.map=blue;m.color.setRGB(1,1,1);m.roughness=.43;m.bumpMap=blue;m.bumpScale=.004;}
   if(m.name==='Dossin gallery terrazzo'){m.map=floor;m.color.setRGB(.8,.8,.8);m.roughness=.78;}
   if(m.name==='Dossin carved oak'){m.map=wood;m.color.setRGB(.85,.8,.7);}
   if(m.name==='Dossin clear exhibit glazing'){m.transparent=true;m.opacity=.11;m.depthWrite=false;m.side=T.DoubleSide;o.castShadow=false;}
   m.needsUpdate=true;
  }
 });
}
export function addDossinLighting(scene:T.Scene,c:DossinLayout,localLights:LocalLightPool){
 const group=new T.Group();group.name='Dossin interior lighting';group.position.set(c.center[0],2,c.center[1]);group.rotation.y=c.yaw;scene.add(group);
 const lighting=localLights.registerInterior([[-4,-12],[-1,8],[16,22]].map(([u,v])=>({position:[u,3.45,-v],color:0xffebce,intensity:9,distance:25,decay:1.5})),group);
 return{update(x:number,z:number){const p=dossinLocal(c,x,z);group.visible=p.u> -40&&p.u<36&&p.v> -35&&p.v<40;lighting.request(group.visible);}};
}
