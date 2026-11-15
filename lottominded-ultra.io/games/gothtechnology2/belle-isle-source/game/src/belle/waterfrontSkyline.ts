import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import plan from './windsorSkyline.json';
/** Persistent mapped south-bank silhouettes, batched by facade material.
 * Kept in every quality tier; only subpixel window detail fades. */
export function addWaterfrontSkyline(scene:T.Scene){
 const root=new T.Group();root.name='Windsor waterfront · mapped skyline';
 for(const kind of ['stone','glass']){
  const geometry:T.BufferGeometry[]=[];
  for(const b of plan.buildings.filter(b=>b.material===kind)){
   const shape=new T.Shape(b.points.map(([x,z])=>new T.Vector2(x,-z)));
   const g=new T.ExtrudeGeometry(shape,{depth:b.height-b.base,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,2+b.base,0);geometry.push(g.index?g.toNonIndexed():g);
  }
  if(!geometry.length)continue;
  const g=mergeGeometries(geometry)!;geometry.forEach(v=>v.dispose());g.computeBoundingSphere();
  const m=new T.MeshStandardMaterial({name:kind==='glass'?'Detroit reflective blue glass':'Detroit limestone',color:kind==='glass'?0x416879:0x9b9589});
  const mesh=new T.Mesh(g,m);mesh.name='Windsor waterfront '+kind;root.add(mesh);
 }
 scene.add(root);return root;
}
