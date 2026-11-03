import * as T from 'three';

export async function addBeach(scene:T.Scene){
 const meta=await fetch('./belle/beach-surface.json').then(r=>r.json()),buffer=await fetch('./belle/beach-surface.bin').then(r=>r.arrayBuffer());
 const packed=new T.InterleavedBuffer(new Float32Array(buffer),8),g=new T.BufferGeometry();
 g.setAttribute('position',new T.InterleavedBufferAttribute(packed,3,0));g.setAttribute('normal',new T.InterleavedBufferAttribute(packed,3,3));g.setAttribute('uv',new T.InterleavedBufferAttribute(packed,2,6));g.setIndex(meta.indices);
 const loader=new T.TextureLoader();const load=async(name:string)=>{const t=await loader.loadAsync('./belle/textures/beach-sand-'+name+'.jpg');t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.setScalar(.375);t.anisotropy=4;return t;};
 const [albedo,normal,roughness]=await Promise.all([load('albedo'),load('normal'),load('roughness')]);albedo.colorSpace=T.SRGBColorSpace;
 const sand=new T.MeshStandardMaterial({color:0xf3eddd,map:albedo,normalMap:normal,roughnessMap:roughness,roughness:1});sand.normalScale.set(.32,.32);
 // Metre-scale ripples, low-frequency sediment and subpixel-faded grains.
 // No giant photographic repeat or high-frequency sparkle while riding.
 sand.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 sandWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nsandWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 sandWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 s=sandWorld.xz;float dry=smoothstep(.16,.64,sandWorld.y);
   float broad=.5+.27*sin(s.x*.29+sin(s.y*.21)*1.8)+.23*sin(s.y*.47-s.x*.16);
   float detail=1.-smoothstep(.25,1.5,length(fwidth(s))*100.);
   float grain=fract(sin(dot(floor(s*100.),vec2(12.9898,78.233)))*43758.5453);
   diffuseColor.rgb*=mix(vec3(.43,.45,.42),vec3(.95,.92,.84),dry)*(.88+.17*broad)*mix(1.,.78+.38*grain,detail);
  `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(.32,max(.78,roughnessFactor),smoothstep(.12,.68,sandWorld.y));
  `);
 };sand.customProgramCacheKey=()=>'scanned-coastal-sand-v2';
 const mesh=new T.Mesh(g,sand);mesh.name='Mapped beach · sloping dry sand and wet shore';mesh.receiveShadow=true;scene.add(mesh);
 return{material:sand,triangles:meta.indices.length/3};
}
