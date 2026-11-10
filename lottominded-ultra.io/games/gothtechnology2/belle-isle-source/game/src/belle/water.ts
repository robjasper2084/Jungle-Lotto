import {skyRadiance} from './volumetricSky.ts';
import {RIVER_BROAD_NORMALS} from './riverSurfaceDetail.ts';
import {riverFarRing,RIVER_PATCH_SIZE,RIVER_PATCH_SEGMENTS} from './riverPatch.ts';
import {createFountainLighting,FOUNTAIN_COLOR_UNIFORMS} from './fountainLighting.ts';
import type {ShipWake} from './riverTraffic.ts';
import {scottLayout} from './fountainLayout.ts';
import {realisticWaterNormal} from './realisticMaterials.ts';
import * as T from 'three';
import {KOI_POND_ID} from './waterFeatures.ts';
import {inside,type ParkMap,type Point,type ParkTerrain} from './terrain.ts';
export function waterLevel(map:ParkMap,x:number,z:number){return map.water.some(w=>inside(x,z,w.points)&&!w.holes.some(h=>inside(x,z,h)))?1.05:0;}
type Vehicle={x:number;y:number;z:number;speed:number;rpm:number}|null;
/** Geographic water surfaces with a bounded near-field mesh and vehicle displacement. */
export function createWater(scene:T.Scene,renderer:T.WebGLRenderer,map:ParkMap,terrain:ParkTerrain,polygon:(p:Point[],y:number,holes?:Point[][])=>T.BufferGeometry){
 const fountainNight={value:0},fountain=scottLayout(map),fountainLighting=createFountainLighting();const reflectionTint={value:new T.Color(1,1,1)},skyLight={value:1};
 const riverSunDirection={value:new T.Vector3(0,1,0)},riverSunGlint={value:0};
 const time={value:0},centre={value:new T.Vector2()},vehicle={value:new T.Vector4(0,0,0,0)},ripples={value:Array.from({length:12},()=>new T.Vector4(0,0,-100,0))};const shipWake={value:Array.from({length:4},()=>new T.Vector4())},shipShape={value:Array.from({length:4},()=>new T.Vector4())};let active:Vehicle=null,lastRipple=0,cursor=0;
 const pixels=new Uint8Array(128*128*4);const field=(x:number,y:number)=>Math.sin(x*.147+y*.196+1.7*Math.sin(y*.098))+Math.sin(x*.294-y*.245+.8*Math.sin(x*.098))*.45+Math.sin(x*.687+y*.54)*.18;
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;pixels[i]=128+Math.round((field(x+1,y)-field(x-1,y))*70);pixels[i+1]=128+Math.round((field(x,y+1)-field(x,y-1))*70);pixels[i+2]=pixels[i+3]=255;}
 const normals=realisticWaterNormal()??new T.DataTexture(pixels,128,128);normals.wrapS=normals.wrapT=T.RepeatWrapping;normals.magFilter=T.LinearFilter;normals.minFilter=T.LinearMipmapLinearFilter;normals.generateMipmaps=true;normals.needsUpdate=true;
 const uniformHeader='uniform sampler2D tracedSky;uniform float tracedSkyReady;'+FOUNTAIN_COLOR_UNIFORMS+'uniform float fountainNight;uniform vec2 fountainCentre;uniform vec3 riverSkyTint;uniform vec3 riverSunDirection;uniform float riverSunGlint;uniform float riverTime;uniform sampler2D riverNormals;uniform vec2 riverCentre;uniform vec4 hoverWash;uniform vec4 riverRipples[12];uniform vec4 shipWake[4];uniform vec4 shipShape[4];varying vec3 riverWorld;';
 function material(kind:'near'|'far'|'lagoon'){
  const m=new T.MeshPhysicalMaterial({color:kind==='lagoon'?0x284b48:0x50859f,roughness:kind==='lagoon'?.12:.28,metalness:kind==='lagoon'?.08:.035,envMapIntensity:kind==='lagoon'?1.15:.85,clearcoat:kind==='lagoon'?.60:0,clearcoatRoughness:.15});
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{tracedSky:skyRadiance.texture,tracedSkyReady:skyRadiance.ready,...fountainLighting.uniforms,fountainNight,fountainCentre:{value:new T.Vector2(fountain.x,fountain.z)},riverSkyTint:reflectionTint,riverSunDirection,riverSunGlint,riverTime:time,riverNormals:{value:normals},riverCentre:centre,hoverWash:vehicle,riverRipples:ripples,shipWake,shipShape});
   shader.vertexShader='uniform float riverTime;uniform vec2 riverCentre;varying vec3 riverWorld;\n'+shader.vertexShader;
   if(kind==='near')shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec2 wp=(modelMatrix*vec4(transformed,1.)).xz;
