import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import plan from './windsorSkyline.json' with {type:'json'};
type SiteRange={id:string;start:number;count:number};
type SkylineBatch={mesh:T.Mesh;geometry:T.BufferGeometry;ranges:SiteRange[]};
const owners=new WeakMap<T.Group,SkylineBatch[]>();
const exclusions=new WeakMap<T.Group,object>();
const geometryOwners=new WeakMap<T.BufferGeometry,()=>boolean>();
const disposedGeometries=new WeakSet<T.BufferGeometry>();
function rememberGeometry(geometry:T.BufferGeometry){
 const attributes=Object.entries(geometry.attributes),index=geometry.index;
 const version=(a:T.BufferAttribute|T.InterleavedBufferAttribute)=>a instanceof T.BufferAttribute?a.version:a.data.version;
 const versions=attributes.map(([,a])=>version(a)),indexVersion=index?.version;
 const range={...geometry.drawRange},groups=geometry.groups.map(group=>({...group}));
 geometry.addEventListener('dispose',()=>disposedGeometries.add(geometry));
 const matches=()=>{let attributeCount=0;for(const _name in geometry.attributes)attributeCount++;
  return!disposedGeometries.has(geometry)&&geometry.index===index&&index?.version===indexVersion&&
  geometry.drawRange.start===range.start&&geometry.drawRange.count===range.count&&geometry.groups.length===groups.length&&
  groups.every((group,i)=>geometry.groups[i].start===group.start&&geometry.groups[i].count===group.count&&geometry.groups[i].materialIndex===group.materialIndex)&&
  attributeCount===attributes.length&&attributes.every(([name,a],i)=>geometry.getAttribute(name)===a&&version(a)===versions[i]);};
 geometryOwners.set(geometry,matches);return matches;
}
/** Persistent mapped south-bank silhouettes, batched by facade material.
 * Kept in every quality tier; only subpixel window detail fades. */
