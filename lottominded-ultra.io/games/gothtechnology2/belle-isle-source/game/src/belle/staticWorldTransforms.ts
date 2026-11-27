import * as T from 'three';
import {freezeStaticWorldTransforms} from './worldPerformancePolicy.ts';

/** Explicit factory ownership only. Register after final placement in the
 * private, world-fixed scene. Local/world transforms, their flags and the
 * hierarchy must then remain immutable. Visibility, materials, geometry and
 * instance buffers may still change. An external animation mixer is outside
 * this contract even when Object3D.animations is empty.
 *
 * Registration is disabled by default and never updates a matrix or replaces
 * a method. Enabling freezes the already-final transforms and prunes only the
 * registered roots' native matrix traversal. No render/scene hooks or per-frame
 * descendant checks are installed. Explicit updateWorldMatrix remains native.
 */
const nativeUpdateMatrixWorld=T.Object3D.prototype.updateMatrixWorld;
const nativeUpdateWorldMatrix=T.Object3D.prototype.updateWorldMatrix;
const nativeUpdateMatrix=T.Object3D.prototype.updateMatrix;
const nativeTraverse=T.Object3D.prototype.traverse;
const ordinaryPrototypes=new Set<object>([T.Object3D.prototype,T.Group.prototype,T.Mesh.prototype,T.InstancedMesh.prototype]);
const flags=['matrixAutoUpdate','matrixWorldAutoUpdate','matrixWorldNeedsUpdate'] as const;
type Flag=typeof flags[number];
type FlagDescriptors=Record<Flag,PropertyDescriptor>;
type NodeRecord={object:T.Object3D;parent:T.Object3D|null;children:T.Object3D[];restore?:FlagDescriptors};
type RootRecord={object:T.Object3D;nodeCount:number;barrier:T.Object3D['updateMatrixWorld'];restore?:PropertyDescriptor};
type Owner={owner:string;nodes:NodeRecord[];roots:RootRecord[];active:boolean;invalidated:boolean;reason:string|null;changed:()=>void};
type Registry={enabled:boolean;owners:Owner[];members:Map<T.Object3D,Owner>;invalidations:number;rejections:{owner:string;reason:string}[]};
const registries=new WeakMap<T.Scene,Registry>();

