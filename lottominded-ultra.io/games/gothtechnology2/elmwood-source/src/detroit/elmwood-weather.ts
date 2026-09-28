import * as T from 'three';

export type ElmwoodWeather='clear'|'cloudy'|'rain'|'mist';
export const WEATHER={
 clear:{cloud:.16,rain:0,fog:.00065,wet:0,wind:.4,sun:1,ambient:.72},
 cloudy:{cloud:.80,rain:0,fog:.0016,wet:0,wind:.7,sun:.28,ambient:.64},
 rain:{cloud:.97,rain:1,fog:.0037,wet:1,wind:1.15,sun:.10,ambient:.46},
 mist:{cloud:.58,rain:0,fog:.012,wet:.3,wind:.12,sun:.3,ambient:.62}
} as const;
/** Solar time, not wall-clock time: latitude and seasonal declination define the sun's path. */
export function validElmwoodDate(value:string){
 const d=new Date(value+'T12:00:00Z');
 return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function elmwoodSun(hour:number,date:string){
 if(!validElmwoodDate(date))date='2026-09-15';
 if(!Number.isFinite(hour))hour=14;
 const d=new Date(date+'T12:00:00Z'),day=(d.getTime()-Date.UTC(d.getUTCFullYear(),0,0))/86400000;
 const lat=42.3450366*Math.PI/180,decl=23.44*Math.PI/180*Math.sin(2*Math.PI*(284+day)/365),ha=(hour-12)*Math.PI/12;
 return {x:-Math.cos(decl)*Math.sin(ha),y:Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(ha),z:-(Math.cos(lat)*Math.sin(decl)-Math.sin(lat)*Math.cos(decl)*Math.cos(ha))};
}

export function makeElmwoodWeather(scene:T.Scene,camera:T.Camera,sun:T.DirectionalLight,hemi:T.HemisphereLight,renderer:T.WebGLRenderer){
 const uniforms={time:{value:0},cloud:{value:WEATHER.clear.cloud as number},rain:{value:0},wet:{value:0},wind:{value:.4}};
 let mode:ElmwoodWeather='clear';const state={...WEATHER.clear} as Record<keyof typeof WEATHER.clear,number>;
 const count=900,a=new Float32Array(count*6),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(a,3));
 const rain=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#bbd2d9',transparent:true,opacity:.28,depthWrite:false}));rain.frustumCulled=false;rain.name='Camera-local rain';scene.add(rain);
 const fog=new T.FogExp2('#bcc9c9',.00065),materials=new Set<T.MeshStandardMaterial>();
 const scratch=new T.Color(),direction=new T.Vector3();let elapsed=0,wetness=0;
 function attach(m:T.Material){
  if(!(m instanceof T.MeshStandardMaterial)||materials.has(m)||/water|leaf|glass/i.test(m.name))return;
  materials.add(m);const original=m.onBeforeCompile.bind(m),key=m.customProgramCacheKey(),lawn=/grass|foliage|shrub|stem|petal/i.test(m.name);
  m.onBeforeCompile=(s,r)=>{original(s,r);s.uniforms.elmwoodWet=uniforms.wet;s.fragmentShader='uniform float elmwoodWet;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(${lawn?'.72':'.16'},roughnessFactor*.38),elmwoodWet);`);
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.-elmwoodWet*.20;');};m.customProgramCacheKey=()=>key+'-weather-wet-v1';m.needsUpdate=true;
 }
 return {uniforms,attach,set(value:ElmwoodWeather){if(value in WEATHER)mode=value;},get mode(){return mode;},
 update(dt:number,solar:T.Vector3,visible:boolean,paused=false){
  if(!paused){elapsed+=dt;const blend=1-Math.exp(-dt*.7),target=WEATHER[mode];for(const k of Object.keys(state) as (keyof typeof state)[])state[k]+=(target[k as keyof typeof target]-state[k])*blend;wetness+=(state.wet-wetness)*(1-Math.exp(-dt*(state.wet>wetness?.15:.035)));}
  uniforms.time.value=elapsed;uniforms.cloud.value=state.cloud;uniforms.rain.value=state.rain;uniforms.wet.value=wetness;uniforms.wind.value=state.wind;
  const day=T.MathUtils.smoothstep(solar.y,-.10,.20),gold=1-T.MathUtils.smoothstep(solar.y,.015,.40);
  sun.intensity=Math.max(0,solar.y)*4.1*state.sun;sun.color.set('#fff4df').lerp(scratch.set('#ffa267'),gold*.77);
  hemi.intensity=(.09+day*state.ambient);hemi.color.set('#bacde1').lerp(scratch.set('#d4b9a0'),gold*.3);hemi.groundColor.set('#414738');
  renderer.toneMappingExposure=.72+day*.24;scene.environmentIntensity=.09+day*(.60-state.cloud*.21);
  fog.color.set('#b6c6cd').lerp(scratch.set('#cbb497'),gold*.43).lerp(scratch.set('#222b3a'),1-day);fog.density=state.fog;
  scene.fog=visible?fog:null;rain.visible=visible&&state.rain>.025;
  if(rain.visible&&!paused){
   const x=camera.position.x,y=camera.position.y,z=camera.position.z;camera.getWorldDirection(direction);
   for(let i=0;i<count;i++){const seed=(i*16807%2147483647)/2147483647,fall=(elapsed*(16+(i%7))+(i*.719))%32;
    const px=x+((i*17.313+elapsed*state.wind*2)%38)-19+direction.x*6,pz=z+((i*11.729)%38)-19+direction.z*6,py=y+15-fall;
    a.set([px,py,pz,px-.11*state.wind,py+.30+seed,pz+.045],i*6);
   }geo.attributes.position.needsUpdate=true;(rain.material as T.LineBasicMaterial).opacity=state.rain*.25;
  }
 }};
}

/** Reflection-lit pond surface with crossing wind waves and rain ripples; no extra scene render. */
export function makeElmwoodWater(source:T.MeshStandardMaterial,u:ReturnType<typeof makeElmwoodWeather>['uniforms']){
 const m=new T.MeshPhysicalMaterial({name:source.name,color:'#34554c',roughness:.16,metalness:.08,ior:1.333,reflectivity:.38,envMapIntensity:1.5,clearcoat:.75,clearcoatRoughness:.16});
 m.onBeforeCompile=s=>{s.uniforms.pondTime=u.time;s.uniforms.pondRain=u.rain;s.uniforms.pondWind=u.wind;
  s.vertexShader='varying vec3 pondWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npondWorld=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader='uniform float pondTime,pondRain,pondWind; varying vec3 pondWorld;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec2 p=pondWorld.xz;float t=pondTime;
   vec2 waves=vec2(sin(p.x*.61+p.y*.39+t*1.2)+.36*sin(p.y*2.3-t*1.9),cos(p.y*.75-p.x*.28+t*.9)+.29*sin(p.x*2.7+t*2.1));
   vec2 id=floor(p*1.9),cell=fract(p*1.9)-.5;float seed=fract(sin(dot(id,vec2(127.1,311.7)))*43758.5453);float age=fract(t*1.7+seed*19.);
   float ring=sin((length(cell)-age*.48)*80.)*exp(-pow((length(cell)-age*.48)*18.,2.))*(1.-age)*pondRain*.36;
   normal=normalize(normal+mat3(viewMatrix)*vec3(waves.x*(.045+pondWind*.025)+ring*.07,0.,waves.y*(.045+pondWind*.025)+ring*.07));`);
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.93+.07*sin(pondWorld.x*.25+pondWorld.z*.31);');
 };m.customProgramCacheKey=()=> 'elmwood-reflection-water-v3';return m;
}
