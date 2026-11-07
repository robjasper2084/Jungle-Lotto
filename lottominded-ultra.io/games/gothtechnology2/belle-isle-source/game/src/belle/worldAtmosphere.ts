import * as T from 'three';
import {atmosphereShader,windVertex} from './atmosphereShaders.ts';
import {presentationBudget} from './presentationPolicy.ts';
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type Wind={time:T.IUniform<number>;amount:T.IUniform<number>;range:T.IUniform<T.Vector2>;amplitude:number};
/** Scene-local shader composition; never mutates Three's shared ShaderChunk table. */
export class WorldAtmosphere {
 private scene:T.Scene;private pending=new Set<T.Object3D>();private queued=false;private disposed=false;
 private originals=new Map<T.Material,{compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey']}>();
 private windMeshes=new WeakSet<T.Object3D>();private winds:Wind[]=[];
 private owned:{mesh:T.Mesh;original:T.Material|T.Material[];materials:T.Material[];depth:T.Material|undefined;distance:T.Material|undefined;depthOwned:T.Material;distanceOwned:T.Material}[]=[];
 readonly uniforms:{belleCloudNoise:T.IUniform<T.Texture>;belleSunDirection:T.IUniform<T.Vector3>;belleCloudTime:T.IUniform<number>;belleCloudCoverage:T.IUniform<number>;belleCloudStrength:T.IUniform<number>};
 constructor(scene:T.Scene,noise:T.Texture){
  this.scene=scene;
  this.uniforms={belleCloudNoise:{value:noise},belleSunDirection:{value:new T.Vector3(0,1,0)},belleCloudTime:{value:0},belleCloudCoverage:{value:0},belleCloudStrength:{value:0}};
  scene.addEventListener('childadded',this.added);this.enqueue(scene);
 }
 private added=(event:{child:T.Object3D})=>this.enqueue(event.child);
 private enqueue(root:T.Object3D){
  this.pending.add(root);if(this.queued)return;this.queued=true;
  // Material dressing is synchronous after scene.add(); compose after it, before
  // the next awaited preparation/render. No new animation loop or polling timer.
  queueMicrotask(()=>{this.queued=false;this.flush();});
 }
 flush(){if(this.disposed)return;for(const root of this.pending)root.traverse(object=>this.patchObject(object));this.pending.clear();}
 private patchObject(object:T.Object3D){
  const mesh=object as T.Mesh;if(!mesh.isMesh)return;
  const original=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const hair=/^Hero_Dreadlocks(?:_\d+)?$/.test(mesh.name);
  const coat=/^Hero_Body(?:_\d+)?$/.test(mesh.name)&&original.some(m=>m.userData.realisticSurface==='cloth'||/cloth|suit|coat/i.test(m.name));
  if((hair||coat)&&!this.windMeshes.has(mesh)&&!mesh.customDepthMaterial&&!mesh.customDistanceMaterial){
   mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
   if(box&&!box.isEmpty()){
    this.windMeshes.add(mesh);const scale=mesh.getWorldScale(new T.Vector3());
    const amplitude=(hair?.010:.007)/Math.max(.001,Math.abs(scale.x),Math.abs(scale.z));
    const range=new T.Vector2(box.min.y,box.min.y+(box.max.y-box.min.y)*(hair?.84:.28));
    const wind:Wind={time:{value:0},amount:{value:0},range:{value:range},amplitude};this.winds.push(wind);
    const materials=original.map(m=>{const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey.bind(m);this.patch(c,wind);return c;});
    const first=original[0] as T.MeshStandardMaterial;
    const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:first.map,alphaMap:first.alphaMap,alphaTest:first.alphaTest,side:first.side});
    const distance=new T.MeshDistanceMaterial({map:first.map,alphaMap:first.alphaMap,alphaTest:first.alphaTest,side:first.side});
    this.patchWind(depth,wind);this.patchWind(distance,wind);
    this.owned.push({mesh,original:mesh.material,materials,depth:mesh.customDepthMaterial,distance:mesh.customDistanceMaterial,depthOwned:depth,distanceOwned:distance});
    mesh.material=Array.isArray(mesh.material)?materials:materials[0];mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;
   }
  }
  for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])this.patch(m);
 }
 private bindWind(shader:Shader,wind:Wind){
  Object.assign(shader.uniforms,{belleWindTime:wind.time,belleWindAmount:wind.amount,belleWindRange:wind.range});
  if(!shader.vertexShader.includes('belleWindRange'))shader.vertexShader=windVertex(shader.vertexShader);
 }
 private patchWind(material:T.Material,wind:Wind){
  const old=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{old.call(material,shader,renderer);this.bindWind(shader,wind);};
  material.customProgramCacheKey=()=>key+'|belle-wind-v1';material.needsUpdate=true;
 }
 private patch(material:T.Material,wind?:Wind){
  if(this.originals.has(material)||!(material as T.MeshStandardMaterial).isMeshStandardMaterial)return;
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey,identity=key.call(material);this.originals.set(material,{compile,key});
  material.onBeforeCompile=(shader,renderer)=>{
   compile.call(material,shader,renderer);if(wind)this.bindWind(shader,wind);
   Object.assign(shader.uniforms,this.uniforms);
   if(!shader.vertexShader.includes('varying vec3 belleAtmosphereWorld;')){
    const result=atmosphereShader(shader.vertexShader,shader.fragmentShader,T.ShaderChunk.lights_fragment_begin);
    shader.vertexShader=result.vertex;shader.fragmentShader=result.fragment;
   }
  };
  material.customProgramCacheKey=()=>identity+'|belle-height-fog-clouds-v1'+(wind?'|wind':'');material.needsUpdate=true;
 }
 update(time:number,direction:T.Vector3,coverage:number,day:number,overcast:number,quality:string,reduced:boolean,xr:boolean){
  this.flush();const budget=presentationBudget(quality,xr);
  this.uniforms.belleSunDirection.value.copy(direction);this.uniforms.belleCloudTime.value=time;
  this.uniforms.belleCloudCoverage.value=coverage;this.uniforms.belleCloudStrength.value=budget.cloudStrength*day*(1-overcast*.8);
  for(const w of this.winds){w.time.value=time;w.amount.value=reduced?0:w.amplitude*budget.wind;}
 }
 get stats(){return{materials:this.originals.size,windMeshes:this.winds.length};}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.scene.removeEventListener('childadded',this.added);this.pending.clear();
  for(const [material,old]of this.originals){material.onBeforeCompile=old.compile;material.customProgramCacheKey=old.key;material.needsUpdate=true;}this.originals.clear();
  for(const item of this.owned){item.mesh.material=item.original;item.mesh.customDepthMaterial=item.depth;item.mesh.customDistanceMaterial=item.distance;for(const m of item.materials)m.dispose();item.depthOwned.dispose();item.distanceOwned.dispose();}
  this.owned.length=0;this.winds.length=0;
 }
}
