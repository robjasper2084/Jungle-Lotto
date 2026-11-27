import * as T from 'three';
import {replaceableLegacyMesh,legacyDetailName,STUDY_SITES} from './stagedLandmarkStudies.ts';
import {waterfrontSkylineSiteReceipts} from './waterfrontSkyline.ts';
import {sweepVisibleMeshTriangles} from './visibleTriangleSweep.ts';
import {readStagedViewBounds} from './stagedLandmarkViewBounds.ts';
import {readStagedGroundFit,readStagedExterior,readStagedRouteGround,readStagedRouteSweeps,type GroundLayout,type GroundRouteSegment} from './stagedLandmarkGroundFit.ts';

type Point={x:number;y:number;z:number};
type Actor=Point&{headingY:number;speed:number;footBlend:number;footMode?:number};
type Layout=GroundLayout;
type Terrain={height(x:number,z:number,y?:number):number;obstructed(x:number,z:number,margin?:number):unknown;land?(x:number,z:number,y?:number):boolean;raycastObstacle(o:Point,d:Point,max:number,half?:number):number|null};
const retained=[
 '107227742_Aquarium illuminated habitat','107227742_Aquarium aged handrails',
 '107227742_Aquarium worn step nosings','107310050_Conservatory concrete paving',
 '107310050_Timber','107310050_Water lily golden heart',
];
const bodyHeights=[.62,1.1,1.58],bodyRadius=.27,probeLength=.7;
function visible(object:T.Object3D){for(let o:T.Object3D|null=object;o;o=o.parent)if(!o.visible)return false;return true;}
function local(c:Layout,x:number,z:number){const dx=x-c.center[0],dz=z-c.center[1];return{u:dx*Math.cos(c.yaw)-dz*Math.sin(c.yaw),v:-dx*Math.sin(c.yaw)-dz*Math.cos(c.yaw)};}

/** Read-only, explicitly requested staging evidence. No actor/camera setters,
 * scene changes, synthetic input, collider changes, or render hooks are exposed.
 * Callbacks copy the real loop's current pose and view. Expensive observations
 * run only when the external harness requests a snapshot, outside FPS gates. */
