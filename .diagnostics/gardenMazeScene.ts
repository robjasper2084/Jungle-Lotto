import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {GardenMazeCollision} from './gardenMaze.ts';
import {greenhouseWorld} from './conservatory.ts';
/** Three opaque static batches. Metre-scaled vertices preserve the shared
 * surface renderer's texture scale; gameplay walls never depend on quality. */
export function addGardenMaze(scene:T.Scene,collision:GardenMazeCollision){
 const root=new T.Group();root.name='Conservatory Garden Maze';root.userData.wallCount=collision.walls.length;
 if(!collision.layout)return {root,stats:{walls:0,triangles:0,draws:0},dispose(){}};
 const c=collision.layout,dummy=new T.Object3D(),geometries:T.BufferGeometry[]=[],materials:T.Material[]=[];
 const hedge=new T.MeshStandardMaterial({name:'Garden maze living foliage',color:0x31552b,roughness:1}),gravel=new T.MeshStandardMaterial({name:'Garden maze gravel',color:0xb0a385,roughness:1});materials.push(hedge,gravel);
 const box=new T.BoxGeometry(1,1,1),cap=new T.SphereGeometry(1,8,3,0,Math.PI*2,0,Math.PI/2),plane=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
 const cores:T.BufferGeometry[]=[],crowns:T.BufferGeometry[]=[],floors:T.BufferGeometry[]=[];
 function part(source:T.BufferGeometry,target:T.BufferGeometry[],u:number,v:number,y:number,w:number,h:number,d:number){const p=greenhouseWorld(c,u,v);dummy.position.set(p.x,y,p.z);dummy.rotation.set(0,c.yaw,0);dummy.scale.set(w,h,d);dummy.updateMatrix();target.push(source.clone().applyMatrix4(dummy.matrix));}
 for(const wall of collision.walls){
  part(box,cores,wall.u,wall.v,wall.bottom+.95,wall.width,1.9,wall.depth);
  const alongU=wall.width>wall.depth,length=alongU?wall.width:wall.depth,count=Math.ceil((length-.8)/.9)+1;
  for(let i=0;i<count;i++){const t=(i/Math.max(1,count-1)-.5)*(length-.8);part(cap,crowns,wall.u+(alongU?t:0),wall.v+(alongU?0:t),wall.bottom+1.9,.4,.3,.4);}
 }
 // Aprons meet the main gravel plane without coplanar overlap. Ground remains
 // the unchanged mapped terrain; these are only thin visual surface skins.
 for(const [u,v,w,d]of [[-70,0,28.8,20.8],[-47.8,0,15.6,2.4],[-88.2,8,7.6,2.4]])part(plane,floors,u,v,2.024,w,1,d);
 let triangles=0;
 for(const [parts,material,name]of [[cores,hedge,'Maze hedge collision-matched cores'],[crowns,hedge,'Maze hedge rounded foliage'],[floors,gravel,'Maze walkable gravel and gate aprons']] as const){
  const geometry=mergeGeometries(parts,false);for(const g of parts)g.dispose();if(!geometry)throw new Error('Garden maze geometry merge failed');geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.push(geometry);triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
  const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=parts!==floors;mesh.receiveShadow=true;mesh.userData.wallCount=parts===cores?collision.walls.length:0;root.add(mesh);
 }
 box.dispose();cap.dispose();plane.dispose();scene.add(root);let disposed=false;
 return {root,stats:{walls:collision.walls.length,triangles,draws:3},dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();const owned=new Set(materials);for(const child of root.children){const m=(child as T.Mesh).material;for(const material of Array.isArray(m)?m:[m])owned.add(material);}for(const m of owned)m.dispose();}};
}
