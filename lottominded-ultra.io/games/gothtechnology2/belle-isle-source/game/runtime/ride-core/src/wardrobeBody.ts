import * as T from 'three';

const withoutHarness=new WeakMap<T.BufferGeometry,number[]>();
/** The themed suits replace the base armor's front cargo harness. Remove only
 * its complete pads, straps and buckles, leaving the garment, back and rig intact.
 * Called in the neutral pose before artwork is fitted. Source assets stay shared. */
export function wardrobeBody(root:T.Object3D){
 const changed:{mesh:T.Mesh;source:T.BufferGeometry;geometry:T.BufferGeometry}[]=[];
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),point=new T.Vector3();
 root.traverse(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh||Array.isArray(mesh.material))return;
  const name=mesh.material.name;
  if(!['Black rubber padding','Brushed titanium fasteners','Charcoal technical nylon'].includes(name))return;
  const source=mesh.geometry,count=source.index?.count??source.attributes.position.count;
  let kept=withoutHarness.get(source);
  if(!kept){
   const front:boolean[]=[],matrix=inverse.clone().multiply(mesh.matrixWorld);
   for(let i=0;i<source.attributes.position.count;i++){
    mesh.getVertexPosition(i,point).applyMatrix4(matrix);
    front.push(name==='Charcoal technical nylon'||(Math.abs(point.x)<.16&&point.y>1.18&&point.y<1.47&&point.z>.12));
   }
   kept=[];
   for(let i=0;i<count;i+=3){const triangle=[0,1,2].map(k=>source.index?.getX(i+k)??i+k);if(!triangle.every(v=>front[v]))kept.push(...triangle);}
   withoutHarness.set(source,kept);
  }
  if(kept.length===count)return;
  const geometry=source.clone();geometry.setIndex(kept);mesh.geometry=geometry;
  changed.push({mesh,source,geometry});
 });
 return {dispose(){for(const {mesh,source,geometry}of changed){mesh.geometry=source;geometry.dispose();}}};
}
