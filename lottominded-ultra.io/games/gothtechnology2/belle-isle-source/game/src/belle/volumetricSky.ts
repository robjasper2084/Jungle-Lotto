import * as T from 'three';

/** Shared linear radiance: water traces its reflection direction into this sky. */
export const skyRadiance={texture:{value:null as T.Texture|null},ready:{value:0}};
type SkyFrame={sun:T.Vector3;zenith:T.Color;horizon:T.Color;warm:T.Color;sunColor:T.Color;coverage:number;density:number;stretch:number;scale:number;time:number;night:number};
function volumeNoise(){
 const n=64,data=new Uint8Array(n*n*n*4);
 const hash=(x:number,y:number,z:number)=>{let a=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1442695041);a=Math.imul(a^(a>>>13),1274126177);return((a^(a>>>16))>>>0)/4294967295;};
 const noise=(x:number,y:number,z:number,size:number)=>{const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let u=x-ix,v=y-iy,w=z-iz;u*=u*(3-2*u);v*=v*(3-2*v);w*=w*(3-2*w);const h=(a:number,b:number,c:number)=>hash((a+size)%size,(b+size)%size,(c+size)%size);const mix=T.MathUtils.lerp;return mix(mix(mix(h(ix,iy,iz),h(ix+1,iy,iz),u),mix(h(ix,iy+1,iz),h(ix+1,iy+1,iz),u),v),mix(mix(h(ix,iy,iz+1),h(ix+1,iy,iz+1),u),mix(h(ix,iy+1,iz+1),h(ix+1,iy+1,iz+1),u),v),w);};
 for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=((z*n+y)*n+x)*4;const a=noise(x/8,y/8,z/8,8),b=noise(x/4,y/4,z/4,16),c=noise(x/2,y/2,z/2,32);data[i]=Math.round((a*.66+b*.25+c*.09)*255);data[i+1]=Math.round(b*255);data[i+2]=Math.round(c*255);data[i+3]=255;}
 const tex=new T.Data3DTexture(data,n,n,n);tex.format=T.RGBAFormat;tex.type=T.UnsignedByteType;tex.minFilter=tex.magFilter=T.LinearFilter;tex.wrapS=tex.wrapT=tex.wrapR=T.RepeatWrapping;tex.unpackAlignment=1;tex.needsUpdate=true;return tex;
}
const vertex='in vec3 position;in vec2 uv;out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const fragment=String.raw`
precision highp float;precision highp sampler3D;
in vec2 vUv;out vec4 outputColor;
uniform sampler3D volumeNoise;
uniform vec3 sun,zenith,horizon,warm,sunColor;
uniform float coverage,density,stretch,cloudScale,cloudTime,night;
const float PI=3.14159265359,EARTH=6371000.,BASE=950.,TOP=2650.;
float height(vec3 p){return length(p+vec3(0.,EARTH,0.))-EARTH;}
float cloud(vec3 p,bool detail){
 float h=(height(p)-BASE)/(TOP-BASE);if(h<0.||h>1.)return 0.;
 vec3 q=(p+vec3(cloudTime*9.,0.,cloudTime*3.))*vec3(.00012/sqrt(stretch),.00021,.00012)*cloudScale;
 vec4 n=texture(volumeNoise,q+vec3(.17,.61,.39));
 float threshold=.73-coverage*.43+pow(h,2.)*.16;
 float shape=max(0.,n.r-threshold)*3.5;
 if(detail){vec4 erosion=texture(volumeNoise,q*3.7+vec3(.37,.11,.63));shape=max(0.,shape-(1.-erosion.g)*.13*(1.-min(1.,shape)));}
 return shape*smoothstep(0.,.12,h)*(1.-smoothstep(.82,1.,h))*density;
}
float shell(vec3 rd,float altitude){vec3 o=vec3(0.,EARTH+4.,0.);float b=dot(o,rd),c=dot(o,o)-(EARTH+altitude)*(EARTH+altitude);return -b+sqrt(max(0.,b*b-c));}
float hg(float mu,float g){return (1.-g*g)/pow(max(.02,1.+g*g-2.*g*mu),1.5);}
vec3 clearSky(vec3 d){
 float h=max(0.,d.y),toward=pow(max(0.,dot(normalize(vec3(d.x,.001,d.z)),normalize(vec3(sun.x,.001,sun.z)))),3.);
 float dusk=1.-smoothstep(.04,.48,abs(sun.y));
 vec3 c=mix(horizon,zenith,pow(smoothstep(-.045,.85,d.y),.52));
 c=mix(c,warm,toward*exp(-h*4.5)*(.18+.72*dusk));
 vec3 bands=mix(horizon,warm,smoothstep(.004,.055,h));bands=mix(bands,zenith,smoothstep(.055,.25,h));
 c=mix(c,bands,.6*(1.-smoothstep(.04,.28,abs(sun.y))));
 float mu=dot(d,sun),disc=smoothstep(cos(.0068),cos(.0057),mu);
 c+=sunColor*(pow(max(0.,mu),80.)*.22+pow(max(0.,mu),900.)*.3+disc*6.)*smoothstep(-.05,.025,sun.y);
 return c;
}
void main(){
 float lon=(vUv.x-.5)*2.*PI,lat=(vUv.y-.5)*PI;
 vec3 d=vec3(cos(lon)*cos(lat),sin(lat),sin(lon)*cos(lat));vec3 background=clearSky(d);
 if(d.y<.002||coverage<.01){outputColor=vec4(background,0.);return;}
 float start=shell(d,BASE),finish=min(shell(d,TOP),120000.);
 if(finish<=start){outputColor=vec4(background,0.);return;}
 float stepSize=(finish-start)/64.;float jitter=fract(sin(dot(floor(vUv*vec2(2048.,1024.)),vec2(12.9898,78.233)))*43758.5453);
 float transmittance=1.;vec3 scattering=vec3(0.);
 float daylight=smoothstep(-.08,.16,sun.y),mu=dot(d,sun);
 float phase=.22+.065*hg(mu,.72)+.05*hg(mu,-.2);
 vec3 ambient=mix(vec3(.025,.038,.067),mix(zenith,vec3(.56,.64,.77),.56),daylight);
 vec3 source=sunColor*(1.7*daylight+.12*(1.-night));
 for(int i=0;i<64;i++){
  vec3 p=d*(start+(float(i)+jitter)*stepSize);float rho=cloud(p,true);if(rho<.002)continue;
  // Six expanding light-ray segments integrate optical depth toward the sun.
  float optical=0.,distance=35.,length=70.;
  for(int j=0;j<6;j++){optical+=cloud(p+sun*distance,false)*length;distance+=length;length*=1.85;}
  float direct=exp(-optical*.0018),multiple=exp(-optical*.00032)*.23;
  float h=clamp((height(p)-BASE)/(TOP-BASE),0.,1.);
  vec3 light=ambient*(.32+.5*h)+source*(direct*phase+multiple);
  // Beer-Lambert extinction and energy-conserving front-to-back scattering.
  float opacity=1.-exp(-rho*stepSize*.0022);
  scattering+=transmittance*light*opacity;transmittance*=1.-opacity;
  if(transmittance<.008)break;
 }
 float haze=1.-exp(-start*.000012);scattering=mix(scattering,background*(1.-transmittance),haze);
 outputColor=vec4(background*transmittance+scattering,1.-transmittance);
}
`;

/** 64 view steps x six sun-ray segments, progressively refreshed in a full panorama.
 * The view never waits on a new camera angle. Only complete panoramas are presented.
 * This is volumetric ray marching on WebGL2, not hardware triangle/RTX tracing.
 */
export class VolumetricSky {
 private uniforms={volumeNoise:{value:volumeNoise()},sun:{value:new T.Vector3()},zenith:{value:new T.Color()},horizon:{value:new T.Color()},warm:{value:new T.Color()},sunColor:{value:new T.Color()},coverage:{value:.65},density:{value:1},stretch:{value:1},cloudScale:{value:1},cloudTime:{value:0},night:{value:0}};
 private scene=new T.Scene();private camera=new T.OrthographicCamera();
 private targets=[0,1].map(()=>new T.WebGLRenderTarget(2048,1024,{type:T.HalfFloatType,depthBuffer:false,stencilBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter,wrapS:T.RepeatWrapping,wrapT:T.ClampToEdgeWrapping}));
 private frame=0;private row=0;private back=0;private complete=false;private lastSun=new T.Vector3();private lastCoverage=-1;
 private viewport=new T.Vector4();private scissor=new T.Vector4();
 private probeScene=new T.Scene();private probeTarget=new T.WebGLRenderTarget(512,256,{type:T.HalfFloatType,depthBuffer:false});private probeCopy:T.ShaderMaterial;private pmrem:T.PMREMGenerator;private probe?:T.WebGLRenderTarget;private lastProbe=-Infinity;
 enabled=true;
 private renderer:T.WebGLRenderer; private world:T.Scene;
 constructor(renderer:T.WebGLRenderer,world:T.Scene){this.renderer=renderer;this.world=world;
  const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,vertexShader:vertex,fragmentShader:fragment,uniforms:this.uniforms,depthTest:false,depthWrite:false});
  this.scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
  this.probeCopy=new T.ShaderMaterial({uniforms:{source:{value:null as T.Texture|null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D source;varying vec2 vUv;void main(){vec3 c=texture2D(source,vUv).rgb;if(vUv.y<.49)c*=.18;gl_FragColor=vec4(c,1.);}',depthTest:false,depthWrite:false});
  this.probeScene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.probeCopy));this.pmrem=new T.PMREMGenerator(renderer);
 }
 update(frame:SkyFrame){
  if(!this.enabled){skyRadiance.ready.value=0;return;}
  if(++this.frame%2)return;
  // A deliberately changed preset restarts the unfinished batch, not the visible sky.
  if(this.lastSun.distanceTo(frame.sun)>.16||Math.abs(this.lastCoverage-frame.coverage)>.2)this.row=0;
  if(this.row===0){this.uniforms.sun.value.copy(frame.sun);for(const key of ['zenith','horizon','warm','sunColor'] as const)this.uniforms[key].value.copy(frame[key]);for(const key of ['coverage','density','stretch','night'] as const)this.uniforms[key].value=frame[key];this.uniforms.cloudScale.value=frame.scale;this.uniforms.cloudTime.value=frame.time;this.lastSun.copy(frame.sun);this.lastCoverage=frame.coverage;}
  const r=this.renderer,target=r.getRenderTarget(),scissorTest=r.getScissorTest(),auto=r.autoClear,xr=r.xr.enabled;r.getViewport(this.viewport);r.getScissor(this.scissor);r.xr.enabled=false;r.autoClear=false;
  try{
   r.setRenderTarget(this.targets[this.back]);r.setViewport(0,0,2048,1024);r.setScissor(0,this.row,2048,8);r.setScissorTest(true);r.render(this.scene,this.camera);this.row+=8;
   if(this.row>=1024){
    this.complete=true;skyRadiance.texture.value=this.targets[this.back].texture;skyRadiance.ready.value=1;this.back=1-this.back;this.row=0;
    // Filter only a small probe, at a bounded cadence; never render the world six times.
    const now=performance.now();if(now-this.lastProbe>5000){this.probeCopy.uniforms.source.value=skyRadiance.texture.value;r.setRenderTarget(this.probeTarget);r.setViewport(0,0,512,256);r.setScissorTest(false);r.render(this.probeScene,this.camera);this.probeTarget.texture.mapping=T.EquirectangularReflectionMapping;this.probe=this.pmrem.fromEquirectangular(this.probeTarget.texture,this.probe);this.world.environment=this.probe.texture;this.lastProbe=now;}
   }
   if(this.complete)skyRadiance.ready.value=1;
  }finally{r.setRenderTarget(target);r.setViewport(this.viewport);r.setScissor(this.scissor);r.setScissorTest(scissorTest);r.autoClear=auto;r.xr.enabled=xr;}
 }
 dispose(){if(this.world.environment===this.probe?.texture)this.world.environment=null;this.probe?.dispose();this.pmrem.dispose();this.probeTarget.dispose();for(const t of this.targets)t.dispose();for(const scene of[this.scene,this.probeScene])scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});skyRadiance.ready.value=0;}
}
