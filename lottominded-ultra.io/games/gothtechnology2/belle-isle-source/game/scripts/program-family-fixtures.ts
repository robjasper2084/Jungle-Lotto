import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as bankCandidate from '../src/belle/surfaceFinish.ts';
import * as pondCandidate from '../src/belle/pondServiceBuildings.ts';
import * as streetCandidate from '../src/belle/streetDetails.ts';
import * as scottCandidate from '../src/belle/fountainDetail.ts';
import * as waterCandidate from '../src/belle/water.ts';
import {createFountainLighting} from '../src/belle/fountainLighting.ts';
import {SCOTT_AUTHORED} from '../src/belle/fountainLayout.ts';
import type {ParkMap,ParkTerrain} from '../src/belle/terrain.ts';
import type {StreetPlan} from '../src/belle/streetPlan.ts';
// @ts-expect-error The isolated driver supplies the exact baseline source.
import * as bankBaselineImport from 'virtual:belle-bank-baseline';
// @ts-expect-error The isolated driver supplies the exact baseline source.
import * as pondBaselineImport from 'virtual:belle-pond-baseline';
// @ts-expect-error The isolated driver supplies the exact baseline source.
import * as streetBaselineImport from 'virtual:belle-street-baseline';
// @ts-expect-error The isolated driver supplies the exact baseline source.
import * as scottBaselineImport from 'virtual:belle-scott-baseline';
// @ts-expect-error The isolated driver supplies the exact baseline source.
import * as waterBaselineImport from 'virtual:belle-water-baseline';
// @ts-expect-error The driver supplies the two unchanged shipped GLTF material records.
import scottMaterialRecords from 'virtual:belle-scott-materials';

export type Side='baseline'|'candidate';
export type FamilyCase={
 id:string;
 family:string;
 expectedBaselinePrograms:number;
 objects:Record<Side,T.Object3D>;
 decorateSurface:boolean;
 requiredUniforms?:string[];
 pose?:(phase:number)=>void;
 setNegativeControl?:(enabled:boolean)=>void;
 camera?:{far:number;positions:[[number,number,number],[number,number,number]];target:[number,number,number]};
};
const sides:Side[]=['baseline','candidate'];
const banks:Record<Side,typeof bankCandidate>={baseline:bankBaselineImport,candidate:bankCandidate};
const ponds:Record<Side,typeof pondCandidate>={baseline:pondBaselineImport,candidate:pondCandidate};
const streets:Record<Side,typeof streetCandidate>={baseline:streetBaselineImport,candidate:streetCandidate};
const scotts:Record<Side,typeof scottCandidate>={baseline:scottBaselineImport,candidate:scottCandidate};
const waters:Record<Side,typeof waterCandidate>={baseline:waterBaselineImport,candidate:waterCandidate};

// Factories also create unused world objects, textures and materials. Retain
// their owners for the fixture lifetime; disposing them could invalidate the
// selected materials. Nothing from these scenes is attached implicitly.
const retainedOwners:unknown[]=[];
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
function meshAt(root:T.Object3D,name:string){
 const object=root.getObjectByName(name);
 assert(object instanceof T.Mesh,'Actual factory mesh missing: '+name);
 assert(!Array.isArray(object.material)&&object.material instanceof T.MeshStandardMaterial,'Expected one standard/physical material: '+name);
 return object as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
}
function casesFor(family:string,ids:string[],expectedBaselinePrograms:number,decorateSurface=true):FamilyCase[]{
 return ids.map(id=>({id,family,expectedBaselinePrograms,objects:{} as Record<Side,T.Object3D>,decorateSurface}));
}
function specimen(source:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>,height=1.25){
 // Bounded synthetic geometry isolates the actual factory material. It is not
 // a claim that the full shipped building/street/monument was rendered here.
 const geometry=new T.BoxGeometry(1.45,height,1.3,3,6,3);geometry.translate(0,height/2,0);
 const object=new T.Mesh(geometry,source.material);object.name=source.name;
 object.castShadow=source.castShadow;object.receiveShadow=source.receiveShadow;
 object.renderOrder=source.renderOrder;object.layers.mask=source.layers.mask;
 return object;
}

