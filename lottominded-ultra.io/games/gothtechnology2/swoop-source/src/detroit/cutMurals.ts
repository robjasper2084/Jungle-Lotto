import type {SceneryWorld} from './sceneryWorld.ts';
import * as T from 'three';
import {GEO,profileLevel,BRIDGE_SLAB_DEPTH,nearestRamp} from './geo-profile.ts';
import {bridgeFrame} from './bridges.ts';
import {cutPoint,cutCoords,heightAt} from './world.ts';

/** Photo sources and section locations: Conservancy 2025 Art Walk map.
 * Bridge dimensions and surface fitting remain game approximations. */
export const CUT_MURALS=[
 {artist:'Ivan Montoya',year:2022,bridge:'Adelaide Street',side:-1,file:'ivanmontoyamural.jpg',crop:[.02,.05,.98,.98],ceiling:true},
 {artist:'Sydney James',year:2018,bridge:'Wilkins Street',side:-1,file:'sydneyjames2.jpg',crop:[0,.03,1,.97],ceiling:true},
 {artist:'Freddy Diaz',year:2019,bridge:'Division Street',side:-1,file:'freddymural.jpg',crop:[0,.20,1,.72],ceiling:false},
 {artist:'Fel3000ft',year:2012,bridge:'Antietam Avenue',side:-1,file:'fel3000mural.jpg',crop:[0,.33,1,.74],ceiling:false},
 {artist:'Mitchell Schorr',year:2014,bridge:'East Larned Street',side:1,file:'carsmuraldequindrecut.jpg',crop:[.02,.23,.98,.93],ceiling:false},
 {artist:'Mike Han / We Are Detroit',year:2013,bridge:'Antietam Avenue',side:1,file:'we-are-detroit-user.jpg',crop:[.045,.25,.98,.47],ceiling:false},
 {artist:'Blue dragon - supplied reference (placement provisional)',year:2013,bridge:'Chestnut Street',side:-1,file:'blue-dragon-user.jpg',crop:[0,.21,1,.91],ceiling:false},
] as const;

/** User-supplied art added only to spans with no existing mural. */
export const SUPPLIED_CUT_MURALS=[
 {title:'Red graffiti / wide',bridge:'East Jefferson Avenue',side:-1,aspect:4/3},
 {title:'Red graffiti / wall',bridge:'Pedestrian bridge 51600816',side:1,aspect:4/3},
 {title:'Red graffiti / close',bridge:'East Lafayette Street',side:-1,aspect:1.4514889529298751},
 {title:'Hooded portrait',bridge:'Vernor pedestrian bridge',side:1,aspect:4/3},
 {title:'Golden abstract',bridge:'Gratiot Avenue',side:1,aspect:1},
] as const;

/** Shared rendered/physical art returns, also used by route regression checks. */
export function muralBacking(site:{bridge:string;side:number},fullSpan=false){
 const b=GEO.bridges.find(b=>b.name===site.bridge)!,f=bridgeFrame(b),side=site.side,x=side*7.4,mid=(f.near+f.far)/2;
 let width=fullSpan?f.far-f.near-.04:Math.min(14,(f.far-f.near)-1.2);
 while(width>3&&[-1,1].some(end=>{const p=f.point(x,mid+end*width/2);return Math.abs(cutCoords(p.x,p.z).u)<5.1||nearestRamp(p.x,p.z).distance<3;}))width-=.5;
 const roof=profileLevel(b.at,'street')-BRIDGE_SLAB_DEPTH-(fullSpan?.025:.3),origin=f.point(x,mid),base=fullSpan?heightAt(origin.x,origin.z)+.02:Math.max(heightAt(origin.x,origin.z)+.10,roof-5.2);
 if(roof-base<.7||nearestRamp(origin.x,origin.z).distance<3)return undefined;
 const back=f.point(x+side*.17,mid),wallYaw=Math.atan2(f.matrix.elements[8],f.matrix.elements[10]);
 return {b,f,side,x,mid,width,roof,base,back,wallYaw,solid:{x:back.x,y:(base+roof)/2,z:back.z,hx:.15,hy:(roof-base)/2,hz:width/2,yaw:wallYaw,kind:'mural-abutment'}};
}

/** Cover the concrete without stretching the original photographed artwork. */
export function muralCoverCrop(width:number,height:number,aspect:number){
 const target=width/height;
 return target>aspect?[0,(1-aspect/target)/2,1,(1+aspect/target)/2]:[(1-target/aspect)/2,0,(1+target/aspect)/2,1];
}

function sprayPaintMaterial(map:T.Texture){
 const material=new T.MeshStandardMaterial({map,roughness:1,metalness:0,side:T.FrontSide,polygonOffset:true,polygonOffsetFactor:-1});
 // The wall paint follows the concrete's world-space pores.
 // No frame, glossy paper layer, additional lighting, or per-frame texture work.
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vPaintWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvPaintWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader='varying vec3 vPaintWorld;\nfloat paintGrain(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898,78.233,37.719))) * 43758.5453); }\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat pores = paintGrain(vPaintWorld * 115.0);\nfloat wear = smoothstep(0.89, 1.0, pores) * 0.18;\ndiffuseColor.rgb = mix(diffuseColor.rgb * (0.93 + pores * 0.07), vec3(0.32,0.33,0.30), wear);');
 };
 material.customProgramCacheKey=()=> 'cut-concrete-spray-v1';
 material.userData.finish='spray paint on concrete';
 return material;
}

