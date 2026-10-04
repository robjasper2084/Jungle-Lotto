import * as T from 'three';
import type {GLTF} from '../compressedGLTFLoader.ts';
import {BicycleView} from './bicycleView.ts';
import type {CommunityRide} from './communityRide.ts';
import {CyclistMotion,RiderCadence} from './cyclistMotion.ts';
export class CommunityView {
  root=new T.Group();views:BicycleView[]=[];private marker:T.Mesh;private markerMaterial:T.MeshBasicMaterial;private cadence=new RiderCadence();private motions:CyclistMotion[]=[];private clock=0;
  readonly ride:CommunityRide;
  constructor(ride:CommunityRide,assets:Map<string,GLTF>){
    this.ride=ride;
    this.root.name='Local community ride';this.motions=ride.riders.map((_,i)=>new CyclistMotion(i));this.views=ride.riders.map((_,i)=>{const view=new BicycleView(assets.get('DS_Bicycle_01')!,assets.get('DS_Cyclist_01')!,i,true);this.root.add(view.root);return view;});
    this.markerMaterial=new T.MeshBasicMaterial({color:0xf2cf70,side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false});this.marker=new T.Mesh(new T.RingGeometry(1.1,1.25,32),this.markerMaterial);this.marker.rotation.x=-Math.PI/2;this.root.add(this.marker);
  }
  update(visible:boolean,dt=1/60,observer?:{x:number;z:number}){
    this.root.visible=visible&&this.ride.stage!=='cleanup';
    if(!this.root.visible){return;}
    this.clock+=dt;this.ride.riders.forEach((r,i)=>{
      const view=this.views[i],distance=observer?Math.hypot(r.x-observer.x,r.z-observer.z):0;
      // Translation stays frame-smooth; only distant skeletal fitting runs less often.
      const motion=this.motions[i],pose=motion.step(dt,r);if(r.parked)pose.riderLookYaw=Math.sin(this.clock*.45+i*1.4)*.16;
      if(this.cadence.due(i,dt,distance)){
        view.apply(pose,motion.steering,motion.pedals);
      }else{view.root.position.set(r.x,r.y+.008,r.z);view.root.rotation.y=pose.headingY;}
    });
    const at=this.ride.route.at(this.ride.gates[this.ride.nextGate]??this.ride.route.length);
    this.marker.position.set(at.x,this.ride.terrain.sampleGround(at.x,at.z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false}).height+.055,at.z);this.marker.visible=this.ride.joined&&this.ride.stage!=='hangout';
  }
  dispose(){this.views.forEach(v=>v.dispose());this.marker.geometry.dispose();this.markerMaterial.dispose();this.root.removeFromParent();}
}

