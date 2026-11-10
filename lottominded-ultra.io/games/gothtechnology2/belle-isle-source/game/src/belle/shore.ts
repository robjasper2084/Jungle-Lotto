import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {inside,segment,type ParkMap,ParkTerrain,type Point} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import {bankGrassGeometry,createShoreDetailPool,type ShoreInstance} from './shoreDetail.ts';

export const riverBankHeight=(offset:number,top=2)=>top-(top+.1)*Math.min(1,Math.max(0,offset/4));

/** Sparse, reproducible bank patches keep beaches, paths and bridge openings clear. */
export function planShoreClutter(data:ParkMap,terrain:ParkTerrain){
 const walls:{x:number;z:number;length:number;heading:number}[]=[],stones:ShoreInstance[]=[],plants:ShoreInstance[]=[];
 const occupied=roadIndex(data.roads),beaches=data.areas.filter(a=>a.kind==='beach'),tint=new T.Color();
 const sandy=(x:number,z:number)=>beaches.some(a=>inside(x,z,a.points)||a.points.slice(1).some((p,i)=>segment(x,z,a.points[i],p).d<9));
 let seed=174;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 const banks=[{points:data.shoreline,land:data.mainland,closed:false},{points:data.island,land:data.island,closed:true},...(data.outerIslets||[]).map(i=>({points:i.points,land:i.points,closed:true}))];
 for(const {points,land,closed} of banks)for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.1)continue;
  const tx=(b[0]-a[0])/length,tz=(b[1]-a[1])/length,nx=tz,nz=-tx,n=Math.ceil(length/7);
  for(let j=0;j<n;j++){
   const t=(j+.5)/n,x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t),bp=terrain.bridge(x,z);
   if(Math.abs(bp.side)<15&&bp.t>-.03&&bp.t<1.03)continue;
   if(!closed)walls.push({x,z,length:length/n+.06,heading:Math.atan2(tx,tz)});
   const outward=inside(x+nx,z+nz,land)?-1:1;
   if(sandy(x,z))continue;
   const count=random()<.18?0:2+Math.floor(random()*4);
   for(let k=0;k<count;k++){
    const offset=.65+random()*3.15,along=(random()-.5)*4.5,size=.28+random()*.62;
    const rx=x+nx*offset*outward+tx*along,rz=z+nz*offset*outward+tz*along;
    if(occupied(rx,rz,'',size*.7+.35)||terrain.obstructed(rx,rz,size*.5))continue;
    const y=(closed?riverBankHeight(offset,terrain.height(x+tx*along,z+tz*along)):-.22)-size*.12;
    stones.push({x:rx,z:rz,y,yaw:random()*Math.PI*2,sx:size*(1.2+random()*.45),sy:size*.65,sz:size,color:tint.setHSL(.09+random()*.04,.04+random()*.08,(y<.3?.28:.39)+random()*.15).getHex()});
   }
   if(!closed||random()>.44)continue;
   // Low grass on the landward lip breaks the straight turf/soil join. It is
   // separate from taller lagoon sedges and never enters the sandy beaches.
   const clump=2+Math.floor(random()*3);
   for(let k=0;k<clump;k++){
    const along=(random()-.5)*3,inland=.2+random()*.85,px=x-nx*inland*outward+tx*along,pz=z-nz*inland*outward+tz*along;
    if(sandy(px,pz)||!terrain.land(px,pz)||occupied(px,pz,'',1.2)||terrain.obstructed(px,pz,.5))continue;
    const width=.7+random()*.65;
    plants.push({x:px,y:terrain.height(px,pz)+.012,z:pz,yaw:random()*Math.PI*2,sx:width,sy:.24+random()*.38,sz:width,color:tint.setHSL(.17+random()*.04,.25,.24+random()*.13).getHex()});
   }
  }
 }
 return {walls,stones,plants};
}

