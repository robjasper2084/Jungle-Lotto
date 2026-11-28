import * as T from 'three';
import {PointLightBudget} from '../../../lottominded-ultra.io/games/gothtechnology2/ride-core/src/pointLightBudget.ts';

type SpotState={light:T.SpotLight;authoredVisible:boolean;appliedVisible:boolean};

function belongsTo(object:T.Object3D,root:T.Object3D){
  for(let parent:T.Object3D|null=object;parent;parent=parent.parent)if(parent===root)return true;
  return false;
}

/** Retain Swoop's original four-light interior policy inside its owned subtree.
 * Pool selection uses each actual render camera, including photo/reflection and
 * split-screen views. Host emitters and their lighting policy remain untouched.
 */
export function createSourceLighting(scene:T.Scene,root:T.Scene){
  if(scene===root)throw Error('Source lighting requires an isolated district root');
  let ownedRoot:T.Scene|null=root;
  let budget:PointLightBudget|undefined=new PointLightBudget(root);
  const spots=new Map<T.SpotLight,SpotState>();
  let active=false,disposed=false;
  const previous=scene.onBeforeRender;

  function attached(){return !!ownedRoot&&belongsTo(ownedRoot,scene);}

  function restoreSpot(record:SpotState){
    if(record.light.visible!==record.appliedVisible)record.authoredVisible=record.light.visible;
    record.light.visible=record.authoredVisible;
  }

  function updateSpots(){
    if(!ownedRoot)return;
    for(const [light,record]of spots){
      if(!belongsTo(light,ownedRoot)){restoreSpot(record);spots.delete(light);continue;}
      if(light.visible!==record.appliedVisible)record.authoredVisible=light.visible;
      // Three includes zero-intensity lights in shader arrays. The original
      // fixed spot pools change intensity, so dusk can restore them normally.
      record.appliedVisible=record.authoredVisible&&light.intensity>0;
      light.visible=record.appliedVisible;
    }
  }

  function pointVisibility(enabled:boolean){
    for(const light of budget?.pool??[]){light.visible=enabled;if(!enabled)light.intensity=0;}
  }

  function setActive(value:boolean){
    if(disposed)return;
    active=value;
    pointVisibility(active&&attached());
    updateSpots();
  }

  function registerSpots(scope?:T.Object3D){
    if(disposed||!ownedRoot)return;
    const target=scope??ownedRoot;
    if(!belongsTo(target,ownedRoot))throw Error('Only imported source spot pools may be registered');
    target.traverse(object=>{
      const light=object as T.SpotLight;
      if(light.isSpotLight&&!spots.has(light))spots.set(light,{light,authoredVisible:light.visible,appliedVisible:light.visible});
    });
    updateSpots();
  }

  function prepare(camera:T.Camera){
    if(disposed||!budget||!ownedRoot)return;
    updateSpots();
    const enabled=active&&attached();
    pointVisibility(enabled);
    if(!enabled)return;
    // Original PointLightBudget writes world-space positions into its copies.
    // Our copies live beneath the transformed district, so undo that frame
    // before Three applies it. Empty slots retain old local positions and must
    // not be transformed a second time on subsequent camera preparations.
    ownedRoot.updateWorldMatrix(true,false);
    budget.update(camera);
    for(const light of budget.pool)if(light.intensity>0){
      ownedRoot.worldToLocal(light.position);
      light.updateMatrixWorld(true);
    }
  }

  // Three invokes the rendered scene's hook, not hooks on nested Scene nodes.
  const hook:T.Scene['onBeforeRender']=function(...args){previous.apply(scene,args);prepare(args[2]);};
  scene.onBeforeRender=hook;
  pointVisibility(false);

  function diagnostics(){
    const pool=budget?.pool??[],isAttached=attached();
    const visible=(light:T.Light)=>{
      if(!isAttached)return false;
      for(let node:T.Object3D|null=light;node;node=node.parent)if(!node.visible)return false;
      return true;
    };
    let visibleSpots=0,positiveSpots=0;
    for(const {light}of spots.values()){
      if(visible(light)){visibleSpots++;if(light.intensity>0)positiveSpots++;}
    }
    return {
      active:active&&!disposed,attached:isAttached,
      pointEmitters:budget?.status.emitters??0,pointSlots:pool.length,
      visiblePointSlots:pool.filter(visible).length,
      activePointSlots:pool.filter(light=>visible(light)&&light.intensity>0).length,
      spotPools:spots.size,visibleSpotPools:visibleSpots,activeSpotPools:positiveSpots,
    };
  }

  function dispose(){
    if(disposed)return;
    disposed=true;active=false;
    if(scene.onBeforeRender===hook)scene.onBeforeRender=previous;
    for(const record of spots.values())restoreSpot(record);
    spots.clear();budget?.dispose();budget=undefined;ownedRoot=null;
    // If a later host feature wrapped this hook, its retained delegate now
    // only calls the earlier host hook and holds no district resources.
  }

  return {registerSpots,setActive,prepare,diagnostics,dispose};
}
