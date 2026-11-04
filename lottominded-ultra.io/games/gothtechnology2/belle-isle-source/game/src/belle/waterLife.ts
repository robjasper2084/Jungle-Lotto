import {createFountainLighting,FOUNTAIN_COLOR_UNIFORMS} from './fountainLighting.ts';
import {addScottDetails} from './fountainDetail.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {KOI_COUNT,koiPose,fountains,flowPoint} from './waterFeatures.ts';
import type {ParkMap} from './terrain.ts';

function colored(g:T.BufferGeometry,color:number){const a=g.attributes.position,c=new T.Color(color),v=new Float32Array(a.count*3);for(let i=0;i<a.count;i++)c.toArray(v,i*3);g.setAttribute('color',new T.BufferAttribute(v,3));if(!g.index)return g;const flat=g.toNonIndexed();g.dispose();return flat;}
function koiGeometry(){
 const body=new T.SphereGeometry(1,20,12);body.scale(.125,.10,.34);const p=body.attributes.position,c=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),patch=Math.sin(z*25+x*19)+Math.cos(x*28-y*13);
  new T.Color(y<-.04?0xe7dfbe:patch>.70?0xd44b17:patch< -1.47&&z<.2?0x292c25:0xf1e6c6).toArray(c,i*3);}
 body.setAttribute('color',new T.BufferAttribute(c,3));const gs=[body.toNonIndexed()];body.dispose();
 for(const side of [-1,1]){
  const eye=new T.SphereGeometry(.018,8,6);eye.translate(side*.085,.041,.255);gs.push(colored(eye,0x171c15));
  const fin=new T.BufferGeometry();fin.setAttribute('position',new T.Float32BufferAttribute([side*.08,-.015,.12,side*.25,-.04,-.02,side*.085,-.035,-.09],3));fin.computeVertexNormals();fin.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,1,0,1],2));gs.push(colored(fin,0xd3ab6c));
 }
 const dorsal=new T.BufferGeometry();dorsal.setAttribute('position',new T.Float32BufferAttribute([0,.085,.10,0,.19,-.13,0,.068,-.25],3));dorsal.setAttribute('uv',new T.Float32BufferAttribute([0,0,.5,1,1,0],2));dorsal.computeVertexNormals();gs.push(colored(dorsal,0xd7a568));
 const joined=mergeGeometries(gs)!;for(const g of gs)g.dispose();return joined;
}
export function addKoi(scene:T.Scene){
 const group=new T.Group();group.name='Conservatory koi · twelve swimming fish';group.position.set(1336,0,1143);scene.add(group);
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:0,side:T.DoubleSide});
 const bodies=new T.InstancedMesh(koiGeometry(),material,KOI_COUNT);
 const tailGeometry=new T.BufferGeometry();tailGeometry.setAttribute('position',new T.Float32BufferAttribute([0,0,0,-.15,.015,-.23,0,0,-.18,0,0,0,0,0,-.18,.15,.015,-.23],3));tailGeometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,1,.5,1,0,0,.5,1,1,1],2));tailGeometry.computeVertexNormals();
 const tails=new T.InstancedMesh(colored(tailGeometry,0xd89d60),material,KOI_COUNT);bodies.frustumCulled=tails.frustumCulled=false;group.add(bodies,tails);
 bodies.instanceMatrix.setUsage(T.DynamicDrawUsage);tails.instanceMatrix.setUsage(T.DynamicDrawUsage);
 const body=new T.Object3D(),tail=new T.Object3D(),joint=new T.Matrix4();let last=-Infinity;
 return {update(time:number,x:number,z:number){group.visible=Math.hypot(x-1336,z-1143)<100;if(!group.visible||time-last<1/30)return;last=time;
  for(let i=0;i<KOI_COUNT;i++){const p=koiPose(i,time);body.position.set(p.x-1336,p.y,p.z-1143);body.rotation.y=p.yaw;body.scale.setScalar(p.size);body.updateMatrix();bodies.setMatrixAt(i,body.matrix);tail.position.set(0,0,-.29);tail.rotation.y=p.tail;tail.updateMatrix();joint.multiplyMatrices(body.matrix,tail.matrix);tails.setMatrixAt(i,joint);}
  bodies.instanceMatrix.needsUpdate=tails.instanceMatrix.needsUpdate=true;
 },stats:{fish:KOI_COUNT,draws:2}};
}

