import * as T from 'three';
/** Glass is composited over the existing drawing buffer: one quad, no second
 * scene render, render target, texture copy or full-resolution offscreen buffer. */
export class LcdViewfinder {
 private samples:number[]=[];status={extraCalls:0,extraTriangles:0,renderTargets:0,p50SubmissionMs:0,p95SubmissionMs:0};
 private scene=new T.Scene();private camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 private size=new T.Vector2();
 private material=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{resolution:{value:new T.Vector2(1,1)}},
  vertexShader:'varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`varying vec2 uvScreen;uniform vec2 resolution;
   void main(){
    float scan=step(.5,fract(uvScreen.y*resolution.y*.5));
    vec2 p=(uvScreen-.5)*2.;
    float edge=smoothstep(.48,1.25,length(p*vec2(.78,.8)));
    gl_FragColor=vec4(.035,.085,.075,.025+scan*.025+edge*.14);
   }`});
 constructor(){const mesh=new T.Mesh(new T.PlaneGeometry(2,2),this.material);mesh.frustumCulled=false;this.scene.add(mesh);}
 render(renderer:T.WebGLRenderer,active:boolean){
  if(!active||renderer.xr.isPresenting)return;
  renderer.getDrawingBufferSize(this.size);this.material.uniforms.resolution.value.copy(this.size);
  const before=performance.now(),calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;
  const clear=renderer.autoClear;renderer.autoClear=false;renderer.render(this.scene,this.camera);renderer.autoClear=clear;
  this.samples.push(performance.now()-before);if(this.samples.length===60){const sorted=this.samples.sort((a,b)=>a-b);this.status={extraCalls:renderer.info.render.calls-calls,extraTriangles:renderer.info.render.triangles-triangles,renderTargets:0,p50SubmissionMs:sorted[30],p95SubmissionMs:sorted[57]};this.samples=[];}
 }
 dispose(){this.material.dispose();this.scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});}
}
