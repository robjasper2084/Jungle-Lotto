import type {Object3D,Scene} from 'three';
/** Opt-in, one-frame draw census. Renderer counters include culled multi-draw
 * ranges and extension fallbacks; allocated geometry size does not. */
export function sampleDrawGroups(scene:Scene){
 const restore:(()=>void)[]=[],groups=new Map<string,{draws:number;triangles:number}>();
 scene.traverse(object=>{
  const mesh=object as Object3D&{isMesh?:boolean;isLine?:boolean};
  if(!mesh.isMesh&&!mesh.isLine)return;
  let top:Object3D=mesh;while(top.parent&&top.parent!==scene)top=top.parent;
  const label=top.name==='Scene'?(mesh.name||top.name):(top.name||mesh.name||mesh.type);
  const before=mesh.onBeforeRender,after=mesh.onAfterRender;let calls=0,triangles=0;
  mesh.onBeforeRender=function(...args){before.apply(this,args);calls=args[0].info.render.calls;triangles=args[0].info.render.triangles;};
  mesh.onAfterRender=function(...args){const stats=args[0].info.render,g=groups.get(label)??{draws:0,triangles:0};g.draws+=stats.calls-calls;g.triangles+=stats.triangles-triangles;groups.set(label,g);after.apply(this,args);};
  restore.push(()=>{mesh.onBeforeRender=before;mesh.onAfterRender=after;});
 });
 return()=>{restore.forEach(fn=>fn());return Object.fromEntries([...groups].sort((a,b)=>b[1].triangles-a[1].triangles).slice(0,120));};
}
