import * as T from 'three';
/** Original broad-scale surface variation; no new textures or per-frame CPU work. */
export function surfacePolish(m:T.MeshStandardMaterial){
 if(m.userData.surfacePolish||!/asphalt|grass|pavement|road/i.test(m.name))return;
 m.userData.surfacePolish=true;const compile=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m);
 m.customProgramCacheKey=()=>key()+'|surface-patina-v1';
 m.onBeforeCompile=(shader,renderer)=>{compile.call(m,shader,renderer);
  shader.vertexShader='varying vec3 vSurfaceWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vSurfaceWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`);
  shader.fragmentShader='varying vec3 vSurfaceWorld;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float patina=sin(vSurfaceWorld.x*.17+sin(vSurfaceWorld.z*.13))*sin(vSurfaceWorld.z*.21+vSurfaceWorld.x*.05);
diffuseColor.rgb*=.96+.045*patina;`);
 };m.needsUpdate=true;
}

type Terrain={segments:readonly {a:number[];b:number[];feature:{tags:Record<string,string>}}[];height:(x:number,north:number)=>number};
/** One inexpensive strip mesh softens grassy lane margins; authored curbs/bridges stay clear. */
export function makeLaneMargins(terrain:Terrain){
 const vertices:number[]=[],uvs:number[]=[];
 for(const segment of terrain.segments){
  if(segment.feature.tags.bridge==='yes')continue;
  const [ax,an]=segment.a,[bx,bn]=segment.b,dx=bx-ax,dn=bn-an,length=Math.hypot(dx,dn);if(length<.1)continue;
  const pieces=Math.ceil(length/2),sx=-dn/length,sn=dx/length;
  for(const side of [-1,1])for(let i=0;i<pieces;i++){
   const row=(t:number,offset:number)=>{const x=ax+dx*t+sx*offset*side,n=an+dn*t+sn*offset*side;return [x,terrain.height(x,n)+.012,-n];};
   const a=row(i/pieces,1.94),b=row((i+1)/pieces,1.94),c=row((i+1)/pieces,2.36),d=row(i/pieces,2.36);
   // Never paint over the 15 cm curb lip.
   if(Math.max(Math.abs(a[1]-d[1]),Math.abs(b[1]-c[1]))>.11)continue;
   vertices.push(...a,...b,...d,...b,...c,...d);uvs.push(0,0,1,0,0,1,1,0,1,1,0,1);
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();g.computeBoundingSphere();
 const m=new T.MeshStandardMaterial({name:'Worn grass and soil lane margin',color:'#68664b',roughness:1,transparent:true,opacity:.36,depthWrite:false,side:T.DoubleSide});
 m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
diffuseColor.a*=sin(vUv.y*3.14159265)*(.55+.45*sin(vUv.x*18.0+vUv.y*9.0));`);};
 // Standard materials enable UVs only when a texture/UV-specific define requests them.
 m.defines={USE_UV:''};m.customProgramCacheKey=()=> 'lane-margin-v1';
 const root=new T.Mesh(g,m);root.name='Soft lane margins';root.receiveShadow=true;root.renderOrder=1;return root;
}
