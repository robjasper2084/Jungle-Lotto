import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {segmentDistance} from './elmwood-details.ts';

type WaterUniforms={waterTime:{value:number};waterDetail:{value:number};rain:{value:number};wind:{value:number}};
type Feature={id:string;points:number[][];tags:Record<string,string>};
type Pond={center:number[];ring:number[][]};
type WaterBed={surfaceGround(x:number,north:number):number;features:Feature[]};
let noise:T.DataTexture|undefined;

/** Small, seamless original noise texture. Mipmaps keep distant highlights from sparkling. */
function waterNoise(){
 if(noise)return noise;
 const size=128,data=new Uint8Array(size*size*4);
 const hash=(x:number,y:number,seed:number)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
 const value=(x:number,y:number,cells:number,seed:number)=>{const px=x*cells/size,py=y*cells/size,ix=Math.floor(px),iy=Math.floor(py),a=px-ix,b=py-iy,s=a*a*(3-2*a),t=b*b*(3-2*b);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix%cells,iy%cells,seed),hash((ix+1)%cells,iy%cells,seed),s),T.MathUtils.lerp(hash(ix%cells,(iy+1)%cells,seed),hash((ix+1)%cells,(iy+1)%cells,seed),s),t);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;data[i]=Math.round(value(x,y,8,19)*255);data[i+1]=Math.round(value(x,y,16,73)*255);data[i+2]=Math.round(value(x,y,32,137)*255);data[i+3]=255;}
 noise=new T.DataTexture(data,size,size,T.RGBAFormat);noise.wrapS=noise.wrapT=T.RepeatWrapping;noise.minFilter=T.LinearMipmapLinearFilter;noise.magFilter=T.LinearFilter;noise.generateMipmaps=true;noise.needsUpdate=true;noise.name='Elmwood original water micro-ripples';return noise;
}

const surface=/* glsl */`
uniform sampler2D waterNoise;
uniform float waterTime,waterDetail,waterRain,waterWind,waterKind;
uniform vec2 waterFountain;
float waterHeight(vec2 p,vec4 info){
 vec2 flow=info.xy;float creek=waterKind;
 vec2 drift=mix(vec2(.018,-.012),flow*.11,creek);
 vec2 q=p*.12-drift*waterTime;
 float broad=texture2D(waterNoise,q).r-.5;
 float fine=texture2D(waterNoise,mat2(.8,-.6,.6,.8)*p*.24+vec2(.009,.006)*waterTime-flow*.09*waterTime*creek).g-.5;
 float micro=0.;if(waterDetail>.5)micro=texture2D(waterNoise,p*.43+flow*.07*waterTime+vec2(-.021,.013)*waterTime).b-.5;
 float wave=(broad*.048+fine*.022+micro*.009*waterDetail)*(.8+waterWind*.35);
 float radius=length(p-waterFountain);
 float impact=sin(radius*8.-waterTime*4.3)*exp(-radius*.22)*.009*(1.-creek);
 vec2 cell=floor(p*1.3),local=fract(p*1.3)-.5;float seed=texture2D(waterNoise,(cell+.5)/128.).b;
 float age=fract(waterTime*.8+seed*7.),dropRadius=length(local);
 float rainfall=sin((dropRadius-age*.7)*45.)*exp(-abs(dropRadius-age*.7)*28.)*(1.-age)*.006*waterRain;
 return (wave+impact+rainfall)*smoothstep(.12,1.1,info.z);
}`;