function bankCases(){
 const result=casesFor('bank',['bank-river-grass','bank-lagoon-earth','bank-formal-stone'],3);
 const rows=[
  {name:'Park grass bank',materialName:'Park grass bank',level:0,stone:false,color:0xffffff,roughness:.8},
  {name:'Natural canal and lagoon banks',materialName:'',level:1.05,stone:false,color:0xffffff,roughness:.97},
  {name:'Formal pond retaining edges',materialName:'',level:1.05,stone:true,color:0x899083,roughness:.97},
 ];
 for(const side of sides)rows.forEach((row,i)=>{
  const material=new T.MeshStandardMaterial({name:row.materialName,color:row.color,roughness:row.roughness,side:T.DoubleSide});
  if(i===1)material.normalScale.set(.15,.15);
  banks[side].finishBank(material,row.level,2,row.stone);
  // Every vertical specimen spans y=0..2.8, including the actual wet-edge,
  // dry-bank and upper turf transitions; both sides receive identical geometry.
  const geometry=new T.BoxGeometry(1.45,2.8,1.3,3,8,3);geometry.translate(0,1.4,0);
  if(row.stone)geometry.deleteAttribute('uv');
  const object=new T.Mesh(geometry,material);object.name=row.name;object.receiveShadow=true;
  result[i].objects[side]=object;
 });
 return result;
}

function pondCases(){
 const result=casesFor('pond',['pond-service-brick','pond-service-roof'],2);
 const names=['Pond service buildings · Service courtyard red brick','Pond service buildings · Annex weathered pitched roof'];
 for(const side of sides){
  const scene=new T.Scene();
  const map={buildings:[{id:'507125655',points:[[0,0],[10,0],[10,20],[0,20]]}]} as unknown as ParkMap;
  const owner=ponds[side].addPondServiceBuildings(scene,map);retainedOwners.push(scene,owner);
  names.forEach((name,i)=>result[i].objects[side]=specimen(meshAt(scene,name)));
 }
 return result;
}

function streetCases(){
 const result=casesFor('street',['street-plain','street-curb','street-gutter'],2);
 const kinds=['white','curb','gutter'] as const;
 for(const side of sides){
  const scene=new T.Scene();
  const plan:StreetPlan={boxes:kinds.map((material,i)=>({material,x:2+i*2,y:2.12,z:2,w:1,h:.2,l:1,yaw:0})),signs:[],stats:{},notes:[]};
  const owner=streets[side].addStreetDetails(scene,plan);retainedOwners.push(scene,owner);
  kinds.forEach((kind,i)=>{
   // Height includes the original curb/gutter grime interval y=2.06..2.19.
   const object=specimen(meshAt(scene,'Street detail 0,0,'+kind),2.8);
   object.geometry.deleteAttribute('uv');result[i].objects[side]=object;
  });
 }
 return result;
}

async function scottCases(){
 const result=casesFor('scott',['scott-shipped-granite','scott-shipped-marble'],2);
 const names=['Monument pale granite','Monument white marble'];
 assert(Array.isArray(scottMaterialRecords)&&scottMaterialRecords.length===2,'Expected two shipped Scott GLTF material records');
 const records=names.map(name=>{
  const matches=scottMaterialRecords.filter((record:{name?:string})=>record.name===name);
  assert(matches.length===1,'Shipped Scott material record missing/duplicated: '+name);return matches[0];
 });
 const clocks:{night:{value:number};time:{value:number};lighting:ReturnType<typeof createFountainLighting>}[]=[];
 for(const side of sides){
  // GLTFLoader supplies the real material state (including DoubleSide). No
  // replacement finish, texture, color or hand-copied PBR default is introduced.
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify({asset:{version:'2.0'},materials:records,scenes:[{nodes:[]}],scene:0}),'');
  const materials=await Promise.all(records.map((_:unknown,i:number)=>gltf.parser.getDependency('material',i))) as T.MeshStandardMaterial[];
  assert(materials.every(material=>material instanceof T.MeshStandardMaterial),'Scott loader did not create standard materials');
  const scene=new T.Scene(),architecture=new T.Group(),night={value:.6},time={value:1.25},lighting=createFountainLighting();
  materials.forEach((material,i)=>{
   const geometry=new T.BoxGeometry(1.45,1.25,1.3,3,4,3);geometry.translate(0,.625,0);
   const object=new T.Mesh(geometry,material);object.name='9146545_'+names[i];
   object.position.set(SCOTT_AUTHORED.x,0,SCOTT_AUTHORED.z);object.castShadow=object.receiveShadow=true;architecture.add(object);
  });
  const radius=SCOTT_AUTHORED.radius;
  const map={waterSources:[{id:'107194067',points:[[-radius,-radius],[radius,-radius],[radius,radius],[-radius,radius]]}]} as unknown as ParkMap;
  const owner=scotts[side].addScottDetails(scene,map,architecture,night,time,lighting);
  // This map yields centre(0,0) and scale1 through the actual alignment code.
  assert(owner.layout.x===0&&owner.layout.z===0&&owner.layout.scale===1,'Scott fixture alignment changed');
  names.forEach((name,i)=>result[i].objects[side]=meshAt(architecture,'9146545_'+name));
  clocks.push({night,time,lighting});retainedOwners.push(scene,architecture,owner,gltf,materials);
 }
 const pose=(phase:number)=>{for(const clock of clocks){clock.time.value=phase===0?1.25:6.75;clock.night.value=phase===0?.4:.75;clock.lighting.update(clock.time.value);}};
 for(const item of result){item.pose=pose;item.requiredUniforms=['skinProfile','fountainPrimary','fountainSecondary','fountainNight','fountainCentre'];}
 pose(0);return result;
}

