import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {freezeStaticWorldTransforms} from './worldPerformancePolicy.ts';
import {disposeStaticWorldTransforms,readStaticWorldTransforms,registerStaticWorldTransforms,setStaticWorldTransformsEnabled} from './staticWorldTransforms.ts';

const flags=['matrixAutoUpdate','matrixWorldAutoUpdate','matrixWorldNeedsUpdate'] as const;
const stock=T.Object3D.prototype.updateMatrixWorld;
function fixture(){
 const scene=new T.Scene(),root=new T.Group(),branch=new T.Group();
 scene.position.set(13,2,-7);scene.rotation.y=.12;
 root.name='private factory root';root.position.set(10,3,-20);root.rotation.y=.31;
 const geometry=new T.BoxGeometry(2,2,2),material=new T.MeshStandardMaterial();
 const mesh=new T.Mesh(geometry,material);mesh.position.set(1,2,-3);mesh.rotation.z=.2;
 const instances=new T.InstancedMesh(geometry,material,2);instances.setMatrixAt(0,new T.Matrix4().makeTranslation(4,0,0));instances.setMatrixAt(1,new T.Matrix4().makeTranslation(-4,0,0));
 root.add(branch);branch.add(mesh,instances);scene.add(root);
 const dynamic=new T.Object3D();dynamic.position.set(-9,1,6);scene.add(dynamic);
 return {scene,root,branch,mesh,instances,dynamic,nodes:[root,branch,mesh,instances],geometry,material};
}
function descriptors(nodes:T.Object3D[]){return nodes.map(object=>({
  flags:flags.map(flag=>Object.getOwnPropertyDescriptor(object,flag)),method:Object.getOwnPropertyDescriptor(object,'updateMatrixWorld')
 }));}
function matrices(nodes:T.Object3D[]){return nodes.map(object=>({local:object.matrix.toArray(),world:object.matrixWorld.toArray()}));}
function renderState(nodes:T.Object3D[]){return nodes.map(object=>({
  geometry:(object as T.Mesh).geometry,material:(object as T.Mesh).material,before:object.onBeforeRender,after:object.onAfterRender,
  beforeShadow:object.onBeforeShadow,afterShadow:object.onAfterShadow,visible:object.visible,cast:object.castShadow,receive:object.receiveShadow,
  renderOrder:object.renderOrder,parent:object.parent,children:[...object.children],raycast:object.raycast
 }));}

test('default-disabled registration preserves even uninitialized matrix bytes and all original descriptors',()=>{
 const {scene,root,nodes}=fixture(),before=matrices([scene,...nodes]),properties=descriptors(nodes),render=renderState(nodes);
 assert.equal(registerStaticWorldTransforms(scene,'factory',[root]),true);
 assert.deepEqual(matrices([scene,...nodes]),before);assert.deepEqual(descriptors(nodes),properties);assert.deepEqual(renderState(nodes),render);
 const read=readStaticWorldTransforms(scene);assert.equal(read.enabled,false);assert.equal(read.activeNodes,0);assert.equal(read.registeredNodes,4);
 assert.deepEqual(read.owners[0].rootIds,[root.id]);assert.deepEqual(read.owners[0].nodeIds,nodes.map(node=>node.id));
 assert(read.owners[0].nodes.every(node=>node.updateMatrixWorld==='original'));
 disposeStaticWorldTransforms(scene);
});

test('activation preserves exact native world matrices and all rendering/raycast inputs',()=>{
 const {scene,root,mesh,nodes,instances}=fixture();scene.updateMatrixWorld(true);
 mesh.castShadow=mesh.receiveShadow=true;mesh.onBeforeRender=()=>{};mesh.onAfterRender=()=>{};mesh.onBeforeShadow=()=>{};mesh.onAfterShadow=()=>{};
 const before=matrices(nodes),properties=descriptors(nodes),render=renderState(nodes),instanceBytes=instances.instanceMatrix.array.slice();
 const origin=mesh.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,0,20)),ray=new T.Raycaster(origin,new T.Vector3(0,0,-1));
 const hits=()=>ray.intersectObject(mesh).map(hit=>({distance:hit.distance,face:hit.faceIndex,point:hit.point.toArray()}));
 const originalHits=hits();assert(originalHits.length>0);
 registerStaticWorldTransforms(scene,'factory',[root]);assert.equal(setStaticWorldTransformsEnabled(scene,true),true);
 scene.updateMatrixWorld(true);root.updateMatrixWorld();root.updateMatrixWorld(true);mesh.updateWorldMatrix(true,false);
 assert.deepEqual(matrices(nodes),before);assert.deepEqual(renderState(nodes),render);assert.deepEqual(hits(),originalHits);assert.deepEqual(instances.instanceMatrix.array,instanceBytes);
 assert(nodes.every(node=>flags.every(flag=>node[flag]===false)));
 assert.equal(mesh.updateWorldMatrix,T.Object3D.prototype.updateWorldMatrix);
 assert.equal(setStaticWorldTransformsEnabled(scene,false),true);assert.deepEqual(descriptors(nodes),properties);assert.deepEqual(matrices(nodes),before);
 disposeStaticWorldTransforms(scene);
});