/** Water is dielectric, with the existing HDR/light/fog path and no extra scene capture. */
export function makeElmwoodWater(source:T.MeshStandardMaterial,u:WaterUniforms){
 const creek=/creek/i.test(source.name),kind={value:creek?1:0},fountain={value:new T.Vector2()};
 const m=new T.MeshPhysicalMaterial({name:source.name,color:'#ffffff',side:source.side,roughness:.18,metalness:0,ior:1.333,envMapIntensity:.68,clearcoat:.20,clearcoatRoughness:.26});
 m.userData.elmwoodWater={kind,fountain};
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{waterNoise:{value:waterNoise()},waterTime:u.waterTime,waterDetail:u.waterDetail,waterRain:u.rain,waterWind:u.wind,waterKind:kind,waterFountain:fountain,waterDeep:{value:new T.Color(creek?'#284b42':'#204848')},waterShallow:{value:new T.Color('#5d7566')}});
  s.vertexShader=surface+'\nattribute vec4 waterInfo; varying vec3 waterWorld; varying vec4 waterData;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   waterWorld=(modelMatrix*vec4(position,1.)).xyz;waterData=waterInfo;
   transformed.y+=waterHeight(waterWorld.xz,waterInfo);`);
  s.fragmentShader=surface+'\nuniform vec3 waterDeep,waterShallow; varying vec3 waterWorld; varying vec4 waterData;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float waterDepth=max(.02,waterData.w),waterShore=waterData.z;
   vec2 waterDrift=waterWorld.xz*.12-waterData.xy*waterTime*.11*waterKind;
   float waterPattern=texture2D(waterNoise,waterDrift).r;
   float waterAbsorption=1.-exp(-waterDepth*1.7);
   diffuseColor.rgb=mix(waterShallow,waterDeep,waterAbsorption)*(.96+.08*waterPattern);
   float shoreFoam=(1.-smoothstep(.04,.65,waterShore))*smoothstep(.48,.78,waterPattern)*(.08+.05*waterKind);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.64,.72,.70),shoreFoam);`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(.19+.09*waterKind+.045*waterWind+.06*(waterPattern-.5)+waterRain*.05,.18,.42);`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float waterH=waterHeight(waterWorld.xz,waterData);
   vec3 waterX=dFdx(waterWorld),waterY=dFdy(waterWorld),waterUp=vec3(0.,1.,0.);
   vec3 waterR1=cross(waterY,waterUp),waterR2=cross(waterUp,waterX);float waterDet=dot(waterX,waterR1);
   vec3 waterGradient=dFdx(waterH)*waterR1+dFdy(waterH)*waterR2;
   vec3 waterNormal=normalize(max(abs(waterDet),.000001)*waterUp-sign(waterDet)*waterGradient);
   normal=normalize(mat3(viewMatrix)*waterNormal);`);
  // Use the same moving normal for the glossy film; a flat clearcoat makes broad fixed bands.
  s.fragmentShader=s.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
   #ifdef USE_CLEARCOAT
    clearcoatNormal=normal;
   #endif`);
 };
 m.customProgramCacheKey=()=> 'elmwood-depth-flow-water-v5';return m;
}

/** Subdivide only water triangles; retain every authored shoreline and original water level. */
export function subdivideWaterGeometry(source:T.BufferGeometry,maxEdge=3){
 const input=source.index?source.toNonIndexed():source.clone(),p=input.getAttribute('position'),vertices:number[]=[];
 const mid=(a:number[],b:number[])=>a.map((v,i)=>(v+b[i])*.5);
 const length=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 const triangle=(a:number[],b:number[],c:number[],depth=0)=>{if(depth<7&&Math.max(length(a,b),length(b,c),length(c,a))>maxEdge){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);}else vertices.push(...a,...b,...c);};
 for(let i=0;i<p.count;i+=3)triangle([p.getX(i),p.getY(i),p.getZ(i)],[p.getX(i+1),p.getY(i+1),p.getZ(i+1)],[p.getX(i+2),p.getY(i+2),p.getZ(i+2)]);
 input.dispose();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));const result=mergeVertices(g,.0001);g.dispose();result.computeVertexNormals();return result;
}

/** Data follows the real mapped bank/bed and creek tangent instead of world-axis stripes. */
export function waterSiteData(x:number,z:number,height:number,terrain:WaterBed,pond:Pond,creek:boolean){
 const north=-z;
 if(!creek){const shore=Math.min(...pond.ring.map((a,i)=>segmentDistance(x,north,a,pond.ring[(i+1)%pond.ring.length])));return [.75,-.66,shore,Math.max(.03,height-terrain.surfaceGround(x,north))];}
 let distance=Infinity,dx=0,dz=-1;
 for(const f of terrain.features.filter(f=>f.tags.waterway==='stream'))for(let i=1;i<f.points.length;i++){
  const a=f.points[i-1],b=f.points[i],d=segmentDistance(x,north,a,b);if(d>=distance)continue;
  distance=d;const length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;dx=(b[0]-a[0])/length;dz=-(b[1]-a[1])/length;
 }
 const shore=Math.max(0,2.75-distance);return [dx,dz,shore,Math.max(.04,Math.min(.8,.08+shore*.19))];
}

export function configureElmwoodWater(foundation:T.Group,terrain:WaterBed,pond:Pond){
 let meshes=0,vertices=0;foundation.updateMatrixWorld(true);
 foundation.traverse(o=>{if(!(o instanceof T.Mesh)||Array.isArray(o.material)||!o.material.userData.elmwoodWater)return;
  const data=o.material.userData.elmwoodWater;data.fountain.value.set(pond.center[0],-pond.center[1]);
  const old=o.geometry,g=subdivideWaterGeometry(old),positions=g.getAttribute('position'),info=new Float32Array(positions.count*4),point=new T.Vector3();
  for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);info.set(waterSiteData(point.x,point.z,point.y,terrain,pond,!!data.kind.value),i*4);}
  g.setAttribute('waterInfo',new T.BufferAttribute(info,4));g.computeBoundingBox();g.boundingBox!.expandByScalar(.05);g.computeBoundingSphere();g.boundingSphere!.radius+=.05;o.geometry=g;old.dispose();o.castShadow=false;o.receiveShadow=true;meshes++;vertices+=positions.count;
 });return {meshes,vertices};
}