float edge=1.-smoothstep(165.,195.,max(abs(wp.x-riverCentre.x),abs(wp.y-riverCentre.y)));
transformed.y+=(sin(dot(wp,vec2(.48,.34))-riverTime*1.3)*.075+sin(dot(wp,vec2(-.31,.63))-riverTime*1.06)*.045+sin(dot(wp,vec2(.14,-.19))-riverTime*.66)*.08)*edge;
`);
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nriverWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=uniformHeader+'\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',"#include <lights_fragment_end>\nreflectedLight.indirectSpecular*=riverSkyTint;\nif(tracedSkyReady>.5){\n vec3 worldN=inverseTransformDirection(normal,viewMatrix);\n vec3 ray=reflect(normalize(riverWorld-cameraPosition),worldN);\n vec2 skyUV=vec2(atan(ray.z,ray.x)*.15915494+.5,asin(clamp(ray.y,-1.,1.))*.318309886+.5);\n vec3 sky=texture2D(tracedSky,skyUV).rgb;\n float fresnel=.025+.975*pow(1.-max(0.,dot(normalize(cameraPosition-riverWorld),worldN)),5.);\n reflectedLight.indirectSpecular=mix(reflectedLight.indirectSpecular,sky*fresnel,.82);\n}");
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec2 p=riverWorld.xz;float viewDistance=length(cameraPosition-riverWorld);
// Near and far geometry meet on shared boundary vertices; no fragment-cut seam.
${kind==='lagoon'?`vec2 r1=texture2D(riverNormals,p*.041+vec2(riverTime*.016,-riverTime*.011)).rg*2.-1.;
vec2 r2=texture2D(riverNormals,vec2(p.y,-p.x)*.089+vec2(-riverTime*.012,riverTime*.008)).rg*2.-1.;
`:`// Two existing normal samples, decorrelated in world space: no new samplers.
vec2 warp=vec2(sin(dot(p,vec2(.011,.023))),sin(dot(p,vec2(-.019,.013))+1.7))*.55;
vec2 r1=texture2D(riverNormals,mat2(.94,-.342,.342,.94)*p*.033+warp+vec2(riverTime*.016,-riverTime*.011)).rg*2.-1.;
vec2 r2=texture2D(riverNormals,mat2(.55,.835,-.835,.55)*p*.071+warp.yx*.7+r1*.08+vec2(-riverTime*.012,riverTime*.008)).rg*2.-1.;
`}
float micro=1.-smoothstep(35.,650.,viewDistance);
vec2 wave=(r1+r2*.48)*${kind==='lagoon'?'.065':'.15'}*(.18+.82*micro);
// Sheltered inland lakes retain fine ripples, not the river's rolling swell.
wave+=(cos(dot(p,vec2(.48,.34))-riverTime*1.3)*vec2(.036,.0255)+cos(dot(p,vec2(-.31,.63))-riverTime*1.06)*vec2(-.014,.028)+cos(dot(p,vec2(.14,-.19))-riverTime*.66)*vec2(.011,-.015))*${kind==='lagoon'?'.22':'(.06+.34*(1.-smoothstep(35.,220.,viewDistance)))'};
${kind==='lagoon'?'':`// Filter subpixel normal detail instead of letting distant ripples form moire.
// World-space derivatives keep the same finish on both connected river meshes.
float riverFootprint=max(length(dFdx(p)),length(dFdy(p)));
float riverNormalVisibility=(.025+.975*(1.-smoothstep(45.,360.,viewDistance)))*(1.-smoothstep(.35,2.5,riverFootprint));
wave*=riverNormalVisibility;
${RIVER_BROAD_NORMALS}
`}
vec2 delta=p-hoverWash.xy;float radius=length(delta);float wash=hoverWash.z*exp(-radius*.42);wave+=delta/max(.1,radius)*sin(radius*6.-riverTime*9.)*wash*.22;
float wakeFoam=0.;
for(int i=0;i<12;i++){vec4 r=riverRipples[i];float age=riverTime-r.z;float dist=length(p-r.xy);float ring=dist-age*1.8;float envelope=exp(-abs(ring)*2.2)*max(0.,1.-age/5.)*r.w;wave+=(p-r.xy)/max(.1,dist)*cos(ring*8.)*envelope*.12;wakeFoam+=envelope*.16;}
// Only the nearest four moving vessels affect water normals. Foam uses bounded meshes.
for(int j=0;j<4;j++){vec4 origin=shipWake[j],shape=shipShape[j];vec2 offset=p-origin.xy;float aft=-dot(offset,origin.zw),side=dot(offset,vec2(origin.w,-origin.z));
 if(shape.z>0.&&aft>0.&&aft<shape.x&&abs(side)<shape.y+aft*.32){float edge=abs(side)-shape.y*.42-aft*.22;float envelope=exp(-abs(edge)/max(1.,shape.y*.14))*(1.-aft/shape.x)*shape.z;wave+=vec2(origin.w,-origin.z)*sign(side)*cos(edge*1.3-riverTime*2.)*envelope*.10;}}
normal=normalize(mat3(viewMatrix)*vec3(wave.x,1.,wave.y));
`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 washDelta=riverWorld.xz-hoverWash.xy;float washR=length(washDelta);float washFoam=hoverWash.z*exp(-abs(washR-2.1)*1.1)*(.4+.6*texture2D(riverNormals,riverWorld.xz*.3+riverTime*.03).r);
float rippleFoam=0.;for(int i=0;i<12;i++){vec4 rr=riverRipples[i];float age=riverTime-rr.z;float ring=length(riverWorld.xz-rr.xy)-age*1.8;rippleFoam+=exp(-abs(ring)*3.)*max(0.,1.-age/5.)*rr.w*.15;}
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.5,.66,.65),clamp(washFoam*.4+rippleFoam,0.,.58));
`);
   if(kind!=='lagoon')shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
 // Atmospheric photo glint: the actual sun, moving ripples and viewer reflection.
 // Uses the already-calculated water normal wave and no additional textures.
 vec3 riverSunReflection=reflect(-normalize(riverSunDirection),normalize(vec3(wave.x*.65,1.,wave.y*.65)));
 float riverSunAlignment=max(0.,dot(normalize(cameraPosition-riverWorld),riverSunReflection));
 float riverSunWide=pow(riverSunAlignment,42.);
 float riverSunCore=pow(riverSunAlignment,170.);
 float riverSunSparkle=.78+.22*clamp((r1.x+r2.y)*riverNormalVisibility,-1.,1.);
 totalEmissiveRadiance+=vec3(1.,.79,.52)*min(1.,riverSunGlint*(riverSunWide*.16+riverSunCore*.85)*riverSunSparkle);
`);
   if(kind==='lagoon')shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
 // Reflected lamps lie on the sight line to virtual light sources beneath the water plane.
 vec3 lightReflection=vec3(0.);float localPool=1.-smoothstep(115.,150.,length(riverWorld.xz-fountainCentre));
 for(int j=0;j<8;j++){float a=float(j)*.785398;vec2 lightXZ=fountainCentre+vec2(sin(a),cos(a))*14.;
  float eyeHeight=max(.2,cameraPosition.y-riverWorld.y);float t=eyeHeight/(eyeHeight+5.);
  vec2 hit=mix(cameraPosition.xz,lightXZ,t),ray=normalize(lightXZ-cameraPosition.xz+vec2(.0001));
  vec2 d=riverWorld.xz-hit;float across=dot(d,vec2(-ray.y,ray.x)),along=dot(d,ray);
  float ripple=sin(riverWorld.x*6.+riverWorld.z*4.7-riverTime*1.8)*.18;
  float streak=exp(-pow((across+ripple)/1.5,2.)-abs(along)/12.);
  float glint=.3+.7*pow(.5+.5*sin(riverWorld.x*2.+riverWorld.z*5.2+riverTime*1.6),4.);
  vec3 c=mix(fountainPrimary,fountainSecondary,.5+.5*sin(a*2.+.9));lightReflection+=c*streak*glint*.65;
 }
 totalEmissiveRadiance+=lightReflection*fountainNight*localPool;
 `);
  };m.customProgramCacheKey=()=>kind+'-reactive-water-multiscale-ring-v10';return m;
 }
 const ring=riverFarRing(),farGeometry=new T.BufferGeometry();farGeometry.setAttribute('position',new T.Float32BufferAttribute(ring.positions,3));farGeometry.setAttribute('uv',new T.Float32BufferAttribute(ring.uv,2));farGeometry.setIndex(ring.indices);farGeometry.computeVertexNormals();
 const far=new T.Mesh(farGeometry,material('far'));far.name='Detroit River distant water';scene.add(far);
 const near=new T.Mesh(new T.PlaneGeometry(RIVER_PATCH_SIZE,RIVER_PATCH_SIZE,RIVER_PATCH_SEGMENTS,RIVER_PATCH_SEGMENTS).rotateX(-Math.PI/2),material('near'));near.name='Detroit River rolling waves';near.frustumCulled=false;scene.add(near);
 const lagoon=material('lagoon');const koiPond=map.waterSources?.find(w=>w.id===KOI_POND_ID);const isKoi=(w:ParkMap['water'][number])=>!!koiPond&&inside(1336,1149,w.points);const pond=material('lagoon');pond.transparent=true;pond.opacity=.42;pond.depthWrite=false;pond.color.set(0x75958a);pond.roughness=.18;
 for(const w of map.water){const koi=isKoi(w),mesh=new T.Mesh(polygon(w.points,1.05,w.holes),koi?pond:lagoon);mesh.name=koi?'Koi pond · clear surface':'Lagoon · '+w.name;scene.add(mesh);if(koi){const bed=new T.Mesh(polygon(w.points,.2,w.holes),new T.MeshStandardMaterial({color:0x685f47,roughness:.95}));bed.name='Koi pond gravel bed';scene.add(bed);}}

 // Separate shallow foam ribbons use the actual mapped shoreline, including islands in ponds.
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 function shore(points:Point[],level:number,waterInside:boolean){
  let signed=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];signed+=a[0]*b[1]-b[0]*a[1];}const sign=Math.sign(signed)*(waterInside?-1:1);let distance=0;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.02)continue;const nx=dz/len*sign,nz=-dx/len*sign,base=positions.length/3;
   positions.push(a[0]+nx*.08,level+.035,a[1]+nz*.08,b[0]+nx*.08,level+.035,b[1]+nz*.08,a[0]+nx*2.3,level+.035,a[1]+nz*2.3,b[0]+nx*2.3,level+.035,b[1]+nz*2.3);uv.push(distance,0,distance+len,0,distance,1,distance+len,1);indices.push(base,base+1,base+2,base+1,base+3,base+2);distance+=len;
  }
 }
 shore(map.island,0,false);shore(map.mainland,0,false);for(const i of map.outerIslets||[])shore(i.points,0,false);for(const w of map.water){if(isKoi(w))continue;shore(w.points,1.05,true);for(const h of w.holes)shore(h,1.05,false);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
 const foam=new T.Mesh(geo,new T.ShaderMaterial({uniforms:{time,skyLight},transparent:true,depthWrite:false,side:T.DoubleSide,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float skyLight;uniform float time;varying vec2 vUv;void main(){float wave=sin(vUv.x*.63-time*.8)*.15+sin(vUv.x*1.77+time*.4)*.08;float band=exp(-pow((vUv.y-(.25+.13*sin(time*.9+vUv.x*.09)+wave))/.16,2.));float flecks=smoothstep(-.3,.7,sin(vUv.x*8.+sin(vUv.y*22.+time))*sin(vUv.x*3.1-vUv.y*15.-time));float alpha=band*flecks*.42*(1.-smoothstep(.7,1.,vUv.y));gl_FragColor=vec4(vec3(.64,.75,.72)*skyLight,alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));foam.name='Moving shoreline foam';scene.add(foam);
 return {setShipWakes(wakes:ShipWake[]){for(let i=0;i<4;i++){const w=wakes[i];if(w){shipWake.value[i].set(w.x,w.z,w.dx,w.dz);shipShape.value[i].set(w.length,w.width,w.power,0);}else shipShape.value[i].set(0,0,0,0);}},setFountainNight(n:number){fountainNight.value=n;},setLighting(tint:T.Color,light:number,sun?:T.Vector3,glint=0){reflectionTint.value.copy(tint);skyLight.value=light;
  if(sun&&sun.lengthSq()>.000001)riverSunDirection.value.copy(sun).normalize();
  riverSunGlint.value=Number.isFinite(glint)?T.MathUtils.clamp(glint,0,1):0;
 },setVehicle(p:Vehicle){active=p;},setQuality(q:string){near.visible=true;foam.visible=q!=='smooth';},update(t:number,camera:T.Camera){time.value=t;fountainLighting.update(t);const eye=new T.Vector3();camera.getWorldPosition(eye);near.position.set(Math.round(eye.x/2)*2,0,Math.round(eye.z/2)*2);far.position.copy(near.position);centre.value.set(near.position.x,near.position.z);
   if(active&&!terrain.land(active.x,active.z)){const level=waterLevel(map,active.x,active.z),power=active.rpm*Math.max(0,1-Math.max(0,active.y-level)/7);vehicle.value.set(active.x,active.z,power,level);if(power>.05&&t-lastRipple>.32){ripples.value[cursor].set(active.x,active.z,t,power);cursor=(cursor+1)%12;lastRipple=t;}}else vehicle.value.z=0;
  }};
}