import * as T from 'three';
import {createWorld as originalCreateWorld} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/world.ts';
import {CITY,CUT_LINE,CUT_METRES,pointOnCut} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geography.ts';
import {SPOTS} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/world.ts';
import type {ParkMap} from './terrain.ts';
import {ParkTerrain} from './terrain.ts';
import {fromSourceMap} from './geo.ts';
import {configureVisualDistricts,overlapReceipt,sourceFootprintFailure} from './visualDistricts.ts';
import {createSwoopDistrict} from './swoopDistrict.ts';
import {previewState} from './previewState.ts';
import {buildConnectorRoute,validateConnectorRoute,connectorNavigationRoad} from './connector.ts';
import {sourceNavigationRoads} from './navigation.ts';
import {registerPreviewTravel} from './previewTravel.ts';

type OriginalArgs=Parameters<typeof originalCreateWorld>;
type FrameView={x:number;z:number;camera:T.Camera;at:number};

function mappedPoint(x:number,z:number):[number,number]{const p=fromSourceMap(x,0,z);return [p.x,p.z];}
function mappedHeading(x:number,z:number,heading:number){
  const a=fromSourceMap(x,0,z),b=fromSourceMap(x+Math.sin(heading),0,z+Math.cos(heading));
  return Math.atan2(b.x-a.x,b.z-a.z);
}

/** Register source roads only AFTER the host has built its rendered geometry.
 * They enrich its guide/GPS without creating a second visible road mesh. */
function addMapDestinations(data:ParkMap,terrain:ParkTerrain){
  const stops=[['atwater','Dequindre Cut · Atwater entrance',18],['freight','Dequindre Cut · Freight Yard',2050],['mack','Dequindre Cut · Mack Avenue',CUT_METRES-12]] as const;
  data.landmarks.push({id:'preview-cut-island',name:'Preview · Return to Belle Isle',kind:'trail',x:data.spawn.x,z:data.spawn.z,yaw:data.spawn.heading,viewDistance:0,description:'Return to the original island starting path.'});
  for(const [id,name,distance]of stops){
    const p=pointOnCut(distance),[x,z]=mappedPoint(p.x,p.z);
    data.landmarks.push({id:'preview-cut-'+id,name,kind:'trail',x,z,yaw:mappedHeading(p.x,p.z,p.heading),viewDistance:0,description:'Original Swoop Detroit route, staged in the shared Belle Isle world.'});
  }
  for(const [i,p]of SPOTS.entries()){
    const [x,z]=mappedPoint(p.x,p.z);
    data.landmarks.push({id:'preview-cut-place-'+i,name:'Swoop · '+p.name,kind:'trail',x,z,yaw:mappedHeading(p.x,p.z,p.heading),viewDistance:0});
  }
  data.roads.push(...sourceNavigationRoads(CITY.roads,terrain.swoopCoverage));
  data.roads.push({id:'preview-source-complete-cut',name:'Dequindre Cut · complete original route',points:CUT_LINE.map(([x,z])=>mappedPoint(x,z)),width:6.096,foot:true,bridge:false,surface:'pavement'});
}

