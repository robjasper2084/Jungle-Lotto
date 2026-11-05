import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';

/** Analytic scattering and wind-driven clouds in one draw; no full-screen pass.
 * Camera translation is removed so split/VR/drone views share a distant sky. */
export class NaturalSky extends Sky {
 private elapsed=0;
 constructor({radianceScale=.52}:{radianceScale?:number}={}){
  super();this.name='Natural daylight, aerial haze and drifting clouds';this.frustumCulled=false;this.renderOrder=-100;
  const m=this.material,u=m.uniforms;
  u.airTime={value:0};u.airDetail={value:1};u.airRain={value:0};u.airHorizon={value:new T.Color('#b6c8ce')};
  // Atmospheric scattering is HDR. Balance it independently of scene exposure
  // so adjusting the sky does not darken riders, trees or the ground.
  u.airRadianceScale={value:Number.isFinite(radianceScale)?T.MathUtils.clamp(radianceScale,.01,1):.52};
  u.cloudCoverage.value=.28;u.turbidity.value=2.6;u.rayleigh.value=1.65;u.mieCoefficient.value=.0045;u.mieDirectionalG.value=.79;
  m.vertexShader=m.vertexShader.replace('vWorldPosition = worldPosition.xyz;','vWorldPosition = cameraPosition + position * 2000.0;')
   .replace('gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );','gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);');
  const start=m.fragmentShader.indexOf('// Clouds'),end=m.fragmentShader.indexOf('gl_FragColor = vec4( texColor, 1.0 );',start);
  if(start<0||end<0)throw Error('Natural sky needs the supported Three Sky shader.');
  m.fragmentShader='uniform float airTime,airDetail,airRain,airRadianceScale;uniform vec3 airHorizon;\n'+m.fragmentShader.slice(0,start)+`
   texColor*=airRadianceScale;
   float day=smoothstep(-.12,.18,vSunDirection.y),gold=1.-smoothstep(.02,.42,vSunDirection.y);
   float morning=gold*(1.-airRain);
   vec2 p=direction.xz/max(.16,direction.y+.12)*2.4+vec2(airTime*.004,airTime*.0016);
   // At low sun, elongated layers read as high wisps rather than white blobs.
   p*=mix(vec2(1.),vec2(.65,2.4),morning);
   float n=noise(p)*.57+noise(p*2.03+3.7)*.28+noise(p*4.07)*.15;
   if(airDetail>.5)n=n*.92+noise(p*8.13)*.08;
   float cover=clamp(cloudCoverage,0.,1.);
   float mask=smoothstep(.65-cover*.38,.82-cover*.30,n)*smoothstep(.015,.20,direction.y);
   float towardSun=max(0.,dot(direction,vSunDirection));
   vec3 shade=mix(vec3(.76,.81,.87),vec3(.30,.22,.17),morning*.82);
   shade=mix(shade,vec3(.24,.29,.34),airRain);
   vec3 lit=mix(vec3(1.10,1.13,1.16),vec3(1.42,.73,.24),morning);
   float edge=1.-smoothstep(.05,.65,mask);
   vec3 cloudColor=mix(shade,lit,clamp(edge*.6+towardSun*.32,0.,1.));
   cloudColor*=mix(.035,1.,day);
   // Amber dawn near the sun fades into cooler clear air above and behind it.
   float dawn=morning*day*(1.-smoothstep(.08,.75,direction.y));
   vec3 dawnColor=mix(vec3(.32,.33,.38),vec3(1.25,.59,.15),pow(towardSun,3.));
   texColor=mix(texColor,min(texColor,vec3(.8)),morning);
   texColor=mix(texColor,dawnColor,dawn*.82);
   texColor=mix(texColor,cloudColor,mask*mix(.94,.68,morning));
   texColor=mix(texColor,airHorizon,1.-smoothstep(-.06,.09,direction.y));
   texColor*=mix(vec3(1.),vec3(1.08,.71,.32),morning*day*(1.-smoothstep(.15,.8,direction.y)));
   float sunDot=clamp(dot(direction,vSunDirection),-1.,1.);
   // A modest photographic halo surrounds a clearly bounded disc; no bloom pass.
   float sunDisc=smoothstep(cos(.014),cos(.012),sunDot);
   float lowSun=(1.-smoothstep(.14,.30,vSunDirection.y))*smoothstep(-.009,.003,vSunDirection.y);
   float halo=exp(-max(0.,1.-sunDot)*1500.);
   texColor+=vec3(.72,.32,.055)*halo*lowSun*(1.-mask*.55)*(1.-airRain);
   texColor=mix(texColor,vec3(5.,2.9,.65),sunDisc*lowSun*(1.-mask*.42)*(1.-airRain*.90));
  `+m.fragmentShader.slice(end);
 }
 update(dt:number,solar:T.Vector3,cloud=.28,rain=0,low=false,reduced=false,paused=false,haze?:T.Color){
  if(!paused&&!reduced)this.elapsed+=Math.max(0,Math.min(.1,dt));
  const u=this.material.uniforms;u.sunPosition.value.copy(solar).normalize();u.airTime.value=this.elapsed;u.airDetail.value=low?0:1;
  u.cloudCoverage.value=T.MathUtils.clamp(cloud,0,1);u.airRain.value=T.MathUtils.clamp(rain,0,1);u.turbidity.value=2.6+cloud*3.8;
  if(haze)u.airHorizon.value.copy(haze);
 }
 get status(){return {kind:'analytic-scattering',cloudTime:this.elapsed,detail:this.material.uniforms.airDetail.value,cloud:this.material.uniforms.cloudCoverage.value};}
 dispose(){this.geometry.dispose();this.material.dispose();this.removeFromParent();}
}
