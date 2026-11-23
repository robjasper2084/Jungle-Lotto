import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {CarController,type CarInput} from './carController.ts';
import {CadillacCabin} from './cadillacCabin.ts';
import type {ParkTerrain} from './terrain.ts';

const modelUrl='./belle/vehicles/silver-cadillac.glb';
let source:Promise<T.Group>|undefined;
export function cadillacModel(){
  return source??=new GLTFLoader().loadAsync(modelUrl).then(asset=>asset.scene).catch(error=>{source=undefined;throw error;});
}
const radius=.346, wheelbase=3.213, track=1.648;
const clamp=T.MathUtils.clamp;
export class CadillacRide {
  readonly sim:CarController;
  readonly cabin?:CadillacCabin;
  private readonly body:T.Object3D;
  private readonly door:T.Object3D;
  private readonly steeringWheel:T.Object3D;
  private readonly hubs:{hub:T.Object3D;spin:T.Object3D;front:boolean}[];
  private readonly lenses=new Map<string,T.MeshStandardMaterial>();
  private readonly eye=new T.Vector3();
  private readonly aim=new T.Vector3();
  private readonly wanted=new T.Vector3();
  private readonly steeringAxis=new T.Vector3(0,.42,-.91).normalize();
  private readonly interiorEye=new T.Object3D();
  private readonly interiorAim=new T.Object3D();
  private doorAngle=0;
  private doorOpen=false;
  exiting=false;
  private pitch=0;
  private heave=0;
  private travel=0;
  private lastSpeed=0;
  riding=false;
  constructor(readonly model:T.Group,private terrain:ParkTerrain,occupants?:{hero:T.Object3D;dog:GLTF;heroClips?:T.AnimationClip[]}){
    const need=(name:string)=>{const item=model.getObjectByName(name);if(!item)throw Error('Cadillac part missing: '+name);return item;};
    this.body=need('SprungBody');this.door=need('DriverDoor');this.steeringWheel=need('SteeringWheel');
    // A passenger-side cabin camera shows the driver's profile and rear passenger.
    // These anchors follow the same suspension transform as the seats and occupants.
    this.interiorEye.name='Cadillac_InteriorCamera';this.interiorEye.position.set(-.61,1.19,.57);
    this.interiorAim.name='Cadillac_InteriorTarget';this.interiorAim.position.set(.10,1.16,-.28);
    this.body.add(this.interiorEye,this.interiorAim);
    this.hubs=['FL','FR','RL','RR'].map(axle=>({hub:need('Hub'+axle),spin:need('Spin'+axle),front:axle.startsWith('F')}));
    model.traverse(o=>{if(o instanceof T.Mesh){
      for(const m of ([] as T.Material[]).concat(o.material))if(m instanceof T.MeshStandardMaterial)this.lenses.set(m.name,m);
    }});
    if(occupants)this.cabin=new CadillacCabin(model,occupants.hero,occupants.dog,occupants.heroClips);
    this.sim=new CarController(terrain,terrain.map.spawn);
    model.visible=false;
  }
  start(){
    const spawn=this.terrain.map.spawn;
    // Spawn along a real road tangent with clear pavement ahead of the bumper.
    const lanes=this.terrain.map.roads.flatMap(road=>road.points.slice(1).map((b,i)=>{
      const a=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      return {x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,heading:Math.atan2(dx,dz),length:Math.hypot(dx,dz)};
    })).filter(lane=>lane.length>=25).sort((a,b)=>Math.hypot(a.x-spawn.x,a.z-spawn.z)-Math.hypot(b.x-spawn.x,b.z-spawn.z));
    const lane=lanes.find(p=>[0,4,10].every(d=>this.sim.valid(p.x+d*Math.sin(p.heading),p.z+d*Math.cos(p.heading),p.heading,this.terrain.height(p.x,p.z))));
    const p=lane??spawn;
    if(!this.sim.reset(p.x,p.z,p.heading))throw Error('No clear pavement for Cadillac');
    this.sim.engine=true;this.sim.selectGear('D');this.riding=this.model.visible=true;
    this.doorAngle=this.doorOpen?1:0;this.doorOpen=this.exiting=false;this.pitch=this.heave=this.travel=this.lastSpeed=0;
    this.cabin?.reset();
    this.update(0,{gas:0,brake:0,steer:0,handbrake:false},0,false);
  }
  leave(){this.riding=this.model.visible=this.exiting=this.doorOpen=false;}
  toggleDoor(){if(Math.abs(this.sim.pose.speed)<.25&&!this.exiting)this.doorOpen=!this.doorOpen;}
  requestExit(){if(this.sim.exitPoint()){this.exiting=this.doorOpen=true;}}
  get exitReady(){return this.exiting&&this.doorAngle>.96;}
  update(dt:number,input:CarInput,night:number,reduced:boolean){
    if(!this.riding)return;
    const smooth=1-Math.exp(-dt*8);
    this.doorAngle=T.MathUtils.lerp(this.doorAngle,Number(this.doorOpen),smooth);
    this.door.rotation.y=-this.doorAngle*1.03;
    const held=this.doorOpen||this.doorAngle>.06;
    const p=this.sim.advance(dt,held?{...input,gas:0,brake:1,handbrake:true}:input);
    this.model.position.set(p.x,p.y,p.z);this.model.rotation.y=p.heading;
    const acceleration=dt?clamp((p.speed-this.lastSpeed)/dt,-10,6):0;
    this.lastSpeed=p.speed;
    this.pitch=T.MathUtils.lerp(this.pitch,reduced?0:acceleration*.004,smooth);
    const sine=Math.sin(p.heading),cosine=Math.cos(p.heading);
    const curvature=Math.tan(p.steering)/wheelbase;
    let mean=0;
    for(const {hub,spin,front} of this.hubs){
      const {x,z}=hub.position;
      const ground=this.terrain.height(p.x+x*cosine+z*sine,p.z-x*sine+z*cosine,p.y);
      const dy=clamp(ground-p.y,-.22,.22);
      hub.position.y=radius+dy;mean+=dy*.25;
      const arc=1-x*curvature;
      hub.rotation.y=front?Math.atan2(wheelbase*curvature,arc):0;
      const distance=p.speed*dt*Math.hypot(arc,front?wheelbase*curvature:0);
      spin.rotation.x=(spin.rotation.x+distance/radius)%(Math.PI*2);
    }
    this.heave=T.MathUtils.lerp(this.heave,mean,smooth);
    this.body.position.y=this.heave;
    this.body.rotation.set(p.pitch-this.pitch,0,p.roll);
    this.steeringWheel.quaternion.setFromAxisAngle(this.steeringAxis,p.steering*5.5);
    this.cabin?.update(dt,p.steering,reduced);
    this.travel+=Math.abs(p.speed)*dt;
    this.lenses.get('BrakeLens')?.emissive.setRGB(this.sim.braking?.95:.15,.005,.007);
    this.lenses.get('Headlamp')?.emissive.setRGB(.23+.75*night,.21+.67*night,.15+.51*night);
    this.lenses.get('ReverseLens')?.emissive.setScalar(this.sim.gear==='R'?.9:0);
  }
  camera(camera:T.PerspectiveCamera,inside:boolean,yaw:number,pitch:number,dt:number,snap:boolean){
    const p=this.sim.pose,angle=p.heading+yaw;
    if(inside){
      this.interiorEye.getWorldPosition(this.eye);
      this.wanted.copy(this.interiorAim.position).sub(this.interiorEye.position);
      const heading=Math.atan2(this.wanted.x,this.wanted.z)+yaw;
      const elevation=clamp(Math.atan2(this.wanted.y,Math.hypot(this.wanted.x,this.wanted.z))-(pitch-.1),-1.35,1.35);
      this.wanted.set(Math.sin(heading)*Math.cos(elevation),Math.sin(elevation),Math.cos(heading)*Math.cos(elevation));
      this.aim.copy(this.interiorEye.position).add(this.wanted);
      this.body.localToWorld(this.aim);
      camera.position.copy(this.eye);
    }else{
      this.aim.set(p.x,p.y+1.03,p.z);
      const d=7.1,h=clamp(2.3+pitch*4,1.05,6.2);
      this.wanted.set(-Math.sin(angle)*d,h,-Math.cos(angle)*d);
      const length=this.wanted.length();this.wanted.normalize();
      const obstacle=this.terrain.raycastObstacle(this.aim,this.wanted,length,.15);
      this.wanted.multiplyScalar(obstacle===null?length:Math.max(1,obstacle-.2)).add(this.aim);
      this.wanted.y=Math.max(this.wanted.y,this.terrain.height(this.wanted.x,this.wanted.z,p.y)+.5);
      camera.position.lerp(this.wanted,snap?1:1-Math.exp(-dt*12));
    }
    // Retain enough horizontal coverage for both occupants when an iPad rotates.
    const fov=inside?clamp(T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(41))/camera.aspect)),55,110):54;
    if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
    camera.up.copy(T.Object3D.DEFAULT_UP);
    camera.lookAt(this.aim);
  }
  diagnostics(){return {vehicle:'silver-cadillac',gear:this.sim.gear,speedMps:this.sim.pose.speed,distanceM:this.travel,
    steeringRad:this.sim.pose.steering,wheelPhaseRad:this.hubs.map(w=>w.spin.rotation.x),driverDoorRad:this.door.rotation.y,
    suspensionPitchRad:this.body.rotation.x,suspensionRollRad:this.body.rotation.z,braking:this.sim.braking,collision:this.sim.collided,
    ...(this.cabin?{occupants:this.cabin.diagnostics()}: {})};}
}
