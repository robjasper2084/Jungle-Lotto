import * as T from 'three';

export type GroundLayout={id:string;center:number[];yaw:number;stairs?:{rise:number;count:number;tread:number;width:number;outsideStart:number;landingStart:number;landingEnd:number;insideEnd:number}};
export type GroundTerrain={height(x:number,z:number,y?:number):number;obstructed(x:number,z:number,margin?:number):unknown;land?(x:number,z:number,y?:number):boolean};
type Surface={height:number;mesh:string;triangle:number;vertices:number[][]};
const epsilon=1e-4;
const world=(c:GroundLayout,u:number,v:number)=>({x:c.center[0]+Math.cos(c.yaw)*u-Math.sin(c.yaw)*v,z:c.center[1]-Math.sin(c.yaw)*u-Math.cos(c.yaw)*v});
const meshes=(root:T.Object3D,accept:(mesh:T.Mesh)=>boolean)=>{const result:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&accept(o))result.push(o);});return result;};

/** Independent upward-facing triangle intersection. Unlike Mesh.raycast this
 * does not lazily compute bounds or change any scene/geometry state. */
export function readGroundSurface(objects:readonly T.Mesh[],x:number,z:number,ceiling=5):Surface|null{
 const ray=new T.Ray(new T.Vector3(x,ceiling,z),new T.Vector3(0,-1,0));
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3();let best:Surface|null=null;
 for(const mesh of objects){
  const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
  if(!position||mesh instanceof T.InstancedMesh||mesh instanceof T.BatchedMesh)continue;
  const available=index?.count??position.count,start=geometry.drawRange.start,end=Math.min(available,start+geometry.drawRange.count);
  for(let i=start;i+2<end;i+=3){
   const group=geometry.groups.find(g=>i>=g.start&&i+2<g.start+g.count),material=Array.isArray(mesh.material)?group&&mesh.material[group.materialIndex??0]:mesh.material;
   if(!material||!material.visible||material.opacity<=0)continue;
   a.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
   b.fromBufferAttribute(position,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
   c.fromBufferAttribute(position,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
   if(ray.intersectTriangle(a,b,c,true,hit)&&hit.y>=ceiling-5&&(!best||hit.y>best.height))best={height:hit.y,mesh:mesh.name,triangle:i/3,vertices:[a.toArray(),b.toArray(),c.toArray()]};
  }
 }
 return best;
}

/** Read original terrain support and actual authored walking surfaces at every
 * source stair flight and the retained Conservatory approach. These are game
 * coordinates, not surveyed elevations. No tolerance is inferred from a pass. */
export function readStagedGroundFit(root:T.Object3D,terrain:GroundTerrain,layouts:{aquarium?:GroundLayout;conservatory?:GroundLayout}){
 const aquarium=layouts.aquarium,conservatory=layouts.conservatory;
 const aquariumLod=aquarium&&root.getObjectByName(aquarium.id+'_STAGED_LODS');
 const conservatoryLod=conservatory&&root.getObjectByName(conservatory.id+'_STAGED_LODS');
 const stairRows=[];
 if(aquarium?.stairs&&aquariumLod instanceof T.LOD){
  const s=aquarium.stairs,stations=[
   ...Array.from({length:s.count},(_,i)=>({part:'outside-step',number:i+1,v:s.outsideStart+(i+.5)*s.tread})),
   ...[.2,.5,.8].map(t=>({part:'landing',number:0,v:s.landingStart+(s.landingEnd-s.landingStart)*t})),
   ...Array.from({length:s.count-1},(_,i)=>({part:'inside-step',number:i+1,v:s.landingEnd+(i+.5)*s.tread})),
  ];
  for(const [level,entry]of aquariumLod.levels.entries()){
   const floors=meshes(entry.object,m=>/^Entrance(?:OutsideSteps|InsideSteps|FlatLanding)__/.test(m.name));
   for(const u of [-s.width*.36,-s.width*.2,s.width*.2,s.width*.36])for(const station of stations){
    const p=world(aquarium,u,station.v),support=terrain.height(p.x,p.z,2),surface=readGroundSurface(floors,p.x,p.z,support+1);
    stairRows.push({level,u,...station,...p,support,surface,difference:surface?surface.height-support:null});
   }
  }
 }
 const paving=meshes(root,m=>m.name==='107310050_Conservatory_concrete_paving'||m.name==='107310050_Conservatory concrete paving');
 const pavingRows=[];
 if(conservatory&&conservatoryLod instanceof T.LOD){
  for(const u of [-23,-21,-19,-17,-15.5,-12])for(const v of [-1,0,1]){
   const p=world(conservatory,u,v),support=terrain.height(p.x,p.z,2),retained=readGroundSurface(paving,p.x,p.z,support+1);
   const levels=conservatoryLod.levels.map((entry,level)=>{
    const threshold=readGroundSurface(meshes(entry.object,m=>m.name==='VestibuleFlushThreshold__sidewalk'),p.x,p.z,support+1);
    const visibleHeight=Math.max(retained?.height??-Infinity,threshold?.height??-Infinity);
    return{level,threshold,visibleHeight,stagedMinusRetained:threshold&&retained?threshold.height-retained.height:null,
     visibleMinusRetained:retained?visibleHeight-retained.height:null};
   });
   pavingRows.push({u,v,...p,support,retained,originalVisualOffset:retained?retained.height-support:null,levels});
  }
 }
 const retainedOffsets=pavingRows.map(row=>row.originalVisualOffset).filter((n):n is number=>n!==null);
 const maximumOriginalVisualOffset=retainedOffsets.length?Math.max(...retainedOffsets):null;
 const stairComplete=!!aquarium?.stairs&&aquariumLod instanceof T.LOD&&aquariumLod.levels.length===3&&stairRows.length===(aquarium.stairs.count*2+2)*4*3;
 const pavingComplete=conservatoryLod instanceof T.LOD&&conservatoryLod.levels.length===3&&pavingRows.length===18&&pavingRows.every(row=>!!row.retained);
 const stairsAgree=stairComplete&&stairRows.every(row=>row.difference!==null&&Math.abs(row.difference)<=epsilon);
 // These pointwise references were independently read from the unmodified
 // 61a9db36 GLBs and original retained paving, not inferred from a global max.
 // LOD0's threshold is already 1cm above the approach. Recording that existing
 // step is a structural receipt, not approval of its appearance or ground fit.
 const surfacesUnchanged=pavingComplete&&pavingRows.every(row=>Math.abs(row.support-2)<=epsilon&&Math.abs(row.retained!.height-(row.u<=-17?2.07:2.08))<=epsilon&&row.levels.every(level=>{
  const expectedThreshold=level.level===0&&row.u>=-21.6&&row.u<=-16;
  return expectedThreshold?!!level.threshold&&Math.abs(level.threshold.height-2.08)<=epsilon:level.threshold===null;
 }));
 return{version:1,structuralReceiptPassed:stairsAgree&&surfacesUnchanged,epsilon,stairs:{complete:stairComplete,agrees:stairsAgree,samples:stairRows},
  paving:{complete:pavingComplete,measuredSurfaceHeightsUnchanged:surfacesUnchanged,maximumOriginalVisualOffset,samples:pavingRows,
   reference:{sourceHead:'61a9db36df072850f4bcea4536471e3d92e07453',retainedGlbBlob:'8319c6e16be404ac8316754e4459d1f864532220',approachHeight:2.07,interiorHeight:2.08,nearThresholdHeight:2.08}},
  visualFitAcceptance:'Pending independent native PNG and route review. The existing near threshold is about 1cm above retained approach paving; original paving is 7–8cm above original game terrain.',
  scope:'Actual loaded triangle heights against original game support and pointwise retained paving. A passing structural receipt is not visual-fit approval, surveyed elevation, complete building collision parity, or native route acceptance.'};
}

/** Complete LOD0 bounds projected by the real last-rendered camera, including
 * geometry hidden by native LOD choice. It is a framing receipt, not an
 * occlusion or appearance verdict; all selected LODs remain in the receipt. */
export function readStagedExterior(root:T.Object3D,id:string,camera:T.Camera|null){
 const lod=root.getObjectByName(id+'_STAGED_LODS'),bounds=new T.Box3(),point=new T.Vector3();let vertices=0;
 if(lod instanceof T.LOD&&lod.levels[0])for(const mesh of meshes(lod.levels[0].object,()=>true)){
  const positions=mesh.geometry.getAttribute('position');if(!positions)continue;
  for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);bounds.expandByPoint(point);vertices++;}
 }
 const corners:number[][]=[],projected:number[][]=[];
 if(!bounds.isEmpty())for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){
  corners.push([x,y,z]);if(camera)projected.push(new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix).toArray());
 }
 const valid=vertices>0&&corners.length===8&&!!camera;
 const direction=camera?new T.Vector3(0,0,-1).transformDirection(camera.matrixWorld):null;
 return{id,ready:valid,vertices,bounds:bounds.isEmpty()?null:{min:bounds.min.toArray(),max:bounds.max.toArray(),center:bounds.getCenter(new T.Vector3()).toArray()},corners,projected,
  selectedLevels:lod instanceof T.LOD?lod.levels.flatMap((entry,i)=>entry.object.visible?[i]:[]):[],
  camera:camera?{position:new T.Vector3().setFromMatrixPosition(camera.matrixWorld).toArray(),direction:direction!.toArray(),fov:(camera as T.PerspectiveCamera).fov,aspect:(camera as T.PerspectiveCamera).aspect}:null,
  completeBoundsInFrame:valid&&projected.every(p=>p.every(Number.isFinite)&&Math.abs(p[0])<=.9&&Math.abs(p[1])<=.9&&p[2]>=-1&&p[2]<=1),
  scope:'All full-model world-bound corners inside the real camera with 5% viewport margin; surrounding-scene occlusion and architectural appearance need the actual PNG.'};
}

/** Bounded read-only queries for the external native-input route planner. */
export function readStagedRouteGround(terrain:GroundTerrain,points:readonly {x:number;z:number}[]){
 if(!terrain.land||points.length>20000||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)))throw Error('Invalid read-only route query');
 return points.map(({x,z})=>{
  const height=terrain.height(x,z,2),walkable=Number.isFinite(height)&&terrain.land!(x,z,2)&&!terrain.obstructed(x,z,.7);
  return{x,z,height,walkable,planningClearance:walkable?(terrain.obstructed(x,z,2.25)?.7:2.25):0};
 });
}
