/**
 * Optional Jefferson presentation assets. This module never edits mapped
 * footprints, building heights, road surfaces, or collision registrations.
 * Assignments are supplied by the reviewed placement list. Generated styles
 * are original game art, not surveyed replicas of the real buildings.
 */
import * as T from 'three';

export type JeffersonPrototype = 'SunsetBlock1' | 'SunsetBlock2' | 'SunsetBlock3' | 'SunsetBlock4' | 'JEF_detroit_38139' | 'JEF_886253052';
export type JeffersonFit = Readonly<{id:string;x:number;z:number;yaw:number;w:number;d:number;h:number}>;
export type JeffersonAssignment = Readonly<{
  buildingId:string;
  prototype:JeffersonPrototype;
  yawOffset?:number;
  /** Human-reviewed reference/capture identifier. This is not automated certification. */
  reviewedReference:string;
}>;
export const JEFFERSON_BUILDING_ASSIGNMENTS:readonly JeffersonAssignment[] = [];
export const JEFFERSON_BUILDING_URL = './belle/jefferson/models/Jefferson_Assigned_Buildings.glb';
export const JEFFERSON_STREET_URL = './belle/jefferson/models/Jefferson_Assigned_Street.glb';

export type JeffersonLoader = {loadAsync(url:string):Promise<{scene:T.Group}>};
export type JeffersonBuildingSelection = {
  /** Original fit IDs, with a prepared normalized prototype for each selected ID. */
  byBuildingId:ReadonlyMap<string,T.Object3D>;
  source:T.Group;
  /** Only call before publication, or after all using meshes have been removed. */
  dispose:()=>void;
};
const PROTOTYPES:readonly JeffersonPrototype[] = ['SunsetBlock1','SunsetBlock2','SunsetBlock3','SunsetBlock4','JEF_detroit_38139','JEF_886253052'];
type Footprint=Readonly<{id:string;points:readonly (readonly [number,number])[]}>;

function materials(root:T.Object3D){
  const values=new Set<T.Material>();
  root.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])values.add(m);});
  return values;
}
/** Resource ownership is limited to a newly loaded asset, never the old game pack. */
export function disposeJeffersonSource(root:T.Object3D){
  const geometry=new Set<T.BufferGeometry>(),textures=new Set<T.Texture>();
  root.traverse(o=>{if(o instanceof T.Mesh)geometry.add(o.geometry);});
  for(const m of materials(root)){
    for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);
    m.dispose();
  }
  for(const value of geometry)value.dispose();
  for(const value of textures)value.dispose();
}

function namedExactlyOnce(root:T.Object3D,name:string){
  const found:T.Object3D[]=[];root.traverse(o=>{if(o.name===name)found.push(o);});
  if(found.length!==1)throw Error(`Jefferson asset requires one ${name}; found ${found.length}`);
  return found[0];
}

function validateNormalizedPrototype(root:T.Object3D,name:JeffersonPrototype){
  const object=namedExactlyOnce(root,name);
  // The existing instance builder multiplies each mesh.matrixWorld. Therefore
  // validate the complete authored transforms, not only raw vertex positions.
  root.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(object,true),eps=.0002;
  const actual=[box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z];
  const expected=[-.5,0,-.5,.5,1,.5];
  if(actual.some((n,i)=>!Number.isFinite(n)||Math.abs(n-expected[i])>eps))
    throw Error(`Jefferson ${name} must be normalized to x/z ±0.5, y 0..1; received ${actual.join(',')}`);
  let meshes=0;
  object.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    if(o instanceof T.SkinnedMesh||o instanceof T.InstancedMesh||o.morphTargetInfluences?.length)
      throw Error(`Jefferson ${name} requires static plain meshes`);
    if(!o.geometry.getAttribute('position')||!o.geometry.getAttribute('normal')||!o.geometry.getAttribute('uv'))
      throw Error(`Jefferson ${name} is missing position/normal/UV data`);
    meshes++;
  });
  if(!meshes)throw Error(`Jefferson ${name} has no mesh`);
  return object;
}

function withinFootprint(x:number,z:number,ring:Footprint['points'],tolerance=.02){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<=tolerance)return true;
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

/** Adapted roots are locked to their existing mapped building and fit.
 * They may extend beyond the old 98% rectangle, but never beyond the actual
 * polygon. This load-time check complements the offline triangle-area audit. */
