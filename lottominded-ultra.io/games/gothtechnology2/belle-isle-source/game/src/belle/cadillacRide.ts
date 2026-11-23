import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {CarController,type CarInput,type CarCollisionEnvelopeBounds} from './carController.ts';
import {CadillacCabin} from './cadillacCabin.ts';
import {CadillacAccess,type CadillacAccessResult,type CadillacPanel} from './cadillacAccess.ts';
import {CadillacTrunk} from './cadillacTrunk.ts';
import {CadillacHydraulics} from './cadillacHydraulics.ts';
import {fitCadillacWireWheels} from './cadillacWireWheels.ts';
import {HydraulicCadillacDriver} from './hydraulicCadillacDriver.ts';
import {invalidateAnimatedShadow} from '../../runtime/ride-core/src/shadowBudget.ts';
import {CadillacSuspension,CADILLAC_CORNERS,CADILLAC_SUSPENSION_LIMITS,type CadillacCorner,type CadillacCornerHeights,type CadillacHop,type CadillacStance,type CadillacSuspensionPose} from './cadillacSuspension.ts';
import {CadillacWheels,CADILLAC_WHEEL_FITS,type CadillacWheelSelection} from './cadillacWheels.ts';
import {CadillacClearance,cadillacPartSweep} from './cadillacClearance.ts';
import {CadillacWheelClearance,cadillacSuspensionHubXZ} from './cadillacWheelClearance.ts';
import type {ParkTerrain} from './terrain.ts';

