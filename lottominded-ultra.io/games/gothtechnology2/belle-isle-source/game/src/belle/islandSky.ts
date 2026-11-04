import * as T from 'three';
import {moonDirection,meteorFrame} from './nightSky.ts';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {advanceHour,normalizeSky,skyKeyBlend,sunDirection,smooth,cloudShape,SKY_KEYS,type SkySettings} from './skyModel.ts';

// A single background draw with three filtered noise samples, not volumetric ray marching.
function cloudTexture(){
 const size=256,pixels=new Uint8Array(size*size*4);
 const hash=(x:number,y:number)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 const noise=(x:number,y:number,n:number)=>{let ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);const h=(a:number,b:number)=>hash((a+n)%n,(b+n)%n);return T.MathUtils.lerp(T.MathUtils.lerp(h(ix,iy),h(ix+1,iy),u),T.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),u),v);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let f=0,amp=.55;for(let o=0;o<5;o++){const n=8<<o;f+=noise(x/size*n,y/size*n,n)*amp;amp*=.5;}const i=(y*size+x)*4;pixels[i]=Math.round(f*255);pixels[i+1]=Math.round(noise(x/size*64,y/size*64,64)*255);pixels[i+2]=Math.round(noise(x/size*128,y/size*128,128)*255);pixels[i+3]=255;}
 const texture=new T.DataTexture(pixels,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
const fragment=`
uniform vec3 zenith,horizon,warm,cloudColor,sunColor,sunDirection,moonDirection,meteorHead,meteorTail;
uniform sampler2D cloudNoise;
uniform float cloudTime,coverage,density,stretch,cloudScale,overcast,daylight,night,meteorOpacity;
varying vec3 skyDirection;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 d=normalize(skyDirection);float h=max(0.,d.y),towardSun=pow(max(0.,dot(normalize(vec3(d.x,.001,d.z)),normalize(vec3(sunDirection.x,.001,sunDirection.z)))),3.);
 vec3 color=mix(horizon,zenith,pow(smoothstep(-.045,.85,d.y),.52));
 float dusk=1.-smoothstep(.04,.48,abs(sunDirection.y));
 color=mix(color,warm,towardSun*exp(-h*4.5)*(.18+.72*dusk));
 float sunDot=dot(d,sunDirection),disc=smoothstep(cos(.0068),cos(.0057),sunDot)*smoothstep(-.04,.015,sunDirection.y);
 float halo=pow(max(0.,sunDot),80.)*.22+pow(max(0.,sunDot),900.)*.3;
 color+=sunColor*(halo+disc*5.)*smoothstep(-.05,.025,sunDirection.y);
 float cover=0.;
 if(d.y>-.02&&coverage>.001){
  vec2 uv=d.xz/(max(.065,d.y)+.18)*.24*cloudScale;
  uv=mat2(.94,-.342,.342,.94)*uv;uv.x/=stretch;
  vec2 drift=vec2(cloudTime*.00035,cloudTime*.00014);
  vec4 n=texture2D(cloudNoise,uv+drift);
  vec4 n2=texture2D(cloudNoise,uv*2.71-drift*.6+vec2(.31,.62));
  float field=n.r*.83+n2.r*.17;
  float threshold=mix(.73,.33,coverage);
  cover=smoothstep(threshold-.025,threshold+.085,field)*density*smoothstep(.015,.18,d.y);
  float relief=clamp((field-threshold)*3.+n.g*.22,0.,1.);
  vec3 shade=cloudColor*mix(.48,1.05,relief);
  float silver=pow(max(0.,sunDot),9.)*(1.-smoothstep(.18,.72,cover))*cover;
  shade+=sunColor*silver*(.15+.5*daylight);
  shade=mix(shade,warm*.65,towardSun*dusk*.48);
  color=mix(color,shade,cover);
  // Thin, higher streaks break up the lower bank without a repeated cloud stamp.
  vec2 highUV=d.xz/(max(.1,d.y)+.2)*vec2(.045,.32)+drift*.35;
  float veil=smoothstep(.50,.69,texture2D(cloudNoise,highUV).r)*.17*density*smoothstep(.02,.3,d.y);
  color=mix(color,cloudColor,veil);
 }
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
 let titlePreview=false;let hour=settings.hour,cloudClock=0,skyClock=0,reduceMotion=false,shadowQuality=true;
 const uniforms={zenith:{value:new T.Color()},horizon:{value:new T.Color()},warm:{value:new T.Color()},cloudColor:{value:new T.Color()},sunColor:{value:new T.Color()},sunDirection:{value:new T.Vector3()},moonDirection:{value:new T.Vector3()},meteorHead:{value:new T.Vector3()},meteorTail:{value:new T.Vector3()},meteorOpacity:{value:0},cloudNoise:{value:cloudTexture()},cloudTime:{value:0},coverage:{value:0},density:{value:0},stretch:{value:1},cloudScale:{value:1},overcast:{value:0},daylight:{value:1},night:{value:0}};
 const sky=new T.Mesh(new T.SphereGeometry(1,32,16),new T.ShaderMaterial({uniforms,side:T.BackSide,depthWrite:false,depthTest:false,vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',fragmentShader:fragment}));sky.name='Belle Isle changing sky';sky.scale.setScalar(9000);sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);scene.background=null;
 const hemi=new T.HemisphereLight(0xd5e8f8,0x63513a,1.3),key=new T.DirectionalLight(0xffdfb0,2.1);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:.1,far:450});key.shadow.bias=-.0003;key.shadow.normalBias=.035;scene.add(hemi,key,key.target);scene.fog=new T.FogExp2(0xb8c4c9,.00007);
 // Build the reflection probe once. No runtime cubemap captures or texture reuploads.
 try{status('Preparing sky reflections');const hdr=await new HDRLoader().setDataType(T.HalfFloatType).loadAsync('./belle/environment/kloppenheim-06-2k.hdr');hdr.mapping=T.EquirectangularReflectionMapping;const generator=new T.PMREMGenerator(renderer),probe=generator.fromEquirectangular(hdr);scene.environment=probe.texture;generator.dispose();hdr.dispose();}catch(e){console.warn('Sky reflection probe unavailable',e);}
 const paletteColors=new Map(SKY_KEYS.map(k=>[k,Object.fromEntries(['top','horizon','warm','cloud','sun'].map(p=>[p,new T.Color(k[p as 'top'])])) as Record<string,T.Color>]));
 const lighting={reflection:new T.Color(),light:1,night:0};
 const daylightAmbient=new T.Color('#d8e8f5');
 const eye=new T.Vector3(),lightDirection=new T.Vector3(),tempColor=new T.Color(),fogColor=new T.Color(),reflectionTint=new T.Color();
 const nightUniform={value:0};
 function dressSkyline(root:T.Object3D){const seen=new Set<T.Material>();root.traverse(o=>{if(!(o as T.Mesh).isMesh)return;const mesh=o as T.Mesh;for(const m of(Array.isArray(mesh.material)?mesh.material:[mesh.material]) as T.MeshStandardMaterial[]){if(seen.has(m)||m.name!=='Detroit reflective blue glass')continue;seen.add(m);m.onBeforeCompile=shader=>{shader.uniforms.cityNight=nightUniform;shader.vertexShader='varying vec3 cityWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\ncityWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='varying vec3 cityWorld;uniform float cityNight;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
vec2 face=abs(normal.x)>abs(normal.z)?cityWorld.zy:cityWorld.xy;vec2 cells=face/vec2(2.1,3.6);vec2 p=fract(cells);float seed=fract(sin(dot(floor(cells),vec2(12.9898,78.233)))*43758.5453);float windows=step(.7,seed)*smoothstep(.08,.19,p.x)*(1.-smoothstep(.76,.9,p.x))*smoothstep(.17,.3,p.y)*(1.-smoothstep(.68,.8,p.y));totalEmissiveRadiance+=vec3(.95,.62,.27)*windows*cityNight*1.3;
`);};m.customProgramCacheKey=()=>'detroit-night-windows-v1';m.needsUpdate=true;}});}
 function configure(next:Partial<SkySettings>){settings=normalizeSky({...settings,hour,...next});hour=settings.hour;try{localStorage.setItem('belle-isle-sky-v1',JSON.stringify(settings));}catch{/* storage may be unavailable */}}
 function tick(seconds:number,running:boolean,reduced:boolean){reduceMotion=reduced;if(running&&!reduced)skyClock+=Math.min(Math.max(seconds,0),.1);hour=advanceHour(hour,seconds,settings,running);if(running&&!reduced)cloudClock+=Math.min(Math.max(seconds,0),.1);}
 function update(camera:T.Camera,x:number,z:number){
  const visualHour=titlePreview?18.72:hour;camera.getWorldPosition(eye);sky.position.copy(eye);const shape=cloudShape(titlePreview?'wispy':settings.clouds,visualHour),blend=skyKeyBlend(visualHour),direction=sunDirection(visualHour),day=smooth(-.08,.20,direction[1]),night=1-smooth(-.22,.04,direction[1]);
  for(const [uniform,palette] of [['zenith','top'],['horizon','horizon'],['warm','warm'],['cloudColor','cloud'],['sunColor','sun']] as const){uniforms[uniform].value.copy(paletteColors.get(blend.a)![palette]).lerp(paletteColors.get(blend.b)![palette],blend.t);}
  const lunar=moonDirection(visualHour),meteor=meteorFrame(skyClock,night,reduceMotion);uniforms.moonDirection.value.fromArray(lunar);uniforms.meteorHead.value.fromArray(meteor.head);uniforms.meteorTail.value.fromArray(meteor.tail);uniforms.meteorOpacity.value=meteor.opacity;
  uniforms.sunDirection.value.fromArray(direction);uniforms.daylight.value=day;uniforms.night.value=night;uniforms.coverage.value=shape.coverage;uniforms.density.value=shape.density;uniforms.stretch.value=shape.stretch;uniforms.cloudScale.value=shape.scale;uniforms.overcast.value=shape.overcast;uniforms.cloudTime.value=cloudClock;
  const dim=1-shape.overcast*.58;uniforms.zenith.value.lerp(tempColor.set('#6e7d8b'),shape.overcast*.3*day);uniforms.warm.value.multiplyScalar(1-shape.overcast*.23);
  hemi.color.set('#9aa6b5').lerp(tempColor.copy(uniforms.horizon.value).lerp(daylightAmbient,.55),day);hemi.groundColor.set('#565b63').lerp(tempColor.set('#665d4a'),day);hemi.intensity=.72+day*.48;
  key.color.copy(uniforms.sunColor.value);key.intensity=.10+2.3*day*dim*smooth(-.01,.20,uniforms.sunDirection.value.y);lightDirection.copy(uniforms.sunDirection.value);if(lightDirection.y<0){lightDirection.fromArray(lunar);key.color.set('#c4d0df');key.intensity=.46*night*(1-shape.overcast*.7);}
  key.position.set(x+lightDirection.x*180,lightDirection.y*180,z+lightDirection.z*180);key.target.position.set(x,0,z);key.castShadow=shadowQuality&&key.intensity>.12;
  scene.environmentIntensity=(.16+day*.43)*dim;fogColor.copy(uniforms.horizon.value).lerp(uniforms.warm.value,.10*(1-day));(scene.fog as T.FogExp2).color.copy(fogColor);(scene.fog as T.FogExp2).density=.000055+shape.overcast*.000018;
  nightUniform.value=night;reflectionTint.copy(uniforms.horizon.value).lerp(uniforms.warm.value,.40*(1-smooth(.1,.65,uniforms.sunDirection.value.y))).multiplyScalar(1.8);reflectionTint.lerp(tempColor.setRGB(1,1,1),day*.25);reflectionTint.multiplyScalar(1/Math.max(.1,reflectionTint.r,reflectionTint.g,reflectionTint.b));
  lighting.reflection.copy(reflectionTint);lighting.light=.12+day*.88;lighting.night=night;return lighting;
 }
 return {preview(value:boolean){titlePreview=value;},get renderHour(){return titlePreview?18.72:hour;},nightAmount:nightUniform,configure,synchronize(next:SkySettings){settings=normalizeSky(next);hour=settings.hour;},tick,update,dressSkyline,setQuality(q:string){shadowQuality=q!=='smooth';},get settings(){return {...settings,hour};},get hour(){return hour;}};
}
