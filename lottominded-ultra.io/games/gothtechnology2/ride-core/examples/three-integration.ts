// Copy this into a Three.js host. Supply your own terrain, assets, scene and render loop.
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {RideCore,HUMAN_PROFILE,FollowCamera,type TerrainSampler,type RideActions} from '@digital-static/ridecore';
import {ThreeRiderView,PedalSparks} from '@digital-static/ridecore/three';
import {RideAudio} from '@digital-static/ridecore/audio';
import type {Scene,PerspectiveCamera} from 'three';

export function mountRide(terrain:TerrainSampler,riderAsset:GLTF,wheelAsset:GLTF,scene:Scene,camera:PerspectiveCamera){
  const profile=HUMAN_PROFILE; // Use MASCOT_PROFILE to retain both feet on the pedals at rest.
  const ride=new RideCore(terrain,{profile}),view=new ThreeRiderView(riderAsset,wheelAsset,terrain,profile);
  const follow=new FollowCamera(terrain),audio=new RideAudio(),sparks=new PedalSparks(scene);
  scene.add(view.root);follow.reset(ride.current);
  return {ride,view,audio, // Enable audio inside a user click: await audio.enable(true).
    frame(seconds:number,input:Partial<RideActions>){
      const result=ride.advance(seconds,input);view.apply(result.pose);
      for(const event of result.events)if(event.type==='landing')follow.landing(event.impact);
      follow.step(Math.min(seconds,.05),result.pose);camera.position.copy(follow.eye);camera.lookAt(follow.target.x,follow.target.y,follow.target.z);camera.fov=follow.fov;camera.updateProjectionMatrix();
      audio.update(result.pose,!ride.controller.crashed);sparks.update(Math.min(seconds,.05),result.pose,true);
      return result.events;
    },
    pause(){audio.update(ride.renderPose,false);},
    async dispose(){view.dispose();sparks.mesh.removeFromParent();sparks.mesh.geometry.dispose();const materials=Array.isArray(sparks.mesh.material)?sparks.mesh.material:[sparks.mesh.material];materials.forEach(m=>m.dispose());await audio.dispose();}
  };
}