function registryFor(scene:T.Scene){
 let registry=registries.get(scene);
 if(!registry){registry={enabled:false,owners:[],members:new Map(),invalidations:0,rejections:[]};registries.set(scene,registry);}
 return registry;
}
function flagDescriptors(object:T.Object3D):FlagDescriptors{
 return Object.fromEntries(flags.map(flag=>[flag,Object.getOwnPropertyDescriptor(object,flag)!])) as FlagDescriptors;
}
function sameDescriptor(a:PropertyDescriptor|undefined,b:PropertyDescriptor|undefined){
 return !!a&&!!b&&a.value===b.value&&a.get===b.get&&a.set===b.set&&a.writable===b.writable&&a.enumerable===b.enumerable&&a.configurable===b.configurable;
}
function unsupported(object:T.Object3D):string|null{
 if(!ordinaryPrototypes.has(Object.getPrototypeOf(object)))return 'non-ordinary object prototype';
 if(object.updateMatrixWorld!==nativeUpdateMatrixWorld||object.updateWorldMatrix!==nativeUpdateWorldMatrix||object.updateMatrix!==nativeUpdateMatrix)return 'custom matrix update method';
 if(object.traverse!==nativeTraverse)return 'custom traversal method';
 for(const method of ['updateMatrixWorld','updateWorldMatrix','updateMatrix'] as const){const descriptor=Object.getOwnPropertyDescriptor(object,method);if(descriptor&&!('value'in descriptor))return 'matrix method accessor';}
 if(object.animations.length)return 'object animations';
 const mesh=object as T.Mesh;
 if(mesh.isMesh&&(Object.keys(mesh.geometry.morphAttributes).length||mesh.morphTargetInfluences?.length))return 'morph animation';
 for(const flag of flags){const descriptor=Object.getOwnPropertyDescriptor(object,flag);if(!descriptor||!('value'in descriptor)||typeof descriptor.value!=='boolean'||!descriptor.writable)return 'non-native matrix flag';}
 if(!object.matrix.elements.every(Number.isFinite)||!object.matrixWorld.elements.every(Number.isFinite))return 'non-finite matrix';
 return null;
}
function detach(owner:Owner){
 for(const {object}of owner.nodes){object.removeEventListener('childadded',owner.changed);object.removeEventListener('childremoved',owner.changed);}
 for(const {object}of owner.roots){object.removeEventListener('added',owner.changed);object.removeEventListener('removed',owner.changed);}
}
function noteInvalidation(registry:Registry,owner:Owner,reason:string){
 if(!owner.invalidated){owner.invalidated=true;owner.reason=reason;registry.invalidations++;}
 detach(owner);
}
function restore(registry:Registry,owner:Owner){
 if(!owner.active)return;
 // A later wrapper can retain a reference to our old method. Disable that
 // closure before restoring anything so it delegates to native traversal.
 owner.active=false;
 for(const root of owner.roots){
  const current=Object.getOwnPropertyDescriptor(root.object,'updateMatrixWorld');
  if(current?.value===root.barrier){
   if(root.restore)Object.defineProperty(root.object,'updateMatrixWorld',root.restore);
   else delete (root.object as Partial<T.Object3D>).updateMatrixWorld;
  }else noteInvalidation(registry,owner,'root updateMatrixWorld ownership changed');
  root.restore=undefined;
 }
 for(const node of owner.nodes){
  if(!node.restore)continue;
  for(const flag of flags){
   const original=node.restore[flag],current=Object.getOwnPropertyDescriptor(node.object,flag);
   if(sameDescriptor(current,{...original,value:false}))Object.defineProperty(node.object,flag,original);
   else noteInvalidation(registry,owner,'matrix flag ownership changed');
  }
  node.restore=undefined;
 }
}
function invalidate(registry:Registry,owner:Owner,reason:string){
 noteInvalidation(registry,owner,reason);restore(registry,owner);
}
function enable(registry:Registry,owner:Owner):boolean{
 if(owner.invalidated)return false;
 if(owner.active){
  if(owner.roots.every(root=>root.object.updateMatrixWorld===root.barrier))return true;
  invalidate(registry,owner,'root updateMatrixWorld ownership changed');return false;
 }
 // This one-time transition check is outside rendering. Native hierarchy
 // events handle later edits without walking the tree every frame.
 for(const node of owner.nodes){
  const reason=unsupported(node.object);
  if(reason||node.object.parent!==node.parent||node.object.children.length!==node.children.length||node.children.some((child,i)=>node.object.children[i]!==child)){
   invalidate(registry,owner,reason??'registered hierarchy changed');return false;
  }
 }
 for(const node of owner.nodes)node.restore=flagDescriptors(node.object);
 for(const root of owner.roots)root.restore=Object.getOwnPropertyDescriptor(root.object,'updateMatrixWorld');
 freezeStaticWorldTransforms(owner.roots.map(root=>root.object));
 for(const root of owner.roots){
  const descriptor=root.restore;
  Object.defineProperty(root.object,'updateMatrixWorld',descriptor?{...descriptor,value:root.barrier}:{value:root.barrier,writable:true,enumerable:true,configurable:true});
 }
 owner.active=true;
 return true;
}

/** Record final, direct children of this private scene. Unsupported or
 * overlapping ownership falls back to the untouched native methods. */
