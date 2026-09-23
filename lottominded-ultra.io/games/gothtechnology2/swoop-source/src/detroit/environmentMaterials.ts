import * as T from 'three';

/** Original Higgsfield albedo; normal/roughness are image-derived, not measured scans. */
export async function loadEnvironmentMaterials(){
  const loader=new T.TextureLoader();
  const materials:Record<string,T.MeshStandardMaterial>={};
  await Promise.all(['asphalt','sidewalk','bark','grass','concrete'].map(async name=>{
    const directory=name==='bark'?'/textures/trees/':'/textures/realistic/';
    const [map,normalMap,roughnessMap]=await Promise.all(['.jpg','_normal.jpg','_roughness.jpg'].map(s=>loader.loadAsync(directory+name+s)));
    map.colorSpace=T.SRGBColorSpace;
    for(const t of [map,normalMap,roughnessMap]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;}
    const strength=name==='bark'?.8:name==='grass'?.4:.32;
    materials[name]=new T.MeshStandardMaterial({map,normalMap,roughnessMap,normalScale:new T.Vector2(strength,strength),roughness:1,envMapIntensity:.35});
    materials[name].name='Higgsfield '+name;
  }));
  materials.asphalt.color.set('#777c80');materials.bark.color.set('#bcb6a9');
  materials.sidewalk.color.set('#c4c1b8');materials.concrete.color.set('#b5b5af');
  await Promise.all(['elm','maple'].map(async species=>{
    const map=await loader.loadAsync('/textures/trees/'+species+'.png');map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
    materials[species]=new T.MeshStandardMaterial({map,alphaTest:.38,alphaToCoverage:true,side:T.DoubleSide,roughness:.92,envMapIntensity:.4,color:species==='elm'?'#abc583':'#b4c790'});
    materials[species].name='Higgsfield '+species+' foliage 20260915';
  }));
  return materials;
}

/** World-scale UVs for structural surfaces. Upward faces use XZ. */
export function surfaceUV(geo:T.BufferGeometry,metres=3){
  const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=new Float32Array(p.count*2);
  geo.computeBoundingBox();const base=geo.boundingBox!.min,ox=Math.floor(base.x/metres),oy=Math.floor(base.y/metres),oz=Math.floor(base.z/metres);
  for(let i=0;i<p.count;i++){
    const horizontal=Math.abs(n.getY(i))>.7;
    const zFace=!horizontal&&Math.abs(n.getX(i))>.7;
    uv[i*2]=(zFace?p.getZ(i):p.getX(i))/metres-(zFace?oz:ox);
    uv[i*2+1]=(horizontal?p.getZ(i):p.getY(i))/metres-(horizontal?oz:oy);
  }
  geo.setAttribute('uv',new T.BufferAttribute(uv,2));
}
