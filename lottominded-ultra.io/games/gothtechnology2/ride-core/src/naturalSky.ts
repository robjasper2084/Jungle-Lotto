import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';

/** Analytic scattering and wind-driven clouds in one draw; no full-screen pass.
 * Camera translation is removed so split/VR/drone views share a distant sky. */
export class NaturalSky extends Sky {
 private elapsed=0;
 constructor(){
  super();this.name='Natural daylight, aerial haze and drifting clouds';this.frustumCulled=false;this.renderOrder=-100;
  const m=this.material,u=m.uniforms;
  u.airTime={value:0};u.airDetail={value:1};u.airRain={value:0};u.airHorizon={value:new T.Color('#b6c8ce')};
  u.cloudCoverage.value=.28;u.turbidity.value=2.6;u.rayleigh.value=1.65;u.mieCoefficient.value=.0045;u.mieDirectionalG.value=.79;
  m.vertexShader=m.vertexShader.replace('vWorldPosition = worldPosition.xyz;','vWorldPosition = cameraPosition + position * 2000.0;')
   .replace('gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );','gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);');
  const start=m.fragmentShader.indexOf('// Clouds'),end=m.fragmentShader.indexOf('gl_FragColor = vec4( texColor, 1.0 );',start);
  if(start<0||end<0)throw Error('Natural sky needs the supported Three Sky shader.');
  m.fragmentShader='uniform float airTime,airDetail,airRain;uniform vec3 airHorizon;\n'+m.fragmentShader.slice(0,start)+`
   texColor*=.52;
   vec2 p=direction.xz/max(.16,direction.y+.12)*2.4+vec2(airTime*.004,airTime*.0016);
   float n=noise(p)*.57+noise(p*2.03+3.7)*.28+noise(p*4.07)*.15;
   if(airDetail>.5)n=n*.92+noise(p*8.13)*.08;
   float cover=clamp(cloudCoverage,0.,1.);
   float mask=smoothstep(.65-cover*.38,.82-cover*.30,n)*smoothstep(.015,.20,direction.y);
   float day=smoothstep(-.12,.18,vSunDirection.y),gold=1.-smoothstep(.02,.42,vSunDirection.y);
   vec3 shade=mix(vec3(.76,.81,.87),vec3(.24,.29,.34),airRain);
   vec3 lit=mix(vec3(1.10,1.13,1.16),vec3(1.23,.78,.48),gold*.68);
   float edge=1.-smoothstep(.05,.65,mask);
   vec3 cloudColor=mix(shade,lit,clamp(edge*.6+max(0.,dot(direction,vSunDirection))*.32,0.,1.));
   cloudColor*=mix(.035,1.,day);
   texColor=mix(texColor,cloudColor,mask*.94);
   texColor=mix(texColor,airHorizon,1.-smoothstep(-.06,.14,direction.y));
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
