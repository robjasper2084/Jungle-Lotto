import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {districts} from './detroitGround.ts';
import {JEFFERSON_SIGNAL_INVENTORY,JEFFERSON_SIGNAL_RETRIEVED,JEFFERSON_SIGNAL_SOURCE,jeffersonSignalPhase,planJeffersonSignals,type SignalAspect,type SignalPoint,type SignalRoad} from './jeffersonSignalPlan.ts';
import type {ParkTerrain} from './terrain.ts';

export const JEFFERSON_SIGNAL_PHOTO_REFERENCES=Object.freeze([
 'https://www.bagleymansion.com/resources/Exterior%20_%20new.jpg.opt840x472o0%2C0s840x472.jpg',
 'https://qjxuiljsgrmymeayoqzi.supabase.co/storage/v1/object/public/building-photos/7b41d649-0ec3-4272-a66e-e1641c5978b1/1778204919-3595.jpg',
]);
const VIEW_DISTANCE=420;
const LENS_ASPECTS:readonly SignalAspect[]=['red','amber','green'];
const ACTIVE={red:new T.Color(0xff321f),amber:new T.Color(0xffd428),green:new T.Color(0x10ee7e)};
const INACTIVE={red:new T.Color(0x381812),amber:new T.Color(0x322713),green:new T.Color(0x102b21)};

/** Roadside supports and fixture counts are original geometry anchored to the
 * city intersection inventory. Joseph Campau's suspended yellow-head family
 * follows the linked photographs. Other unmeasured hardware is explicitly an
 * approximation. The deterministic game cycle never reads real traffic signals. */