export async function buildCutMurals(world:SceneryWorld,groupAt:(x:number,z:number)=>T.Group){
 const urls=[
  new URL('../../art/cut-murals/ivanmontoyamural.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/sydneyjames2.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/freddymural.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/fel3000mural.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/carsmuraldequindrecut.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/we-are-detroit-user.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/blue-dragon-user.jpg',import.meta.url).href,
  new URL('../../art/cut-murals/hdl-user.jpg',import.meta.url).href,
  new URL('../../art/supplied-murals-20261004/red-graffiti-wide.webp',import.meta.url).href,
  new URL('../../art/supplied-murals-20261004/red-graffiti-wall.webp',import.meta.url).href,
  new URL('../../art/supplied-murals-20261004/red-graffiti-close.webp',import.meta.url).href,
  new URL('../../art/supplied-murals-20261004/hooded-portrait.webp',import.meta.url).href,
  new URL('../../art/supplied-murals-20261004/golden-abstract.webp',import.meta.url).href,
 ];
 const maps=await Promise.all(urls.map(u=>new T.TextureLoader().loadAsync(u)));
 const materials=maps.map(map=>{map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return new T.MeshStandardMaterial({map,roughness:1,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});});
 const panel=(points:T.Vector3[],crop:readonly number[],material:T.Material,name:string,readableFront=false)=>{
  const [u0,v0,u1,v1]=crop,g=new T.BufferGeometry();g.setFromPoints(points);g.setIndex([0,1,2,0,2,3]);
  // Same handedness correction as the route art; preserve signatures and readable lettering.
  g.setAttribute('uv',new T.Float32BufferAttribute(readableFront?[u0,v0,u1,v0,u1,v1,u0,v1]:[u1,v0,u0,v0,u0,v1,u1,v1],2));g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.name=name;mesh.receiveShadow=true;const p=points[0];groupAt(p.x,p.z).add(mesh);
 };
 let walls=0;
 CUT_MURALS.forEach((site,i)=>{
  const placement=muralBacking(site);if(!placement)return;
  const {f,side,x,mid,width,roof,base,back,wallYaw,solid}=placement;
  // A shallow concrete art return brings the abutment artwork down to trail
  // level; the simplified outer road supports otherwise bury it in the bank.
  const za=mid-width/2,zb=mid+width/2;
  const backing=new T.Mesh(new T.BoxGeometry(.3,roof-base,width),new T.MeshStandardMaterial({color:'#a4a197',roughness:1}));
  backing.position.set(back.x,(base+roof)/2,back.z);backing.rotation.y=wallYaw;backing.receiveShadow=true;groupAt(back.x,back.z).add(backing);
  world.solids.push(solid);world.addBox(solid);
  const vertex=(xx:number,y:number,z:number)=>{const p=f.point(xx,z);return new T.Vector3(p.x,y,p.z);};
  const [u0,v0,u1,v1]=site.crop,split=site.ceiling?v0+(v1-v0)*.68:v1;
  // Order the face along the trail consistently on either bank.
  const a=side<0?za:zb,c=side<0?zb:za;
  const artTop=site.artist.startsWith('Mike Han')?Math.min(roof,base+width/5.6):roof;
  panel([vertex(x,base,a),vertex(x,base,c),vertex(x,artTop,c),vertex(x,artTop,a)],[u0,v0,u1,split],materials[i],site.artist+' — '+site.year+' — '+site.bridge);walls++;
 });
 // The surviving freestanding HDL wall between Larned and Lafayette.
 const p=cutPoint(615,-9.2),look=cutPoint(615),yaw=Math.atan2(look.x-p.x,look.z-p.z),base=heightAt(p.x,p.z),w=12,h=4.5;
 const concrete=new T.MeshStandardMaterial({color:'#8b897a',roughness:1});
 const block=new T.Mesh(new T.BoxGeometry(w,h,.45),concrete);block.position.set(p.x,base+h/2,p.z);block.rotation.y=yaw;block.castShadow=block.receiveShadow=true;groupAt(p.x,p.z).add(block);
 const s={x:p.x,y:base+h/2,z:p.z,hx:w/2,hy:h/2,hz:.225,yaw,kind:'mural-wall'};world.solids.push(s);world.addBox(s);
 const v=(u:number,y:number)=>new T.Vector3(p.x+Math.cos(yaw)*u+Math.sin(yaw)*.242,y,p.z-Math.sin(yaw)*u+Math.cos(yaw)*.242);
 panel([v(-w/2,base),v(w/2,base),v(w/2,base+h),v(-w/2,base+h)],[.033,.23,.965,.99],materials[7],'Hygienic Dress League — 2014');walls++;
 SUPPLIED_CUT_MURALS.forEach((site,i)=>{
  const placement=muralBacking(site,true);if(!placement)throw Error('No clear wall for supplied mural: '+site.bridge);
  const {f,side,x,mid,width,roof,base,back,wallYaw,solid}=placement;
  const backing=new T.Mesh(new T.BoxGeometry(.3,roof-base,width),concrete);backing.position.set(back.x,(base+roof)/2,back.z);backing.rotation.y=wallYaw;backing.receiveShadow=true;groupAt(back.x,back.z).add(backing);world.solids.push(solid);world.addBox(solid);
  const paint=sprayPaintMaterial(maps[8+i]);
  const a=mid+(side<0?1:-1)*width/2,c=mid-(side<0?1:-1)*width/2;
  const vertex=(y:number,z:number)=>{const p=f.point(x,z);return new T.Vector3(p.x,y,p.z);};
  panel([vertex(base,a),vertex(base,c),vertex(roof,c),vertex(roof,a)],muralCoverCrop(width,roof-base,site.aspect),paint,site.title+' / supplied game mural / '+site.bridge,true);walls++;
 });
 // Every bridge roof and beam keeps its original concrete material.
 return {walls,ceilings:0,suppliedFinish:'full concrete walls, spray paint',source:'Detroit Riverfront Conservancy Art Walk 2025 plus five user-supplied game murals',placements:'approximate'};
}
