import * as T from 'three';
import type {StreetPlan,StreetBox} from './streetPlan.ts';

// Build once from the offline plan. Group by material AND 256 m tile so the
// renderer can discard distant detail without per-frame object traversal.
export function addStreetDetails(scene:T.Scene,plan:StreetPlan){
 const materials:Record<StreetBox['material'],T.MeshStandardMaterial>={
  white:new T.MeshStandardMaterial({color:0xd6d5c7,roughness:.94}),
  yellow:new T.MeshStandardMaterial({color:0xd4ab35,roughness:.93}),
  curb:new T.MeshStandardMaterial({color:0xaaa89b,roughness:.9}),
  gutter:new T.MeshStandardMaterial({color:0x666860,roughness:.95}),
  metal:new T.MeshStandardMaterial({color:0x343b38,roughness:.7,metalness:.5}),
  green:new T.MeshStandardMaterial({color:0x345647,roughness:.9}),
  tactile:new T.MeshStandardMaterial({color:0x92713f,roughness:.9})
 };
 for(const [key,material]of Object.entries(materials)){
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 detailWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\ndetailWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='varying vec3 detailWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float grain=fract(sin(dot(floor(detailWorld.xz*85.),vec2(12.9898,78.233)))*43758.5453);
    float resolved=1.-smoothstep(.35,1.7,length(fwidth(detailWorld.xz))*85.);
    float wear=.5+.25*sin(detailWorld.x*1.7+sin(detailWorld.z*.8))+.25*sin(detailWorld.z*2.3);
    diffuseColor.rgb*=mix(.86,1.04,wear)*mix(1.,mix(.86,1.08,grain),resolved);
    ${key==='curb'||key==='gutter'?`float grime=.92+.08*smoothstep(2.06,2.19,detailWorld.y);diffuseColor.rgb*=grime;`:''}
   `);
  };
  material.customProgramCacheKey=()=>'street-antialiased-weather-v2-'+key;
 }
 const unit=new T.BoxGeometry(1,1,1).toNonIndexed();
 // Chamfer the upper edges rather than making curb runs look like sharp blocks.
 const section=new T.Shape();section.moveTo(-.5,-.5);section.lineTo(.5,-.5);section.lineTo(.5,.3);section.lineTo(.4,.5);section.lineTo(-.4,.5);section.lineTo(-.5,.3);section.closePath();
 const curbUnit=new T.ExtrudeGeometry(section,{depth:1,bevelEnabled:false,steps:1});curbUnit.translate(0,0,-.5);
 const groups=new Map<string,{p:number[];n:number[];m:StreetBox['material']}>();
 for(const b of plan.boxes){
  const template=b.material==='curb'&&b.h>.03?curbUnit:unit,pos=template.attributes.position,nor=template.attributes.normal;
  const key=Math.floor(b.x/256)+','+Math.floor(b.z/256)+','+b.material;
  if(!groups.has(key))groups.set(key,{p:[],n:[],m:b.material});const g=groups.get(key)!,co=Math.cos(b.yaw),si=Math.sin(b.yaw);
  for(let i=0;i<pos.count;i++){
   // Flat paint/gutters need only the top face, not six box faces.
   if(b.h<.03&&nor.getY(i)<.5)continue;
   const x=pos.getX(i)*b.w,y=pos.getY(i)*b.h,z=pos.getZ(i)*b.l,nx=nor.getX(i),nz=nor.getZ(i);
   g.p.push(b.x+co*x+si*z,b.y+y+(b.grade||0)*z,b.z-si*x+co*z);const ny=nor.getY(i),normalZ=nz-(b.grade||0)*ny,normalLength=Math.hypot(nx,ny,normalZ);g.n.push((co*nx+si*normalZ)/normalLength,ny/normalLength,(-si*nx+co*normalZ)/normalLength);
  }
 }
 unit.dispose();curbUnit.dispose();
 const tiles:{mesh:T.Mesh;x:number;z:number}[]=[];
 for(const [key,b]of groups){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.computeBoundingSphere();const m=new T.Mesh(g,materials[b.m]);m.name='Street detail '+key;m.receiveShadow=true;scene.add(m);const [x,z]=key.split(',').map(Number);tiles.push({mesh:m,x:x*256+128,z:z*256+128});}
 // One text atlas for every sign, with actual readable text, solid rear panels,
 // bolted posts and no separate textures per destination.
 const columns=4,cellW=256,cellH=80,rows=Math.ceil(Math.max(1,plan.signs.length)/columns),canvas=document.createElement('canvas');canvas.width=columns*cellW;canvas.height=T.MathUtils.ceilPowerOfTwo(rows*cellH);
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#405249';ctx.fillRect(0,0,canvas.width,canvas.height);
 const frontP:number[]=[],frontUV:number[]=[],frontN:number[]=[],backP:number[]=[],backN:number[]=[],poleMatrices:T.Matrix4[]=[];
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),v=new T.Vector3();
 plan.signs.forEach((s,i)=>{
  const ox=i%columns*cellW,oy=Math.floor(i/columns)*cellH;
  ctx.fillStyle=s.kind==='speed'?'#e6e4d9':s.kind==='stop'?'#992b26':'#1f3c32';ctx.fillRect(ox+3,oy+3,cellW-6,cellH-6);ctx.strokeStyle='#d6ddcb';ctx.lineWidth=2;ctx.strokeRect(ox+6,oy+6,cellW-12,cellH-12);
  ctx.textAlign='center';ctx.fillStyle=s.kind==='speed'?'#18251e':'#edf0e4';ctx.font='bold 18px Arial';
  const maxW=cellW-24;let size=18;while(ctx.measureText(s.title).width>maxW&&size>10){size--;ctx.font=`bold ${size}px Arial`;}
  ctx.fillText(s.title,ox+cellW/2,oy+38,maxW);ctx.font='11px Arial';ctx.fillText(s.subtitle,ox+cellW/2,oy+59,maxW);
  const co=Math.cos(s.yaw),si=Math.sin(s.yaw),verts=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,-.5],[.5,.5],[-.5,.5]];
  for(const [x,y]of verts){frontP.push(s.x+co*x*s.w,s.y+y*s.h,s.z-si*x*s.w);frontN.push(si,0,co);frontUV.push((ox+(x+.5)*cellW)/canvas.width,1-(oy+( .5-y)*cellH)/canvas.height);}
  for(const [x,y]of verts.slice().reverse()){backP.push(s.x+co*x*s.w-si*.045,s.y+y*s.h,s.z-si*x*s.w-co*.045);backN.push(-si,0,-co);}
  const postXs=s.w>2?[-s.w*.33,s.w*.33]:[0];for(const x of postXs){v.set(s.x+co*x-si*.08,s.y-1.25,s.z-si*x-co*.08);rotation.setFromAxisAngle(new T.Vector3(0,1,0),s.yaw);poleMatrices.push(matrix.compose(v,rotation,new T.Vector3(.07,2.5,.07)).clone());}
 });
 const atlas=new T.CanvasTexture(canvas);atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
 const frontG=new T.BufferGeometry();frontG.setAttribute('position',new T.Float32BufferAttribute(frontP,3));frontG.setAttribute('normal',new T.Float32BufferAttribute(frontN,3));frontG.setAttribute('uv',new T.Float32BufferAttribute(frontUV,2));
 const front=new T.Mesh(frontG,new T.MeshStandardMaterial({map:atlas,roughness:.8}));front.name='Belle Isle wayfinding · shared text atlas';scene.add(front);
 const backG=new T.BufferGeometry();backG.setAttribute('position',new T.Float32BufferAttribute(backP,3));backG.setAttribute('normal',new T.Float32BufferAttribute(backN,3));scene.add(new T.Mesh(backG,materials.metal));
 const posts=new T.InstancedMesh(new T.BoxGeometry(1,1,1),materials.metal,poleMatrices.length);poleMatrices.forEach((m,i)=>posts.setMatrixAt(i,m));posts.computeBoundingSphere();scene.add(posts);
 return {batches:groups.size+3,signs:plan.signs.length,boxes:plan.boxes.length,atlas:[canvas.width,canvas.height],update(x:number,z:number){for(const t of tiles)t.mesh.visible=Math.hypot(t.x-x,t.z-z)<440;}};
}