function validateAssignedPrototype(root:T.Object3D,assignment:JeffersonAssignment,fit:JeffersonFit,footprints:readonly Footprint[]){
  const object=namedExactlyOnce(root,assignment.prototype),metadata=object.userData;
  if(metadata.jeffersonBuildingId!==fit.id||(assignment.yawOffset??0)!==0)
    throw Error(`Jefferson ${assignment.prototype} is authored for a different building or yaw`);
  for(const key of ['x','z','yaw','w','h','d'] as const)
    if(!Number.isFinite(metadata.jeffersonFit?.[key])||Math.abs(metadata.jeffersonFit[key]-fit[key])>1e-5)
      throw Error(`Jefferson ${assignment.prototype} has a stale ${key} fit`);
  const matches=footprints.filter(p=>p.id===fit.id);
  if(matches.length!==1||matches[0].points.length<3)throw Error(`Jefferson ${fit.id} requires its exact mapped footprint`);
  root.updateMatrixWorld(true);
  const fitMatrix=new T.Matrix4().makeRotationY(fit.yaw).scale(new T.Vector3(fit.w,fit.h,fit.d));
  fitMatrix.setPosition(fit.x,0,fit.z);
  const combined=new T.Matrix4(),point=new T.Vector3(),limit=.5/.98+.0002;
  const bounds=new T.Box3().setFromObject(object,true);
  if(bounds.min.x < -limit||bounds.max.x > limit||bounds.min.z < -limit||bounds.max.z > limit||
    bounds.min.y < -.0002||Math.abs(bounds.min.y)>.002||Math.abs(bounds.max.y-1)>.002)
    throw Error(`Jefferson ${fit.id} has invalid adapted bounds`);
  let vertices=0;
  object.traverse(mesh=>{
    if(!(mesh instanceof T.Mesh))return;
    if(mesh instanceof T.SkinnedMesh||mesh instanceof T.InstancedMesh||mesh.morphTargetInfluences?.length)
      throw Error(`Jefferson ${fit.id} requires static plain meshes`);
    const positions=mesh.geometry.getAttribute('position');
    if(!positions||!mesh.geometry.getAttribute('normal')||!mesh.geometry.getAttribute('uv'))
      throw Error(`Jefferson ${fit.id} is missing position/normal/UV data`);
    combined.multiplyMatrices(fitMatrix,mesh.matrixWorld);
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(combined);
      if(![point.x,point.y,point.z].every(Number.isFinite)||point.y<-.002||point.y>fit.h+.002||!withinFootprint(point.x,point.z,matches[0].points))
        throw Error(`Jefferson ${fit.id} has a vertex outside its mapped building`);
      vertices++;
    }
  });
  if(!vertices)throw Error(`Jefferson ${fit.id} has no mesh`);
  return object;
}

/**
 * All allowlisted IDs must resolve to exactly one existing fitted building.
 * Invalid/ambiguous IDs fail before any request. Caller can retain the original
 * pack as one transaction when this throws. No automatic nearest-ID matching.
 */
export async function prepareJeffersonBuildingSkins(
  fits:readonly JeffersonFit[],loader:JeffersonLoader,
  options:{enabled:boolean;assignments?:readonly JeffersonAssignment[];footprints?:readonly Footprint[];url?:string},
):Promise<JeffersonBuildingSelection|undefined>{
  const assignments=options.assignments??JEFFERSON_BUILDING_ASSIGNMENTS;
  if(!options.enabled||assignments.length===0)return;
  const selected=new Map<string,JeffersonAssignment>();
  for(const assignment of assignments){
    if(!assignment.buildingId.trim()||selected.has(assignment.buildingId))throw Error('Duplicate/empty Jefferson building ID');
    if(!PROTOTYPES.includes(assignment.prototype)||!assignment.reviewedReference.trim()||!Number.isFinite(assignment.yawOffset??0))throw Error('Unreviewed Jefferson assignment');
    const matched=fits.filter(f=>f.id===assignment.buildingId);
    if(matched.length!==1)throw Error(`Jefferson building ${assignment.buildingId} resolves to ${matched.length} existing fits`);
    const fit=matched[0];
    if(![fit.x,fit.z,fit.yaw,fit.w,fit.d,fit.h].every(Number.isFinite)||Math.min(fit.w,fit.d,fit.h)<=0)
      throw Error(`Invalid Jefferson fit ${fit.id}`);
    selected.set(assignment.buildingId,assignment);
  }
  const source=(await loader.loadAsync(options.url??JEFFERSON_BUILDING_URL)).scene;
  try{
    const prototypes=new Map<JeffersonPrototype,T.Object3D>();
    for(const assignment of assignments){
      const fit=fits.find(f=>f.id===assignment.buildingId)!;
      // A fitted root is never a reusable archetype: validate every target,
      // including an accidental second use of an already cached root.
      if(assignment.prototype.startsWith('JEF_'))
        prototypes.set(assignment.prototype,validateAssignedPrototype(source,assignment,fit,options.footprints??[]));
      else if(!prototypes.has(assignment.prototype))
        prototypes.set(assignment.prototype,validateNormalizedPrototype(source,assignment.prototype));
    }
    const byBuildingId=new Map<string,T.Object3D>();
    for(const [id,assignment]of selected)byBuildingId.set(id,prototypes.get(assignment.prototype)!);
    let disposed=false;
    return {source,byBuildingId,dispose(){if(!disposed){disposed=true;disposeJeffersonSource(source);}}};
  }catch(error){disposeJeffersonSource(source);throw error;}
}

