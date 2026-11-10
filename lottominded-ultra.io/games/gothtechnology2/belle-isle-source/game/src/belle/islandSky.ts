import {VolumetricSky,skyRadiance} from './volumetricSky.ts';
import {dressDetroitSkyline} from './skylineMaterials.ts';

import * as T from 'three';
import {yieldStartupTask} from './startupWork.ts';
import {BroaderPresentation} from './broaderPresentation.ts';
import {sunsetPhotoGrade,photoShadowExtent} from './photoReferenceGrade.ts';
import {livingSkyFragment,cloudLightFactor} from './skyAtmosphere.ts';
import {SkyLife} from './skyLife.ts';
import {skyFillIntensity} from './visualPolishPolicy.ts';
import {STARTUP_SKIES,startupSkyLook,startupSun} from './startupSky.ts';
import {moonDirection,meteorFrame} from './nightSky.ts';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {advanceHour,normalizeSky,skyKeyBlend,sunDirection,smooth,cloudShape,islandHazeDensity,SKY_KEYS,type SkySettings} from './skyModel.ts';

// Lightweight cloud field remains available as an explicitly selected fallback.
function cloudTexture(){
 const size=512,pixels=new Uint8Array(size*size*4);
 const hash=(x:number,y:number)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 const noise=(x:number,y:number,n:number)=>{let ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);const h=(a:number,b:number)=>hash((a+n)%n,(b+n)%n);return T.MathUtils.lerp(T.MathUtils.lerp(h(ix,iy),h(ix+1,iy),u),T.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),u),v);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let f=0,amp=.55;for(let o=0;o<5;o++){const n=8<<o;f+=noise(x/size*n,y/size*n,n)*amp;amp*=.5;}const i=(y*size+x)*4;pixels[i]=Math.round(f*255);pixels[i+1]=Math.round(noise(x/size*64,y/size*64,64)*255);pixels[i+2]=Math.round(noise(x/size*128,y/size*128,128)*255);pixels[i+3]=255;}
 const texture=new T.DataTexture(pixels,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
const fragment=`
uniform vec3 zenith,horizon,warm,cloudColor,sunColor,sunDirection,moonDirection,meteorHead,meteorTail;
uniform sampler2D cloudNoise,volumeRadiance;
uniform float volumeReady;
uniform float cloudTime,coverage,density,stretch,cloudScale,overcast,daylight,night,meteorOpacity,startupRipples,startupSunset;
varying vec3 skyDirection;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 d=normalize(skyDirection);float h=max(0.,d.y),towardSun=pow(max(0.,dot(normalize(vec3(d.x,.001,d.z)),normalize(vec3(sunDirection.x,.001,sunDirection.z)))),3.);
 vec3 color=mix(horizon,zenith,pow(smoothstep(-.045,.85,d.y),.52));
 float dusk=1.-smoothstep(.04,.48,abs(sunDirection.y));
 color=mix(color,warm,towardSun*exp(-h*4.5)*(.18+.72*dusk));
 // Broad but bounded Mie scattering softens the solar horizon in the reference.
 // Reuses the existing sun vector; no new texture samples or fullscreen passes.
 float photoScatter=(1.-smoothstep(.11,.45,abs(sunDirection.y)))*smoothstep(-.055,.025,sunDirection.y);
 color+=sunColor*pow(max(0.,dot(d,sunDirection)),16.)*photoScatter*.12*exp(-h*2.8)*(1.-overcast*.55);
 // Photo-reference sunset: red at the skyline, amber above it, blue-grey overhead.
 if(startupSunset>.001){
  vec3 bands=mix(horizon,warm,smoothstep(.004,.055,h));
  bands=mix(bands,zenith,smoothstep(.055,.25,h));
  color=mix(color,bands,startupSunset);
 }
 float sunDot=dot(d,sunDirection),disc=smoothstep(cos(.0068),cos(.0057),sunDot)*smoothstep(-.04,.015,sunDirection.y);
 float halo=pow(max(0.,sunDot),80.)*.22+pow(max(0.,sunDot),900.)*.3;
 color+=sunColor*(halo+disc*5.)*smoothstep(-.05,.025,sunDirection.y);
 float cover=0.;

 if(volumeReady<.5&&d.y>-.02&&coverage>.001){
  // Perspective-compressed lower banks and a separate high cirrus layer.
  vec2 uv=d.xz/(max(.045,d.y)+.105)*.22*cloudScale;
  uv=mat2(.94,-.342,.342,.94)*uv;uv.x/=sqrt(stretch);
  vec2 drift=vec2(cloudTime*.00028,cloudTime*.00011);
  vec4 broad=texture2D(cloudNoise,uv*.44+drift*.55);
  vec4 n=texture2D(cloudNoise,uv+drift+vec2(broad.g,broad.b)*.055);
  vec4 detail=texture2D(cloudNoise,uv*3.17-drift*.4+vec2(.31,.62));
  float field=n.r*.73+broad.r*.18+detail.r*.09;
  float threshold=mix(.76,.34,coverage);
  float thickness=smoothstep(threshold-.055,threshold+.13,field);
  float horizonFade=smoothstep(.015,.10,d.y);
  cover=thickness*density*horizonFade;
  vec2 lightOffset=normalize(sunDirection.xz+vec2(.001))*.022;
  float litField=texture2D(cloudNoise,uv+drift+lightOffset).r;
  float edgeLight=clamp((n.r-litField)*8.+.50,0.,1.);
  float volume=clamp((field-threshold)*3.2+detail.g*.12,0.,1.);
  vec3 cloudShadow=mix(cloudColor*.47,vec3(.105,.135,.19),.23*daylight);
  vec3 cloudLight=cloudColor*(.92+edgeLight*.48);
  vec3 shade=mix(cloudShadow,cloudLight,clamp(edgeLight*.5+volume*.62,0.,1.));
  // Warm undersides and a narrow silver lining around sunlit cloud edges.
  float silver=pow(max(0.,sunDot),6.)*pow(1.-thickness,2.)*thickness*5.;
  shade+=sunColor*silver*(.25+.8*daylight);
  shade=mix(shade,warm*(.75+edgeLight*.45),towardSun*dusk*(.38+.25*edgeLight));
  color=mix(color,shade,cover);
  vec2 highUV=mat2(.86,-.50,.50,.86)*(d.xz/(max(.07,d.y)+.16));
  vec4 wisps=texture2D(cloudNoise,highUV*vec2(.075,.64)+drift*.24);
  float ripple=texture2D(cloudNoise,highUV*vec2(.32,1.7)+wisps.gb*.12).g;
  float veil=smoothstep(.43,.69,wisps.r+(.5-ripple)*.12)*(.13+.18*coverage)*density*horizonFade;
  vec3 highColor=mix(cloudColor,warm,towardSun*dusk*.6)*(.82+wisps.g*.35);
  color=mix(color,highColor,veil*(1.-cover*.7));
  cover=clamp(cover+veil*(1.-cover),0.,1.);
 }
 // Light shafts are a bounded analytic scattering approximation, not hardware ray tracing.
 if(volumeReady<.5&&dusk>.1&&d.y>0.&&sunDirection.y>-.035){
  vec3 right=normalize(cross(sunDirection,vec3(0.,1.,0.))),up=cross(right,sunDirection);
  float angle=atan(dot(d,up),dot(d,right));float streak=pow(max(0.,sin(angle*17.+texture2D(cloudNoise,vec2(angle*.13,cloudTime*.0001)).r*5.)),9.);
  color+=sunColor*streak*pow(max(0.,sunDot),22.)*dusk*(1.-cover)*.055;
 }
 if(volumeReady>.5){vec2 panorama=vec2(atan(d.z,d.x)*.15915494+.5,asin(clamp(d.y,-1.,1.))*.318309886+.5);vec4 traced=texture2D(volumeRadiance,panorama);color=traced.rgb;cover=traced.a;}
 // Stars, lunar terrain and brief meteors share the cloud occlusion.
 if(night>.01&&d.y>0.){
  vec2 starUV=vec2(atan(d.z,d.x)*.15915494+.5,asin(clamp(d.y,-1.,1.))*.63661977)*vec2(1300.,650.);
  vec2 cell=floor(starUV),point=fract(starUV)-vec2(.2+.6*hash(cell),.2+.6*hash(cell+23.));
  float aa=max(length(fwidth(starUV))*.55,.12),stars=(1.-smoothstep(.07,.07+aa,length(point)))*step(.999,hash(cell+71.));
  color+=vec3(.62,.68,.76)*stars*(.18+.65*hash(cell+57.))*night*(1.-cover)*smoothstep(.025,.3,d.y);
  float moonDot=dot(d,moonDirection),radius=.009;
  float edge=max(fwidth(moonDot),.000001),moon=smoothstep(cos(radius)-edge,cos(radius)+edge,moonDot);
  vec3 moonRight=normalize(cross(moonDirection,vec3(0.,1.,0.))),moonUp=cross(moonRight,moonDirection);
  vec2 m=vec2(dot(d,moonRight),dot(d,moonUp))/radius;
  float terrain=texture2D(cloudNoise,m*.21+vec2(.31,.67)).r;
  float maria=smoothstep(.41,.59,terrain);
  float crater=texture2D(cloudNoise,m*.87+vec2(.62,.13)).g;
  float sphere=sqrt(max(0.,1.-dot(m,m))),phase=smoothstep(-.34,.15,m.x*.28+sphere*.86);
  vec3 lunar=vec3(.82,.81,.76)*mix(.43,1.,maria)*(.87+.20*crater)*(.65+.35*sphere)*phase;
  float halo=pow(max(0.,moonDot),420.)*.025+pow(max(0.,moonDot),3500.)*.035;
  color+=(lunar*moon*1.55+vec3(.49,.55,.64)*halo)*night*(1.-cover);
  if(meteorOpacity>.001){
   vec3 segment=meteorHead-meteorTail;float t=clamp(dot(d-meteorTail,segment)/max(dot(segment,segment),.000001),0.,1.);
   float dist=length(d-normalize(meteorTail+segment*t)),aa=max(length(fwidth(d))*.6,.00015);
   float trail=(1.-smoothstep(.00025,.0006+aa,dist))*pow(t,1.5);
   float head=1.-smoothstep(.00035,.0011+aa,length(d-meteorHead));
   color+=vec3(.68,.78,1.)*(trail*.65+head)*meteorOpacity*(1.-cover);
  }
 }
 color=mix(color,horizon,(1.-smoothstep(-.13,0.,d.y)));
 gl_FragColor=vec4(max(color,vec3(0.)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export async function createIslandSky(scene:T.Scene,renderer:T.WebGLRenderer,status:(s:string)=>void){
 let settings=normalizeSky(null);try{settings=normalizeSky(JSON.parse(localStorage.getItem('belle-isle-sky-v1')||'null'));}catch{/* defaults */}
 let skyFrame=0,lastVolumeFrame=-1;let titlePreview=false,previewIndex=0;let hour=settings.hour,cloudClock=0,skyClock=0,reduceMotion=false,shadowQuality=true,quality='automatic';
 const uniforms={volumeRadiance:skyRadiance.texture,volumeReady:skyRadiance.ready,startupRipples:{value:0},startupSunset:{value:0},zenith:{value:new T.Color()},horizon:{value:new T.Color()},warm:{value:new T.Color()},cloudColor:{value:new T.Color()},sunColor:{value:new T.Color()},sunDirection:{value:new T.Vector3()},moonDirection:{value:new T.Vector3()},meteorHead:{value:new T.Vector3()},meteorTail:{value:new T.Vector3()},meteorOpacity:{value:0},cloudNoise:{value:cloudTexture()},cloudTime:{value:0},coverage:{value:0},density:{value:0},stretch:{value:1},cloudScale:{value:1},overcast:{value:0},daylight:{value:1},night:{value:0}};
 const sky=new T.Mesh(new T.SphereGeometry(1,32,16),new T.ShaderMaterial({uniforms,side:T.BackSide,depthWrite:false,depthTest:false,vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',fragmentShader:livingSkyFragment(fragment)}));sky.name='Belle Isle changing sky';sky.scale.setScalar(9000);sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);scene.background=null;

 const hemi=new T.HemisphereLight(0xd5e8f8,0x63513a,1.3),key=new T.DirectionalLight(0xffdfb0,2.1);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:.1,far:450});key.shadow.bias=-.0003;key.shadow.normalBias=.035;scene.add(hemi,key,key.target);scene.fog=new T.FogExp2(0xb8c4c9,.00007);
 // The initial HDR remains a fallback; bounded sky-only probes follow live weather.
 try{status('Preparing sky reflections');const hdr=await new HDRLoader().setDataType(T.HalfFloatType).loadAsync('./belle/environment/kloppenheim-06-2k.hdr');hdr.mapping=T.EquirectangularReflectionMapping;const generator=new T.PMREMGenerator(renderer),probe=generator.fromEquirectangular(hdr);scene.environment=probe.texture;generator.dispose();hdr.dispose();}catch(e){console.warn('Sky reflection probe unavailable',e);}
 const broader=new BroaderPresentation(scene,renderer,sky.material,uniforms.cloudNoise.value);
 const volume=new VolumetricSky(renderer,scene);try{volume.enabled=localStorage.getItem('belle-sky-renderer')!=='layered';}catch{}
 const skyQuality=document.createElement('label');skyQuality.textContent='Sky rendering';const skySelect=document.createElement('select');skySelect.id='sky-renderer';skySelect.setAttribute('aria-label','Sky rendering');skySelect.add(new Option('Cinematic · traced cloud lighting','traced'));skySelect.add(new Option('Layered · lower GPU use','layered'));skySelect.value=volume.enabled?'traced':'layered';skyQuality.append(skySelect);document.getElementById('sky-clouds')?.closest('fieldset')?.append(skyQuality);if(!skyQuality.isConnected)document.getElementById('settings')?.append(skyQuality);skySelect.onchange=()=>{volume.enabled=skySelect.value==='traced';try{localStorage.setItem('belle-sky-renderer',skySelect.value);}catch{}};

 const paletteColors=new Map(SKY_KEYS.map(k=>[k,Object.fromEntries(['top','horizon','warm','cloud','sun'].map(p=>[p,new T.Color(k[p as 'top'])])) as Record<string,T.Color>]));
 const previewColors=STARTUP_SKIES.map(k=>Object.fromEntries(['top','horizon','warm','cloud','sun'].map(p=>[p,new T.Color(k[p as 'top'])])) as Record<string,T.Color>);
 const lighting={reflection:new T.Color(),light:1,night:0,sun:new T.Vector3(),glint:0,golden:0};
 const daylightAmbient=new T.Color('#d8e8f5');
 const eye=new T.Vector3(),lightDirection=new T.Vector3(),tempColor=new T.Color(),fogColor=new T.Color(),reflectionTint=new T.Color();
 const referenceHorizon=new T.Color('#dcded7'),referenceZenith=new T.Color('#8daec2'),referenceFog=new T.Color('#d8d4c5');
 const nightUniform={value:0},skyLife=new SkyLife(scene);
 function dressSkyline(root:T.Object3D){const seen=new Set<T.Material>();root.traverse(o=>{if(!(o as T.Mesh).isMesh)return;const mesh=o as T.Mesh;for(const m of(Array.isArray(mesh.material)?mesh.material:[mesh.material]) as T.MeshStandardMaterial[]){if(seen.has(m)||m.name!=='Detroit reflective blue glass')continue;seen.add(m);m.onBeforeCompile=shader=>{shader.uniforms.cityNight=nightUniform;shader.vertexShader='varying vec3 cityWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\ncityWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='varying vec3 cityWorld;uniform float cityNight;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
vec2 face=abs(normal.x)>abs(normal.z)?cityWorld.zy:cityWorld.xy;vec2 cells=face/vec2(2.1,3.6);vec2 p=fract(cells);float seed=fract(sin(dot(floor(cells),vec2(12.9898,78.233)))*43758.5453);float windows=step(.7,seed)*smoothstep(.08,.19,p.x)*(1.-smoothstep(.76,.9,p.x))*smoothstep(.17,.3,p.y)*(1.-smoothstep(.68,.8,p.y));totalEmissiveRadiance+=vec3(.95,.62,.27)*windows*cityNight*1.3;
`);};m.customProgramCacheKey=()=>'detroit-night-windows-v1';m.needsUpdate=true;}});}
 function configure(next:Partial<SkySettings>){settings=normalizeSky({...settings,hour,...next});hour=settings.hour;try{localStorage.setItem('belle-isle-sky-v1',JSON.stringify(settings));}catch{/* storage may be unavailable */}}
 function tick(seconds:number,running:boolean,reduced:boolean){skyFrame++;broader.tick(seconds,running,reduced);reduceMotion=reduced;if(running&&!reduced)skyClock+=Math.min(Math.max(seconds,0),.1);hour=advanceHour(hour,seconds,settings,running);if(running&&!reduced)cloudClock+=Math.min(Math.max(seconds,0),.1);}
 function update(camera:T.Camera,x:number,z:number){
  const look=titlePreview?startupSkyLook(previewIndex):null,visualHour=look?.hour??hour;camera.getWorldPosition(eye);sky.position.copy(eye);const shape=look?.clouds??cloudShape(settings.clouds,visualHour),blend=skyKeyBlend(visualHour),direction=look?startupSun(look):sunDirection(visualHour),day=smooth(-.08,.20,direction[1]),night=1-smooth(-.22,.04,direction[1]);
  for(const [uniform,palette] of [['zenith','top'],['horizon','horizon'],['warm','warm'],['cloudColor','cloud'],['sunColor','sun']] as const){if(look)uniforms[uniform].value.copy(previewColors[STARTUP_SKIES.indexOf(look)][palette]);else uniforms[uniform].value.copy(paletteColors.get(blend.a)![palette]).lerp(paletteColors.get(blend.b)![palette],blend.t);}
  const photoLook=sunsetPhotoGrade(direction[1],shape.overcast,night);
  if(!look){
   uniforms.horizon.value.lerp(referenceHorizon,photoLook.haze*.42);
   uniforms.zenith.value.lerp(referenceZenith,photoLook.warmth*.28);
  }
  uniforms.startupRipples.value=look?.ripples??0;uniforms.startupSunset.value=look?.sunset??(.65*(1-smooth(.04,.28,Math.abs(direction[1]))));

  const lunar=moonDirection(visualHour),meteor=meteorFrame(skyClock,night,reduceMotion);uniforms.moonDirection.value.fromArray(lunar);uniforms.meteorHead.value.fromArray(meteor.head);uniforms.meteorTail.value.fromArray(meteor.tail);uniforms.meteorOpacity.value=meteor.opacity;
  uniforms.sunDirection.value.fromArray(direction);uniforms.daylight.value=day;uniforms.night.value=night;uniforms.coverage.value=shape.coverage;uniforms.density.value=shape.density;uniforms.stretch.value=shape.stretch;uniforms.cloudScale.value=shape.scale;uniforms.overcast.value=shape.overcast;uniforms.cloudTime.value=cloudClock;
  const dim=1-shape.overcast*.58;uniforms.zenith.value.lerp(tempColor.set('#6e7d8b'),shape.overcast*.3*day);uniforms.warm.value.multiplyScalar(1-shape.overcast*.23);
  hemi.color.set('#c0cad7').lerp(tempColor.copy(uniforms.horizon.value).lerp(daylightAmbient,.55),day);hemi.groundColor.set('#727b83').lerp(tempColor.set('#665d4a'),day);hemi.intensity=skyFillIntensity(day,shape.overcast)*(1-photoLook.warmth*.20);
  key.color.copy(uniforms.sunColor.value);key.intensity=.10+2.3*day*dim*smooth(-.01,.20,uniforms.sunDirection.value.y);lightDirection.copy(uniforms.sunDirection.value);if(lightDirection.y<0){lightDirection.fromArray(lunar);key.color.set('#c9dcf3');key.intensity=.72*night*(1-shape.overcast*.45);}
  key.intensity*=cloudLightFactor(cloudClock,shape.coverage,shape.overcast,day,reduceMotion)*(1+photoLook.warmth*.48);
  skyLife.update(skyClock,day,!titlePreview&&!reduceMotion,shadowQuality);
  const extent=photoShadowExtent(eye.y),lightDistance=180+(extent-55)*1.5;
  if(key.shadow.camera.right!==extent){Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,far:450+(extent-55)*3});key.shadow.camera.updateProjectionMatrix();}
  key.position.set(x+lightDirection.x*lightDistance,lightDirection.y*lightDistance,z+lightDirection.z*lightDistance);key.target.position.set(x,0,z);key.castShadow=shadowQuality&&key.intensity>.12;
  scene.environmentIntensity=(.28+day*.31)*dim*(1-photoLook.warmth*.12);fogColor.copy(uniforms.horizon.value).lerp(uniforms.warm.value,.10*(1-day));(scene.fog as T.FogExp2).color.copy(fogColor).lerp(referenceFog,photoLook.haze*.09);(scene.fog as T.FogExp2).density=islandHazeDensity(shape.overcast,night);
  nightUniform.value=night;reflectionTint.copy(uniforms.horizon.value).lerp(uniforms.warm.value,.40*(1-smooth(.1,.65,uniforms.sunDirection.value.y))).multiplyScalar(1.8);reflectionTint.lerp(tempColor.setRGB(1,1,1),day*.25);reflectionTint.multiplyScalar(1/Math.max(.1,reflectionTint.r,reflectionTint.g,reflectionTint.b));
  if(lastVolumeFrame!==skyFrame){lastVolumeFrame=skyFrame;volume.update({sun:uniforms.sunDirection.value,zenith:uniforms.zenith.value,horizon:uniforms.horizon.value,warm:uniforms.warm.value,sunColor:uniforms.sunColor.value,coverage:shape.coverage,density:shape.density,stretch:shape.stretch,scale:shape.scale,time:cloudClock,night});}
  broader.update(visualHour,shape.coverage,day,shape.overcast,uniforms.sunDirection.value,quality,titlePreview,volume.enabled);
  lighting.reflection.copy(reflectionTint);lighting.light=.12+day*.88;lighting.night=night;
  lighting.sun.copy(uniforms.sunDirection.value);lighting.glint=photoLook.glint;lighting.golden=photoLook.foliage;return lighting;
 }
 async function prepareReflections(camera:T.Camera,x:number,z:number){
  const preview=titlePreview;
  try{titlePreview=false;update(camera,x,z);await yieldStartupTask();if(!volume.enabled)broader.prepareReflections(hour,uniforms.coverage.value,quality);}
  finally{titlePreview=preview;update(camera,x,z);}

 }
 return {prepareReflections,protectStartup:()=>broader.protectStartup(),observeFrame:(ms:number,eligible:boolean)=>broader.observeFrame(ms,eligible),preview(value:boolean){titlePreview=value;},previewShot(index:number){previewIndex=index;},get renderHour(){return titlePreview?startupSkyLook(previewIndex).hour:hour;},nightAmount:nightUniform,configure,synchronize(next:SkySettings){settings=normalizeSky(next);hour=settings.hour;},tick,update,dressSkyline,setQuality(q:string){quality=q;shadowQuality=q!=='smooth';},get presentation(){return broader.stats;},dispose(){volume.dispose();broader.dispose();},get settings(){return {...settings,hour};},get hour(){return hour;}};
}