test('only the owned subtree traversal is pruned; dynamic scene children still update normally',()=>{
 const {scene,root,nodes,dynamic}=fixture();scene.updateMatrixWorld(true);registerStaticWorldTransforms(scene,'factory',[root]);
 const visited:number[]=[];
 const count=()=>{const original=T.Object3D.prototype.updateMatrixWorld;try{
  T.Object3D.prototype.updateMatrixWorld=function(force){visited.push(this.id);original.call(this,force);};scene.updateMatrixWorld(true);
 }finally{T.Object3D.prototype.updateMatrixWorld=original;}};
 count();assert(nodes.every(node=>visited.includes(node.id)));visited.length=0;
 setStaticWorldTransformsEnabled(scene,true);dynamic.position.x=34;count();
 assert(visited.includes(scene.id)&&visited.includes(dynamic.id));assert(nodes.every(node=>!visited.includes(node.id)));
 const expected=dynamic.position.clone().applyMatrix4(scene.matrixWorld);assert.deepEqual(new T.Vector3().setFromMatrixPosition(dynamic.matrixWorld).toArray(),expected.toArray());
 setStaticWorldTransformsEnabled(scene,false);visited.length=0;count();assert(nodes.every(node=>visited.includes(node.id)));
 disposeStaticWorldTransforms(scene);
});

test('every activation captures current native flags, including warmup-cleared dirty state',()=>{
 const {scene,root,nodes}=fixture();registerStaticWorldTransforms(scene,'factory',[root]);
 scene.updateMatrixWorld(true);const first=descriptors(nodes);assert(nodes.every(node=>!node.matrixWorldNeedsUpdate));
 setStaticWorldTransformsEnabled(scene,true);setStaticWorldTransformsEnabled(scene,false);assert.deepEqual(descriptors(nodes),first);
 nodes[1].matrixWorldNeedsUpdate=true;const second=descriptors(nodes);
 setStaticWorldTransformsEnabled(scene,true);setStaticWorldTransformsEnabled(scene,false);assert.deepEqual(descriptors(nodes),second);
 disposeStaticWorldTransforms(scene);
});

test('already-frozen nodes and an original own native-method descriptor restore exactly',()=>{
 const {scene,root,nodes}=fixture();freezeStaticWorldTransforms([root]);
 Object.defineProperty(root,'updateMatrixWorld',{value:stock,writable:true,enumerable:false,configurable:true});
 const before=descriptors(nodes),matrix=matrices(nodes);registerStaticWorldTransforms(scene,'factory',[root]);
 setStaticWorldTransformsEnabled(scene,true);scene.updateMatrixWorld(true);setStaticWorldTransformsEnabled(scene,false);
 assert.deepEqual(descriptors(nodes),before);assert.deepEqual(matrices(nodes),matrix);disposeStaticWorldTransforms(scene);
});

test('late registrations follow the selected mode and disabling restores every actual owner',()=>{
 const {scene,root,nodes}=fixture();scene.updateMatrixWorld(true);registerStaticWorldTransforms(scene,'first',[root]);setStaticWorldTransformsEnabled(scene,true);
 const late=new T.Group(),child=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());late.position.x=71;child.position.y=4;late.add(child);scene.add(late);
 const before=descriptors([late,child]);assert(registerStaticWorldTransforms(scene,'late',[late]));
 const read=readStaticWorldTransforms(scene);assert.equal(read.activeOwners,2);assert.equal(read.activeNodes,nodes.length+2);assert.equal(late.matrixWorld.elements[12],71*scene.matrixWorld.elements[0]+scene.matrixWorld.elements[12]);
 assert(setStaticWorldTransformsEnabled(scene,false));assert.deepEqual(descriptors([late,child]),before);
 const later=new T.Group();scene.add(later);const native=descriptors([later]);assert(registerStaticWorldTransforms(scene,'later',[later]));assert.deepEqual(descriptors([later]),native);
 disposeStaticWorldTransforms(scene);
});