export type CadillacVariant='cadillac'|'hydraulic-cadillac';
const modelUrls={cadillac:'./belle/vehicles/silver-cadillac.glb','hydraulic-cadillac':'./belle/vehicles/hydraulics-cadillac.glb'};
const source:Partial<Record<CadillacVariant,Promise<T.Group>>>={};
export function cadillacModel(variant:CadillacVariant='cadillac'){
  return source[variant]??=new GLTFLoader().loadAsync(modelUrls[variant]).then(asset=>{
    if(variant==='hydraulic-cadillac')fitCadillacWireWheels(asset.scene);
    return asset.scene;
  }).catch(error=>{delete source[variant];throw error;});
}
const wheelbase=3.213;
const clamp=T.MathUtils.clamp;
const emptyKeys:ReadonlySet<string>=new Set();
export class CadillacRide {
  readonly sim:CarController;
  readonly cabin?:CadillacCabin;
  readonly access?:CadillacAccess;
  readonly hydraulics?:CadillacHydraulics;
  readonly suspension:CadillacSuspension;
  readonly wheels:CadillacWheels;
  readonly trunk?:CadillacTrunk;
  readonly trunkSpeakerAnchor?:T.Object3D;
  private inspectTrunk=false;
  private readonly body:T.Object3D;
  private readonly clearance:CadillacClearance;
  private readonly wheelClearance:CadillacWheelClearance;
  private readonly hubAnchors:{x:number;y:number;z:number}[];
  private readonly driverSweep?:T.Box3;
  private readonly bodyMatrix=new T.Matrix4();
  private readonly bodyParentMatrix=new T.Matrix4();
  private readonly bodyBounds=new T.Box3();
  private readonly partBounds=new T.Box3();
  private readonly collisionPoint=new T.Vector3();
  private readonly extraParts:T.Box3[]=[];
  private readonly collisionParts:CarCollisionEnvelopeBounds[]=[];
  private readonly posePosition=new T.Vector3();
  private readonly poseRotation=new T.Quaternion();
  private readonly poseEuler=new T.Euler();
  private automaticLevel=false;
  private levelDenied=false;
  private modificationMessage='';
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
    model.updateWorldMatrix(true,true);
    this.bodyParentMatrix.copy(model.matrixWorld).invert().multiply(this.body.parent!.matrixWorld);
    this.clearance=new CadillacClearance(this.body);
    if(variant==='cadillac'){this.door=need('DriverDoor');this.steeringWheel=need('SteeringWheel');this.driverSweep=cadillacPartSweep(this.body,this.door,-1.03);}
    else {
      this.hydraulics=new CadillacHydraulics(need('Cadillac_Model'),this.body);
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
    this.hubAnchors=this.hubs.map(({hub})=>({x:hub.position.x,y:hub.position.y,z:hub.position.z}));
    this.suspension=this.hydraulics?.suspension??new CadillacSuspension(Object.fromEntries(CADILLAC_CORNERS.map((corner,i)=>[corner,{x:this.hubs[i].hub.position.x,y:this.hubs[i].hub.position.y,z:this.hubs[i].hub.position.z}])) as Record<CadillacCorner,{x:number;y:number;z:number}>);
    this.wheelClearance=new CadillacWheelClearance(model,this.body,this.hubs.map(({hub})=>hub),variant);
    this.wheels=new CadillacWheels(model,variant);
    if(hoodieDriver&&variant==='hydraulic-cadillac')this.hydraulicDriver=new HydraulicCadillacDriver(this.body,hoodieDriver);
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
    this.sim.setCollisionEnvelope();
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
    this.access?.reset();this.trunk?.setOpen(0);this.suspension.reset();this.automaticLevel=this.levelDenied=false;this.modificationMessage='';
    this.cabin?.reset();
    this.update(0,{gas:0,brake:0,steer:0,handbrake:false},0,false);
  }
  leave(){
    this.riding=this.model.visible=this.exiting=this.doorOpen=this.inspectTrunk=false;
    this.doorAngle=0;if(this.door)this.door.rotation.y=0;this.access?.reset();this.trunk?.setOpen(0);this.sim.cancelCruise();this.sim.pose.speed=0;
    this.suspension.reset();this.sim.setCollisionEnvelope();this.automaticLevel=this.levelDenied=false;this.modificationMessage='';
  }
  private parkForAccess(){this.sim.selectGear(this.sim.gear);this.sim.cancelCruise();}
  toggleDoor(){if(this.door&&this.riding&&Math.abs(this.sim.pose.speed)<.25&&!this.exiting){
    if(!this.pathClear(this.plannedSuspensionPath(),undefined,true)){this.modificationMessage='There is not enough clearance for the door and suspension.';return;}
    this.doorOpen=!this.doorOpen;if(this.doorOpen)this.parkForAccess();
  }}
  private toggleAccess(panel:CadillacPanel):CadillacAccessResult{
    if(!this.access)return {accepted:false,opening:false,reason:'unavailable'};
    if(!this.riding)return this.access.reject('unavailable');
    if(this.exiting)return this.access.reject('exiting');
    if(Math.abs(this.sim.pose.speed)>=.25)return this.access.reject('moving');
    if(!this.pathClear(this.plannedSuspensionPath(),panel))return this.access.reject('blocked');
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
  get modificationStatus(){return this.modificationMessage;}
  private modificationReady(){
    if(!this.riding||this.exiting)return 'Return to the parked Cadillac to change its setup.';
    if(Math.abs(this.sim.pose.speed)>=.25)return 'Stop the Cadillac before changing its setup.';
    return '';
  }
  private result(accepted:boolean,message:string){this.modificationMessage=message;return{accepted,message};}
  private extraBounds(panel?:CadillacPanel,driver=false){
    const extra=this.extraParts;extra.length=0;this.access?.collisionParts(panel,extra);
    if(this.driverSweep&&(driver||this.doorOpen||this.doorAngle>0))extra.push(this.driverSweep);
    return extra;
  }
  private suspensionMatrix(pose:Readonly<CadillacSuspensionPose>,world:boolean,matrix=new T.Matrix4()){
    const p=this.sim.pose;
    this.posePosition.set(this.body.position.x,this.heave+pose.heave,this.body.position.z);
    this.poseEuler.set(p.pitch-this.pitch+pose.pitch,0,p.roll+pose.roll);
    this.poseRotation.setFromEuler(this.poseEuler);
    matrix.compose(this.posePosition,this.poseRotation,this.body.scale);
    // Keep physics bounds in car-local coordinates. Going through world space
    // and back introduces tiny moving-origin errors that invalidate caches.
    matrix.premultiply(this.bodyParentMatrix);
    if(world){this.model.updateWorldMatrix(true,false);matrix.premultiply(this.model.matrixWorld);}
    return matrix;
  }
  private plannedSuspensionPath(){
    return this.suspension.previewPendingMotion(24);
  }
  private pathClear(poses:readonly CadillacSuspensionPose[],panel?:CadillacPanel,driver=false){
    const p=this.sim.pose,sine=Math.sin(p.heading),cosine=Math.cos(p.heading),curvature=Math.tan(p.steering)/wheelbase;
    const samples=poses.map(pose=>{
      const wheelCenters=this.hubAnchors.map((anchor,i)=>{
        const center={x:0,y:0,z:0};cadillacSuspensionHubXZ(anchor,pose,center);
        const x=p.x+center.x*cosine+center.z*sine,z=p.z-center.x*sine+center.z*cosine;
        const ground=this.terrain.height(x,z,p.y),surface=this.terrain.roadContact?.height(x,z,ground)??ground;
        center.y=this.wheels.radius+clamp(surface-p.y,-.22,.22)+pose.wheelLifts[CADILLAC_CORNERS[i]];
        return center;
      });
      return{bodyMatrix:this.suspensionMatrix(pose,false),wheelCenters,
        steering:wheelCenters.map((center,i)=>this.hubs[i].front?Math.atan2(wheelbase*curvature,1-center.x*curvature):0)};
    });
    if(!this.wheelClearance.clearPath(samples))return false;
    return this.clearance.clearPath(poses.map(pose=>this.suspensionMatrix(pose,true)),this.terrain,p.y,this.extraBounds(panel,driver));
  }
  private clearanceMessage(fallback:string){
    const failure=this.wheelClearance.failure;
    if(!failure)return fallback;
    const names={FL:'front left',FR:'front right',RL:'rear left',RR:'rear right'};
    return `That stance would bring the ${names[failure.corner]} tire into its fender. Use a more level setting or straighten the wheels.`;
  }
  private acceptTargets(targets:CadillacCornerHeights,immediate:boolean){
    const reason=this.modificationReady();if(reason)return this.result(false,reason);
    if(this.suspension.snapshot().hop)return this.result(false,'Let the current hop finish before changing corner heights.');
    if(!CADILLAC_CORNERS.every(corner=>Number.isFinite(targets[corner])&&targets[corner]>=CADILLAC_SUSPENSION_LIMITS.min&&targets[corner]<=CADILLAC_SUSPENSION_LIMITS.max))return this.result(false,'Choose a height within the suspension range.');
    const current=this.suspension.snapshot().current;
    const steps=Math.max(1,Math.ceil(Math.max(...CADILLAC_CORNERS.map(corner=>Math.abs(targets[corner]-current[corner])))/.025));
    if(!this.pathClear(this.suspension.previewPath(targets,steps)))return this.result(false,this.clearanceMessage('Not enough clearance. Move away from the obstacle or choose a higher, more level stance.'));
    this.parkForAccess();this.suspension.setTargets(targets,immediate);this.automaticLevel=this.levelDenied=false;
    if(immediate)this.presentSuspension(0);
    return this.result(true,'Suspension updated. Uneven corners level before steering or driving.');
  }
  setSuspensionCorner(corner:CadillacCorner,metres:number,immediate=true){
    if(!CADILLAC_CORNERS.includes(corner))return this.result(false,'Choose one of the four wheel corners.');
    return this.acceptTargets({...this.suspension.targets,[corner]:metres},immediate);
  }
  setSuspensionStance(stance:CadillacStance,immediate=true){
    if(!['low','cruise','raised','level'].includes(stance))return this.result(false,'Choose a suspension preset.');
    const targets=this.suspension.targets,height=stance==='level'?CADILLAC_CORNERS.reduce((sum,corner)=>sum+targets[corner]/4,0):CADILLAC_SUSPENSION_LIMITS[stance];
    return this.acceptTargets({FL:height,FR:height,RL:height,RR:height},immediate);
  }
  hopSuspension(mode:CadillacHop,reduced:boolean){
    const reason=this.modificationReady();if(reason)return this.result(false,reason);
    if(reduced)return this.result(false,'Hops are off with Reduced camera motion. Static height controls are available.');
    if(!['all','front','rear'].includes(mode))return this.result(false,'Choose all wheels, front, or rear.');
    const state=this.suspension.snapshot();if(!state.settled||state.cooldown>0)return this.result(false,'Let the suspension settle before the next hop.');
    if(!this.pathClear(this.suspension.previewHop(mode,24)))return this.result(false,this.clearanceMessage('Not enough overhead or panel clearance to hop here.'));
    if(!this.suspension.hop(mode,reduced))return this.result(false,'Let the suspension settle before the next hop.');
    this.parkForAccess();this.automaticLevel=this.levelDenied=false;return this.result(true,'Hydraulic hop started. Driving resumes after landing and leveling.');
  }
  settleSuspension(){
    const reason=this.modificationReady();if(reason)return this.result(false,reason);
    const targets=this.suspension.targets,height=CADILLAC_CORNERS.reduce((sum,corner)=>sum+targets[corner]/4,0);
    if(!this.pathClear(this.suspension.previewPath({FL:height,FR:height,RL:height,RR:height})))return this.result(false,this.clearanceMessage('There is not enough clearance to level here.'));
    this.suspension.settle();this.automaticLevel=true;this.levelDenied=false;this.parkForAccess();return this.result(true,'Finishing the current motion, then leveling the Cadillac.');
  }
  setWheels(selection:CadillacWheelSelection){
    const reason=this.modificationReady();if(reason)return this.result(false,reason);
    if(!this.suspension.settled)return this.result(false,'Let the suspension settle before changing wheels.');
    return this.wheels.apply(selection)?this.result(true,'Wheels and tires updated.'):this.result(false,'Choose a supported wheel and tire option.');
  }
  suspensionKey(code:string,shift:boolean,repeat:boolean,reduced:boolean){
    if(!shift||!['KeyX','KeyY','KeyZ'].includes(code))return false;
    if(!repeat){if(code==='KeyY')this.setSuspensionStance('cruise',reduced);else this.hopSuspension(code==='KeyZ'?'front':'rear',reduced);}
    return true;
  }
  requestExit(){
    if(!this.riding||!this.sim.exitPoint())return;
    const needsLevel=!this.suspension.readyForDrive,path=this.plannedSuspensionPath();
    if(needsLevel){const targets=this.suspension.targets,height=CADILLAC_CORNERS.reduce((sum,corner)=>sum+targets[corner]/4,0);path.push(...this.suspension.previewPath({FL:height,FR:height,RL:height,RR:height}));}
    if(!this.pathClear(path,undefined,true)||this.access&&!this.access.closeAll(this.terrain,this.sim.pose.y))return;
    // All exit checks precede both panel and suspension commits.
    if(needsLevel){this.suspension.settle();this.automaticLevel=true;this.levelDenied=false;}
    this.exiting=this.doorOpen=true;this.inspectTrunk=false;this.parkForAccess();
  }
  get exitReady(){return this.exiting&&this.suspension.readyForDrive&&(!this.door||this.doorAngle>.96)&&!this.access?.held;}
  update(dt:number,input:CarInput,night:number,reduced:boolean,keys:ReadonlySet<string>=emptyKeys){
    if(!this.riding)return;
    dt=clamp(Number.isFinite(dt)?dt:0,0,.12);
    const smooth=1-Math.exp(-dt*8);
    const liftDirection=Number(keys.has('PageUp'))-Number(keys.has('PageDown'));
    if(liftDirection&&dt>0&&!this.exiting&&Math.abs(this.sim.pose.speed)<.25&&!this.suspension.snapshot().hop){
      const selectors=['KeyU','KeyO','KeyJ','KeyL'],single=selectors.some(key=>keys.has(key)),previous=this.suspension.targets,targets={...previous};
      CADILLAC_CORNERS.forEach((corner,i)=>{if(!single||keys.has(selectors[i]))targets[corner]=clamp(targets[corner]+liftDirection*dt*.28,CADILLAC_SUSPENSION_LIMITS.min,CADILLAC_SUSPENSION_LIMITS.max);});
      if(CADILLAC_CORNERS.some(corner=>targets[corner]!==previous[corner]))this.acceptTargets(targets,reduced);
    }
    const wantsDrive=input.gas>.02||input.brake>.02&&!input.handbrake||this.sim.cruise>0;
    if(wantsDrive&&!this.suspension.readyForDrive&&!this.automaticLevel&&!this.levelDenied){
      if(!this.settleSuspension().accepted)this.levelDenied=true;
    }
    if(!wantsDrive)this.levelDenied=false;
    this.suspension.update(dt,reduced);
    if(this.suspension.readyForDrive)this.automaticLevel=false;
    this.doorAngle=T.MathUtils.lerp(this.doorAngle,Number(this.doorOpen),reduced?1:smooth);
    if(Math.abs(this.doorAngle-Number(this.doorOpen))<.0001)this.doorAngle=Number(this.doorOpen);
    if(this.door)this.door.rotation.y=-this.doorAngle*1.03||0;
    this.access?.update(dt,reduced);this.trunk?.setOpen(this.access!.trunkProgress);
    // Preserve the intentional open-panel driving feature. Only an unfinished
    // hydraulic motion/asymmetric wheel contact or exit holds the brakes.
    const suspensionHeld=!this.suspension.readyForDrive,held=this.exiting||suspensionHeld;
    this.syncCollisionEnvelope();
    // Keep the steering angle used by the accepted fender-clearance sweep.
    // Normal steering resumes as soon as all corners have landed and leveled.
    const p=this.sim.advance(dt,held?{...input,gas:0,brake:1,handbrake:true,lockSteering:suspensionHeld,lockAttitude:suspensionHeld}:input);
    this.model.position.set(p.x,p.y,p.z);this.model.rotation.y=p.heading;
    if(Math.abs(p.speed)>=.25)this.inspectTrunk=false;
    const acceleration=dt?clamp((p.speed-this.lastSpeed)/dt,-10,6):0;
    this.lastSpeed=p.speed;
    if(!suspensionHeld)this.pitch=T.MathUtils.lerp(this.pitch,reduced?0:acceleration*.004,smooth);
    this.presentSuspension(dt);
    this.steeringWheel?.quaternion.setFromAxisAngle(this.steeringAxis,p.steering*5.5);
    this.cabin?.update(dt,p.steering,reduced);
    this.hydraulicDriver?.update(p.steering);
    if(this.hydraulicDriver)invalidateAnimatedShadow(this.model);
    this.travel+=Math.abs(p.speed)*dt;
    this.lenses.get('BrakeLens')?.emissive.setRGB(this.sim.braking?.95:.15,.005,.007);
    this.lenses.get('Headlamp')?.emissive.setRGB(.23+.75*night,.21+.67*night,.15+.51*night);
    this.lenses.get('ReverseLens')?.emissive.setScalar(this.sim.gear==='R'?.9:0);
  }
  private presentSuspension(dt:number){
    const p=this.sim.pose,smooth=1-Math.exp(-dt*8),suspension=this.suspension.pose;
    const sine=Math.sin(p.heading),cosine=Math.cos(p.heading);
    const curvature=Math.tan(p.steering)/wheelbase;
    const wheelRadius=this.wheels.radius;
    let mean=0;
    for(let i=0;i<this.hubs.length;i++){
      const {hub,spin,front}=this.hubs[i];
      // Keep the wheel centered beneath its tilted fender. The original hub
      // anchors remain immutable, so repeated edits never accumulate drift.
      cadillacSuspensionHubXZ(this.hubAnchors[i],suspension,hub.position);
      const {x,z}=hub.position;
      const wheelX=p.x+x*cosine+z*sine,wheelZ=p.z-x*sine+z*cosine;
      const ground=this.terrain.height(wheelX,wheelZ,p.y);
      const surface=this.terrain.roadContact?.height(wheelX,wheelZ,ground)??ground;
      const dy=clamp(surface-p.y,-.22,.22);
      hub.position.y=wheelRadius+dy+suspension.wheelLifts[CADILLAC_CORNERS[i]];mean+=dy*.25;
      const arc=1-x*curvature;
      hub.rotation.y=front?Math.atan2(wheelbase*curvature,arc):0;
      const distance=p.speed*dt*Math.hypot(arc,front?wheelbase*curvature:0);
      spin.rotation.x=(spin.rotation.x+distance/wheelRadius)%(Math.PI*2);
    }
    // Clearance was checked against this parked base attitude and road heave.
    // Do not add an unmeasured ground-settling transform during a hop/tilt.
    if(this.suspension.readyForDrive)this.heave=T.MathUtils.lerp(this.heave,mean,smooth);
    this.body.position.y=this.heave+suspension.heave;
    this.body.rotation.set(p.pitch-this.pitch+suspension.pitch,0,p.roll+suspension.roll);
    this.hydraulics?.updateCylinders();
    this.syncCollisionEnvelope();
  }
  private syncCollisionEnvelope(){
    const matrix=this.suspensionMatrix(this.suspension.pose,false,this.bodyMatrix),bounds=this.clearance.bounds(matrix,this.bodyBounds);
    const fit=CADILLAC_WHEEL_FITS[this.variant],halfWidth=Math.max(fit.halfWidth,fit.outset),radius=this.wheels.radius;
    for(const {hub}of this.hubs){
      const sine=Math.abs(Math.sin(hub.rotation.y)),cosine=Math.abs(Math.cos(hub.rotation.y));
      const halfX=halfWidth*cosine+radius*sine,halfZ=halfWidth*sine+radius*cosine;
      bounds.expandByPoint(this.collisionPoint.set(hub.position.x-halfX,hub.position.y-radius,hub.position.z-halfZ));
      bounds.expandByPoint(this.collisionPoint.set(hub.position.x+halfX,hub.position.y+radius,hub.position.z+halfZ));
    }
    const parts=this.collisionParts,extra=this.extraBounds();
    for(let i=0;i<extra.length;i++){
      const part=this.partBounds.copy(extra[i]).applyMatrix4(matrix),entry=parts[i]??={minX:0,maxX:0,minY:0,maxY:0,minZ:0,maxZ:0};
      entry.minX=part.min.x;entry.maxX=part.max.x;entry.minY=part.min.y;entry.maxY=part.max.y;entry.minZ=part.min.z;entry.maxZ=part.max.z;
    }
    parts.length=extra.length;
    this.sim.setCollisionEnvelope({minX:bounds.min.x,maxX:bounds.max.x,minY:bounds.min.y,maxY:bounds.max.y,minZ:bounds.min.z,maxZ:bounds.max.z,parts});
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
    suspension:this.suspension.snapshot(),wheels:this.wheels.diagnostics(),modificationStatus:this.modificationMessage,
    ...(this.cabin?{occupants:this.cabin.diagnostics()}: {})};}
  dispose(){this.leave();this.wheels.dispose();this.trunk?.dispose();this.access?.dispose();this.cabin?.dispose();this.hydraulicDriver?.dispose();this.interiorEye.removeFromParent();this.interiorAim.removeFromParent();}
}
