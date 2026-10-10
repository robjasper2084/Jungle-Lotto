import * as T from 'three';
import {DetroitWorld} from '../world.ts';
import {buildScenery} from '../scenery.ts';
import type {SceneryWorld} from '../sceneryWorld.ts';
import type {DowntownArena} from '../../../../ride-core/src/royale/downtownArena.ts';
/** Original source scenery and materials, in the exact exported physics frame. */
export async function buildDetroitArenaScene(scene:T.Scene,arena:DowntownArena){
 const geometry=new DetroitWorld(),t=arena.terrain.fixture.transform;
 const visual:SceneryWorld={chunks:geometry.chunks,solids:geometry.solids,geoMeshes:geometry.geoMeshes,buildingMeshes:geometry.buildingMeshes,
  // Static colliders already belong to the validated canonical map snapshot.
  addBox(){},addMesh(){},addRideSurface(){},step(){},
  sampleGround(x,z,out,referenceY){arena.sampleGround((x-t.tx)/t.sx,z-t.tz,out,referenceY===undefined?undefined:referenceY-t.ty);out.height+=t.ty;out.normal.x*=t.sx;return out;}
 };
 const root=new T.Scene();root.name='Original Swoop Detroit scenery';root.scale.x=1/t.sx;root.position.set(-t.tx/t.sx,-t.ty,-t.tz);scene.add(root);
 const start=arena.sourcePosition(arena.spawns[0].position),scenery=await buildScenery(root,visual,true,start);
 scenery.update(start.x,start.z,0);
 return {root,update(p:{x:number;y:number;z:number},time:number){const source=arena.sourcePosition(p);scenery.update(source.x,source.z,time);}};
}