test('adding or removing an internal child immediately invalidates and restores the complete owner',()=>{
 for(const kind of ['add','remove'] as const){
  const {scene,root,branch,mesh,nodes}=fixture();scene.updateMatrixWorld(true);const before=descriptors(nodes);
  registerStaticWorldTransforms(scene,'factory',[root]);setStaticWorldTransformsEnabled(scene,true);
  if(kind==='add')branch.add(new T.Object3D());else branch.remove(mesh);
  const read=readStaticWorldTransforms(scene);assert.equal(read.invalidations,1);assert.equal(read.activeNodes,0);assert.equal(read.owners[0].invalidated,true);
  assert.deepEqual(descriptors(nodes),before);assert.equal(setStaticWorldTransformsEnabled(scene,true),false);
  if(kind==='add'){const added=branch.children.at(-1)!;added.position.x=9;scene.updateMatrixWorld(true);assert.notEqual(added.matrixWorld.elements[12],0);}
  disposeStaticWorldTransforms(scene);
 }
});

test('removing or reparenting a registered root restores native propagation before reuse',()=>{
 for(const reparent of [false,true]){
  const {scene,root,nodes}=fixture();scene.updateMatrixWorld(true);const before=descriptors(nodes);
  registerStaticWorldTransforms(scene,'factory',[root]);setStaticWorldTransformsEnabled(scene,true);
  const next=new T.Group();next.position.x=19;scene.add(next);
  if(reparent)next.add(root);else root.removeFromParent();
  assert.equal(readStaticWorldTransforms(scene).invalidations,1);assert.deepEqual(descriptors(nodes),before);
  root.position.x=20;if(!reparent)next.add(root);scene.updateMatrixWorld(true);
  const expected=root.position.clone().applyMatrix4(next.matrixWorld);assert.deepEqual(new T.Vector3().setFromMatrixPosition(root.matrixWorld).toArray(),expected.toArray());
  disposeStaticWorldTransforms(scene);
 }
});

test('hierarchy edits while disabled invalidate without changing any matrix flag or method',()=>{
 const {scene,root,branch,nodes}=fixture();const before=descriptors(nodes),matrix=matrices(nodes);
 registerStaticWorldTransforms(scene,'factory',[root]);branch.add(new T.Object3D());
 assert.equal(readStaticWorldTransforms(scene).invalidations,1);assert.deepEqual(descriptors(nodes),before);assert.deepEqual(matrices(nodes),matrix);
 assert.equal(setStaticWorldTransformsEnabled(scene,true),false);disposeStaticWorldTransforms(scene);
});

test('unsupported specialized objects, animation and custom methods remain fully native',()=>{
 const mutations:((root:T.Group)=>void)[]=[
  root=>root.add(new T.SkinnedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial())),
  root=>root.add(new T.Bone()),root=>root.add(new T.PerspectiveCamera()),root=>root.add(new T.LOD()),
  root=>{root.animations.push(new T.AnimationClip('animated',1,[]));},
  root=>{root.updateMatrixWorld=function(force){stock.call(this,force);};},
  root=>{root.updateWorldMatrix=function(){};},root=>{root.updateMatrix=function(){};},root=>{root.traverse=function(){};},
  root=>{Object.defineProperty(root,'updateMatrixWorld',{get:()=>stock,configurable:true});},
  root=>{const mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());mesh.geometry.morphAttributes.position=[mesh.geometry.attributes.position.clone()];root.add(mesh);},
 ];
 for(const mutate of mutations){
  const scene=new T.Scene(),root=new T.Group();scene.add(root);mutate(root);
  const before=descriptors([root]),matrix=matrices([root]);assert.equal(registerStaticWorldTransforms(scene,'unsupported',[root]),false);
  assert.equal(setStaticWorldTransformsEnabled(scene,true),false);assert.deepEqual(descriptors([root]),before);assert.deepEqual(matrices([root]),matrix);
  assert.equal(readStaticWorldTransforms(scene).registeredNodes,0);disposeStaticWorldTransforms(scene);
 }
});

test('changed matrix methods before activation fail closed without freezing the tree',()=>{
 const {scene,root,mesh,nodes}=fixture();registerStaticWorldTransforms(scene,'factory',[root]);
 const replacement=function(this:T.Object3D,force?:boolean){stock.call(this,force);};mesh.updateMatrixWorld=replacement;
 const before=descriptors(nodes);assert.equal(setStaticWorldTransformsEnabled(scene,true),false);assert.deepEqual(descriptors(nodes),before);
 assert.equal(readStaticWorldTransforms(scene).invalidations,1);disposeStaticWorldTransforms(scene);
});

