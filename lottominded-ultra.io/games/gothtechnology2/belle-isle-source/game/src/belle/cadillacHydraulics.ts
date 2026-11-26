import * as T from 'three';
import {CadillacSuspension,CADILLAC_CORNERS,type CadillacSuspensionAnchors} from './cadillacSuspension.ts';

const corners=CADILLAC_CORNERS;
export const hydraulicCadillacControls='Page Up / Page Down · raise / lower. Hold U, O, J or L for one corner. Right Shift + Z / X · front / rear hop. Right Shift + Y · cruise stance.';

export class CadillacHydraulics {
  readonly suspension:CadillacSuspension;
  private readonly start=new T.Vector3();
  private readonly end=new T.Vector3();
  private readonly difference=new T.Vector3();
  private readonly up=new T.Vector3(0,1,0);
  readonly hubs:{hub:T.Group;spin:T.Object3D;front:boolean}[];
  private readonly cylinders:{chassis:T.Object3D;wheel:T.Object3D;sections:{part:T.Object3D;scale:number;fraction:number}[]}[];
  get heave(){return this.suspension.pose.heave;}
  get pitch(){return this.suspension.pose.pitch;}
  get roll(){return this.suspension.pose.roll;}

  constructor(private readonly root:T.Object3D,body:T.Object3D){
    const requirePart=(name:string)=>{
      const part=root.getObjectByName(name);
      if(!part)throw Error('Hydraulic Cadillac part missing: '+name);
      return part;
    };
    this.hubs=corners.map(corner=>{
      const spin=requirePart('Wheel_'+corner);
      const hub=new T.Group();
      hub.name='HydraulicHub'+corner;
      hub.position.copy(spin.position);
      spin.parent!.add(hub);
      hub.add(spin);
      spin.position.set(0,0,0);
      hub.attach(requirePart('Hydraulic_'+corner+'_HubMount'));
      return {hub,spin,front:corner.startsWith('F')};
    });
    this.cylinders=corners.map(corner=>{
      const prefix='Hydraulic_'+corner+'_';
      const chassis=requirePart(prefix+'ChassisMount'),wheel=requirePart(prefix+'HubMount');
      body.attach(chassis);
      chassis.getWorldPosition(this.start);
      const rest=wheel.getWorldPosition(this.end).distanceTo(this.start);
      return {chassis,wheel,sections:['Barrel','Rod'].map((name,index)=>{
        const part=requirePart(prefix+name);
        return {part,scale:part.scale.y/rest,fraction:index===0?.32:.78};
      })};
    });
    this.suspension=new CadillacSuspension(Object.fromEntries(corners.map((corner,index)=>{
      const p=this.hubs[index].hub.position;return[corner,{x:p.x,y:p.y,z:p.z}];
    })) as unknown as CadillacSuspensionAnchors);
  }

  reset(){this.suspension.reset();}

  stance(value:'low'|'cruise'|'raised'){
    return this.suspension.stance(value);
  }

  hop(front:boolean,speed:number,reducedMotion=false){
    if(!Number.isFinite(speed)||Math.abs(speed)>=.25)return false;
    return this.suspension.hop(front?'front':'rear',reducedMotion);
  }

  key(code:string,shift:boolean,repeat:boolean,speed:number){
    if(!shift||!['KeyX','KeyY','KeyZ'].includes(code))return false;
    if(repeat)return true;
    if(code==='KeyY'){if(Number.isFinite(speed)&&Math.abs(speed)<.25)this.stance('cruise');}
    else this.hop(code==='KeyZ',speed);
    return true;
  }

  /** Keyboard requests are validated by CadillacRide before changing targets.
   * Retain the old argument shape without an unchecked per-frame mutation. */
  update(dt:number,_keys:ReadonlySet<string>,reducedMotion=false){
    const pose=this.suspension.update(dt,reducedMotion),wheels=pose.wheelLifts;
    return {front:(wheels.FL+wheels.FR)/2,rear:(wheels.RL+wheels.RR)/2,wheelLifts:wheels};
  }

  updateCylinders(){
    this.root.updateWorldMatrix(true,true);
    for(const {chassis,wheel,sections} of this.cylinders){
      this.root.worldToLocal(chassis.getWorldPosition(this.start));
      this.root.worldToLocal(wheel.getWorldPosition(this.end));
      this.difference.subVectors(this.end,this.start);
      const length=this.difference.length();
      if(length<.01)continue;
      this.difference.multiplyScalar(1/length);
      for(const {part,scale,fraction} of sections){
        part.position.copy(this.start).lerp(this.end,fraction);
        part.quaternion.setFromUnitVectors(this.up,this.difference);
        part.scale.y=scale*length;
      }
    }
  }
}