function riverCases(){
 const result=casesFor('river',['river-near-original-mesh','river-far-original-mesh'],2,false);
 const names=['Detroit River rolling waves','Detroit River distant water'];
 const clocks:{water:ReturnType<typeof waterCandidate.createWater>;camera:T.PerspectiveCamera}[]=[];
 const candidateTimes=new Set<T.IUniform<number>>();let currentPhase=0,negativeControl=false;
 for(const side of sides){
  const scene=new T.Scene();
  const map={island:[],mainland:[],waterSources:[],water:[{name:'program fixture',points:[[20,20],[30,20],[30,30],[20,30],[20,20]],holes:[]}]} as unknown as ParkMap;
  const water=waters[side].createWater(scene,{} as T.WebGLRenderer,map,{land:()=>false} as unknown as ParkTerrain,
   (_points,y)=>new T.PlaneGeometry(10,10).rotateX(-Math.PI/2).translate(25,y,25));
  const camera=new T.PerspectiveCamera();water.setQuality('high');water.update(1.25,camera);
  // These are the actual 128-segment near grid and far ring, retaining all
  // source attributes, indices, materials, district masks and render order.
  names.forEach((name,i)=>{
   const object=meshAt(scene,name);result[i].objects[side]=object;
   if(side==='candidate'){
    const previous=object.material.onBeforeCompile;
    object.material.onBeforeCompile=function(shader,renderer){
     previous.call(this,shader,renderer);const time=shader.uniforms.riverTime;
     assert(time&&typeof time.value==='number','Actual candidate river clock missing');candidateTimes.add(time);
    };
   }
  });
  clocks.push({water,camera});retainedOwners.push(scene,water,camera);
 }
 const applyClockControl=()=>{for(const time of candidateTimes)time.value=(currentPhase===0?1.25:6.75)+(negativeControl?2:0);};
 const pose=(phase:number)=>{
  currentPhase=phase;for(const {water,camera}of clocks)water.update(phase===0?1.25:6.75,camera);
  // Apply the control after normal phase selection, changing only the actual
  // candidate riverTime binding. Baseline clocks and all geometry stay intact.
  applyClockControl();
 };
 const setNegativeControl=(enabled:boolean)=>{
  assert(!enabled||candidateTimes.size>0,'Candidate river clock has not compiled');negativeControl=enabled;applyClockControl();
 };
 for(const item of result){
  item.pose=pose;item.setNegativeControl=setNegativeControl;item.requiredUniforms=['riverTime','riverCentre','riverNormals'];
  item.camera={far:21000,positions:[[25,18,50],[40,12,80]],target:[0,0,0]};
 }
 return result;
}

export async function createProgramFamilyCases():Promise<FamilyCase[]>{
 const result=[...bankCases(),...pondCases(),...streetCases(),...await scottCases(),...riverCases()];
 assert(result.length===12&&new Set(result.map(item=>item.id)).size===12,'Program-family fixture inventory changed');
 for(const item of result)for(const side of sides)assert(item.objects[side] instanceof T.Object3D,'Fixture object missing: '+item.id+' '+side);
 return result;
}
