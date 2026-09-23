import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {Solid} from './world.ts';
import {hash} from './world.ts';
import {DETROIT_LANDMARKS,SKYLINE_ID} from './architectureData.ts';

type BuildingMaterials=Record<'red'|'buff'|'store'|'brick'|'stone'|'steel'|'roof'|'glass'|'metal',T.MeshStandardMaterial>;
const boxGeo=new T.BoxGeometry(1,1,1),planeGeo=new T.PlaneGeometry(1,1);
function box(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material){const o=new T.Mesh(boxGeo,m);o.position.set(x,y,z);o.scale.set(w,h,d);g.add(o);return o;}
function facade(g:T.Group,y:number,z:number,w:number,h:number,m:T.Material,u:number,v:number){
  const geo=planeGeo.clone(),uv=geo.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*u,uv.getY(i)*v);
  const o=new T.Mesh(geo,m);o.position.set(0,y,z);o.scale.set(w,h,1);g.add(o);
}
/** Every former placeholder gets four street facades and a detailed roof. */
export function buildDetroitBlock(s:Solid,m:BuildingMaterials,index:number){
  const g=new T.Group();g.name='Detroit industrial block '+index;g.position.set(s.x,s.y-s.hy,s.z);
  const w=s.hx*2,d=s.hz*2,h=s.hy*2,skin=index%3===1?m.buff:m.red;
  const base=3.25,floors=Math.max(1,Math.round((h-base)/3.3)),floorHeight=(h-base)/floors;
  box(g,0,h/2,0,w,h,d,m.brick);box(g,0,.26,0,w+.24,.52,d+.24,m.stone);
  for(let face=0;face<4;face++){
    const along=face%2?d:w,half=face%2?w/2:d/2;
    const wall=new T.Group();wall.rotation.y=face*Math.PI/2;g.add(wall);
    const bays=Math.max(3,Math.round(along/3.8)),bay=along/bays;
    facade(wall,base+(h-base)/2,half+.012,along,h-base,skin,bays/4,floors/3);
    if(index%2===0&&face%2===0)facade(wall,base/2+.13,half+.016,along,base-.26,m.store,along/15,1);
    else for(let i=0;i<bays;i++){
      const x=-along/2+bay*(i+.5);box(wall,x,1.4,half+.018,bay*.74,2.8,.06,m.steel);
      if(i%3===1){box(wall,x,1.5,half+.06,bay*.62,2.4,.06,m.metal);for(let y=.4;y<2.8;y+=.22)box(wall,x,y,half+.105,bay*.62,.025,.025,m.steel);}
      else{box(wall,x,1.55,half+.065,bay*.64,2.25,.04,m.glass);box(wall,x,1.55,half+.105,.065,2.25,.045,m.steel);box(wall,x,2,half+.105,bay*.64,.06,.045,m.steel);}
      box(wall,x,3.04,half+.18,bay*.86,.18,.55,m.stone);
    }
    for(let floor=0;floor<floors;floor++)for(let i=0;i<bays;i++){
      const x=-along/2+bay*(i+.5),y=base+floorHeight*(floor+.5);
      box(wall,x,y-floorHeight*.39,half+.14,bay*.69,.14,.32,m.stone);
      box(wall,x,y+floorHeight*.39,half+.085,bay*.69,.16,.18,m.stone);
    }
    for(let i=0;i<=bays;i+=2)box(wall,-along/2+i*bay,h/2,half+.12,.3,h,.25,m.brick);
    for(const y of [base,h-.18,h+.24])box(wall,0,y,half+.16,along+.3,.16,.36,m.stone);
    box(wall,0,h+.12,half-.12,along,.5,.3,m.brick);
    box(wall,along/2-.45,h/2,half+.25,.085,h,.085,m.steel);
    box(wall,-along/2+.7,1.7,half+.23,.42,.6,.26,m.metal);
  }
  box(g,0,h-.08,0,w-.65,.12,d-.65,m.roof);
  for(let i=0;i<3;i++){
    const x=(hash(index*7+i)-.5)*(w-6),z=(hash(index*19+i)-.5)*(d-8);
    box(g,x,h+.55,z,2.7,1.1,1.8,m.metal);box(g,x,h+1.13,z,2.85,.12,1.95,m.steel);
    for(let j=0;j<5;j++)box(g,x,h+.2+j*.16,z+.92,2.3,.045,.04,m.steel);
    box(g,x+1.8,h+.28,z,1.1,.55,.65,m.metal);
  }
  box(g,w*.31,h+1.25,-d*.32,1.15,2.5,1.15,m.brick);box(g,w*.31,h+2.55,-d*.32,1.4,.15,1.4,m.stone);
  g.userData.facadeFloors=floors;return g;
}

export async function createArchitecture(scene:T.Scene,groupAt:(z:number)=>T.Group,solids:Solid[]){
  const loader=new T.TextureLoader();
  const textures=await Promise.all(['industrial_red','industrial_buff','storefront'].map(n=>loader.loadAsync('/textures/architecture/'+n+'.jpg')));
  textures.forEach(t=>{t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;});
  const masonry=await loader.loadAsync('/textures/cut/brick.jpg');masonry.colorSpace=T.SRGBColorSpace;masonry.wrapS=masonry.wrapT=T.RepeatWrapping;masonry.repeat.set(3,3);masonry.anisotropy=8;
  const m:BuildingMaterials={red:new T.MeshStandardMaterial({map:textures[0],color:'#bdb9b2',roughness:.84}),buff:new T.MeshStandardMaterial({map:textures[1],color:'#cecac0',roughness:.86}),store:new T.MeshStandardMaterial({map:textures[2],color:'#d0cdc5',roughness:.65}),brick:new T.MeshStandardMaterial({map:masonry,color:'#765445',roughness:.91}),stone:new T.MeshStandardMaterial({color:'#9c9586',roughness:.87}),steel:new T.MeshStandardMaterial({color:'#252d2d',metalness:.55,roughness:.4}),roof:new T.MeshStandardMaterial({color:'#343839',roughness:.92}),glass:new T.MeshStandardMaterial({color:'#263d47',metalness:.48,roughness:.19}),metal:new T.MeshStandardMaterial({color:'#7b8281',metalness:.55,roughness:.58})};
  let blockCount=0;for(const s of solids)if(s.kind==='warehouse')groupAt(s.z).add(buildDetroitBlock(s,m,blockCount++));
  const gltf=new GLTFLoader(),assets=await Promise.all([...DETROIT_LANDMARKS.map(l=>l.id),SKYLINE_ID].map(id=>gltf.loadAsync('/exports/architecture/'+id+'.glb')));
  DETROIT_LANDMARKS.forEach((l,i)=>{
    const model=assets[i].scene;model.name=l.name;model.position.set(l.x,l.base,l.z);model.rotation.y=l.rotation;
    model.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=true;const material=mesh.material as T.MeshStandardMaterial;if(material.name==='Detroit salvaged red brick')material.color.set('#9e7c65');if(material.name==='Painted charcoal brick')material.color.set('#5b6267');});
    groupAt(l.z).add(model);box(groupAt(l.z),l.x,l.base-.05,l.z,l.hx*2+7,.15,l.hz*2+7,m.stone);
  });
  const skyline=assets.at(-1)!.scene;skyline.name='Detroit Renaissance Center skyline';skyline.position.set(-650,0,75);scene.add(skyline);
  skyline.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;const material=mesh.material as T.MeshStandardMaterial;material.fog=false;material.color.lerp(new T.Color('#9daeb4'),.30);});
  return {blockCount,landmarks:DETROIT_LANDMARKS.length+1,skyline};
}
