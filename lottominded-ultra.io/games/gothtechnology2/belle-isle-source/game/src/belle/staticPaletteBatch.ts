import * as T from 'three';
/** Display-only multi-draw groups. Each piece keeps its own transform, bounds and
 * visibility, so a hidden interior no longer splits an entire material batch.
 * Original scene meshes and collision remain authoritative outside split views.
 */
export class StaticPaletteBatch {
 readonly root=new T.Group();
 readonly stats={sourceDraws:0,batches:0};
 private groups:{sources:T.Mesh[];geometries:T.BufferGeometry[];materials:T.Material[];mesh:T.BatchedMesh;ids:number[];visible:boolean[];eligible:boolean[]}[]=[];
 private active=false;
 private ownedMaterials:T.Material[]=[];
 constructor(sources:T.Mesh[],selection?:number|ReadonlySet<T.Mesh>){
  const sameMaterial=typeof selection==='number'?undefined:selection;
  this.root.name='Split static material batches';this.root.visible=false;
  const groups=new Map<string,T.Mesh[]>(),materials=new Map<T.Material,string>();
  for(const mesh of sources){
   const m=mesh.material,g=mesh.geometry,exact=sameMaterial?.has(mesh)??false;
   if(mesh.userData.staticSprayReplaced||(mesh as T.SkinnedMesh).isSkinnedMesh||(mesh as T.InstancedMesh).isInstancedMesh||(mesh as T.BatchedMesh).isBatchedMesh||mesh.children.length||Array.isArray(m)||!(m instanceof T.MeshStandardMaterial)||m.type!=='MeshStandardMaterial'||m.transparent||m.opacity!==1||m.alphaTest||Object.keys(g.morphAttributes).length||!g.attributes.position||!g.attributes.normal||(!exact&&m.onBeforeCompile!==T.Material.prototype.onBeforeCompile&&!m.userData.realisticSurface)||m.vertexColors)continue;
   mesh.updateWorldMatrix(true,false);
   // The generated bridge tile positions are already in world coordinates.
   // With identical source transforms and the exact material object, even
   // custom local-position shader inputs and night uniforms remain identical.
   if(exact&&!mesh.matrixWorld.equals(identity))continue;
   let properties=exact?m.uuid:materials.get(m);
   if(properties===undefined){
    // Material JSON references textures by UUID. Seed those identities to avoid
    // encoding loaded texture images just to compare two opaque finishes.
    const textures:Record<string,{uuid:string}>={};for(const value of Object.values(m))if(value instanceof T.Texture)textures[value.uuid]={uuid:value.uuid};
    const json=m.toJSON({textures} as T.JSONMeta) as unknown as Record<string,unknown>;
    for(const key of ['uuid','name','color','vertexColors','metadata','userData'])delete json[key];
    properties=JSON.stringify(json);materials.set(m,properties);
   }
   const attributes=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name]);
   // Shared GPU programs can still bind different surface textures and uniforms.
   const surface=m.userData.realisticProfile??m.userData.realisticSurface;
   const key=[mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask,!!g.index,JSON.stringify(attributes),properties,m.customProgramCacheKey(),surface].join('|');
   const group=groups.get(key);if(group)group.push(mesh);else groups.set(key,[mesh]);
  }
  for(const sources of groups.values()){
   if(sources.length<2)continue;
   const first=sources[0],original=first.material as T.MeshStandardMaterial,exact=sameMaterial?.has(first),material=exact?original:original.clone();
   // Preserve the source-space procedural surface shader. BatchedMesh transforms
   // positions after begin_vertex, so no world-space texture rebaking is needed.
   if(!exact){
    this.ownedMaterials.push(material);material.color.setRGB(1,1,1);
    material.onBeforeCompile=(shader,renderer)=>original.onBeforeCompile(shader,renderer);
    material.customProgramCacheKey=()=>original.customProgramCacheKey();
   }
   const geometries=[...new Set(sources.map(s=>s.geometry))];
   const vertices=geometries.reduce((n,g)=>n+g.attributes.position.count,0),indices=geometries.reduce((n,g)=>n+(g.index?.count??0),0);
   const mesh=new T.BatchedMesh(sources.length,vertices,indices,material),geometryIds=new Map<T.BufferGeometry,number>();
   for(const geometry of geometries)geometryIds.set(geometry,mesh.addGeometry(geometry));
   const ids=sources.map(source=>{const id=mesh.addInstance(geometryIds.get(source.geometry)!);mesh.setMatrixAt(id,source.matrixWorld);if(!exact)mesh.setColorAt(id,(source.material as T.MeshStandardMaterial).color);return id;});
   mesh.name='Static multi-draw · '+first.name;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;mesh.matrixAutoUpdate=false;
   mesh.perObjectFrustumCulled=true;mesh.sortObjects=false;mesh.computeBoundingBox();mesh.computeBoundingSphere();this.root.add(mesh);
   this.groups.push({sources,mesh,ids,geometries:sources.map(s=>s.geometry),materials:sources.map(s=>s.material as T.Material),visible:[],eligible:[]});this.stats.sourceDraws+=sources.length;this.stats.batches++;
  }
 }
 beginView(worldShadows?:boolean){
  if(this.active)this.endView();this.active=true;this.root.visible=true;
  for(const group of this.groups){
   let casters=0,eligible=0;
   group.sources.forEach((source,i)=>{
    group.visible[i]=source.visible;
    let shown=true;for(let o:T.Object3D|null=source;o;o=o.parent)if(!o.visible){shown=false;break;}
    if(worldShadows!==undefined&&(source.geometry!==group.geometries[i]||source.material!==group.materials[i]))shown=false;
    group.eligible[i]=shown;
    if(shown){eligible++;if(source.castShadow)casters++;}
   });
   if(worldShadows!==undefined)group.mesh.castShadow=worldShadows&&casters>eligible-casters;
   const useBatch=worldShadows===undefined||(worldShadows?Math.max(casters,eligible-casters):eligible)>=2;
   group.mesh.visible=useBatch;
   group.sources.forEach((source,i)=>{
    const shown=useBatch&&group.eligible[i]&&(!worldShadows||source.castShadow===group.mesh.castShadow);
    group.mesh.setVisibleAt(group.ids[i],shown);
    if(shown)source.visible=false;
   });
  }
 }
 endView(){if(!this.active)return;for(const group of this.groups)group.visible.forEach((visible,i)=>group.sources[i].visible=visible);this.root.visible=false;this.active=false;}
 dispose(){this.endView();this.root.removeFromParent();for(const group of this.groups)group.mesh.dispose();for(const m of this.ownedMaterials)m.dispose();}
}
const identity=new T.Matrix4();
