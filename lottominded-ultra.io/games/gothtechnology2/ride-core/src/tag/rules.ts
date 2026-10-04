import {RideController,NEUTRAL_ACTIONS,createPose,type RidePose} from '../controller.ts';
import {RIDE_TUNING,clamp,angle} from '../rideDynamics.ts';
import type {Vec3,TerrainSampler} from '../terrain.ts';
import {lanePoint,type TagFixture,type TagProduct} from './fixture.ts';
import {TagNavigation} from './navigation.ts';
export const TAG_VERSION='heart-rush-1';
export const TAG_RULES=Object.freeze({duration:180,countdown:3,headStart:3,lock:2,shotInterval:.7,speed:24,range:24,lifetime:1,radius:.14,capacity:3,regen:2,burstDuration:.6,burstCost:35,burstCooldown:3,burstDelay:1.25,burstRegen:10});
export type TagRuleset='classic'|'spread';export type TagPhase='lobby'|'loading'|'countdown'|'head_start'|'active'|'results'|'disposing';
export type TagCommand={round:string;seq:number;tick:number;throttle:number;steer:number;aimYaw:number;aimPitch:number;fire:boolean;shot:number;hop:boolean;burst:boolean;reset:boolean};
export type TagActor={id:string;name:string;bot:boolean;dnf:boolean;connected:boolean;controller:RideController;previous:RidePose;role:'runner'|'it';epoch:number;lock:number;protectedUntil:number;ammo:number;regen:number;lastShot:number;lastShotId:number;ack:number;input:TagCommand;itTime:number;tags:number;resets:number;burst:number;burstEnd:number;burstReady:number;controlled:number;outside:number;crashAge:number;seen?:{id:string;position:Vec3;until:number};goal?:Vec3;decision:number;reaction:number;botHop:boolean;route:Vec3[];routeAge:number;progress:Vec3;stuck:number;explored:Set<string>};
export type Heart={id:string;shooter:string;round:string;epoch:number;tick:number;from:Vec3;position:Vec3;velocity:Vec3;age:number};
export type TagEvent={id:string;tick:number;kind:'shot'|'blocked'|'tag'|'reset'|'result';actor:string;target?:string};
export type TagSnapshot={version:string;hash:string;product:TagProduct;arena:string;round:string;tick:number;phase:TagPhase;time:number;remaining:number;ruleset:TagRuleset;actors:{id:string;name:string;bot:boolean;connected:boolean;dnf:boolean;role:string;epoch:number;ammo:number;burst:number;lock:number;itTime:number;tags:number;resets:number;ack:number;pose:RidePose}[];hearts:Heart[];events:TagEvent[];winners:string[];owner?:{id:string;state:ReturnType<RideController['captureState']>}};
export const neutralCommand=(round='',seq=0,tick=0):TagCommand=>({round,seq,tick,throttle:0,steer:0,aimYaw:0,aimPitch:0,fire:false,shot:0,hop:false,burst:false,reset:false});
const cell=(p:Vec3)=>Math.floor(p.x/12)+','+Math.floor(p.z/12);
const copy=(p:Vec3):Vec3=>({x:p.x,y:p.y,z:p.z}),sub=(a:Vec3,b:Vec3)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),add=(a:Vec3,b:Vec3)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),scale=(a:Vec3,t:number)=>({x:a.x*t,y:a.y*t,z:a.z*t});
/** Relative swept spheres: moving target crossings count even between fixed ticks. */
export function sphereTOI(a0:Vec3,a1:Vec3,b0:Vec3,b1:Vec3,radius:number){
  const p=sub(a0,b0),v=sub(sub(a1,a0),sub(b1,b0)),c=p.x*p.x+p.y*p.y+p.z*p.z-radius*radius;if(c<=0)return 0;
  const aa=v.x*v.x+v.y*v.y+v.z*v.z,bb=2*(p.x*v.x+p.y*v.y+p.z*v.z),d=bb*bb-4*aa*c;if(aa<1e-12||d<0)return null;
  const t=(-bb-Math.sqrt(d))/(2*aa);return t>=0&&t<=1?t:null;
}
export function validCommand(c:TagCommand,actor:TagActor,round:string,tick:number){
  return c&&c.round===round&&Number.isSafeInteger(c.seq)&&c.seq>actor.ack&&c.seq<actor.ack+241&&Number.isSafeInteger(c.tick)&&Math.abs(c.tick-tick)<=120&&
    [c.throttle,c.steer,c.aimYaw,c.aimPitch].every(Number.isFinite)&&Math.abs(c.throttle)<=1&&Math.abs(c.steer)<=1&&Math.abs(c.aimYaw)<=1.35&&Math.abs(c.aimPitch)<=.75&&
    Number.isSafeInteger(c.shot)&&c.shot>=0&&typeof c.fire==='boolean'&&typeof c.hop==='boolean'&&typeof c.burst==='boolean'&&typeof c.reset==='boolean';
}
/** Only this simulation resolves roles, ammunition, movement and results, offline or hosted. */
export class TagMatch{
  actors:TagActor[]=[];hearts:Heart[]=[];events:TagEvent[]=[];winners:string[]=[];phase:TagPhase='lobby';tick=0;time=0;round='';remaining:number=TAG_RULES.duration;roundNumber=0;private eventSeq=0;private randomState=18321;readonly navigation:TagNavigation;
  constructor(readonly fixture:TagFixture,readonly terrain:TerrainSampler & {sweep?(p:Vec3,d:Vec3,r:number):number|null;legal?(p:Vec3):boolean},readonly ruleset:TagRuleset='classic',readonly difficulty:'easy'|'normal'|'hard'|'expert'='normal',readonly duration:number=TAG_RULES.duration){this.navigation=new TagNavigation(fixture,terrain);}
  private random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  addActor(id:string,name:string,bot=false){
    if(this.actors.length>=8||this.actors.some(a=>a.id===id))throw Error('ROOM_FULL');
    const spawn=this.fixture.spawns[this.actors.length%this.fixture.spawns.length],speed=this.fixture.product==='swoop-detroit'?10:8;
    const controller=new RideController(this.terrain,{spawn,tuning:{...RIDE_TUNING,version:TAG_VERSION,maxSpeed:speed,hopSpeed:3.5,chargedHopSpeed:0,maxLean:.7,lowSpeedYaw:2.9,highSpeedYaw:1,driveAcceleration:8}});
    const actor:TagActor={id,name:name.replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,20)||'Rider',bot,dnf:false,connected:!bot,controller,previous:createPose(),role:'runner',epoch:0,lock:0,protectedUntil:0,ammo:3,regen:0,lastShot:-1e6,lastShotId:0,ack:0,input:neutralCommand(),itTime:0,tags:0,resets:0,burst:100,burstEnd:0,burstReady:0,controlled:0,outside:0,crashAge:0,decision:0,reaction:0,botHop:false,route:[],routeAge:0,progress:copy(spawn.position),stuck:0,explored:new Set<string>()};
    this.actors.push(actor);return actor;
  }
  start(round:string){if(this.actors.length<(this.ruleset==='spread'?4:2))throw Error('MORE_PLAYERS_NEEDED');this.phase='loading';this.round=round;this.roundNumber++;this.tick=0;this.time=0;this.remaining=this.duration;this.hearts=[];this.events=[];this.winners=[];
    this.actors=this.actors.filter(a=>!a.dnf);for(const [i,a]of this.actors.entries()){a.controller.reset(this.fixture.spawns[i%this.fixture.spawns.length]);Object.assign(a,{role:'runner',epoch:a.epoch+1,lock:0,protectedUntil:0,ammo:3,regen:0,lastShot:-1e6,lastShotId:0,ack:0,input:neutralCommand(round),itTime:0,tags:0,resets:0,burst:100,burstEnd:0,burstReady:0,controlled:0,outside:0,crashAge:0,decision:0,reaction:0,goal:undefined,seen:undefined,route:[],routeAge:0,progress:copy(a.controller.poseValue),stuck:0,explored:new Set<string>()});}
    this.actors[(this.roundNumber-1)%this.actors.length].role='it';this.phase='countdown';
  }
  command(id:string,c:TagCommand){const a=this.actors.find(a=>a.id===id&&!a.dnf);if(!a||a.bot||!validCommand(c,a,this.round,this.tick))return false;a.ack=c.seq;
    // Several valid render-frame commands can arrive before one server tick.
    // Keep one-shot actions until simulation consumes them; newest axes still win.
    a.input={...c,hop:a.input.hop||c.hop,burst:a.input.burst||c.burst,reset:a.input.reset||c.reset};return true;}
  release(id:string){const a=this.actors.find(a=>a.id===id);if(a)a.input=neutralCommand(this.round,a.ack,this.tick);}
  private emit(kind:TagEvent['kind'],actor:string,target?:string){this.events.push({id:this.round+':'+(++this.eventSeq),tick:this.tick,kind,actor,target});if(this.events.length>24)this.events.shift();}
  private center(p:RidePose){return {x:p.x,y:p.y+1.05,z:p.z};}
  private clear(a:Vec3,b:Vec3,r=0){const d=sub(b,a),length=Math.hypot(d.x,d.y,d.z);return length<.001||this.terrain.raycastObstacle(a,d,length,r)===null;}
  private tag(shooter:TagActor,target:TagActor,credit=true,forced=false){
    if(target.role!=='runner'||target.dnf||shooter.role!=='it'||(!forced&&(target.protectedUntil>this.time||shooter.lock>this.time)))return false;
    const epoch=shooter.epoch;
    if(this.ruleset==='classic'){shooter.role='runner';shooter.epoch++;shooter.protectedUntil=this.time+TAG_RULES.lock;}
    target.role='it';target.epoch++;target.lock=this.time+TAG_RULES.lock;
    this.hearts=this.hearts.filter(h=>h.shooter!==target.id&&(this.ruleset!=='classic'||h.shooter!==shooter.id||h.epoch!==epoch));
    if(credit)shooter.tags++;this.emit('tag',shooter.id,target.id);return true;
  }
  reset(a:TagActor){a.resets++;if(a.role==='runner'){const it=this.actors.find(b=>b.role==='it')!;this.tag(it,a,false,true);}
    a.controller.reset(this.fixture.spawns.reduce((best,s)=>Math.hypot(s.position.x-a.previous.x,s.position.z-a.previous.z)<Math.hypot(best.position.x-a.previous.x,best.position.z-a.previous.z)?s:best));a.outside=0;this.emit('reset',a.id);}
  private bot(a:TagActor,dt:number){
    const p=a.controller.poseValue;a.routeAge+=dt;
    if(this.tick%12===0){
      a.explored.add(cell(p));if(a.goal&&Math.hypot(a.goal.x-p.x,a.goal.z-p.z)<3)a.explored.add(cell(a.goal));
      const visible=this.actors.filter(b=>b.id!==a.id&&!b.dnf&&b.role!==a.role).map(b=>({actor:b,d:Math.hypot(b.controller.poseValue.x-p.x,b.controller.poseValue.z-p.z)})).filter(b=>b.d<45&&this.clear(this.center(p),this.center(b.actor.controller.poseValue))).sort((a,b)=>a.d-b.d)[0]?.actor;
      if(visible){if(a.seen?.id!==visible.id)a.reaction=this.time+({easy:.6,normal:.35,hard:.2,expert:.1}[this.difficulty]);a.seen={id:visible.id,position:copy(visible.controller.poseValue),until:this.time+2};}
      if(a.seen&&a.seen.until<this.time)a.seen=undefined;
      const travelled=Math.hypot(p.x-a.progress.x,p.z-a.progress.z);a.stuck=travelled<.025?a.stuck+.2:0;a.progress=copy(p);
      if(!a.goal||a.routeAge>1||Math.hypot(a.goal.x-p.x,a.goal.z-p.z)<3||a.stuck>2){
        const nodes=this.navigation.reachable(p),near=nodes.filter(q=>Math.hypot(q.x-p.x,q.z-p.z)>6&&Math.hypot(q.x-p.x,q.z-p.z)<60),candidates=near.length?near:nodes,fresh=candidates.filter(q=>!a.explored.has(cell(q))),pool=fresh.length?fresh:candidates,forward=pool.filter(q=>Math.abs(angle(Math.atan2(q.x-p.x,q.z-p.z)-p.headingY))<1.3),choices=forward.length?forward:pool;
        if(a.seen&&this.time>=a.reaction&&a.role==='it')a.goal=copy(a.seen.position);
        else if(a.seen&&this.time>=a.reaction&&a.role==='runner')a.goal=copy([...choices].sort((u,v)=>Math.hypot(v.x-a.seen!.position.x,v.z-a.seen!.position.z)-Math.hypot(u.x-a.seen!.position.x,u.z-a.seen!.position.z))[0]??p);
        else if(!a.goal||a.stuck>2||Math.hypot(a.goal.x-p.x,a.goal.z-p.z)<3)a.goal=copy([...choices].sort((u,v)=>Math.hypot(v.x-p.x,v.z-p.z)-Math.hypot(u.x-p.x,u.z-p.z)).slice(0,8)[Math.floor(this.random()*Math.min(8,choices.length))]??p);
        a.route=this.navigation.path(p,a.goal);a.routeAge=0;
      }
    }
    if(this.tick%3!==0)return;
    while(a.route.length>1&&Math.hypot(a.route[0].x-p.x,a.route[0].z-p.z)<.9)a.route.shift();
    let goal=a.route[0]??a.goal??this.fixture.spawns[0].position;
    // Only visible targets on the same lane permit the short final interception.
    if(a.role==='it'&&a.seen&&this.time>=a.reaction&&Math.hypot(a.seen.position.x-p.x,a.seen.position.z-p.z)<10&&this.navigation.clearPath(p,a.seen.position)&&this.terrain.legal?.(a.seen.position)!==false)goal=a.seen.position;
    const nearest=this.fixture.walkable?undefined:this.fixture.lanes.map(l=>({l,q:lanePoint(p,l)})).sort((u,v)=>Math.hypot(u.q.x-p.x,u.q.z-p.z)-Math.hypot(v.q.x-p.x,v.q.z-p.z))[0];
    if(!this.fixture.walkable&&nearest&&Math.hypot(nearest.q.x-p.x,nearest.q.z-p.z)>nearest.l.width*.28){const dx=nearest.l.b.x-nearest.l.a.x,dz=nearest.l.b.z-nearest.l.a.z,length=Math.hypot(dx,dz),sign=(goal.x-nearest.q.x)*dx+(goal.z-nearest.q.z)*dz>=0?1:-1,look=Math.min(2.5,Math.hypot(goal.x-nearest.q.x,goal.z-nearest.q.z));goal=lanePoint({x:nearest.q.x+dx/length*look*sign,y:nearest.q.y,z:nearest.q.z+dz/length*look*sign},nearest.l);}
    const error=angle(Math.atan2(goal.x-p.x,goal.z-p.z)-p.headingY),wall=this.terrain.raycastObstacle({x:p.x,y:p.y+.8,z:p.z},{x:Math.sin(p.headingY),y:0,z:Math.cos(p.headingY)},Math.max(1.4,Math.abs(p.speed)*.65),.3)!==null;
    // A sharp reversal needs a slow balance turn. Circling at even 0.5 m/s
    // can carry a rider outside a narrow lane before its heading catches up.
    let targetSpeed=Math.abs(error)>1.1?.25:Math.abs(error)>.55?1.4:Math.abs(error)>.25?2.8:5.5;
    let routeDistance=Math.hypot(goal.x-p.x,goal.z-p.z);for(let i=1;i<a.route.length&&routeDistance<20;i++){const u=a.route[i-1],v=a.route[i],before=i>1?a.route[i-2]:p,turn=Math.abs(angle(Math.atan2(v.x-u.x,v.z-u.z)-Math.atan2(u.x-before.x,u.z-before.z)));if(turn>.12){const corner=Math.sqrt(1.4/Math.max(.02,turn/Math.max(1,Math.hypot(v.x-u.x,v.z-u.z))));targetSpeed=Math.min(targetSpeed,Math.sqrt(corner*corner+5*Math.max(0,routeDistance-2.5)));}routeDistance+=Math.hypot(v.x-u.x,v.z-u.z);}
    // Check the braking corridor, including current sideways momentum. Keep the
    // full controller physics; do not clamp positions back onto a lane.
    const horizon=Math.max(.45,Math.abs(p.speed)/3),samples=Math.max(2,Math.ceil(Math.abs(p.speed)*horizon/.3));
    let laneAhead=true;
    for(let i=1;i<=samples;i++){const t=horizon*i/samples,q={x:p.x+p.velocityX*t,y:p.y,z:p.z+p.velocityZ*t};
      if(this.terrain.legal?.(q)===false){laneAhead=false;break;}}
    if(!laneAhead)targetSpeed=0;
    const ground=this.terrain.sampleGround(p.x,p.z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});
    const hill=9.81*(ground.normal.x*Math.sin(p.headingY)+ground.normal.z*Math.cos(p.headingY));
    const throttle=clamp((targetSpeed-p.speed)*.65+.1-hill/8,-.7,1);
    const desired=a.seen?clamp(angle(Math.atan2(a.seen.position.x-p.x,a.seen.position.z-p.z)-p.headingY),-1.35,1.35):0,rate={easy:1.1,normal:1.8,hard:2.5,expert:3.3}[this.difficulty],aim=a.input.aimYaw+clamp(desired-a.input.aimYaw,-rate*.05,rate*.05),pitch=a.seen?clamp(Math.atan2(a.seen.position.y-p.y,Math.hypot(a.seen.position.x-p.x,a.seen.position.z-p.z)), -.75,.75):0;
    a.input={...neutralCommand(this.round,a.ack+1,this.tick),throttle:wall?(a.stuck>1?-.45:0):throttle,steer:clamp(-error*1.8*(wall&&a.stuck>1?-1:1),-.72,.72),aimYaw:aim,aimPitch:pitch,fire:!!a.seen&&a.role==='it'&&this.time>=a.reaction&&Math.abs(desired-aim)<.12&&this.clear(this.center(p),{...a.seen.position,y:a.seen.position.y+1.05}),shot:a.lastShotId+1,burst:a.role==='runner'&&!!a.seen&&Math.abs(error)<.15&&!wall&&laneAhead&&targetSpeed>4};a.ack++;
  }
  private fire(a:TagActor){
    const c=a.input;if(!c.fire||a.role!=='it'||a.lock>this.time||a.ammo<1||this.time-a.lastShot<TAG_RULES.shotInterval||c.shot<=a.lastShotId||a.controller.crashed)return;
    a.lastShotId=c.shot;a.lastShot=this.time;a.ammo--;const p=a.controller.poseValue,yaw=p.headingY+c.aimYaw,cp=Math.cos(c.aimPitch),direction={x:Math.sin(yaw)*cp,y:Math.sin(c.aimPitch),z:Math.cos(yaw)*cp},origin=this.center(p),muzzle=add(origin,scale(direction,.7));
    if(!this.clear(origin,muzzle,TAG_RULES.radius)){this.emit('blocked',a.id);return;}
    this.hearts.push({id:this.round+':'+a.id+':'+c.shot,shooter:a.id,round:this.round,epoch:a.epoch,tick:this.tick,from:copy(muzzle),position:muzzle,velocity:scale(direction,TAG_RULES.speed),age:0});this.emit('shot',a.id);
  }
  step(dt=1/60){
    if(this.phase==='lobby'||this.phase==='results'||this.phase==='disposing')return;
    this.tick++;this.time+=dt;
    if(this.time<TAG_RULES.countdown)this.phase='countdown';else if(this.time<TAG_RULES.countdown+TAG_RULES.headStart)this.phase='head_start';else this.phase='active';
    const active=this.phase==='active';
    for(const a of this.actors){a.previous={...a.controller.poseValue};if(a.bot||!a.connected)this.bot(a,dt);
      const canMove=active||this.phase==='head_start'&&a.role==='runner';
      if(!canMove)continue;const c=a.input;
      if(c.burst&&a.burst>=35&&a.burstReady<=this.time&&a.controller.snapshot().grounded&&!a.controller.crashed){a.burst-=35;a.burstEnd=this.time+.6;a.burstReady=this.time+3;a.controlled=0;c.burst=false;}
      const base=this.fixture.product==='swoop-detroit'?10:8;a.controller.setHandling({maxSpeed:a.burstEnd>this.time?(base===10?13:10.5):base});
      if(c.reset){if(active)this.reset(a);c.reset=false;}
      a.controller.step(dt,{...NEUTRAL_ACTIONS,throttle:c.throttle,steer:c.steer,hop:c.hop,hopHeld:c.hop});c.hop=false;
      if(a.controller.crashed){a.crashAge+=dt;if(a.crashAge>1.6)a.controller.step(dt,{...NEUTRAL_ACTIONS,reset:true});}else a.crashAge=0;
      a.controlled=a.controller.snapshot().grounded&&!a.controller.crashed&&a.controller.lastLandingImpact<5&&a.burstEnd<=this.time?a.controlled+dt:0;if(a.controlled>=1.25)a.burst=Math.min(100,a.burst+10*dt);
      a.outside=this.terrain.legal?.(a.controller.poseValue)===false?a.outside+dt:0;if(a.outside>=3&&active)this.reset(a);
      if(active){if(a.role==='it')a.itTime+=dt;a.regen+=dt;while(a.regen>=2){a.regen-=2;a.ammo=Math.min(3,a.ammo+1);}this.fire(a);}
    }
    if(active){
      const candidates:{toi:number;id:string;shooter:TagActor;target:TagActor;heart?:Heart}[]=[];
      for(const h of [...this.hearts]){const shooter=this.actors.find(a=>a.id===h.shooter)!;
        if(h.epoch!==shooter.epoch||shooter.role!=='it'){this.hearts=this.hearts.filter(p=>p!==h);continue;}
        const from=copy(h.position),delta=scale(h.velocity,dt),to=add(from,delta),wall=this.terrain.sweep?.(from,delta,.14)??((()=>{const length=Math.hypot(delta.x,delta.y,delta.z),hit=this.terrain.raycast(from,delta,length);return hit===null?null:hit/length;})());
        for(const target of this.actors.filter(a=>a.id!==shooter.id&&a.role==='runner'&&!a.dnf)){
          const toi=sphereTOI(from,to,this.center(target.previous),this.center(target.controller.poseValue),.5+.14);
          if(toi!==null&&(wall===null||toi<wall-1e-7))candidates.push({toi,id:h.id,shooter,target,heart:h});
        }
        h.position=to;h.age+=dt;if(wall!==null||h.age>=1-1e-9||h.age*24>=24)this.hearts=this.hearts.filter(p=>p!==h);
      }
      for(const shooter of this.actors.filter(a=>a.role==='it'&&!a.dnf))for(const target of this.actors.filter(a=>a.role==='runner'&&!a.dnf)){
        const toi=sphereTOI(this.center(shooter.previous),this.center(shooter.controller.poseValue),this.center(target.previous),this.center(target.controller.poseValue),1);
        if(toi!==null){const a=add(this.center(shooter.previous),scale(sub(this.center(shooter.controller.poseValue),this.center(shooter.previous)),toi)),b=add(this.center(target.previous),scale(sub(this.center(target.controller.poseValue),this.center(target.previous)),toi));if(this.clear(a,b,.1))candidates.push({toi,id:'contact:'+shooter.id+':'+target.id,shooter,target});}
      }
      const consumed=new Set<string>();for(const c of candidates.sort((a,b)=>a.toi-b.toi||a.id.localeCompare(b.id)||a.target.id.localeCompare(b.target.id))){if(c.heart&&(consumed.has(c.id)||c.heart.epoch!==c.shooter.epoch))continue;if(this.tag(c.shooter,c.target)){if(c.heart){consumed.add(c.id);this.hearts=this.hearts.filter(h=>h.id!==c.id);}}}
      this.remaining=Math.max(0,this.duration-(this.time-6));if(this.remaining<=1e-9||this.ruleset==='spread'&&this.actors.every(a=>a.role==='it'||a.dnf))this.finish();
    }
  }
  finish(){const eligible=this.actors.filter(a=>!a.dnf);if(this.ruleset==='classic'){const lowest=Math.min(...eligible.map(a=>a.itTime+3*a.resets));this.winners=eligible.filter(a=>Math.abs(a.itTime+3*a.resets-lowest)<1e-6).map(a=>a.id);}else {const runners=eligible.filter(a=>a.role==='runner');this.winners=(runners.length?runners:eligible.filter(a=>a.role==='it')).map(a=>a.id);}this.phase='results';this.hearts=[];this.emit('result','server');}
  leave(id:string){const a=this.actors.find(a=>a.id===id);if(!a)return;a.dnf=true;a.connected=false;this.release(id);if(this.ruleset==='spread'&&a.role==='runner'){a.role='it';a.epoch++;a.lock=this.time+2;}if(this.phase==='lobby')this.actors=this.actors.filter(b=>b!==a);}
  snapshot(owner?:string):TagSnapshot{return {version:TAG_VERSION,hash:this.fixture.hash,product:this.fixture.product,arena:this.fixture.arena,round:this.round,tick:this.tick,phase:this.phase,time:this.time,remaining:this.remaining,ruleset:this.ruleset,
    actors:this.actors.map(a=>({id:a.id,name:a.name,bot:a.bot,connected:a.connected,dnf:a.dnf,role:a.role,epoch:a.epoch,ammo:a.ammo,burst:a.burst,lock:Math.max(0,a.lock-this.time),itTime:a.itTime,tags:a.tags,resets:a.resets,ack:a.ack,pose:{...a.controller.poseValue}})),
    hearts:this.hearts.map(h=>({...h,from:copy(h.from),position:copy(h.position),velocity:copy(h.velocity)})),events:[...this.events],winners:[...this.winners],owner:owner?{id:owner,state:this.actors.find(a=>a.id===owner)!.controller.captureState()}:undefined};}
}