test('a replacement root wrapper is retained and its captured disabled barrier delegates natively',()=>{
 const {scene,root,mesh}=fixture();scene.updateMatrixWorld(true);registerStaticWorldTransforms(scene,'factory',[root]);setStaticWorldTransformsEnabled(scene,true);
 const captured=root.updateMatrixWorld;let calls=0;
 const replacement=function(this:T.Object3D,force?:boolean){calls++;captured.call(this,force);};root.updateMatrixWorld=replacement;
 assert.equal(setStaticWorldTransformsEnabled(scene,false),false);assert.equal(root.updateMatrixWorld,replacement);
 mesh.position.x=28;scene.updateMatrixWorld(true);assert(calls>0);
 const expected=mesh.position.clone().applyMatrix4(mesh.parent!.matrixWorld);assert.deepEqual(new T.Vector3().setFromMatrixPosition(mesh.matrixWorld).toArray(),expected.toArray());
 assert.equal(readStaticWorldTransforms(scene).invalidations,1);disposeStaticWorldTransforms(scene);assert.equal(root.updateMatrixWorld,replacement);
});

test('borrowing an enabled barrier for a different receiver keeps stock force semantics',()=>{
 const {scene,root,dynamic}=fixture();registerStaticWorldTransforms(scene,'factory',[root]);setStaticWorldTransformsEnabled(scene,true);
 dynamic.position.set(7,8,9);root.updateMatrixWorld.call(dynamic,true);
 const expected=dynamic.position.clone().applyMatrix4(scene.matrixWorld);assert.deepEqual(new T.Vector3().setFromMatrixPosition(dynamic.matrixWorld).toArray(),expected.toArray());
 disposeStaticWorldTransforms(scene);
});

test('visibility, render state and instance-buffer updates do not invalidate fixed object transforms',()=>{
 const {scene,root,mesh,instances}=fixture();scene.updateMatrixWorld(true);registerStaticWorldTransforms(scene,'factory',[root]);setStaticWorldTransformsEnabled(scene,true);
 mesh.visible=false;mesh.castShadow=true;mesh.receiveShadow=true;(mesh.material as T.MeshStandardMaterial).color.setHex(0x223344);
 instances.setMatrixAt(1,new T.Matrix4().makeTranslation(16,2,-8));instances.count=1;instances.instanceMatrix.needsUpdate=true;
 scene.updateMatrixWorld(true);assert.equal(readStaticWorldTransforms(scene).invalidations,0);assert.equal(readStaticWorldTransforms(scene).activeNodes,4);
 assert.equal(mesh.visible,false);assert.equal(instances.count,1);disposeStaticWorldTransforms(scene);
});

test('duplicate exact registration is idempotent while overlapping or unfinished roots are rejected',()=>{
 const {scene,root,branch}=fixture();assert(registerStaticWorldTransforms(scene,'factory',[root]));assert(registerStaticWorldTransforms(scene,'factory',[root]));
 assert.equal(readStaticWorldTransforms(scene).registeredOwners,1);assert.equal(registerStaticWorldTransforms(scene,'overlap',[root]),false);
 assert.equal(registerStaticWorldTransforms(scene,'not-final',[branch]),false);assert.equal(registerStaticWorldTransforms(scene,'detached',[new T.Group()]),false);
 assert.equal(registerStaticWorldTransforms(scene,'factory',[new T.Group()]),false);disposeStaticWorldTransforms(scene);
});

test('registries are scene-local and their snapshots cannot mutate actual ownership',()=>{
 const a=fixture(),b=fixture();registerStaticWorldTransforms(a.scene,'factory',[a.root]);registerStaticWorldTransforms(b.scene,'factory',[b.root]);setStaticWorldTransformsEnabled(a.scene,true);
 const read=readStaticWorldTransforms(a.scene);read.owners[0].nodeIds.length=0;read.owners[0].roots.length=0;read.rejections.push({owner:'fake',reason:'fake'});
 assert.equal(readStaticWorldTransforms(a.scene).activeNodes,4);assert.equal(readStaticWorldTransforms(a.scene).rejectedRegistrations,0);
 assert.equal(readStaticWorldTransforms(b.scene).enabled,false);assert.equal(b.root.updateMatrixWorld,stock);disposeStaticWorldTransforms(a.scene);disposeStaticWorldTransforms(b.scene);
});

test('dispose restores flags and descriptors and removes only the helper listeners',()=>{
 const {scene,root,branch,nodes}=fixture();scene.updateMatrixWorld(true);const before=descriptors(nodes);let otherEvents=0;
 branch.addEventListener('childadded',()=>otherEvents++);registerStaticWorldTransforms(scene,'factory',[root]);setStaticWorldTransformsEnabled(scene,true);disposeStaticWorldTransforms(scene);
 assert.deepEqual(descriptors(nodes),before);branch.add(new T.Object3D());assert.equal(otherEvents,1);assert.equal(readStaticWorldTransforms(scene).registeredOwners,0);
 disposeStaticWorldTransforms(scene);
});