export function addFountainFlow(scene:T.Scene,map:ParkMap,architecture:T.Object3D){
 const time={value:0},night={value:0},lighting=createFountainLighting();const scott=addScottDetails(scene,map,architecture,night,time,lighting);const stream=new T.MeshStandardMaterial({color:0xbedde0,roughness:.16,metalness:.12,transparent:true,opacity:.65,depthWrite:false});
 stream.onBeforeCompile=shader=>{Object.assign(shader.uniforms,lighting.uniforms);shader.uniforms.flowTime=time;shader.uniforms.flowNight=night;shader.vertexShader='varying vec2 flowUV;varying vec3 flowWorld;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nflowUV=uv;').replace('#include <begin_vertex>','#include <begin_vertex>\nflowWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader=FOUNTAIN_COLOR_UNIFORMS+'uniform float flowTime;uniform float flowNight;varying vec2 flowUV;varying vec3 flowWorld;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat fleck=.5+.5*sin(flowUV.x*110.-flowTime*19.);diffuseColor.rgb*=.75+fleck*.4;diffuseColor.a*=.5+fleck*.5;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat closeScott=1.-smoothstep(75.,100.,length(flowWorld.xz-vec2('+scott.layout.x+','+scott.layout.z+')));vec3 lit=mix(fountainPrimary,fountainSecondary,.5+.5*sin(flowWorld.y*.8));totalEmissiveRadiance+=lit*flowNight*closeScott*.65;');};stream.customProgramCacheKey=()=>'fountain-running-stream-cycle-v2';
 const basin=new T.MeshStandardMaterial({color:0x416d68,metalness:.16,roughness:.22});
 basin.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{...lighting.uniforms,flowTime:time,flowNight:night,scottCentre:{value:new T.Vector2(scott.layout.x,scott.layout.z)}});shader.vertexShader='varying vec3 basinP;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbasinP=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader=FOUNTAIN_COLOR_UNIFORMS+'uniform float flowTime;uniform float flowNight;uniform vec2 scottCentre;varying vec3 basinP;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec2 rip=vec2(sin(basinP.x*4.+flowTime*2.6),cos(basinP.z*4.7-flowTime*2.));normal=normalize(normal+vec3(rip.x*.045,rip.y*.045,0.));').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
 vec2 q=basinP.xz-scottCentre;float r=length(q),a=atan(q.x,q.y);float nearScott=1.-smoothstep(75.,100.,r);
 float caustic=pow(.5+.5*sin(basinP.x*3.+sin(basinP.z*2.3+flowTime*.8)+flowTime),8.)*pow(.5+.5*cos(basinP.z*2.7-flowTime*.7),2.);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.35,.49,.35),nearScott*(1.-flowNight)*.6);
 totalEmissiveRadiance+=vec3(.16,.22,.13)*caustic*(1.-flowNight)*nearScott;
 vec3 c=mix(fountainPrimary,fountainSecondary,.5+.5*sin(a*2.+.9));
 float poolLight=.045+.30*pow(.5+.5*cos(a*8.+sin(r*2.-flowTime)*.15),18.)*exp(-abs(r-14.)*.12);
 if(r>20.)poolLight=.12+.13*pow(.5+.5*sin(r*.85+sin(basinP.x*6.+flowTime)*.15),12.);
 totalEmissiveRadiance+=c*poolLight*flowNight*nearScott;
 `);};basin.customProgramCacheKey=()=>'fountain-basin-caustic-uplight-cycle-v3';scott.water.material=basin;

 architecture.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;const ms=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(ms.some(m=>m.name==='Fountain falling water')){mesh.visible=false;mesh.userData.staticSprayReplaced=true;}if(ms.some(m=>m.name==='Fountain water')){mesh.material=basin;mesh.castShadow=false;}});
 const sprayMaterial=new T.PointsMaterial({color:0xd8eeeb,size:.055,transparent:true,opacity:.65,depthWrite:false,sizeAttenuation:true});
 sprayMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat droplet=length(gl_PointCoord-vec2(.5));if(droplet>.5)discard;diffuseColor.a*=1.-smoothstep(.25,.5,droplet);');};sprayMaterial.customProgramCacheKey=()=>'soft-round-fountain-droplets-v1';
 const effects=fountains(map).map(f=>{if(f.id==='9146545')f.flows.push(...scott.flows);
  const group=new T.Group();group.name=f.name+' · flowing water';group.position.set(f.x,2,f.z);group.rotation.y=f.yaw;scene.add(group);
  if(f.id==='9146545'){const sheet=stream.clone();sheet.opacity=.19;sheet.side=T.DoubleSide;sheet.onBeforeCompile=stream.onBeforeCompile;sheet.customProgramCacheKey=stream.customProgramCacheKey;for(const [rt,rb,top,bottom]of [[3.24,4.25,8.4,5.78],[5.94,6.35,5.75,2.72]]){const curtain=new T.Mesh(new T.CylinderGeometry(rt*scott.layout.scale,rb*scott.layout.scale,top-bottom,96,1,true),sheet);curtain.position.y=(top+bottom)/2;curtain.name='Scott continuous falling-water curtain';group.add(curtain);}}

  if(f.id==='6179290151'){const pool=new T.Mesh(new T.CircleGeometry(.20,32).rotateX(-Math.PI/2),basin);pool.position.y=1.081;group.add(pool);const nozzle=new T.Mesh(new T.CylinderGeometry(.024,.024,.08,10),new T.MeshStandardMaterial({color:0xb7c2bf,metalness:.75,roughness:.22}));nozzle.position.set(0,1.14,.37);group.add(nozzle);}
  const gs=f.flows.map(flow=>{const points=Array.from({length:25},(_,i)=>new T.Vector3(...flowPoint(flow,i/24)));return new T.TubeGeometry(new T.CatmullRomCurve3(points),24,flow.radius,5,false);});
  const geometry=mergeGeometries(gs)!;gs.forEach(g=>g.dispose());group.add(new T.Mesh(geometry,stream));
  const positions=new Float32Array(f.flows.length*10*3),drops=new T.BufferGeometry();drops.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));const droplets=f.id==='6179290151'||f.id==='9146545'?sprayMaterial.clone():sprayMaterial;if(droplets!==sprayMaterial){if(f.id==='6179290151')droplets.size=.022;droplets.onBeforeCompile=sprayMaterial.onBeforeCompile;droplets.customProgramCacheKey=sprayMaterial.customProgramCacheKey;}const points=new T.Points(drops,droplets);points.frustumCulled=false;group.add(points);
  // Receiving bowls show small, expanding rings rather than splashes in mid-air.
  const rippleMaterial=new T.MeshBasicMaterial({color:0xaecfca,transparent:true,opacity:.27,depthWrite:false,side:T.DoubleSide});const ripples=new T.InstancedMesh(new T.RingGeometry(.86,1,24).rotateX(-Math.PI/2),rippleMaterial,f.flows.length);ripples.frustumCulled=false;group.add(ripples);
  return {f,group,drops,positions,ripples,droplets,rippleMaterial};
 });const object=new T.Object3D();let last=-Infinity;
 return {sources:effects.map(e=>e.f),update(t:number,x:number,z:number,nightAmount=0){time.value=t;night.value=nightAmount;lighting.update(t);scott.update();if(t-last<1/30)return;last=t;
  for(const e of effects){if(e.f.id==='9146545'){e.droplets.color.set(0xd8eeeb).lerp(lighting.primary.value,nightAmount*.8);e.rippleMaterial.color.set(0xaecfca).lerp(lighting.secondary.value,nightAmount*.8);}e.group.visible=Math.hypot(x-e.f.x,z-e.f.z)<(e.f.id==='9146545'?550:150);if(!e.group.visible)continue;
   e.f.flows.forEach((f,i)=>{for(let j=0;j<10;j++){const u=(t/f.seconds+j/10+i*.131)%1,p=flowPoint(f,u),k=(i*10+j)*3;const spread=.015+.045*u;e.positions[k]=p[0]+Math.sin(j*16+i)*spread;e.positions[k+1]=p[1];e.positions[k+2]=p[2]+Math.cos(j*13+i)*spread;}
    const phase=(t*.85+i*.17)%1;object.position.set(f.to[0],f.to[1]+.012,f.to[2]);object.scale.setScalar(.08+phase*(e.f.id==='6179290151'?.10:.35));object.updateMatrix();e.ripples.setMatrixAt(i,object.matrix);
   });e.drops.attributes.position.needsUpdate=true;e.ripples.instanceMatrix.needsUpdate=true;
  }
 },stats:{fountains:effects.length,streams:effects.reduce((n,e)=>n+e.f.flows.length,0)}};
}
