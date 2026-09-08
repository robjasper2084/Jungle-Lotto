// Shared primitives extracted from Static Wars. Classic-script compatible so the
// original campaign retains its boot order; ES-module games use core.js.
(() => {
 const MOVEMENT=Object.freeze({maxGroundSpeed:430,crouchSpeed:145,groundAccel:4100,groundDecel:3600,airAccel:3100,airTurnAccel:3900,airDecel:760,jumpVelocity:-955,jumpCut:.5,coyoteTime:.2,jumpBuffer:.24,dashCooldown:.62,dashDuration:.17,dashSpeed:980,dashEndMomentum:.58,wallSlideSpeed:245,wallStickTime:.12,wallJumpX:620,wallJumpY:-910,landingSquashTime:.18,invulnAfterHit:1.05,contactCooldown:.95});
 const PLAYER_ROWS=Object.freeze({run:0,runBack:1,jump:2,crouch:3,shoot:4,idle:5});
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function launchJump(p,velocity){p.vy=velocity;p.grounded=false;p.coyote=0;p.jumpBuffer=0;}
 function beginDash(p,config=MOVEMENT){p.dashCd=config.dashCooldown;p.dashTime=config.dashDuration;p.invuln=Math.max(p.invuln||0,.22);}
 function beginOverdrive(p,duration=4.2){p.overdrive=0;p.overdriveTime=duration;p.invuln=Math.max(p.invuln||0,.6);}
 function angledShot(shot,radians){const cos=Math.cos(radians),sin=Math.sin(radians);return {...shot,vx:shot.vx*cos-shot.vy*sin,vy:shot.vx*sin+shot.vy*cos,hitIds:new Set()};}
 function weaponSpec(weapon,strong=false){return {speed:weapon==='beam'?1120:strong?1040:900,damage:weapon==='beam'||strong?2:1,life:weapon==='beam'?.95:1.15,pierce:strong||weapon==='beam',cooldown:weapon==='rapid'?.075:weapon==='beam'||strong?.09:.15,offsets:weapon==='spread'?[-.18,0,.18]:weapon==='double'?[-.045,.045]:[0]};}
 function takeDamage(p,amount,invulnerability=1.05){if(p.invuln>0)return false;p.hp=Math.max(0,p.hp-amount);p.invuln=invulnerability;return true;}
 class Pool{
  constructor(limit=160){this.limit=limit;this.items=[];this.free=[];}
  add(data){if(this.items.length>=this.limit)return null;const item=this.free.pop()||{};for(const k of Object.keys(item))delete item[k];Object.assign(item,data);this.items.push(item);return item;}
  prune(keep){let write=0;for(const item of this.items){if(keep(item))this.items[write++]=item;else if(this.free.length<this.limit)this.free.push(item);}this.items.length=write;}
  clear(){this.prune(()=>false);}
 }
 class Events{constructor(){this.listeners=new Map();}on(type,fn){const list=this.listeners.get(type)||new Set();list.add(fn);this.listeners.set(type,list);return()=>list.delete(fn);}emit(type,data){for(const fn of this.listeners.get(type)||[])fn(data);for(const fn of this.listeners.get('*')||[])fn({type,...data});}clear(){this.listeners.clear();}}
 class FixedStep{constructor(step=1/60){this.step=step;this.accumulator=0;this.pending={};}reset(){this.accumulator=0;this.pending={};}advance(delta,actions,update){for(const [k,v]of Object.entries(actions))if(k.endsWith('Pressed')||k.endsWith('Released'))this.pending[k]||=v;this.accumulator+=Math.min(delta,.1);while(this.accumulator>=this.step){const next={...actions,...this.pending};update(next,this.step);for(const k of Object.keys(this.pending))this.pending[k]=false;this.accumulator-=this.step;}}}
 function tone(ctx,freq,duration,type,peak,destination=ctx.destination){const now=ctx.currentTime;
    const harmonicPeak = peak * (type === "sine" ? 0.22 : 0.3);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    osc.frequency.setValueAtTime(freq, now);
    osc.type = type;
    harmonic.frequency.setValueAtTime(Math.max(40, freq * (type === "sawtooth" ? 0.5 : 2)), now);
    harmonic.type = type === "square" ? "triangle" : "sine";
    harmonic.detune.setValueAtTime(type === "sawtooth" ? -7 : 9, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    harmonicGain.gain.setValueAtTime(0.0001, now);
    harmonicGain.gain.exponentialRampToValueAtTime(harmonicPeak, now + 0.008);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.86);
    osc.connect(gain);
    harmonic.connect(harmonicGain);
    gain.connect(destination);
    harmonicGain.connect(destination);
    osc.start(now);
    harmonic.start(now);
    osc.stop(now + duration + 0.02);
    harmonic.stop(now + duration + 0.02);
 }
 globalThis.RahbeCore={tone,MOVEMENT,PLAYER_ROWS,clamp,launchJump,beginDash,beginOverdrive,angledShot,weaponSpec,takeDamage,Pool,Events,FixedStep};
})();
