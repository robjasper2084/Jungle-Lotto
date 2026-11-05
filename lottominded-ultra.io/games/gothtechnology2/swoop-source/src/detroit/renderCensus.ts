import * as T from 'three';

/** Opt-in localhost diagnostics. Counts camera-visible submissions by scene root;
 * never runs on the public game or in the normal frame loop. */
export function renderCensus(scene:T.Scene,camera:T.Camera){
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const rows=new Map<string,{name:string;calls:number;triangles:number}>();
 scene.traverseVisible(o=>{
  const m=o as T.Mesh;if(!m.isMesh||!m.layers.test(camera.layers))return;
  if(m.frustumCulled&&!frustum.intersectsObject(m))return;
  const lineage:T.Object3D[]=[];for(let p:T.Object3D|null=m.parent;p&&p!==scene;p=p.parent)lineage.unshift(p);
  const root=lineage.length>1&&(lineage[0] as T.Scene).isScene?lineage[1]:lineage[0];
  const name=root?(root.name||root.type+' '+root.id):m.name||m.type;
  const row=rows.get(name)??{name,calls:0,triangles:0};
  const materials=Array.isArray(m.material)?m.material:[m.material];
  row.calls+=Array.isArray(m.material)?m.geometry.groups.filter(g=>materials[g.materialIndex??0]?.visible).length:Number(m.material.visible);
  row.triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3*((m as T.InstancedMesh).isInstancedMesh?(m as T.InstancedMesh).count:1);
  rows.set(name,row);
 });
 return [...rows.values()].sort((a,b)=>b.calls-a.calls).slice(0,18);
}
