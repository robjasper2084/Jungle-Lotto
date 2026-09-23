import * as T from 'three';
import {SurfaceParticles,effectSurface,ConfirmationState,type EffectPatch} from './effectRules.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
import type {RidePose} from './controller.ts';
import './rideEffects.css';
export function reducedEffects(){return document.documentElement.dataset.reducedMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;}
export class SurfaceEffects {
 readonly model=new SurfaceParticles();private terrain:TerrainSampler;private patches:readonly EffectPatch[];private ground=createGroundSample();
 private position=new Float32Array(96*3);private colors=new Float32Array(96*3);private alpha=new Float32Array(96);private size=new Float32Array(96);
 private mesh:T.Points;private rings:T.Mesh[]=[];
 constructor(scene:T.Scene,terrain:TerrainSampler,patches:readonly EffectPatch[]=[]){this.terrain=terrain;this.patches=patches;
  const geometry=new T.BufferGeometry();for(const [key,array,n]of [['position',this.position,3],['color',this.colors,3],['aAlpha',this.alpha,1],['aSize',this.size,1]] as const)geometry.setAttribute(key,new T.BufferAttribute(array,n));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,vertexShader:`attribute float aAlpha; attribute float aSize; varying float opacity; varying vec3 tint; void main(){opacity=aAlpha;tint=color;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(aSize*440.0/max(.1,-p.z),1.0,22.0);}`,fragmentShader:`varying float opacity; varying vec3 tint; void main(){float a=(1.0-smoothstep(.15,.5,length(gl_PointCoord-.5)))*opacity;if(a<.005)discard;gl_FragColor=vec4(tint,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  this.mesh=new T.Points(geometry,material);this.mesh.frustumCulled=false;scene.add(this.mesh);
  const ringGeometry=new T.RingGeometry(.88,1,32);for(let i=0;i<6;i++){const r=new T.Mesh(ringGeometry,new T.MeshBasicMaterial({color:'#abc8cf',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));r.rotation.x=-Math.PI/2;r.visible=false;scene.add(r);this.rings.push(r);}
 }
 sample(p:RidePose){const g=this.terrain.sampleGround(p.x,p.z,this.ground,p.y),s=effectSurface(this.patches,p.x,p.z,g.surface);g.surface=s.surface;return {g,...s};}
 land(p:RidePose,impact:number){const {g,wet}=this.sample(p);this.model.land(p,g,wet,impact,reducedEffects());return {wet,surface:g.surface};}
 step(dt:number,p:RidePose,grounded:boolean){const {g,wet,leaves}=this.sample(p);this.model.step(dt,p,g,grounded,wet,leaves,reducedEffects());}
 render(){const color=new T.Color();this.model.particles.forEach((p,i)=>{this.position.set([p.x,p.y,p.z],i*3);this.alpha[i]=p.age>0?p.alpha*p.age/p.life:0;this.size[i]=p.size*(p.kind==='dust'?1+(1-p.age/p.life)*1.7:1);color.set(p.kind==='spray'?'#b1d5df':p.kind==='leaf'?'#8d7540':'#baa78b');color.toArray(this.colors,i*3);});for(const a of Object.values(this.mesh.geometry.attributes))a.needsUpdate=true;this.mesh.visible=this.model.state.live>0;
  this.model.rings.forEach((p,i)=>{const r=this.rings[i];r.visible=p.age>0;r.position.set(p.x,p.y,p.z);r.scale.setScalar(.08+(1-p.age/.65)*.38);(r.material as T.MeshBasicMaterial).opacity=p.age/.65*.3;});
 }
 reset(){this.model.reset();this.render();}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as T.Material).dispose();this.rings[0].geometry.dispose();this.rings.forEach(r=>{r.removeFromParent();(r.material as T.Material).dispose();});}
}
export class RiderLamp {
 private lamp=new T.SpotLight('#e7f3fc',0,17,.38,.72,2);private target=new T.Object3D();private glow:T.Sprite;private terrain:TerrainSampler;
 constructor(scene:T.Scene,terrain:TerrainSampler){this.terrain=terrain;this.lamp.target=this.target;this.lamp.castShadow=false;scene.add(this.lamp,this.target);const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d')!,g=ctx.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#ffffff');g.addColorStop(.18,'#b0d8eaaa');g.addColorStop(1,'#9acada00');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);this.glow=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.2}));this.glow.scale.setScalar(.16);scene.add(this.glow);}
 update(dt:number,p:RidePose,dusk:boolean,visible:boolean){const s=Math.sin(p.headingY),c=Math.cos(p.headingY),shade=this.terrain.raycastObstacle({x:p.x,y:p.y+2.3,z:p.z},{x:0,y:1,z:0},7)!==null,target=visible&&p.crashBlend===0?(dusk?24:shade?10:0):0;this.lamp.intensity=visible?T.MathUtils.damp(this.lamp.intensity,target,6,dt):0;this.lamp.position.set(p.x+s*.34,p.y+.48,p.z+c*.34);this.target.position.set(p.x+s*8,p.y+.02,p.z+c*8);this.glow.position.copy(this.lamp.position);this.glow.visible=visible&&this.lamp.intensity>.4;(this.glow.material as T.SpriteMaterial).opacity=Math.min(.28,this.lamp.intensity/90);}
 get intensity(){return this.lamp.intensity;}
 dispose(){this.lamp.removeFromParent();this.target.removeFromParent();this.glow.removeFromParent();(this.glow.material as T.SpriteMaterial).map?.dispose();this.glow.material.dispose();}
}
export class RideConfirmation {
 readonly model=new ConfirmationState();readonly element=document.createElement('div');private lastText='';
 constructor(parent:HTMLElement){this.element.className='rideConfirmation';this.element.setAttribute('role','status');this.element.setAttribute('aria-live','polite');this.element.hidden=true;parent.append(this.element);}
 show(kind:string,text:string,token:string){return this.model.show(kind,text,token);}
 step(dt:number){this.model.step(dt);}
 render(visible:boolean){this.element.hidden=!visible||this.model.remaining<=0;if(this.lastText!==this.model.text){this.lastText=this.model.text;this.element.textContent='SWOOP / '+this.model.text;}this.element.dataset.kind=this.model.kind;this.element.style.setProperty('--cue-pulse',String(reducedEffects()?0:Math.max(0,(this.model.remaining-1.15)/.65)));}
 reset(){this.model.reset();this.render(false);}
 dispose(){this.element.remove();}
}