/** Shoreline surfaces share the controller's mapped bank and ramp heights. */
export function addShoreDetails(scene:T.Scene,data:ParkMap,terrain:ParkTerrain,grass:T.Material,concrete:T.Material){
 const bridge=data.bridge,ux=(bridge.b[0]-bridge.a[0])/bridge.length,uz=(bridge.b[1]-bridge.a[1])/bridge.length;
 const world=(s:number,w:number)=>[bridge.a[0]+ux*s+uz*w,bridge.a[1]+uz*s-ux*w] as Point;
 for(const [start,end]of[[-180,0],[bridge.length,bridge.length+110]]){
  const vertices:number[]=[],uv:number[]=[],indices:number[]=[];const rows=40,cols=32;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const [x,z]=world(start+(end-start)*j/rows,-38+76*i/cols);vertices.push(x,terrain.height(x,z)+.006,z);uv.push(x/8,z/8);
   if(j&&i){const k=j*(cols+1)+i;indices.push(k,k-cols-2,k-1,k,k-cols-1,k-cols-2);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new T.Mesh(g,grass);mesh.name='Graded bridge approach';mesh.receiveShadow=true;scene.add(mesh);
 }
 const foam=addShoreWash(scene,data,terrain);
 const plan=planShoreClutter(data,terrain),walls=plan.walls.map(w=>{
  const geometry=new T.BoxGeometry(.48,2.2,w.length);geometry.rotateY(w.heading);geometry.translate(w.x,.9,w.z);return geometry;
 });
 if(walls.length){const g=mergeGeometries(walls)!;walls.forEach(g=>g.dispose());const m=new T.Mesh(g,concrete);m.name='Mapped Detroit seawall';m.receiveShadow=true;scene.add(m);}
 const rock=new T.IcosahedronGeometry(1,1),rockMaterial=new T.MeshStandardMaterial({color:0xb7b7a8,roughness:.97});rockMaterial.name='Weathered shoreline stone';
 rockMaterial.onBeforeCompile=s=>{s.vertexShader='varying vec3 rockWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 rw=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nrw=instanceMatrix*rw;\n#endif\nrockWorld=(modelMatrix*rw).xyz;');s.fragmentShader='varying vec3 rockWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nfloat wet=1.-smoothstep(.05,.65,rockWorld.y);diffuseColor.rgb*=1.-wet*.35;roughnessFactor=mix(roughnessFactor,.32,wet);');};

 const vertices=rock.attributes.position;
 for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),r=.91+.09*Math.sin(x*8.1+y*4.7+z*6.3);vertices.setXYZ(i,x*r,y*r,z*r);}rock.computeVertexNormals();
 const plantMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:1,side:T.DoubleSide});plantMaterial.name='Shore bank grass';
 const stones=createShoreDetailPool(scene,rock,rockMaterial,plan.stones,'rocks','Shoreline riprap');
 const plants=createShoreDetailPool(scene,bankGrassGeometry(),plantMaterial,plan.plants,'plants','Low riverbank grass');
 return {animate:foam.animate,rocks:plan.stones.length,plants:plan.plants.length,stats:{rocks:stones.stats,plants:plants.stats,maxDraws:2},
  setQuality(quality:string){stones.setQuality(quality);plants.setQuality(quality);},
  update(x:number,z:number){stones.update(x,z);plants.update(x,z);}
 };
}

function addShoreWash(scene:T.Scene,data:ParkMap,terrain:ParkTerrain){
 const foamPositions:number[]=[],foamUV:number[]=[],foamIndex:number[]=[];let shoreLength=0;
 for(let i=1;i<data.island.length;i++){const a=data.island[i-1],b=data.island[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.1)continue;const nx=(b[1]-a[1])/length,nz=-(b[0]-a[0])/length,n=Math.ceil(length/7);for(let j=0;j<n;j++){const t=(j+.5)/n,x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t),outward=inside(x+nx,z+nz,data.island)?-1:1;{const alongX=(b[0]-a[0])/length,alongZ=(b[1]-a[1])/length,half=length/n*.52,base=foamPositions.length/3;for(const [along,offset,u,v]of[[-half,3.55,shoreLength,0],[half,3.55,shoreLength+half*2,0],[-half,5.1,shoreLength,1],[half,5.1,shoreLength+half*2,1]]){foamPositions.push(x+alongX*along+nx*offset*outward,.065,z+alongZ*along+nz*offset*outward);foamUV.push(u,v);}foamIndex.push(base,base+2,base+1,base+1,base+2,base+3);shoreLength+=half*2;}
}}
 const foamTime={value:0},foamLight={value:1},foamGeometry=new T.BufferGeometry();foamGeometry.setAttribute('position',new T.Float32BufferAttribute(foamPositions,3));foamGeometry.setAttribute('uv',new T.Float32BufferAttribute(foamUV,2));foamGeometry.setIndex(foamIndex);const foam=new T.Mesh(foamGeometry,new T.ShaderMaterial({uniforms:{time:foamTime,light:foamLight},transparent:true,depthWrite:false,side:T.DoubleSide,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float time,light;void main(){float wave=sin(v.x*.57-time*.8)+sin(v.x*1.31+time*.35)*.25;float edge=1.-smoothstep(.06,.24,abs(v.y-(.45+.2*sin(time*.7+v.x*.12))));float speck=fract(sin(dot(floor(v*vec2(15.,70.)),vec2(12.98,78.23)))*43758.5);float a=edge*smoothstep(-.4,.7,wave)*mix(.15,.48,speck)*sin(v.y*3.14159);gl_FragColor=vec4(vec3(.72,.84,.79)*light,a);}'}));foam.name='Moving shoreline wash';scene.add(foam);
return{animate(time:number,light:number){foamTime.value=time;foamLight.value=.25+.75*light;}};}
