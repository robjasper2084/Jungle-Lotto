import * as T from 'three';

const corners=['FL','FR','RL','RR'] as const;
export const hydraulicCadillacControls='Page Up / Page Down · raise / lower. Hold U, O, J or L for one corner. Right Shift + Z / X · front / rear hop. Right Shift + Y · cruise stance.';

export class CadillacHydraulics {
  private readonly targets=[0,0,0,0];
  private readonly travel=[0,0,0,0];
  private readonly start=new T.Vector3();
  private readonly end=new T.Vector3();
  private readonly difference=new T.Vector3();
  private readonly up=new T.Vector3(0,1,0);
  private hopTime=0;
  private hopFront=false;
  private cooldown=0;
  readonly hubs:{hub:T.Group;spin:T.Object3D;front:boolean}[];
  private readonly cylinders:{chassis:T.Object3D;wheel:T.Object3D;sections:{part:T.Object3D;scale:number;fraction:number}[]}[];
  heave=0;
  pitch=0;
  roll=0;

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
  }

  reset(){
    this.targets.fill(0);this.travel.fill(0);
    this.heave=this.pitch=this.roll=this.hopTime=this.cooldown=0;
  }

  stance(value:'low'|'cruise'|'raised'){
    this.targets.fill(value==='low' ? -.11 : value==='raised' ? .14 : 0);
  }

  hop(front:boolean,speed:number){
    if(Math.abs(speed)>2||this.hopTime||this.cooldown>0)return false;
    this.hopFront=front;this.hopTime=1;
    return true;
  }

  key(code:string,shift:boolean,repeat:boolean,speed:number){
    if(!shift||!['KeyX','KeyY','KeyZ'].includes(code))return false;
    if(repeat)return true;
    if(code==='KeyY')this.stance('cruise');
    else this.hop(code==='KeyZ',speed);
    return true;
  }

  update(dt:number,keys:ReadonlySet<string>){
    const direction=Number(keys.has('PageUp'))-Number(keys.has('PageDown'));
    const selectors=['KeyU','KeyO','KeyJ','KeyL'];
    const single=selectors.some(key=>keys.has(key));
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.hopTime>0){
      this.hopTime=Math.max(0,this.hopTime-dt);
      if(!this.hopTime)this.cooldown=.45;
    }
    const hop=this.hopTime ? .23*Math.sin(Math.PI*this.hopTime)**2 : 0;
    for(let i=0;i<4;i++){
      if(!single||keys.has(selectors[i]))this.targets[i]=T.MathUtils.clamp(this.targets[i]+direction*dt*.28,-.11,.14);
      const difference=this.targets[i]-this.travel[i];
      this.travel[i]+=T.MathUtils.clamp(difference,-dt*.45,dt*.35);
    }
    const [fl,fr,rl,rr]=this.travel;
    const front=(fl+fr)*.5+(this.hopFront?hop:0),rear=(rl+rr)*.5+(this.hopFront?0:hop);
    this.heave=(front+rear)*.5;
    this.pitch=(rear-front)/3.213;
    this.roll=(fl+rl-fr-rr)/3.296;
    return {front:this.hopFront?hop*.65:0,rear:this.hopFront?0:hop*.65};
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
