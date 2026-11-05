import * as T from 'three';
import type {Weapon} from '../../../../ride-core/src/royale/rules.ts';

const VIEW_MODEL_LAYER=30;
/** The camera's physical monitor samples the already rendered world. The hands
 * are drawn afterwards, so the display never films itself or the combat HUD. */
export class CameraRearLcd {
 readonly root=new T.Group();
 private size=new T.Vector2();private texture?:T.FramebufferTexture;private nextCopy=0;
 readonly status={active:false,width:0,height:0,copies:0,worldRenders:1,refreshHz:30};
 private material=new T.ShaderMaterial({toneMapped:false,
  uniforms:{frame:{value:null},ready:{value:0},sourceAspect:{value:1}},
  vertexShader:'varying vec2 screenUv;void main(){screenUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 screenUv;uniform sampler2D frame;uniform float ready;uniform float sourceAspect;
   void main(){
    vec2 p=screenUv-.5;vec2 crop=vec2(min(1.,1.6/sourceAspect),min(1.,sourceAspect/1.6));
    vec3 live=texture2D(frame,p*crop+.5).rgb;
    vec3 color=mix(vec3(.018,.035,.034),live,ready);
    color*=.965+.035*step(.5,fract(screenUv.y*144.));
    vec2 a=abs(p);float focus=step(a.x,.16)*step(.145,a.x)*step(.085,a.y)*step(a.y,.13)
      +step(a.y,.13)*step(.115,a.y)*step(.115,a.x)*step(a.x,.16);
    color=mix(color,vec3(.76,.96,.87),clamp(focus,0.,1.)*.75);
    float led=1.-smoothstep(.009,.014,length(screenUv-vec2(.055,.94)));
    color=mix(color,vec3(.2,.95,.62),led);
    gl_FragColor=vec4(color,1.);
   }`});
 private bezel=new T.Mesh(new T.BoxGeometry(.186,.126,.016),new T.MeshStandardMaterial({color:'#10191d',roughness:.66,metalness:.28}));
 private screen=new T.Mesh(new T.PlaneGeometry(.16,.10),this.material);
 constructor(){
  this.root.name='Camera rear live LCD';this.screen.name='Camera rear LCD glass';
  this.screen.rotation.y=Math.PI;this.screen.position.z=-.0085;
  this.root.add(this.bezel,this.screen);
 }
 mount(parent:T.Object3D|undefined,kind:Weapon){
  if(!parent){this.root.removeFromParent();return;}
  if(this.root.parent!==parent)parent.add(this.root);
  this.root.position.set(0,.062,kind==='bass'?-.215:-.137);
 }
 render(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,viewModel:T.Object3D,now:number,lowPower=false){
  const active=viewModel.visible&&!!this.root.parent&&!renderer.xr.isPresenting;
  this.status.active=active;
  if(!active){renderer.render(scene,camera);return;}
  viewModel.visible=false;
  try{renderer.render(scene,camera);}finally{viewModel.visible=true;}
  renderer.getDrawingBufferSize(this.size);
  const width=Math.max(1,Math.floor(this.size.x)),height=Math.max(1,Math.floor(this.size.y));
  if(!this.texture||width!==this.status.width||height!==this.status.height){
   this.texture?.dispose();this.texture=new T.FramebufferTexture(width,height);
   this.texture.minFilter=this.texture.magFilter=T.LinearFilter;
   this.material.uniforms.frame.value=this.texture;this.material.uniforms.sourceAspect.value=width/height;
   this.status.width=width;this.status.height=height;this.nextCopy=0;
  }
  this.status.refreshHz=lowPower?15:30;
  if(now>=this.nextCopy){renderer.copyFramebufferToTexture(this.texture);this.nextCopy=now+1000/this.status.refreshHz;this.status.copies++;this.material.uniforms.ready.value=1;}
  // Only the view model and existing lights enter this pass. World geometry,
  // water, shadows and background are submitted once per frame.
  viewModel.traverse(o=>o.layers.enable(VIEW_MODEL_LAYER));
  const lights:Array<[T.Object3D,number]>=[];
  for(const o of scene.children)if(o instanceof T.Light){lights.push([o,o.layers.mask]);o.layers.enable(VIEW_MODEL_LAYER);}
  const mask=camera.layers.mask,background=scene.background,clear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate;
  try{
   camera.layers.set(VIEW_MODEL_LAYER);scene.background=null;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;
   renderer.render(scene,camera);
  }finally{
   camera.layers.mask=mask;scene.background=background;renderer.autoClear=clear;renderer.shadowMap.autoUpdate=shadowUpdate;
   for(const [light,layer]of lights)light.layers.mask=layer;
  }
 }
 dispose(){this.texture?.dispose();this.material.dispose();this.screen.geometry.dispose();this.bezel.geometry.dispose();this.bezel.material.dispose();this.root.removeFromParent();}
}
