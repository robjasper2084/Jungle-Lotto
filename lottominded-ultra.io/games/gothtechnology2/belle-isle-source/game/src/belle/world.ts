import {addCoastGuard} from './coastGuard.ts';
import {WorldQuality} from './worldQuality.ts';
import {LocalLightPool} from './localLighting.ts';
import {createRiverTraffic} from './riverTraffic.ts';
import {addWoodlandFloor} from './woodland.ts';
import {addMeadow} from './meadow.ts';
import {applyRealisticMaterials} from './realisticMaterials.ts';
import {addStreetLighting} from './streetLighting.ts';
import {addBridgeLighting} from './bridgeLighting.ts';
import {sunDirection,smooth} from './skyModel.ts';
import {visibleWithHysteresis} from './environmentDetail.ts';
import {createVehicleContactShadow,type ContactShadowPose} from './contactShadow.ts';
import {addPlaygrounds} from './playgroundScene.ts';
import {createWater} from './water.ts';
import {addKoi,addFountainFlow} from './waterLife.ts';
import {addLagoonBridge} from './lagoonBridgeScene.ts';
import {addSmallBridgesStaged} from './smallBridgeScene.ts';
import {yieldStartupTask} from './startupWork.ts';
import {addLakeHabitat} from './lakeHabitat.ts';
import {addBirds} from './birds.ts';
import {addWaterfowl} from './waterfowl.ts';
import {addGulls} from './gulls.ts';
import {addYachtClub} from './yachtClubScene.ts';
import {addReferenceArchitecture} from './referenceArchitecture.ts';
import {addGolfCenter} from './golfCenterScene.ts';
import {addParkFacilities} from './parkFacilities.ts';
import {prepareDossinMaterials,addDossinLighting} from './dossinScene.ts';
import {prepareAquariumMaterials,addAquariumLife} from './aquariumScene.ts';
import {addBeach} from './beach.ts';
import {addServiceBuildings} from './serviceBuildings.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createIslandSky} from './islandSky.ts';
import {addShoreDetails} from './shore.ts';
import {addStreetDetails} from './streetDetails.ts';
import {addActivities} from './activitiesScene.ts';
import {addNature} from './nature.ts';
import {addGardens} from './gardens.ts';
import {addOudolfDetails} from './oudolfScene.ts';
import {addPavement} from './pavement.ts';
import {finishAsphalt,finishBank} from './surfaceFinish.ts';
import {addEntrance} from './entrance.ts';
import {addWaterBanks} from './waterBanks.ts';
import {ParkTerrain,inside,segment,type Point,type ParkMap} from './terrain.ts';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function poly(p:Point[],y:number,holes:Point[][]=[]){const s=new T.Shape(p.map(v=>new T.Vector2(v[0],-v[1])));for(const h of holes)s.holes.push(new T.Path(h.map(v=>new T.Vector2(v[0],-v[1]))));const g=new T.ShapeGeometry(s);g.rotateX(-Math.PI/2);g.translate(0,y,0);const a=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<a.count;i++)uv.setXY(i,a.getX(i)/8,a.getZ(i)/8);return g;}
function road(points:Point[],width:number,height:(x:number,z:number)=>number){const p:number[]=[],uv:number[]=[],routeUV:number[]=[],idx:number[]=[];let len=0;for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(i+1,points.length-1)],before=new T.Vector2(points[i][0]-a[0],points[i][1]-a[1]).normalize(),after=new T.Vector2(b[0]-points[i][0],b[1]-points[i][1]).normalize(),v=before.clone().add(after).normalize(),miter=Math.min(1.8,1/Math.max(.56,v.dot(i===points.length-1?before:after)));if(i)len+=Math.hypot(points[i][0]-a[0],points[i][1]-a[1]);for(const side of[-1,1]){const x=points[i][0]+v.y*width*.5*side*miter,z=points[i][1]-v.x*width*.5*side*miter;p.push(x,height(x,z),z);uv.push(x/8,z/8);routeUV.push(side*width*.5,len);}if(i){const j=i*2;idx.push(j-2,j,j-1,j,j+1,j-1);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('routeCoord',new T.Float32BufferAttribute(routeUV,2));g.setIndex(idx);g.computeVertexNormals();return g;}
const mat=(color:number,roughness=.8)=>new T.MeshStandardMaterial({color,roughness});
export async function createWorld(scene:T.Scene,renderer:T.WebGLRenderer,data:ParkMap,terrain:ParkTerrain,status:(s:string)=>void){
 const islandSky=await createIslandSky(scene,renderer,status);
 const localLights=new LocalLightPool(scene);
 // Surface skins are ready before world creation. Do not fetch the discarded PNG fallback atlases.
 const grass=mat(0x8f9b7e);grass.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 terrainXZ;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nterrainXZ=(modelMatrix*vec4(transformed,1.)).xz;');shader.fragmentShader='varying vec2 terrainXZ;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat meadowVariation=.5+.25*sin(terrainXZ.x*.037+sin(terrainXZ.y*.043)*2.)+.25*sin(terrainXZ.y*.077+terrainXZ.x*.019);diffuseColor.rgb*=mix(vec3(.72,.79,.62),vec3(1.05,1.04,.91),meadowVariation);');};const pavement=mat(0x979b99);finishAsphalt(pavement);const pathMat=mat(0x948f81),concrete=mat(0xbebdb2),sand=mat(0xc3b28c);
 grass.name='Park lawn';pavement.name='Island asphalt';pathMat.name='Concrete pathways';concrete.name='Poured concrete';sand.name='Beach sand';
 // Metre-scale aggregate and broad weathering keep untextured paths from reading
 // as uniformly colored ribbons. Fade subpixel grain instead of sparkling.
 for(const m of [pathMat,concrete]){
  m.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec2 pavingXZ;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\npavingXZ=(modelMatrix*vec4(transformed,1.)).xz;');
   shader.fragmentShader='varying vec2 pavingXZ;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec2 aggregateCell=floor(pavingXZ*75.);
    float aggregate=fract(sin(dot(aggregateCell,vec2(12.9898,78.233)))*43758.5453);
    float fineDetail=1.-smoothstep(.4,1.8,length(fwidth(pavingXZ))*75.);
    float weather=.94+.045*sin(pavingXZ.x*.85+sin(pavingXZ.y*.47))+.025*sin(pavingXZ.y*3.1);
    diffuseColor.rgb*=weather*mix(1.,mix(.80,1.12,aggregate),fineDetail);
   `);
  };m.customProgramCacheKey=()=>'paving-aggregate-v1';
 }

 function add(g:T.BufferGeometry,m:T.Material|T.Material[]){const mesh=new T.Mesh(g,m);mesh.receiveShadow=true;scene.add(mesh);return mesh;}
 const dryLand:Point[][][]=await fetch('./belle/beach-land.json').then(r=>r.json());for(const p of dryLand)add(poly(p[0],2,p.slice(1)),grass);const beachStats=await addBeach(scene);
 const bankPositions:number[]=[],bankIndices:number[]=[],sandyBankIndices:number[]=[];for(const shore of [data.island,...(data.outerIslets||[]).map(i=>i.points)]){const base=bankPositions.length/3;const outline=shore.slice(0,-1);let signed=0;outline.forEach((p,i)=>{const q=outline[(i+1)%outline.length];signed+=p[0]*q[1]-q[0]*p[1];});outline.forEach((p,i)=>{const prev=outline[(i+outline.length-1)%outline.length],next=outline[(i+1)%outline.length],dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz)||1,side=Math.sign(signed);bankPositions.push(p[0],terrain.height(p[0],p[1]),p[1],p[0]+dz/len*4*side,-.1,p[1]-dx/len*4*side);const a=base+i*2,b=base+((i+1)%outline.length)*2;const q=outline[(i+1)%outline.length],mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2,sandy=terrain.beaches.some(beach=>beach.waterside.some(e=>segment(mx,mz,e.a,e.b).d<.2));(sandy?sandyBankIndices:bankIndices).push(a,b,a+1,b,b+1,a+1);});}const bankGeometry=new T.BufferGeometry();bankGeometry.setAttribute('position',new T.Float32BufferAttribute(bankPositions,3));bankGeometry.setIndex([...bankIndices,...sandyBankIndices]);bankGeometry.addGroup(0,bankIndices.length,0);bankGeometry.addGroup(bankIndices.length,sandyBankIndices.length,1);bankGeometry.computeVertexNormals();const bankMaterial=mat(0xffffff);bankMaterial.side=T.DoubleSide;const bankUV:number[]=[];for(let i=0;i<bankPositions.length;i+=3)bankUV.push(bankPositions[i]/3,bankPositions[i+2]/3);bankGeometry.setAttribute('uv',new T.Float32BufferAttribute(bankUV,2));bankMaterial.name='Park grass bank';finishBank(bankMaterial,0,2);add(bankGeometry,[bankMaterial,beachStats.material]);add(poly(data.mainland,2),grass);const shoreDetails=addShoreDetails(scene,data,terrain,grass,concrete);if(!data.landPolygons)for(const w of data.water)for(const h of w.holes)add(poly(h,2),grass);
 const waterBanks=addWaterBanks(scene,data,terrain,grass);addWoodlandFloor(scene,data);await yieldStartupTask();
 const water=createWater(scene,renderer,data,terrain,poly);const koi=addKoi(scene);const waterfowl=addWaterfowl(scene);const gulls=addGulls(scene);
 const gravel=mat(0x8d846c),wood=mat(0x81745b),pavers=pathMat.clone();
 gravel.name='Park gravel';wood.name='Timber boardwalk';pavers.name='Concrete pavers';
 function surfaceDetail(m:T.MeshStandardMaterial,kind:string){const base=m.onBeforeCompile;m.onBeforeCompile=(shader,r)=>{base(shader,r);shader.vertexShader='varying vec2 corridor;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncorridor=(modelMatrix*vec4(transformed,1.)).xz;');shader.fragmentShader='varying vec2 corridor;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 vec2 q=corridor;float seam=1.;
 ${kind==='wood'?`float edge=min(fract(q.y/.19),1.-fract(q.y/.19))*.19;seam=mix(.57,1.,smoothstep(0.,.008+fwidth(q.y),edge));seam*=.93+.06*sin(q.x*48.+sin(q.y*12.));`:kind==='pavers'?`vec2 cell=vec2(q.x+mod(floor(q.y/.22),2.)*.11,q.y)/.22;vec2 e=min(fract(cell),1.-fract(cell))*.22;seam=mix(.67,1.,smoothstep(0.,.006+length(fwidth(q)),min(e.x,e.y)));`:kind==='concrete'?`vec2 cell=q/2.4;vec2 edge=min(fract(cell),1.-fract(cell))*2.4;seam=mix(.87,1.,smoothstep(0.,.004+length(fwidth(q)),min(edge.x,edge.y)));`:`float grain=fract(sin(dot(floor(q*36.),vec2(12.89,78.23)))*43758.54);seam=mix(1.,.82+grain*.3,1.-smoothstep(.4,1.8,length(fwidth(q))*36.));`}
 if(length(q)<.000001)seam=1.;diffuseColor.rgb*=seam;
 `);};m.customProgramCacheKey=()=>kind+'-joined-pavement-detail-v2';}
 surfaceDetail(pathMat,'concrete');surfaceDetail(pavers,'pavers');surfaceDetail(wood,'wood');surfaceDetail(gravel,'gravel');
 await addPavement(scene,{asphalt:pavement,concrete:pathMat,gravel,wood,pavers});
 const bridgePts:Point[]=Array.from({length:151},(_,i)=>[data.bridge.a[0]+(data.bridge.b[0]-data.bridge.a[0])*i/150,data.bridge.a[1]+(data.bridge.b[1]-data.bridge.a[1])*i/150]);const deckY=(x:number,z:number)=>6+4*Math.sin(Math.PI*T.MathUtils.clamp(terrain.bridge(x,z).t,0,1));add(road(bridgePts,26,(x,z)=>deckY(x,z)+.015),concrete);add(road(bridgePts,20,(x,z)=>deckY(x,z)+.06),pavement);
 for(const a of data.areas){if(a.points.length<4)continue;if(a.kind==='pitch')add(poly(a.points,2.012),mat(0x728260));if(a.kind==='garden'){const soil=grass.clone();soil.color.set(a.id==='107227702'?0x8f9b7e:0x8d8062);soil.onBeforeCompile=grass.onBeforeCompile;add(poly(a.points,2.012,a.holes),soil);}}
 const lagoonBridge=addLagoonBridge(scene,data);await yieldStartupTask();const smallBridges=await addSmallBridgesStaged(scene,terrain.smallBridges.plan);await yieldStartupTask();
 addServiceBuildings(scene,data,islandSky.nightAmount);const facilities=addParkFacilities(scene,data);
 status('Adding road markings and wayfinding');const streetPlan=await fetch('./belle/street-details.json').then(r=>{if(!r.ok)throw new Error('Street details '+r.status);return r.json();});const streetBuffer:ArrayBuffer=await fetch('./belle/street-details.bin').then(r=>{if(!r.ok)throw new Error('Street geometry '+r.status);return r.arrayBuffer();});const streetData=new Float32Array(streetBuffer);streetPlan.boxes=[];for(let i=0;i<streetData.length;i+=streetPlan.stride)streetPlan.boxes.push({x:streetData[i],y:streetData[i+1],z:streetData[i+2],w:streetData[i+3],h:streetData[i+4],l:streetData[i+5],yaw:streetData[i+6],material:streetPlan.materials[streetData[i+7]],grade:streetData[i+8]});const streetStats=addStreetDetails(scene,streetPlan);streetPlan.boxes.length=0;await yieldStartupTask();
 addEntrance(scene,data,terrain);await yieldStartupTask();
 status('Loading Detroit skyline');const skyline=await loader.loadAsync('./belle/detroit-skyline.glb');skyline.scene.name='Detroit skyline · Renaissance Center';skyline.scene.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=false;o.receiveShadow=false;}});scene.add(skyline.scene);islandSky.dressSkyline(skyline.scene);
 status('Loading landmark architecture');const landmarks=await loader.loadAsync('./belle/landmarks.glb?v=walkthrough-20261103');scene.add(landmarks.scene);landmarks.scene.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;(o as T.Mesh).geometry.computeBoundingSphere();for(const m of(Array.isArray((o as T.Mesh).material)?(o as T.Mesh).material:[(o as T.Mesh).material]) as T.MeshStandardMaterial[]){if(m.name==='Conservatory clear panes'){m.transparent=true;m.opacity=.62;m.color.setRGB(.20,.30,.29);m.roughness=.22;m.metalness=.18;m.envMapIntensity=.85;m.depthWrite=false;m.side=T.DoubleSide;o.castShadow=false;}if(m.name.startsWith('Conservatory leaf'))m.side=T.DoubleSide;if(m.name==='Casino buff masonry'){m.color.setRGB(.52,.39,.24);m.bumpMap=m.map;m.bumpScale=.012;}if(m.map&&/limestone/i.test(m.name)){m.bumpMap=m.map;m.bumpScale=.018;m.roughness=.88;}};}});
 // Remove only the old solid Yacht Club shell; every other landmark remains intact.
 const oldYacht:T.Object3D[]=[];landmarks.scene.traverse(o=>{if(o.name.startsWith('264321737_'))oldYacht.push(o);});for(const o of oldYacht)o.removeFromParent();
 status('Loading Yacht Club and marina');const yachtClub=await addYachtClub(scene,loader,localLights);
 const oldGolf:T.Object3D[]=[];landmarks.scene.traverse(o=>{if(o.name.startsWith('509207568_'))oldGolf.push(o);});for(const o of oldGolf)o.removeFromParent();
 status('Loading Golf Center');const golfCenter=await addGolfCenter(scene,loader);const referenceArchitecture=await addReferenceArchitecture(scene,loader);status('Loading playgrounds');const playgroundScene=await addPlaygrounds(scene,loader);
 const fountainFlow=addFountainFlow(scene,data,landmarks.scene);
 prepareDossinMaterials(landmarks.scene);const dossinLighting=data.dossin?addDossinLighting(scene,data.dossin,localLights):null;prepareAquariumMaterials(landmarks.scene);const aquariumLife=data.aquarium?addAquariumLife(scene,data.aquarium,localLights):null;
 for(const l of data.landmarks.filter(l=>/Boat House|Yacht Club/.test(l.name))){const b=data.buildings.find(b=>b.id===l.id);if(b)add(poly(b.points,2),concrete);}
 status('Loading White House and stable yard');const historic=await loader.loadAsync('./belle/historic-houses.glb');historic.scene.name='White House and former stable yard';historic.scene.traverse(o=>{if((o as T.Mesh).isMesh){const mesh=o as T.Mesh;mesh.castShadow=!o.name.startsWith('Stable flower');mesh.receiveShadow=true;mesh.geometry.computeBoundingSphere();if(o.name.startsWith('Stable flower'))(mesh.material as T.MeshStandardMaterial).side=T.DoubleSide;}});scene.add(historic.scene);
 status('Adding park birds');const birds=await addBirds(scene,data,terrain);const activities=addActivities(scene,data,terrain,grass);const nature=await addNature(scene,status);status('Planting meadow grass');const meadow=await addMeadow(scene);const gardens=await addGardens(scene);const oudolf=addOudolfDetails(scene,data,grass);const lakeHabitat=await addLakeHabitat(scene);let lastX=Infinity,lastZ=Infinity;

 const coastGuard=addCoastGuard(scene);
 const streetLights=addStreetLighting(scene,data),bridgeLights=addBridgeLighting(scene,data,streetLights.lamps,localLights);applyRealisticMaterials(scene);const traffic=createRiverTraffic(scene,data),contactShadow=createVehicleContactShadow(scene,terrain);
 // Static world-space bounds are cached once. Interior gravel/plants used to be
 // rendered from across the island even though the enclosing building hid them.
 landmarks.scene.updateMatrixWorld(true);
 const landmarkDraws:{mesh:T.Mesh;center:T.Vector3;radius:number;range:number;shadow:boolean}[]=[];
 landmarks.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;const sphere=o.geometry.boundingSphere!;
  const detail=/Aquarium (river gravel|aquatic plants|tank interiors)|Conservatory (leaf|flower|palm bark|rough tufa)/i.test(o.name);
  landmarkDraws.push({mesh:o,center:sphere.center.clone().applyMatrix4(o.matrixWorld),radius:sphere.radius*Math.max(...o.scale.toArray()),range:detail?140:1800,shadow:o.castShadow});
 });
 // Static architecture transforms are fixed after the fountain is placed.
 for(const staticRoot of [landmarks.scene,skyline.scene,historic.scene]){staticRoot.updateMatrixWorld(true);staticRoot.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});}
 const quality=new WorldQuality(q=>{
  water.setQuality(q);islandSky.setQuality(q);birds.setQuality(q);gulls.setQuality(q);
  nature.setQuality(q);meadow.setQuality(q);gardens.setQuality(q);shoreDetails.setQuality(q);waterBanks.setQuality(q);contactShadow.setQuality(q);
  lastX=Infinity;
 },ratio=>renderer.setPixelRatio(ratio));
 return {sky:islandSky,trafficRay:traffic.raycast,waterVehicle:water.setVehicle,contactVehicle(pose:ContactShadowPose|null){contactShadow.update(pose);},quality,setBudget(scale:number){quality.setBudget(scale);},setQuality(q:string){quality.setQuality(q);},update(time:number,x:number,z:number,camera:T.Camera,running=true){localLights.beginFrame(x,z);yachtClub.update(x,z);golfCenter.update(x,z);referenceArchitecture.update(x,z);playgroundScene.update(x,z);const skyLight=islandSky.update(camera,x,z);const lampNight=1-smooth(-.12,.08,sunDirection(islandSky.renderHour)[1]);coastGuard.update(time,lampNight);bridgeLights.setNight(lampNight);streetLights.setNight(lampNight);bridgeLights.update(time,x,z);water.setLighting(skyLight.reflection,skyLight.light,skyLight.sun,skyLight.glint);water.setFountainNight(lampNight);water.setShipWakes(traffic.update(time,x,z,lampNight,skyLight.light,running));water.update(time,camera);koi.update(time,x,z);waterfowl.update(time,x,z);fountainFlow.update(time,x,z,lampNight);birds.update(time,x,z);gulls.update(time,x,z);activities.update(islandSky.hour,x,z);nature.update(x,z,skyLight.night,skyLight.golden);shoreDetails.update(x,z);waterBanks.update(x,z);meadow.update(time,x,z,camera.position.y-1.5);aquariumLife?.update(time,x,z);dossinLighting?.update(x,z);localLights.update();if(Math.hypot(x-lastX,z-lastZ)>30){lastX=x;lastZ=z;historic.scene.visible=visibleWithHysteresis(Math.hypot(x-1428,z-1000),900,historic.scene.visible,50);lakeHabitat.update(x,z);lagoonBridge.visible=visibleWithHysteresis(Math.hypot(x-3950,z+200),600,lagoonBridge.visible,40);facilities.update(x,z);streetStats.update(x,z);gardens.update(x,z);oudolf.update(x,z);for(const item of landmarkDraws){const distance=Math.hypot(item.center.x-x,item.center.z-z);item.mesh.visible=!item.mesh.userData.staticSprayReplaced&&(/MacArthur/.test(item.mesh.name)||visibleWithHysteresis(distance,item.range+item.radius,item.mesh.visible,item.range<200?14:45));item.mesh.castShadow=item.shadow&&visibleWithHysteresis(distance,170+item.radius,item.mesh.castShadow,20);}}},stats:{smallBridges:smallBridges.stats,traffic:traffic.stats,waterfowl:waterfowl.stats,gulls:gulls.stats,activities:activities.stats,meadow:meadow.stats,playgrounds:playgroundScene.stats,golfCenter:golfCenter.stats,yachtClub:yachtClub.stats,koi:koi.stats,fountains:fountainFlow.stats,lakeHabitat:lakeHabitat.stats,birds:birds.stats,facilities:facilities.stats,beaches:{triangles:beachStats.triangles},shore:{...shoreDetails.stats,lagoonSedges:waterBanks.stats},gardens:gardens.stats,street:streetStats,nature:nature.stats,trees:nature.stats.trees,landmarks:data.landmarks.length,roads:data.roads.length}};
}