/** Imported solely by the isolated Vite compilation, never the production entry. */
export async function createWorld(...args:OriginalArgs){
  const [scene,renderer,data,rawTerrain,status,renderProbe]=args;
  if(!(rawTerrain instanceof ParkTerrain))throw Error('The isolated world requires its matching composite terrain adapter.');
  const terrain=rawTerrain;
  const report=(message:string)=>{previewState.stage=message;status(message);};
  let district:Awaited<ReturnType<typeof createSwoopDistrict>>|undefined;
  let unregisterTravel=()=>{};
  try{
    report('Preparing the full Dequindre Cut physics alongside Belle Isle…');
    await terrain.prepareSwoop();
    // Source loaders may add real rideable floors beyond the original tiles.
    // Finish those registrations before clipping, while keeping source meshes
    // out of the original host's material and batching traversals.
    district=await createSwoopDistrict({scene,renderer,terrain,status:report,deferAttachment:true});
    configureVisualDistricts(terrain);
    const host=await originalCreateWorld(scene,renderer,data,terrain,report,renderProbe);
    scene.add(district.root);
    // Apply the opening view before Belle's first texture preparation. The
    // preview's source-only warm predicate respects this visibility while
    // retaining Belle's original warming policy for its own hidden models.
    const openingCamera=new T.PerspectiveCamera(60,Math.max(1,renderer.domElement.clientWidth)/Math.max(1,renderer.domElement.clientHeight),.08,22000);
    const openingHeight=terrain.height(data.spawn.x,data.spawn.z);
    openingCamera.position.set(data.spawn.x,openingHeight+1.8,data.spawn.z);
    openingCamera.lookAt(data.spawn.x+Math.sin(data.spawn.heading)*15,openingHeight+1.8,data.spawn.z+Math.cos(data.spawn.heading)*15);
    openingCamera.updateMatrixWorld();
    district.update(0,data.spawn.x,data.spawn.z,openingCamera);
    const connector=buildConnectorRoute();
    report('Checking the complete street connection toward the Cut…');
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    const outbound=validateConnectorRoute(terrain,connector,{phase:'complete-scene'});
    report('Checking the return connection to Belle Isle…');
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    const inbound=validateConnectorRoute(terrain,connector,{reverse:true,phase:'complete-scene'});
    if(outbound.ok&&inbound.ok)data.roads.push(connectorNavigationRoad(connector,outbound,inbound));
    addMapDestinations(data,terrain);
    const views=new Map<T.Camera,FrameView>();
    const frameViews:FrameView[]=[];
    let disposed=false,lastFrame=Number.NaN,frameCount=0;
    const dispose=()=>{if(disposed)return;disposed=true;unregisterTravel();district?.dispose();};
    unregisterTravel=registerPreviewTravel(async place=>{
      if(disposed)throw Error('This preview is closed. Reload before travelling.');
      if(!terrain.containsSwoop(place.x,place.z))return;
      const active=[...views.values()],current=active.at(-1)?.camera;
      const camera=current instanceof T.PerspectiveCamera?current.clone():openingCamera.clone();
      const y=terrain.height(place.x,place.z),heading=place.yaw??0;
      camera.position.set(place.x-Math.sin(heading)*4.8,y+3.1,place.z-Math.cos(heading)*4.8);
      camera.lookAt(place.x,y+1.4,place.z);camera.updateMatrixWorld();
      await district!.warm(camera,place.x,place.z,active);
      report('Your destination is ready.');
    });
    window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{once:true});
    previewState.diagnostics=()=>({
      importedWorld:district!.diagnostics(),
      connector:{route:connector,outbound,inbound,verified:outbound.ok&&inbound.ok},
      overlap:{...overlapReceipt,replacedBuildingIds:[...overlapReceipt.replacedBuildingIds],retainedBoundaryBuildingIds:[...overlapReceipt.retainedBoundaryBuildingIds]},
      runtime:{renderers:1,frameCount,activeCameras:views.size,sourceTerrainCells:terrain.swoopCoverage.cellCount},
      gpu:{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),shadowMapEnabled:renderer.shadowMap.enabled},
      release:{held:true,productionChecksUnchanged:true,nativeAcceptanceEstablished:false},
    });
    previewState.ready=true;previewState.readyAt=performance.now();
    report('Dequindre Cut preview prepared. Completing the shared game startup…');
    return {...host,
      update(...params:Parameters<typeof host.update>){
        host.update(...params);
        if(disposed)return;
        const [time,x,z,camera]=params;
        if(time!==lastFrame){lastFrame=time;frameCount++;}
        const now=performance.now();let current=views.get(camera);
        if(current){current.x=x;current.z=z;current.at=now;}
        else{current={x,z,camera,at:now};views.set(camera,current);}
        // A split-screen renderer updates its cameras sequentially. Retaining
        // the other active camera across a frame prevents its assets evicting.
        for(const [key,view]of views)if(now-view.at>1000)views.delete(key);
        frameViews.length=0;frameViews.push(current);
        for(const view of views.values())if(view!==current)frameViews.push(view);
        district!.updateViews(time,frameViews);
        if(previewState.lastPose){previewState.lastPose.x=x;previewState.lastPose.z=z;previewState.lastPose.sourceDistrict=terrain.containsSwoop(x,z);}
        else previewState.lastPose={x,z,sourceDistrict:terrain.containsSwoop(x,z)};
      },
    };
  }catch(error){
    const failedFootprint=sourceFootprintFailure();
    if(failedFootprint)previewState.diagnostics=()=>({overlapFailure:failedFootprint});
    unregisterTravel();district?.dispose();previewState.error=error instanceof Error?error.message:String(error);previewState.stage='Preview could not finish preparing';throw error;
  }
}
