import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {CarController,type CarInput} from './carController.ts';
import {CadillacCabin} from './cadillacCabin.ts';
import {CadillacAccess,type CadillacAccessResult,type CadillacPanel} from './cadillacAccess.ts';
import {CadillacTrunk} from './cadillacTrunk.ts';
import {CadillacHydraulics} from './cadillacHydraulics.ts';
import {HydraulicCadillacDriver} from './hydraulicCadillacDriver.ts';
import type {ParkTerrain} from './terrain.ts';

export type CadillacVariant='cadillac'|'hydraulic-cadillac';
const modelUrls={cadillac:'./belle/vehicles/silver-cadillac.glb','hydraulic-cadillac':'./belle/vehicles/hydraulics-cadillac.glb'};
const source:Partial<Record<CadillacVariant,Promise<T.Group>>>={};
export function cadillacModel(variant:CadillacVariant='cadillac'){
  return source[variant]??=new GLTFLoader().loadAsync(modelUrls[variant]).then(asset=>asset.scene).catch(error=>{delete source[variant];throw error;});
}
const radius=.346, wheelbase=3.213, track=1.648;
const clamp=T.MathUtils.clamp;
const emptyKeys:ReadonlySet<string>=new Set();
export class CadillacRide {
  readonly sim:CarController;
  readonly cabin?:CadillacCabin;
  readonly access?:CadillacAccess;
  readonly hydraulics?:CadillacHydraulics;
  readonly trunk?:CadillacTrunk;
  readonly trunkSpeakerAnchor?:T.Object3D;
  private inspectTrunk=false;
  private readonly body:T.Object3D;
  private readonly hydraulicDriver?:HydraulicCadillacDriver;
  private readonly door?:T.Object3D;
  private readonly steeringWheel?:T.Object3D;
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
  constructor(readonly model:T.Group,private terrain:ParkTerrain,occupants?:{hero:T.Object3D;dog:GLTF;heroClips?:T.AnimationClip[]},readonly variant:CadillacVariant='cadillac',hoodieDriver?:GLTF){
    const need=(name:string)=>{const item=model.getObjectByName(name);if(!item)throw Error('Cadillac part missing: '+name);return item;};
    this.body=need(variant==='cadillac'?'SprungBody':'ChassisGeometry');
    if(variant==='cadillac'){this.door=need('DriverDoor');this.steeringWheel=need('SteeringWheel');}
    else {
      this.hydraulics=new CadillacHydraulics(need('Cadillac_Model'),this.body);
      if(hoodieDriver)this.hydraulicDriver=new HydraulicCadillacDriver(this.body,hoodieDriver);
    }
    // A passenger-side cabin camera shows the driver's profile and rear passenger.
    // These anchors follow the same suspension transform as the seats and occupants.
    this.interiorEye.name='Cadillac_InteriorCamera';this.interiorEye.position.set(-.61,1.19,.57);
    this.interiorAim.name='Cadillac_InteriorTarget';this.interiorAim.position.set(.10,1.16,-.28);
    if(variant==='hydraulic-cadillac'){
      this.interiorEye.position.set(-.64,1.21,.47);
      this.interiorAim.position.set(.42,1.01,.29);
    }
    this.body.add(this.interiorEye,this.interiorAim);
    this.hubs=this.hydraulics?.hubs??['FL','FR','RL','RR'].map(axle=>({hub:need('Hub'+axle),spin:need('Spin'+axle),front:axle.startsWith('F')}));
    model.traverse(o=>{if(o instanceof T.Mesh){
      for(const m of ([] as T.Material[]).concat(o.material))if(m instanceof T.MeshStandardMaterial)this.lenses.set(m.name,m);
    }});
    if(occupants&&variant==='cadillac')this.cabin=new CadillacCabin(model,occupants.hero,occupants.dog,occupants.heroClips);
    // Cabin fitting preserves the source vertex IDs; partition the fitted index
    // buffers afterward so every door variant retains the steering-column fit.
    if(variant==='cadillac'){
      this.access=new CadillacAccess(this.body);
      this.trunk=new CadillacTrunk(this.body,this.access.trunkLid);this.trunkSpeakerAnchor=this.trunk.audioAnchor;
    }
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
    this.doorAngle=0;this.doorOpen=this.exiting=this.inspectTrunk=false;this.pitch=this.heave=this.travel=this.lastSpeed=0;
    this.access?.reset();this.trunk?.setOpen(0);this.hydraulics?.reset();
    this.cabin?.reset();
    this.update(0,{gas:0,brake:0,steer:0,handbrake:false},0,false);
  }
  leave(){
    this.riding=this.model.visible=this.exiting=this.doorOpen=this.inspectTrunk=false;
    this.doorAngle=0;if(this.door)this.door.rotation.y=0;this.access?.reset();this.trunk?.setOpen(0);this.sim.cancelCruise();this.sim.pose.speed=0;
  }
  private parkForAccess(){this.sim.selectGear(this.sim.gear);this.sim.cancelCruise();}
  toggleDoor(){if(this.door&&this.riding&&Math.abs(this.sim.pose.speed)<.25&&!this.exiting){this.doorOpen=!this.doorOpen;if(this.doorOpen)this.parkForAccess();}}
  private toggleAccess(panel:CadillacPanel):CadillacAccessResult{
    if(!this.access)return {accepted:false,opening:false,reason:'unavailable'};
    if(!this.riding)return this.access.reject('unavailable');
    if(this.exiting)return this.access.reject('exiting');
    if(Math.abs(this.sim.pose.speed)>=.25)return this.access.reject('moving');
    const result=this.access.toggle(panel,this.terrain,this.sim.pose.y);
    if(result.accepted&&result.opening)this.parkForAccess();
    return result;
  }
  toggleTrunk(){return this.toggleAccess('trunk');}
  toggleRearDoor(side:'left'|'right'){return this.toggleAccess(side==='left'?'rearLeft':'rearRight');}
  accessSnapshot(){return this.access?.snapshot();}
  setTrunkView(enabled:boolean){
    if(enabled&&(!this.trunk||!this.riding||this.exiting||Math.abs(this.sim.pose.speed)>=.25))return false;
    this.inspectTrunk=enabled;return true;
  }
  get trunkView(){return this.inspectTrunk;}
  requestExit(){
    if(this.riding&&this.sim.exitPoint()&&(!this.access||this.access.closeAll(this.terrain,this.sim.pose.y))){
      this.exiting=this.doorOpen=true;this.inspectTrunk=false;this.parkForAccess();
    }
  }
  get exitReady(){return this.exiting&&(!this.door||this.doorAngle>.96)&&!this.access?.held;}
  update(dt:number,input:CarInput,night:number,reduced:boolean,keys:ReadonlySet<string>=emptyKeys){
    if(!this.riding)return;
    const smooth=1-Math.exp(-dt*8);
    this.doorAngle=T.MathUtils.lerp(this.doorAngle,Number(this.doorOpen),reduced?1:smooth);
    if(Math.abs(this.doorAngle-Number(this.doorOpen))<.0001)this.doorAngle=Number(this.doorOpen);
    if(this.door)this.door.rotation.y=-this.doorAngle*1.03||0;
    this.access?.update(dt,reduced);this.trunk?.setOpen(this.access!.trunkProgress);
    const p=this.sim.advance(dt,this.exiting?{...input,gas:0,brake:1,handbrake:true}:input);
    this.model.position.set(p.x,p.y,p.z);this.model.rotation.y=p.heading;
    if(Math.abs(p.speed)>=.25)this.inspectTrunk=false;
    const acceleration=dt?clamp((p.speed-this.lastSpeed)/dt,-10,6):0;
    this.lastSpeed=p.speed;
    this.pitch=T.MathUtils.lerp(this.pitch,reduced?0:acceleration*.004,smooth);
    const sine=Math.sin(p.heading),cosine=Math.cos(p.heading);
    const curvature=Math.tan(p.steering)/wheelbase;
    const suspension=this.hydraulics?.update(dt,keys);
    const wheelRadius=this.hydraulics ? .365164 : radius;
    let mean=0;
    for(const {hub,spin,front} of this.hubs){
      const {x,z}=hub.position;
      const ground=this.terrain.height(p.x+x*cosine+z*sine,p.z-x*sine+z*cosine,p.y);
      const dy=clamp(ground-p.y,-.22,.22);
      hub.position.y=wheelRadius+dy+(suspension?(front?suspension.front:suspension.rear):0);mean+=dy*.25;
      const arc=1-x*curvature;
      hub.rotation.y=front?Math.atan2(wheelbase*curvature,arc):0;
      const distance=p.speed*dt*Math.hypot(arc,front?wheelbase*curvature:0);
      spin.rotation.x=(spin.rotation.x+distance/wheelRadius)%(Math.PI*2);
    }
    this.heave=T.MathUtils.lerp(this.heave,mean,smooth);
    this.body.position.y=this.heave+(this.hydraulics?.heave??0);
    this.body.rotation.set(p.pitch-this.pitch+(this.hydraulics?.pitch??0),0,p.roll+(this.hydraulics?.roll??0));
    this.hydraulics?.updateCylinders();
    this.steeringWheel?.quaternion.setFromAxisAngle(this.steeringAxis,p.steering*5.5);
    this.cabin?.update(dt,p.steering,reduced);
    this.hydraulicDriver?.update(p.steering);
    this.travel+=Math.abs(p.speed)*dt;
    this.lenses.get('BrakeLens')?.emissive.setRGB(this.sim.braking?.95:.15,.005,.007);
    this.lenses.get('Headlamp')?.emissive.setRGB(.23+.75*night,.21+.67*night,.15+.51*night);
    this.lenses.get('ReverseLens')?.emissive.setScalar(this.sim.gear==='R'?.9:0);
  }
  camera(camera:T.PerspectiveCamera,inside:boolean,yaw:number,pitch:number,dt:number,snap:boolean){
    const p=this.sim.pose,angle=p.heading+yaw;
    const interior=inside&&!this.inspectTrunk;
    if(this.inspectTrunk){
      // Rear three-quarter view exposes the lid lettering and all three cones.
      // It shares the normal look controls and terrain obstruction clipping.
      this.aim.set(0,1.25,-2.12);this.body.localToWorld(this.aim);
      const distance=3.8,viewAngle=angle+.48,height=clamp(1.45+pitch*2,.7,3.1);
      this.wanted.set(-Math.sin(viewAngle)*distance,height,-Math.cos(viewAngle)*distance);
      const length=this.wanted.length();this.wanted.normalize();
      const obstacle=this.terrain.raycastObstacle(this.aim,this.wanted,length,.15);
      this.wanted.multiplyScalar(obstacle===null?length:Math.max(.35,obstacle-.2)).add(this.aim);
      this.wanted.y=Math.max(this.wanted.y,this.terrain.height(this.wanted.x,this.wanted.z,p.y)+.5);
      camera.position.lerp(this.wanted,snap?1:1-Math.exp(-dt*12));
    }else if(interior){
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
    const fov=interior?clamp(T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(41))/camera.aspect)),55,110):54;
    if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
    camera.up.copy(T.Object3D.DEFAULT_UP);
    camera.lookAt(this.aim);
  }
  diagnostics(){return {vehicle:this.variant==='cadillac'?'silver-cadillac':this.variant,gear:this.sim.gear,speedMps:this.sim.pose.speed,distanceM:this.travel,
    steeringRad:this.sim.pose.steering,wheelPhaseRad:this.hubs.map(w=>w.spin.rotation.x),driverDoorRad:this.door?.rotation.y??0,
    suspensionPitchRad:this.body.rotation.x,suspensionRollRad:this.body.rotation.z,braking:this.sim.braking,collision:this.sim.collided,
    access:this.access?.diagnostics(),trunkInstallation:this.trunk?.diagnostics(),trunkView:this.inspectTrunk,
    ...(this.cabin?{occupants:this.cabin.diagnostics()}: {})};}
  dispose(){this.leave();this.trunk?.dispose();this.access?.dispose();this.cabin?.dispose();this.hydraulicDriver?.dispose();this.interiorEye.removeFromParent();this.interiorAim.removeFromParent();}
}