export function createStagedLandmarkProof(root:T.Object3D,terrain:Terrain,layouts:{aquarium?:Layout;conservatory?:Layout},skylineRoot?:T.Group){
 let actor:(Actor&{firstPerson:boolean})|null=null,camera:T.Camera|null=null,frames=0,time:number|null=null;
 const copies=new Map([layouts.aquarium,layouts.conservatory].filter((c):c is Layout=>!!c).map(c=>[c.id,JSON.parse(JSON.stringify(c)) as Layout]));
 const ray=new T.Raycaster();
 function probe(dx:number,dz:number){
  if(!actor)return null;
  const x=actor.x+dx*probeLength,z=actor.z+dz*probeLength,d={x:dx,y:0,z:dz};
  const hits=bodyHeights.map(h=>terrain.raycastObstacle({x:actor!.x,y:actor!.y+h,z:actor!.z},d,probeLength,bodyRadius));
  return{x,z,floor:terrain.height(x,z,actor.y),blocked:!!terrain.obstructed(x,z,bodyRadius),radius:bodyRadius,maxDistance:probeLength,bodyHeights:[...bodyHeights],sweptHits:hits};
 }
 const snapshot=()=>{
  const nodes:T.Object3D[]=[];root.traverse(o=>nodes.push(o));
  const skylineSites=skylineRoot?waterfrontSkylineSiteReceipts(skylineRoot,STUDY_SITES.map(s=>s.id)):null;
  const sites=STUDY_SITES.map(spec=>{
   const cfg=copies.get(spec.id),lod=root.getObjectByName(spec.id+'_STAGED_LODS');
   const legacy=nodes.filter(o=>(o as T.Mesh).isMesh&&replaceableLegacyMesh(spec.id,o.name));
   return{id:spec.id,name:spec.name,layout:cfg?JSON.parse(JSON.stringify(cfg)):null,
    local:actor&&cfg?local(cfg,actor.x,actor.z):null,floor:actor?terrain.height(actor.x,actor.z,actor.y):null,
    blocked:actor?!!terrain.obstructed(actor.x,actor.z,bodyRadius):null,
    installedLods:lod instanceof T.LOD?lod.levels.length:0,
    selectedLevels:lod instanceof T.LOD?lod.levels.flatMap((level,i)=>visible(level.object)?[i]:[]):[],
    attachedLegacyFacades:legacy.map(o=>o.name),
    skylineDuplicate:skylineSites?.find(s=>s.id===spec.id)??null,
    retainedDetails:retained.filter(name=>name.startsWith(spec.id+'_')&&nodes.some(o=>legacyDetailName(spec.id,o.name)===legacyDetailName(spec.id,name))),
    retainedDetailNodes:retained.filter(name=>name.startsWith(spec.id+'_')).flatMap(authored=>nodes.filter(o=>legacyDetailName(spec.id,o.name)===legacyDetailName(spec.id,authored)).map(o=>({authored,loaded:o.name}))),
   };
  });
  const sin=actor?Math.sin(actor.headingY):0,cos=actor?Math.cos(actor.headingY):1;
  const forwardProbe=probe(sin,cos),directionalProbes={forward:forwardProbe,backward:probe(-sin,-cos),right:probe(cos,-sin),left:probe(-cos,sin)};
  // Rendered, visible site geometry at the forward sweep heights provides a
  // separate visual-contact receipt; it does not replace the existing collider.
  const siteRoots=STUDY_SITES.map(s=>root.getObjectByName(s.id+'_STAGED_LODS')).filter((o):o is T.Object3D=>!!o);
  const legacyMeshes=nodes.filter(o=>o instanceof T.Mesh&&STUDY_SITES.some(s=>o.name.startsWith(s.id+'_'))&&!siteRoots.some(r=>r===o));
  const candidateMeshes:T.Mesh[]=[];for(const r of siteRoots)r.traverse(o=>{if(o instanceof T.Mesh)candidateMeshes.push(o);});
  const geometry=[...new Set([...candidateMeshes,...legacyMeshes])].filter((o):o is T.Mesh=>o instanceof T.Mesh&&visible(o));
  const visibleForwardSurfaces=actor?bodyHeights.map(h=>{
   ray.set(new T.Vector3(actor!.x,actor!.y+h,actor!.z),new T.Vector3(sin,0,cos));ray.near=0;ray.far=2;
   const hit=ray.intersectObjects(geometry,false)[0];return hit?{height:h,distance:hit.distance,mesh:hit.object.name}:null;
  }):[];
  // Keep the original centre rays above as independent evidence. A capsule
  // may reach a finite pane edge that its centre ray misses, so contact compares
  // the terrain sweep with a sphere of the identical radius at every body height.
  const visibleForwardSweeps=actor?bodyHeights.map(height=>({height,...sweepVisibleMeshTriangles(geometry,
   new T.Vector3(actor!.x,actor!.y+height,actor!.z),new T.Vector3(sin,0,cos),bodyRadius,probeLength,camera?.layers)})):[];
  const direction=camera?new T.Vector3(0,0,-1).transformDirection(camera.matrixWorld):null;
  const skylineClear=!skylineRoot||!!skylineSites&&skylineSites.every(s=>s.known&&s.attached&&s.vertices===0&&'exclusionOwned'in s&&s.exclusionOwned);
  return{version:1,ready:!!actor&&!!camera&&sites.every(s=>s.installedLods===3)&&skylineClear,frames,time,
   actor:actor?{...actor,onFoot:actor.footMode===2||(actor.footMode===undefined&&actor.footBlend>.99),floor:terrain.height(actor.x,actor.z,actor.y),forwardProbe,directionalProbes,visibleForwardSurfaces,visibleForwardSweeps}:null,
   camera:camera?{position:new T.Vector3().setFromMatrixPosition(camera.matrixWorld).toArray(),direction:direction!.toArray(),near:(camera as T.PerspectiveCamera).near,far:(camera as T.PerspectiveCamera).far,fov:(camera as T.PerspectiveCamera).fov,aspect:(camera as T.PerspectiveCamera).aspect}:null,
   sites,scope:'Actual staged full-game actor, camera, installed LODs and existing collision queries; no measured building-height or complete architectural collision parity certification.'};
 };
 const motion=()=>({frames,time,actor:actor?{...actor,onFoot:actor.footMode===2||(actor.footMode===undefined&&actor.footBlend>.99)}:null,
  sites:STUDY_SITES.map(spec=>({id:spec.id,local:actor&&copies.has(spec.id)?local(copies.get(spec.id)!,actor.x,actor.z):null}))});
 return{
  publicApi:Object.freeze({snapshot,motion,frame:()=>frames,
   groundFit:()=>readStagedGroundFit(root,terrain,{aquarium:copies.get('107227742'),conservatory:copies.get('107310050')}),
   exterior:(id:string)=>readStagedExterior(root,id,camera),
   viewObstructions:(id:string)=>{const exterior=readStagedExterior(root,id,camera);return camera&&exterior.ready&&exterior.bounds?{...readStagedViewBounds(root,id,camera,exterior.bounds),camera:exterior.camera,selectedLevels:exterior.selectedLevels}:null;},
   routeGround:(points:readonly {x:number;z:number}[])=>readStagedRouteGround(terrain,points),
   routeSweeps:(segments:readonly GroundRouteSegment[])=>readStagedRouteSweeps(terrain,segments),
  }),
  observeActor(p:Actor,firstPerson:boolean){actor={x:p.x,y:p.y,z:p.z,headingY:p.headingY,speed:p.speed,footBlend:p.footBlend,footMode:p.footMode,firstPerson};},
  observeView(t:number,_x:number,_z:number,c:T.Camera){if(t!==time){frames++;time=t;}camera=c;},
 };
}
