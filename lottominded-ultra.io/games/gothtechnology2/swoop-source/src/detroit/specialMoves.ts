import {clamp} from './rideDynamics.ts';
import {RIDE_RULES} from './rideRules.ts';

export const SPECIAL_MOVES=[
  {id:1,name:'Curb hop',key:'1',maxSpeed:7,preload:.42,turn:0,points:120},
  {id:2,name:'180 hop',key:'2',maxSpeed:4,preload:.52,turn:Math.PI,points:200},
  {id:3,name:'360 hop',key:'3',maxSpeed:4,preload:.74,turn:Math.PI*2,points:350},
  {id:4,name:'One-foot glide',key:'4',maxSpeed:5,preload:0,turn:0,points:150},
  {id:5,name:'Rolling pirouette',key:'5',maxSpeed:1.4,preload:0,turn:Math.PI*2,points:240},
  {id:6,name:'Pendulum',key:'6',maxSpeed:1,preload:0,turn:0,points:180},
  {id:7,name:'Tuck hop',key:'7',maxSpeed:6,preload:.68,turn:0,points:220},
] as const;
const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
type Phase='idle'|'preload'|'launch'|'flight'|'glide'|'flow'|'settle';

/** Fixed-step trick intent. Never moves the rider through space or adds an air impulse. */
export class SpecialMoves {
  phase:Phase='idle';id=0;age=0;direction=1;rotation=0;duration=1;
  foot=0;twist=0;reach=0;tuck=0;event='';award=0;completed=0;
  private down=false;private eligible=false;
  cooldown=0;
  groundYaw=0;targetSpeed:number|null=null;
  get move(){return SPECIAL_MOVES.find(m=>m.id===this.id);}
  get active(){return this.phase!=='idle';}
  reset(){this.cooldown=0;this.groundYaw=0;this.targetSpeed=null;this.phase='idle';this.id=0;this.age=this.rotation=this.foot=this.twist=this.reach=this.tuck=0;this.down=false;this.eligible=false;this.event='';this.award=0;}
  beginStep(request:number,grounded:boolean,crashed:boolean,speed:number,bank:number,steer:number,dt:number,clear=true){
    this.event='';this.award=0;this.groundYaw=0;this.targetSpeed=null;
    this.cooldown=Math.max(0,this.cooldown-dt);
    const edge=request!==0&&!this.down;this.down=request!==0;
    if(crashed){this.cancel();if(edge)this.event='Recover before starting a trick';return {crouch:false,hop:false};}
    if(edge&&this.active)this.event='Finish or settle the current move first';
    if(edge&&!this.active){const move=SPECIAL_MOVES.find(m=>m.id===request);
      if(move){
        if(!grounded)this.event='Land before starting a special move';
        else if(this.cooldown>0)this.event='Let the wheel settle before another move';
        else if(Math.abs(speed)>move.maxSpeed)this.event=`${move.name}: slow below ${Math.round(move.maxSpeed*3.6)} km/h`;
        else if(Math.abs(bank)>.22)this.event='Straighten the wheel before starting a trick';
        else if(!clear)this.event='Not enough clear space for this move';
        else if(move.id===4&&speed<1)this.event='One-foot glide: roll forward at 4–18 km/h';
        else {this.id=move.id;this.age=0;this.rotation=0;this.direction=steer>.1?-1:steer<-.1?1:1;this.phase=move.id===4?'glide':move.id===5||move.id===6?'flow':'preload';this.event=move.name+' · '+(move.preload?'preload':'balance');}
      }
    }
    const move=this.move;let hop=false;
    if(this.phase==='preload'&&move){
      if(!grounded){this.cancel('Move canceled: wheel left the ground');}
      else {this.age+=dt;const wind=Math.sin(clamp(this.age/move.preload,0,1)*Math.PI/2);this.twist=-this.direction*wind*(move.turn?.22:0);this.reach=.1*wind;
        if(this.age>=move.preload){this.phase='launch';hop=true;}}
    }else if(this.phase==='glide'){
      if(!grounded||speed<.6||Math.abs(speed)>5.5||Math.abs(bank)>.32||Math.abs(steer)>.65)this.cancel('Foot down · regain balance');
      else{this.age+=dt;this.foot=smooth(this.age/.3)*(1-smooth((this.age-1.5)/.35));this.reach=this.foot*.3;
        if(this.age>=1.85){this.phase='settle';this.age=0;this.eligible=true;}}
    }else if(this.phase==='flow'){
      if(!grounded||Math.abs(bank)>.35||Math.abs(steer)>.7)this.cancel('Flow canceled · regain balance');
      else {
        this.age+=dt;const duration=this.id===5?3.6:4.8,t=clamp(this.age/duration,0,1),envelope=Math.sin(Math.PI*t)**2;
        // Low-speed rotation ramps up and down; translation still uses the collision controller.
        const rotation=this.id===5?this.direction*Math.PI*2*smooth(t):0;
        this.groundYaw=rotation-this.rotation;this.rotation=rotation;
        this.targetSpeed=this.id===5?.4*envelope:.85*Math.sin(t*Math.PI*4)*envelope;
        this.twist=this.id===5?this.direction*.18*Math.sin(t*Math.PI*2):0;
        this.reach=.24*envelope;this.tuck=.035*envelope;
        if(t>=1){this.phase='settle';this.age=0;this.eligible=true;}
      }
    }else if(this.phase==='settle'){
      if(this.id===5||this.id===6)this.targetSpeed=0;
      if(!grounded||Math.abs(bank)>.4)this.cancel('Trick not banked · settle the wheel first');
      else {this.age+=dt;this.foot=this.twist=this.reach=this.tuck=0;
        if(this.age>=RIDE_RULES.settleSeconds){if(this.eligible&&move){this.award=move.points;this.completed++;this.event=`${move.name} · clean +${move.points}`;}this.phase='idle';this.id=0;this.cooldown=.4;}}
    }
    return {crouch:this.phase==='preload'||this.phase==='launch',hop};
  }
  launch(velocityY:number){if(this.phase!=='launch')return;this.phase='flight';this.age=0;this.rotation=0;this.duration=Math.max(.25,2*velocityY/9.81*.90);}
  airStep(dt:number){
    if(this.phase!=='flight')return 0;
    this.age+=dt;const t=clamp(this.age/this.duration,0,1),target=(this.move?.turn??0)*this.direction*smooth(t),delta=target-this.rotation;
    this.rotation=target;const pulse=Math.sin(Math.PI*t);
    this.twist=this.direction*((this.move?.turn?-.22:0)*(1-smooth(t/.2))+.16*Math.sin(t*Math.PI*2));this.reach=(this.id===7?.12:.22)*pulse;this.tuck=(this.id===7?.23:.14)*pulse;
    return delta;
  }
  land(quality:string){if(this.phase!=='flight')return;
    this.eligible=(quality==='clean'||quality==='charged')&&Math.abs(this.rotation-(this.move?.turn??0)*this.direction)<.18;
    if(!this.eligible){this.cancel('Trick missed · finish rotation and land softly');return;}
    this.phase='settle';this.age=0;this.twist=this.reach=this.tuck=0;
  }
  cancel(message=''){this.groundYaw=0;this.targetSpeed=null;this.phase='idle';this.id=0;this.foot=this.twist=this.reach=this.tuck=0;this.eligible=false;if(message)this.event=message;}
  snapshot(){return {id:this.id,name:this.move?.name??'',phase:this.phase,rotation:this.rotation,foot:this.foot,completed:this.completed,pending:this.active?(this.move?.points??0):0,settleProgress:this.phase==='settle'?clamp(this.age/RIDE_RULES.settleSeconds,0,1):0,settleSeconds:RIDE_RULES.settleSeconds,cooldown:this.cooldown};}
}