export const JEFFERSON_STREET_PROTOTYPES = [
  'JEF_JeffersonStreetSign','JEF_BelleIsleWayfinding','JEF_ParkingSign','JEF_StreetLamp',
  'JEF_Bollard','JEF_ConcretePlanter','JEF_LitterBin','JEF_UtilityCabinet',
] as const;
export type JeffersonStreetPrototype=typeof JEFFERSON_STREET_PROTOTYPES[number];
export type JeffersonStreetPlacement=Readonly<{
  id:string;prototype:JeffersonStreetPrototype;x:number;z:number;yaw:number;
  /** Keep physical dimensions unchanged; y comes from the existing ground sampler. */
  reviewedReference:string;
  /** New physical blockers require a separately reviewed collision change. */
  collisionPolicy:'visual-only';
}>;
export const JEFFERSON_STREET_PLACEMENTS:readonly JeffersonStreetPlacement[]=[];

/**
 * Optional metre-authored street kit. This independent transaction creates
 * only an off-scene group, checks existing terrain/road clearance, warms it,
 * then returns an explicit publish handle. It adds no collision registrations.
 */
export async function prepareJeffersonStreetKit(options:{
  enabled:boolean;placements?:readonly JeffersonStreetPlacement[];loader:JeffersonLoader;url?:string;
  scene:T.Scene;camera:T.Camera;
  ground:{height:(x:number,z:number)=>number;land:(x:number,z:number)=>boolean;obstructed:(x:number,z:number,margin:number)=>boolean};
  /** Both park and connected-district road records must be provided. */
  roads:readonly {width:number;points:readonly (readonly [number,number])[]}[];
  warmTextures:(group:T.Group)=>Promise<unknown>;
  warmPrograms:(group:T.Group,camera:T.Camera,scene:T.Scene)=>Promise<unknown>;
}):Promise<{group:T.Group;publish:()=>void;dispose:()=>void}|undefined>{
  const placements=options.placements??JEFFERSON_STREET_PLACEMENTS;
  if(!options.enabled||placements.length===0)return;
  const ids=new Set<string>();
  for(const p of placements){
    if(!p.id.trim()||ids.has(p.id))throw Error('Duplicate/empty Jefferson prop ID');ids.add(p.id);
    if(!JEFFERSON_STREET_PROTOTYPES.includes(p.prototype)||!p.reviewedReference.trim()||p.collisionPolicy!=='visual-only')
      throw Error(`Unreviewed Jefferson prop ${p.id}`);
    if(![p.x,p.z,p.yaw].every(Number.isFinite))throw Error(`Invalid Jefferson prop transform ${p.id}`);
    if(!options.ground.land(p.x,p.z))throw Error(`Jefferson prop ${p.id} is not on mapped land`);
  }
  const source=(await options.loader.loadAsync(options.url??JEFFERSON_STREET_URL)).scene;
  const group=new T.Group();group.name='Jefferson reviewed street details';
  let disposed=false,published=false;
  const dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();disposeJeffersonSource(source);};
  try{
    for(const p of placements){
      const proto=namedExactlyOnce(source,p.prototype),object=proto.clone(true);
      // The aggregate kit is spread out for review. Extract the named root at
      // its own local origin, preserving the internal metre-authored meshes.
      object.position.set(0,0,0);object.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(object,true),radius=Math.hypot(Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),Math.max(Math.abs(box.min.z),Math.abs(box.max.z)));
      if(!Number.isFinite(radius)||radius<=0)throw Error(`Invalid Jefferson prop bounds ${p.id}`);
      if(options.ground.obstructed(p.x,p.z,radius+.25))throw Error(`Jefferson prop ${p.id} overlaps an existing obstacle`);
      for(const road of options.roads)for(let i=1;i<road.points.length;i++){
        const [ax,az]=road.points[i-1],[bx,bz]=road.points[i],dx=bx-ax,dz=bz-az;
        const t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.z-az)*dz)/(dx*dx+dz*dz||1)));
        if(Math.hypot(p.x-ax-t*dx,p.z-az-t*dz)<road.width*.5+radius+.8)
          throw Error(`Jefferson prop ${p.id} intersects mapped road/path clearance`);
      }
      const height=options.ground.height(p.x,p.z);if(!Number.isFinite(height))throw Error('Invalid Jefferson terrain height');
      const placement=new T.Group();placement.name=p.id;placement.position.set(p.x,height,p.z);placement.rotation.y=p.yaw;
      placement.userData={jeffersonPrototype:p.prototype,reviewedReference:p.reviewedReference,collisionPolicy:p.collisionPolicy};
      placement.add(object);object.traverse(o=>{if(o instanceof T.Mesh){o.receiveShadow=true;}});group.add(placement);
    }
    await options.warmTextures(group);
    await options.warmPrograms(group,options.camera,options.scene);
    return {group,publish(){if(disposed)throw Error('Cannot publish disposed Jefferson props');if(!published){options.scene.add(group);published=true;}},dispose};
  }catch(error){dispose();throw error;}
}
