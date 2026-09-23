import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {wind,type TreeSite} from './trees.ts';

export const ELM_TREE_SPECIES=['white-oak','red-maple','american-elm','white-pine','weeping-willow'] as const;
export type ElmTreeSite=TreeSite&{species:number};
export function elmTreeSpecies(seed:number,nearWater:boolean){
  const choice=Math.abs(Math.sin(seed*127.1+17)*43758.5453)%1;
  return nearWater&&choice>.56?4:Math.floor(choice*4);
}
/** Shared photographic PBR maps; library geometry carries original UVs. */
export async function loadElmwoodLibrary(time:{value:number},compact=false){
  const loader=new T.TextureLoader(),materials=new Map<string,T.MeshStandardMaterial>();
  async function texture(url:string){
    const tex:T.Texture=await loader.loadAsync(url),image=tex.image as HTMLImageElement;tex.flipY=false;
    if(compact&&Math.max(image.width,image.height)>1024){const canvas=document.createElement('canvas'),ratio=1024/Math.max(image.width,image.height);canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);tex.source.data=canvas;tex.needsUpdate=true;}return tex;
  }
  await Promise.all(['grass','asphalt','limestone','slate','granite','soil','wood','oak-bark','bronze','weathered-stone'].map(async name=>{
    const [map,normalMap,orm]=await Promise.all(['Albedo','Normal','ORM'].map(k=>texture(`/textures/elmwood-library/${name}_${k}.png`)));
    map.colorSpace=T.SRGBColorSpace;
    for(const tex of [map,normalMap,orm]){tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;}
    const material=new T.MeshStandardMaterial({map,normalMap,roughnessMap:orm,metalnessMap:orm,roughness:1,metalness:name==='bronze'?1:0,normalScale:new T.Vector2(.45,.45),envMapIntensity:.5});
    if(name==='grass'){material.roughnessMap=null;material.roughness=.95;material.normalScale.set(.22,.22);}
    materials.set(name,material);
  }));
  await Promise.all(ELM_TREE_SPECIES.map(async name=>{
    const map=await texture(`/textures/elmwood-library/leaf-${name}_Albedo.png`);map.colorSpace=T.SRGBColorSpace;
    const material=new T.MeshStandardMaterial({map,side:T.DoubleSide,alphaTest:.42,roughness:.94,envMapIntensity:.5});wind(material,time);materials.set('leaf-'+name,material);
  }));
  materials.set('grass-blade',new T.MeshStandardMaterial({color:'#667c3d',roughness:1,side:T.DoubleSide}));
  materials.set('dry-leaf',new T.MeshStandardMaterial({color:'#6e5938',roughness:1,side:T.DoubleSide}));
  materials.set('glass',new T.MeshStandardMaterial({color:'#354947',roughness:.24,metalness:.1}));
  materials.set('iron',new T.MeshStandardMaterial({color:'#222b29',roughness:.65,metalness:.65}));
  const names=['elmwood-chapel','elmwood-gatehouse','flying-geese-baked','headstone-arched','headstone-weathered','headstone-cross','obelisk','ledger','urn','grass-tuft','fallen-leaf-patch','low-shrub',...ELM_TREE_SPECIES,...ELM_TREE_SPECIES.map(name=>name+'-far')];
  const models=new Map<string,T.Object3D>(),gltf=new GLTFLoader();
  await Promise.all(names.map(async name=>{
    const model=(await gltf.loadAsync(`/exports/elmwood/${name}.glb`)).scene;
    model.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;
      const original=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).name.toLowerCase().replace(/^reference /,'').replace(/\.\d+$/,'');
      const key=original.includes('grass blade')?'grass-blade':original.includes('fallen leaf')?'dry-leaf':original==='leaf'?'leaf-white-oak':original.includes('glaz')?'glass':original.includes('tracery')?'wood':original.includes('limestone')?'limestone':original.includes('slate')?'slate':original;
      mesh.material=materials.get(key)??materials.get('granite')!;mesh.castShadow=mesh.receiveShadow=true;
      if(key.startsWith('leaf-')){const mat=mesh.material as T.MeshStandardMaterial;const depth=new T.MeshDepthMaterial({map:mat.map,alphaTest:mat.alphaTest,side:T.DoubleSide,depthPacking:T.RGBADepthPacking});wind(depth,time);mesh.customDepthMaterial=depth;}
    });models.set(name,model);
  }));
  function place(name:string,parent:T.Object3D,x:number,y:number,z:number,maxWidth?:number,maxDepth?:number){
    const object=models.get(name)!.clone(true),bounds=new T.Box3().setFromObject(object),size=bounds.getSize(new T.Vector3());
    const scale=Math.min(maxWidth?maxWidth/size.x:1,maxDepth?maxDepth/size.z:1);
    object.scale.setScalar(scale);object.position.set(x-(bounds.min.x+size.x/2)*scale,y-bounds.min.y*scale,z-(bounds.min.z+size.z/2)*scale);parent.add(object);return object;
  }
  function trees(sites:ElmTreeSite[],compact:()=>boolean){
    const geometries=new Map<string,T.BufferGeometry>();
    const root=new T.Group(),batches:{near:T.Group;far:T.Group;x:number;z:number}[]=[];
    const tiles=new Map<string,ElmTreeSite[]>();for(const site of sites){const key=`${Math.floor(site.x/40)},${Math.floor(site.z/40)},${site.species}`;if(!tiles.has(key))tiles.set(key,[]);tiles.get(key)!.push(site);}
    for(const list of tiles.values()){
      const species=ELM_TREE_SPECIES[list[0].species],base=models.get(species)!,box=new T.Box3().setFromObject(base),height=box.max.y-box.min.y;
      const groups=[new T.Group(),new T.Group()];root.add(...groups);
      for(let lod=0;lod<2;lod++){
        const source=models.get(species+(lod?'-far':''))!;source.updateMatrixWorld(true);
        source.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;
          let geometry=geometries.get(mesh.uuid);if(!geometry){
            geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
            const p=geometry.attributes.position;
            for(let i=0;i<p.count;i++){
              const y=p.getY(i),x=p.getX(i),z=p.getZ(i);
              if(species==='white-pine'){const taper=.76-.32*Math.min(1,Math.max(0,(y-4)/height));p.setX(i,x*taper);p.setZ(i,z*taper);}
              if(species==='weeping-willow'&&y>5)p.setY(i,y-Math.hypot(x,z)*.18*Math.min(1,(y-5)/3));
            }geometry.computeVertexNormals();geometries.set(mesh.uuid,geometry);
          }
          const instanced=new T.InstancedMesh(geometry,mesh.material,list.length),dummy=new T.Object3D();
          list.forEach((s,i)=>{const scale=s.h/height;dummy.position.set(s.x,s.y-box.min.y*scale-.1,s.z);dummy.rotation.set(0,s.seed*2.399963,0);dummy.scale.set(scale*(.85+(s.seed%7)*.045),scale,scale);dummy.updateMatrix();instanced.setMatrixAt(i,dummy.matrix);const tint=.90+(s.seed%9)*.013;instanced.setColorAt(i,new T.Color(tint,tint,.97*tint));});
          instanced.castShadow=instanced.receiveShadow=true;instanced.customDepthMaterial=mesh.customDepthMaterial;instanced.computeBoundingSphere();groups[lod].add(instanced);
        });
      }
      batches.push({near:groups[0],far:groups[1],x:list.reduce((n,s)=>n+s.x,0)/list.length,z:list.reduce((n,s)=>n+s.z,0)/list.length});
    }
    return {root,update(x:number,z:number){const light=compact();let visible=0;for(const b of batches){const d=Math.hypot(x-b.x,z-b.z),detail=d<(light?35:85),shown=d<(light?150:300);b.near.visible=shown&&detail;b.far.visible=shown&&!detail;if(shown)visible++;for(const group of [b.near,b.far])group.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=!light&&detail;});}return visible;}};
  }

  return {materials,models,place,trees};
}