export function registerStaticWorldTransforms(scene:T.Scene,ownerName:string,roots:readonly T.Object3D[]):boolean{
 const registry=registryFor(scene);
 const reject=(reason:string)=>{registry.rejections.push({owner:ownerName,reason});return false;};
 if(!ownerName.trim()||!roots.length)return reject('empty owner or root list');
 const previous=registry.owners.find(owner=>owner.owner===ownerName);
 if(previous){
  if(previous.roots.length===roots.length&&previous.roots.every((root,i)=>root.object===roots[i]))return !previous.invalidated;
  return reject('owner already registered with different roots');
 }
 const nodes:NodeRecord[]=[],rootCounts:number[]=[],seen=new Set<T.Object3D>();
 let reason:string|null=null;
 for(const root of roots){
  if(root.parent!==scene)return reject('root is not a final direct scene child');
  const descriptor=Object.getOwnPropertyDescriptor(root,'updateMatrixWorld');
  if((descriptor&&!descriptor.configurable&&!descriptor.writable)||(!descriptor&&!Object.isExtensible(root)))return reject('root method cannot be restored');
  const before=nodes.length;
  const pending=[root];
  while(pending.length&&!reason){
   const object=pending.pop()!;
   if(seen.has(object)||registry.members.has(object)){reason='overlapping registered ownership';break;}
   reason=unsupported(object);if(reason)break;
   seen.add(object);nodes.push({object,parent:object.parent,children:[...object.children]});
   for(let i=object.children.length-1;i>=0;i--)pending.push(object.children[i]);
  }
  if(reason)return reject(reason);
  if(nodes.length===before)return reject('empty root traversal');
  rootCounts.push(nodes.length-before);
 }
 const owner:Owner={owner:ownerName,nodes,roots:[],active:false,invalidated:false,reason:null,changed:()=>{}};
 owner.changed=()=>invalidate(registry,owner,'registered hierarchy changed');
 owner.roots=roots.map((object,i)=>({object,nodeCount:rootCounts[i],barrier:function(this:T.Object3D,force?:boolean){
  // Constant-time receiver/lifetime checks preserve borrowed-method and
  // retained-wrapper semantics; there are no traversal checks or counters.
  if(!owner.active||this!==object)nativeUpdateMatrixWorld.call(this,force);
 }}));
 registry.owners.push(owner);
 for(const node of nodes){registry.members.set(node.object,owner);node.object.addEventListener('childadded',owner.changed);node.object.addEventListener('childremoved',owner.changed);}
 for(const root of roots){root.addEventListener('added',owner.changed);root.addEventListener('removed',owner.changed);}
 return registry.enabled?enable(registry,owner):true;
}

/** Also sets the default for later streamed factory registrations. */
export function setStaticWorldTransformsEnabled(scene:T.Scene,enabled:boolean):boolean{
 const registry=registryFor(scene);registry.enabled=enabled;
 let accepted=registry.rejections.length===0;
 for(const owner of registry.owners){
  if(enabled){if(!enable(registry,owner))accepted=false;}
  else{restore(registry,owner);if(owner.invalidated)accepted=false;}
 }
 return accepted;
}

export function readStaticWorldTransforms(scene:T.Scene){
 const registry=registries.get(scene);
 const owners=(registry?.owners??[]).map(owner=>{
  const rootByObject=new Map(owner.roots.map(root=>[root.object,root]));
  const method=(object:T.Object3D):'original'|'barrier'|'other'=>object.updateMatrixWorld===nativeUpdateMatrixWorld?'original':object.updateMatrixWorld===rootByObject.get(object)?.barrier?'barrier':'other';
  return {owner:owner.owner,eligible:!owner.invalidated,active:owner.active,invalidated:owner.invalidated,reason:owner.reason,
   rootIds:owner.roots.map(root=>root.object.id),nodeIds:owner.nodes.map(node=>node.object.id),rootCount:owner.roots.length,nodeCount:owner.nodes.length,
   roots:owner.roots.map(root=>({id:root.object.id,name:root.object.name,type:root.object.type,parentId:root.object.parent?.id??null,nodeCount:root.nodeCount,updateMatrixWorld:method(root.object)})),
   nodes:owner.nodes.map(({object})=>({id:object.id,name:object.name,type:object.type,parentId:object.parent?.id??null,matrixAutoUpdate:object.matrixAutoUpdate,matrixWorldAutoUpdate:object.matrixWorldAutoUpdate,matrixWorldNeedsUpdate:object.matrixWorldNeedsUpdate,updateMatrixWorld:method(object)}))};
 });
 return {version:1 as const,enabled:registry?.enabled??false,registeredOwners:owners.length,registeredRoots:owners.reduce((n,o)=>n+o.rootCount,0),registeredNodes:owners.reduce((n,o)=>n+o.nodeCount,0),
  activeOwners:owners.filter(o=>o.active).length,activeRoots:owners.reduce((n,o)=>n+(o.active?o.rootCount:0),0),activeNodes:owners.reduce((n,o)=>n+(o.active?o.nodeCount:0),0),
  invalidations:registry?.invalidations??0,rejectedRegistrations:registry?.rejections.length??0,owners,rejections:registry?.rejections.map(entry=>({...entry}))??[]};
}

/** Restore owned descriptors and detach only our hierarchy listeners. */
export function disposeStaticWorldTransforms(scene:T.Scene):void{
 const registry=registries.get(scene);if(!registry)return;
 registry.enabled=false;
 for(const owner of registry.owners){restore(registry,owner);detach(owner);}
 registry.members.clear();registries.delete(scene);
}
