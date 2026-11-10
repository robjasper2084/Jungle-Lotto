import * as T from 'three';
/** Display-only multi-draw groups. Each piece keeps its own transform, bounds and
 * visibility, so a hidden interior no longer splits an entire material batch.
 * Original scene meshes and collision remain authoritative outside split views.
 */
export class StaticPaletteBatch {
 readonly root=new T.Group();
 readonly stats={sourceDraws:0,batches:0};
 private groups:{sources:T.Mesh[];mesh:T.BatchedMesh;ids:number[];visible:boolean[]}[]=[];
 private active=false;
 constructor(sources:T.Mesh[],_cellSize=512){
  this.root.name='Split static material batches';this.root.visible=false;
  const groups=new Map<string,T.Mesh[]>();
  for(const mesh of sources){
   const m=mesh.material,g=mesh.geometry;
   if(mesh.userData.staticSprayReplaced||(mesh as T.SkinnedMesh).isSkinnedMesh||(mesh as T.InstancedMesh).isInstancedMesh||(mesh as T.BatchedMesh).isBatchedMesh||mesh.children.length||Array.isArray(m)||!(m instanceof T.MeshStandardMaterial)||m.type!=='MeshStandardMaterial'||m.transparent||m.opacity!==1||m.alphaTest||Object.keys(g.morphAttributes).length||!g.attributes.position||!g.attributes.normal||(m.onBeforeCompile!==T.Material.prototype.onBeforeCompile&&!m.userData.realisticSurface)||m.vertexColors)continue;
   mesh.updateWorldMatrix(true,false);
   const json=m.toJSON() as unknown as Record<string,unknown>;for(const key of ['uuid','name','color','vertexColors','metadata','userData'])delete json[key];
   const attributes=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name]);
   const key=[mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask,!!g.index,JSON.stringify(attributes),JSON.stringify(json),m.customProgramCacheKey()].join('|');
   const group=groups.get(key);if(group)group.push(mesh);else groups.set(key,[mesh]);
  }
  for(const sources of groups.values()){
   if(sources.length<2)continue;
   const first=sources[0],original=first.material as T.MeshStandardMaterial,material=original.clone();
   material.color.setRGB(1,1,1);
   // Preserve the source-space procedural surface shader. BatchedMesh transforms
   // positions after begin_vertex, so no world-space texture rebaking is needed.
   material.onBeforeCompile=(shader,renderer)=>original.onBeforeCompile(shader,renderer);
   material.customProgramCacheKey=()=>original.customProgramCacheKey();
   const geometries=[...new Set(sources.map(s=>s.geometry))];
   const vertices=geometries.reduce((n,g)=>n+g.attributes.position.count,0),indices=geometries.reduce((n,g)=>n+(g.index?.count??0),0);
   const mesh=new T.BatchedMesh(sources.length,vertices,indices,material),geometryIds=new Map<T.BufferGeometry,number>();
   for(const geometry of geometries)geometryIds.set(geometry,mesh.addGeometry(geometry));
   const ids=sources.map(source=>{const id=mesh.addInstance(geometryIds.get(source.geometry)!);mesh.setMatrixAt(id,source.matrixWorld);mesh.setColorAt(id,(source.material as T.MeshStandardMaterial).color);return id;});
   mesh.name='Static multi-draw · '+first.name;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;mesh.matrixAutoUpdate=false;
   mesh.perObjectFrustumCulled=true;mesh.sortObjects=false;mesh.computeBoundingBox();mesh.computeBoundingSphere();this.root.add(mesh);
   this.groups.push({sources,mesh,ids,visible:[]});this.stats.sourceDraws+=sources.length;this.stats.batches++;
  }
 }
 beginView(){
  if(this.active)this.endView();this.active=true;this.root.visible=true;
  for(const group of this.groups){
   group.visible=group.sources.map(s=>s.visible);
   group.sources.forEach((source,i)=>{let visible=true;for(let o:T.Object3D|null=source;o;o=o.parent)if(!o.visible){visible=false;break;}group.mesh.setVisibleAt(group.ids[i],visible);});
   group.sources.forEach(source=>source.visible=false);
  }
 }
 endView(){if(!this.active)return;for(const group of this.groups){group.visible.forEach((visible,i)=>group.sources[i].visible=visible);group.visible=[];}this.root.visible=false;this.active=false;}
 dispose(){this.endView();this.root.removeFromParent();for(const group of this.groups){group.mesh.dispose();(group.mesh.material as T.Material).dispose();}}
}