export function createJeffersonSignals(scene:T.Scene,terrain:ParkTerrain,options:{roads?:readonly SignalRoad[]}={}){
 const roads=options.roads??[...terrain.map.roads,...districts.roads];
 const plan=planJeffersonSignals({roads,land:(x,z)=>terrain.land(x,z),obstructed:(x,z,r)=>terrain.obstructed(x,z,r)});
 const metal=new T.MeshStandardMaterial({name:'Jefferson galvanized signal supports',color:0x969c99,metalness:.65,roughness:.45});
 const black=new T.MeshStandardMaterial({name:'Jefferson signal backplates and span wires',color:0x171b1b,roughness:.86});
 const yellow=new T.MeshStandardMaterial({name:'Jefferson yellow traffic signal housings',color:0xe5ad2b,metalness:.08,roughness:.52});
 const lensMaterial=new T.MeshBasicMaterial({name:'Jefferson signal lens colors',color:0xffffff,toneMapped:false});
 const materials=[metal,black,yellow,lensMaterial];
 const circle=new T.CircleGeometry(.147,16);
 const root=new T.Group();root.name='Jefferson mapped traffic signals';root.matrixAutoUpdate=false;
 root.userData={source:JEFFERSON_SIGNAL_SOURCE,retrieved:JEFFERSON_SIGNAL_RETRIEVED,intersectionPositions:'city GIS',hardware:'reference-informed original approximation',timing:'88-second game simulation',collision:'visual props; existing collision map unchanged',photoReferences:JEFFERSON_SIGNAL_PHOTO_REFERENCES};
 const geometries:T.BufferGeometry[]=[circle];
 const states:{group:T.Group;lenses:T.InstancedMesh;axes:('jefferson'|'cross')[];x:number;z:number;offset:number;phase:number}[]=[];
 let triangleCount=0,fixtureCount=0,headCount=0,spanCount=0;
 const up=new T.Vector3(0,1,0),quaternion=new T.Quaternion(),matrix=new T.Matrix4();
 const dummy=new T.Object3D();
 for(const junction of plan.junctions){
  const group=new T.Group();group.name='Jefferson / '+junction.source.name;group.matrixAutoUpdate=false;group.visible=false;
  // The existing island warmup traverses this hidden group, preparing both
  // shadow policies before the first ride without rendering distant signals.
  group.userData={warmIslandShaders:true,cityObjectId:junction.source.objectId,cityIntersectionId:junction.source.intersectionId,longitude:junction.source.longitude,latitude:junction.source.latitude,sourceCenter:junction.center,jeffersonRoadId:junction.jeffersonRoadId,crossRoadId:junction.crossRoadId??null};
  const pieces=new Map<T.Material,T.BufferGeometry[]>();
  const append=(g:T.BufferGeometry,material:T.Material)=>{const list=pieces.get(material)??[];list.push(g);pieces.set(material,list);};
  function box(x:number,y:number,z:number,w:number,h:number,d:number,yaw:number,material:T.Material){
   const g=new T.BoxGeometry(w,h,d);g.rotateY(yaw);g.translate(x,y,z);append(g,material);
  }
  function beam(a:T.Vector3,b:T.Vector3,radius:number,material:T.Material,sides=8){
   const direction=b.clone().sub(a),length=direction.length();if(length<.001)return;
   const g=new T.CylinderGeometry(radius,radius,length,sides);
   quaternion.setFromUnitVectors(up,direction.divideScalar(length));matrix.makeRotationFromQuaternion(quaternion);matrix.setPosition(a.clone().add(b).multiplyScalar(.5));
   g.applyMatrix4(matrix);append(g,material);
  }
  const poleTops=new Map<string,T.Vector3>();
  function pole(point:SignalPoint){
   const key=point.map(v=>v.toFixed(3)).join(','),existing=poleTops.get(key);if(existing)return existing;
   const base=terrain.height(...point),top=new T.Vector3(point[0],base+7.4,point[1]);
   const shaft=new T.CylinderGeometry(.115,.18,7.4,8);shaft.translate(point[0],base+3.7,point[1]);append(shaft,metal);
   const foot=new T.CylinderGeometry(.28,.33,.42,8);foot.translate(point[0],base+.21,point[1]);append(foot,metal);
   poleTops.set(key,top);return top;
  }
  const headTransforms:{position:T.Vector3;yaw:number;axis:'jefferson'|'cross'}[]=[];
  for(const fixture of junction.fixtures){
   fixtureCount++;
   const top=pole(fixture.pole),support=fixture.support?pole(fixture.support):undefined;
   const yaw=Math.atan2(-fixture.travel[0],-fixture.travel[1]);
   const nx=-fixture.travel[0],nz=-fixture.travel[1];
   if(support){
    spanCount++;
    const cable=(t:number)=>new T.Vector3(top.x+(support.x-top.x)*t,top.y+(support.y-top.y)*t-.5*4*t*(1-t),top.z+(support.z-top.z)*t);
    for(let i=0;i<8;i++)beam(cable(i/8),cable((i+1)/8),.024,black,5);
   }
   for(const point of fixture.heads){
    let suspensionY:number;
    if(support){
     const dx=support.x-top.x,dz=support.z-top.z,t=Math.max(0,Math.min(1,((point[0]-top.x)*dx+(point[1]-top.z)*dz)/(dx*dx+dz*dz)));
     suspensionY=top.y+(support.y-top.y)*t-.5*4*t*(1-t);
    }else{
     suspensionY=top.y-.2;
     beam(top,new T.Vector3(point[0],suspensionY,point[1]),.075,metal);
    }
    const y=suspensionY-.91;
    beam(new T.Vector3(point[0],suspensionY,point[1]),new T.Vector3(point[0],y+.68,point[1]),.032,black,6);
    box(point[0],y,point[1],.66,1.61,.07,yaw,black);
    box(point[0]+nx*.12,y,point[1]+nz*.12,.46,1.35,.26,yaw,yellow);
    for(let row=0;row<3;row++){
     const cy=y+.43-row*.43;
     // Projecting hoods keep the three vertical lenses legible in daylight.
     box(point[0]+nx*.32,cy+.17,point[1]+nz*.32,.37,.045,.30,yaw,black);
    }
    headTransforms.push({position:new T.Vector3(point[0]+nx*.258,y,point[1]+nz*.258),yaw,axis:fixture.axis});headCount++;
   }
  }
  for(const [material,list]of pieces){
   const g=mergeGeometries(list);if(!g)throw Error('Could not batch Jefferson signals');
   list.forEach(p=>p.dispose());g.computeBoundingSphere();geometries.push(g);
   const mesh=new T.Mesh(g,material);mesh.name=material.name;mesh.matrixAutoUpdate=false;mesh.castShadow=true;mesh.receiveShadow=true;
   group.add(mesh);triangleCount+=(g.index?.count??g.attributes.position.count)/3;
  }
  const lenses=new T.InstancedMesh(circle,lensMaterial,headTransforms.length*3),axes:('jefferson'|'cross')[]=[];
  lenses.name='Jefferson phase-controlled lenses';lenses.matrixAutoUpdate=false;
  for(const head of headTransforms){
   const headIndex=axes.length;axes.push(head.axis);
   for(let row=0;row<3;row++){
    dummy.position.copy(head.position);dummy.position.y+=.43-row*.43;dummy.rotation.set(0,head.yaw,0);dummy.updateMatrix();
    lenses.setMatrixAt(headIndex*3+row,dummy.matrix);lenses.setColorAt(headIndex*3+row,INACTIVE[LENS_ASPECTS[row]]);
   }
  }
  lenses.computeBoundingSphere();lenses.computeBoundingBox();group.add(lenses);triangleCount+=circle.index!.count/3*lenses.count;
  states.push({group,lenses,axes,x:junction.center[0],z:junction.center[1],offset:junction.offsetSeconds,phase:-1});root.add(group);
 }
 scene.add(root);
 const stats={source:JEFFERSON_SIGNAL_SOURCE,retrieved:JEFFERSON_SIGNAL_RETRIEVED,sourceIntersections:JEFFERSON_SIGNAL_INVENTORY.length,renderedIntersections:plan.junctions.length,excluded:plan.excluded.map(v=>({name:v.source.name,reason:v.reason})),fixtureCount,headCount,spanCount,triangles:triangleCount,batches:states.reduce((n,s)=>n+s.group.children.length,0),visibleJunctions:0,lensColorUpdates:0,viewDistance:VIEW_DISTANCE,timing:'authored simulation; not city timing',hardware:'original reference-informed approximation'};
 let disposed=false;
 function update(elapsedSeconds:number,x:number,z:number){
  if(disposed)return;
  let visible=0;
  for(const state of states){
   state.group.visible=Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(state.x-x,state.z-z)<VIEW_DISTANCE;
   if(state.group.visible)visible++;
   const phase=jeffersonSignalPhase(elapsedSeconds,state.offset);if(state.phase===phase.key)continue;
   state.phase=phase.key;
   for(let head=0;head<state.axes.length;head++){
    const active=phase[state.axes[head]];
    for(let row=0;row<3;row++){const aspect=LENS_ASPECTS[row];state.lenses.setColorAt(head*3+row,aspect===active?ACTIVE[aspect]:INACTIVE[aspect]);}
   }
   state.lenses.instanceColor!.needsUpdate=true;stats.lensColorUpdates++;
  }
  stats.visibleJunctions=visible;
 }
 function dispose(){
  if(disposed)return;disposed=true;scene.remove(root);
  for(const state of states)state.lenses.dispose();
  for(const g of geometries)g.dispose();for(const material of materials)material.dispose();
 }
 // Colors are correct before the first visible frame; all junctions remain
 // hidden until the world supplies its normal player/view coordinates.
 update(0,Infinity,Infinity);
 return {update,dispose,plan,stats};
}