export function addWaterfrontSkyline(scene:T.Scene){
 const root=new T.Group();root.name='Windsor waterfront · mapped skyline';
 const batches:SkylineBatch[]=[];
 for(const kind of ['stone','glass']){
  const geometry:T.BufferGeometry[]=[],ranges:SiteRange[]=[];let start=0;
  for(const b of plan.buildings.filter(b=>b.material===kind)){
   const shape=new T.Shape(b.points.map(([x,z])=>new T.Vector2(x,-z)));
   const g=new T.ExtrudeGeometry(shape,{depth:b.height-b.base,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,2+b.base,0);const part=g.index?g.toNonIndexed():g;if(part!==g)g.dispose();geometry.push(part);
   const count=part.getAttribute('position').count;ranges.push({id:b.id,start,count});start+=count;
  }
  if(!geometry.length)continue;
  const g=mergeGeometries(geometry)!;geometry.forEach(v=>v.dispose());g.computeBoundingSphere();
  const m=new T.MeshStandardMaterial({name:kind==='glass'?'Detroit reflective blue glass':'Detroit limestone',color:kind==='glass'?0x416879:0x9b9589});
  const mesh=new T.Mesh(g,m);mesh.name='Windsor waterfront '+kind;root.add(mesh);
  rememberGeometry(g);batches.push({mesh,geometry:g,ranges});
 }
 owners.set(root,batches);
 scene.add(root);return root;
}

/** The broad skyline source also contains these two island footprints. Retain
 * every other submitted vertex in its original order while verified studies
 * own those sites. The source geometry and material remain available intact. */
export function excludeWaterfrontSkylineSites(root:T.Group,ids:readonly string[]){
 const batches=owners.get(root),selected=new Set(ids),token={},parent=root.parent;
 if(!batches||exclusions.has(root)||!selected.size)throw Error('Waterfront skyline exclusion ownership unavailable');
 for(const id of selected)if(batches.flatMap(b=>b.ranges).filter(r=>r.id===id).length!==1)throw Error('Waterfront skyline site is missing or ambiguous: '+id);
 const changes:{batch:SkylineBatch;replacement:T.BufferGeometry;matches:()=>boolean;before:T.Mesh['onBeforeRender'];hook:T.Mesh['onBeforeRender']}[]=[];
 try{
  for(const batch of batches){
   if(!batch.ranges.some(r=>selected.has(r.id)))continue;
   if(batch.mesh.parent!==root||batch.mesh.geometry!==batch.geometry||!geometryOwners.get(batch.geometry)?.())throw Error('Waterfront skyline source changed before exclusion');
   const replacement=batch.geometry.clone(),indices:number[]=[];
   for(const range of batch.ranges)if(!selected.has(range.id))for(let i=range.start;i<range.start+range.count;i++)indices.push(i);
   replacement.setIndex(indices);replacement.setDrawRange(0,indices.length);
   const matches=rememberGeometry(replacement),before=batch.mesh.onBeforeRender;
   // A custom hook also keeps this owned draw out of static palette batching.
   // Forward the native callback exactly; no extra renders or material changes.
   const hook:T.Mesh['onBeforeRender']=function(this:T.Mesh,...args){return Reflect.apply(before,this,args);};
   changes.push({batch,replacement,matches,before,hook});
  }
  exclusions.set(root,token);
  for(const change of changes){change.batch.mesh.geometry=change.replacement;change.batch.mesh.onBeforeRender=change.hook;}
 }catch(error){for(const c of changes){if(c.batch.mesh.geometry===c.replacement)c.batch.mesh.geometry=c.batch.geometry;if(c.batch.mesh.onBeforeRender===c.hook)c.batch.mesh.onBeforeRender=c.before;geometryOwners.delete(c.replacement);c.replacement.dispose();}if(exclusions.get(root)===token)exclusions.delete(root);throw error;}
 let active=true;
 return{
  intact:()=>active&&root.parent===parent&&exclusions.get(root)===token&&changes.every(c=>c.batch.mesh.parent===root&&c.batch.mesh.geometry===c.replacement&&c.batch.mesh.onBeforeRender===c.hook&&c.matches()),
  rollback(){if(!active)return;active=false;
   for(const c of changes){if(c.batch.mesh.geometry===c.replacement)c.batch.mesh.geometry=c.batch.geometry;if(c.batch.mesh.onBeforeRender===c.hook)c.batch.mesh.onBeforeRender=c.before;geometryOwners.delete(c.replacement);if(!disposedGeometries.has(c.replacement))c.replacement.dispose();}
   if(exclusions.get(root)===token)exclusions.delete(root);
  },
 };
}

/** Copies actual current draw-range/index membership, including the skyline
 * owner outside landmarks.scene. Unknown or mutated geometry never means zero. */
export function waterfrontSkylineSiteReceipts(root:T.Group,ids:readonly string[]){
 const batches=owners.get(root);if(!batches)return null;
 return ids.map(id=>{
  const found=batches.flatMap(batch=>batch.ranges.filter(range=>range.id===id).map(range=>({batch,range})));
  if(found.length!==1)return{id,known:false,attached:false,vertices:null};
  const {batch,range}=found[0],geometry=batch.mesh.geometry,known=!!geometryOwners.get(geometry)?.();
  let attached=batch.mesh.parent===root;for(let o:T.Object3D|null=batch.mesh;o;o=o.parent)if(!o.visible)attached=false;
  if(!root.parent)attached=false;
  let vertices:number|null=null;
  if(known){vertices=0;const count=geometry.index?.count??geometry.getAttribute('position').count,start=Math.max(0,geometry.drawRange.start),end=Math.min(count,start+geometry.drawRange.count);
   for(let i=start;i<end;i++){const vertex=geometry.index?geometry.index.getX(i):i;if(vertex>=range.start&&vertex<range.start+range.count)vertices++;}
  }
  return{id,known,attached,vertices,mesh:batch.mesh.name,sourceVertices:range.count,exclusionOwned:exclusions.has(root)};
 });
}
