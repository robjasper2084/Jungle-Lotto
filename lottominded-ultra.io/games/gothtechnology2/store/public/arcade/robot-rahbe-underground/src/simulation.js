import {launchJump} from '../../robot-rahbe-arcade/shared/core.js';
import {WIDTH,HEIGHT,STRIDE,DEPTHS,makeWorld,floorY,checkpoint} from './world.js';
export const STEP=1/60;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const body=p=>({x:p.x-17,y:p.y-59,w:34,h:59});
export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export function ropeEnd(r,time){const angle=Math.sin(time*1.65+r.phase)*.78;return {x:r.x+Math.sin(angle)*r.length,y:r.y+Math.cos(angle)*r.length,angle};}
export function createSimulation(saved=null){
  const s={world:makeWorld(),time:0,mode:'title',depth:0,reached:0,coins:0,secrets:0,kills:0,deaths:0,events:[],shots:[],sparks:[],train:{x:-1700,y:floorY(1),active:false,warning:false},gateHint:0,context:'',saveRevision:0};
  s.player={...checkpoint(0),vx:0,vy:0,hp:6,maxHp:6,facing:1,grounded:true,coyote:.1,jumpBuffer:0,invuln:0,cooldown:0,rope:-1,cart:-1,climbing:false,action:'idle'};
  if(saved&&saved.version===1){
    s.reached=clamp(Number(saved.reached)||0,0,6);s.depth=s.reached;
    Object.assign(s.player,checkpoint(s.depth));
    s.coins=clamp(Number(saved.coins)||0,0,999999);s.secrets=clamp(Number(saved.secrets)||0,0,2);
    const seals=Array.isArray(saved.seals)?saved.seals:[];s.world.seals.forEach(x=>x.taken=seals.includes(x.number));
    const taken=new Set(Array.isArray(saved.taken)?saved.taken:[]);s.world.coins.forEach(x=>x.taken=taken.has(x.id));
    const treasure=new Set(Array.isArray(saved.treasures)?saved.treasures:[]);s.world.treasures.forEach((x,i)=>x.taken=treasure.has(i));
    if(saved.wallOpen)s.world.walls[0].hp=0;
  }
  return s;
}
export function serialize(s){return {version:1,reached:s.reached,coins:s.coins,secrets:s.secrets,seals:s.world.seals.filter(x=>x.taken).map(x=>x.number),taken:s.world.coins.filter(x=>x.taken).map(x=>x.id),treasures:s.world.treasures.flatMap((x,i)=>x.taken?[i]:[]),wallOpen:s.world.walls[0].hp<=0};}
export function emit(s,type,text,x=s.player.x,y=s.player.y){s.events.push({type,text,x,y});}
function burst(s,x,y,color,count=10){for(let i=0;i<count;i++)s.sparks.push({x,y,vx:Math.cos(i*2.4)*80+(i%3)*25,vy:Math.sin(i*2.4)*110-65,life:.4+(i%5)*.06,color});}
export function hurt(s,amount=1,sourceX=s.player.x-1){
  const p=s.player;if(p.invuln>0||s.mode!=='playing')return false;
  p.hp=Math.max(0,p.hp-amount);p.invuln=1.6;p.hurtUntil=s.time+.32;p.vx=(p.x<sourceX?-1:1)*210;p.vy=-230;p.rope=-1;p.cart=-1;
  burst(s,p.x,p.y-30,'#ef7758');emit(s,'hurt','Integrity damaged');
  if(p.hp===0){s.mode='dead';s.deaths++;emit(s,'dead','Signal lost. Your checkpoint is safe.');}
  return true;
}
export function respawn(s){Object.assign(s.player,checkpoint(s.reached),{vx:0,vy:0,hp:6,invuln:2,rope:-1,cart:-1,climbing:false,grounded:true});s.depth=s.reached;s.mode='playing';s.shots=[];s.world.boss.active=false;emit(s,'checkpoint','Signal restored at '+DEPTHS[s.reached].name);}
function fallReset(s){if(hurt(s,1)){if(s.mode==='playing'){const hp=s.player.hp;Object.assign(s.player,checkpoint(s.reached),{vx:0,vy:0,rope:-1,cart:-1,grounded:true,climbing:false,hp});emit(s,'checkpoint','Recalled to the last access beacon.');}}else if(s.mode==='playing'){Object.assign(s.player,checkpoint(s.reached),{vx:0,vy:0,rope:-1,cart:-1});}}
export function update(s,a={},dt=STEP){
  if(s.mode!=='playing')return;
  s.time+=dt;const p=s.player,w=s.world;const move=(a.right?1:0)-(a.left?1:0);const vertical=(a.down?1:0)-(a.up?1:0);
  p.invuln=Math.max(0,p.invuln-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);s.gateHint=Math.max(0,s.gateHint-dt);
  if(a.jumpPressed)p.jumpBuffer=.13;
  s.context='';p.aim=a.up?-1:a.down&&!p.grounded?1:0;
  for(const plat of w.platforms){
    plat.dx=0;plat.dy=0;
    if(plat.kind==='moving'||plat.kind==='elevator'){
      const oldX=plat.x,oldY=plat.y;const d=Math.sin(s.time*plat.speed)*plat.range;
      plat.x=plat.baseX+(plat.axis==='x'?d:0);plat.y=plat.baseY+(plat.axis==='y'?d:0);plat.dx=plat.x-oldX;plat.dy=plat.y-oldY;
      if(p.grounded&&p.standing===plat.id){p.x+=plat.dx;p.y+=plat.dy;}
    }
    if(plat.kind==='crumble'&&plat.timer>=0){plat.timer+=dt;if(plat.timer>.6){plat.fallen+=dt;if(plat.fallen>5){plat.timer=-1;plat.fallen=0;}}}
  }
  for(const c of w.carts){c.x+=c.vx*dt;if(c.x<c.min||c.x>c.max){c.x=clamp(c.x,c.min,c.max);c.vx*=-1;}}
  for(const r of w.rolling){r.x+=r.speed*dt;if(r.x<r.min)r.x=r.max;}
  const cycle=s.time%13;
  s.train.warning=cycle>7.5&&cycle<9.5;s.train.active=cycle>=9.5;
  s.train.x=-1250+(cycle-9.5)*1350;
  if(s.depth===1&&s.train.warning)s.context='TRAIN APPROACHING · Climb onto a ledge';
  const nearbyLadder=w.ladders.find(l=>Math.abs(p.x-l.x)<33&&p.y>=l.y1-12&&p.y<=l.y2+12);
  const nearRope=w.ropes.findIndex(r=>distance({x:p.x,y:p.y-45},ropeEnd(r,s.time))<100);
  const nearCart=w.carts.findIndex(c=>Math.abs(p.x-c.x)<115&&Math.abs(p.y-c.y)<90);
  if(nearRope>=0&&p.rope<0)s.context='E · GRAB ROPE   /   SPACE · RELEASE';
  else if(nearCart>=0&&p.cart<0)s.context='E · BOARD MINE CART';
  else if(nearbyLadder)s.context='W / S · CLIMB';
  if(a.interactPressed){
    if(p.cart>=0){p.cart=-1;p.vy=-430;p.grounded=false;}
    else if(p.rope>=0){p.rope=-1;p.vy=-300;p.vx=move*420;}
    else if(nearCart>=0){p.cart=nearCart;p.cartBoardUntil=s.time+.35;p.rope=-1;emit(s,'cart','Mine cart engaged. SPACE to jump free.');}
    else if(nearRope>=0){p.rope=nearRope;p.ropeGrabUntil=s.time+.32;p.cart=-1;p.climbing=false;emit(s,'rope','Hold on. Jump at the end of the swing.');}
    else if(Math.abs(p.x-w.gate.x)<160&&s.depth===6){
      if(w.seals.every(x=>x.taken)){w.gate.open=true;s.saveRevision++;emit(s,'gate','03 · 13 · 31 — THE ORIGINAL DRAW IS OPEN');}
      else{emit(s,'notice','Missing seals: '+w.seals.filter(x=>!x.taken).map(x=>x.number).join(' · ')+'. Use the ladders to return.');}
    }
  }
  const oldY=p.y;
  if(p.rope>=0){
    const r=w.ropes[p.rope],end=ropeEnd(r,s.time),future=ropeEnd(r,s.time+dt);p.x=end.x;p.y=end.y+50;p.swingAngle=end.angle;p.vx=(future.x-end.x)/dt;p.vy=(future.y-end.y)/dt;p.grounded=false;p.action='swing';s.context='SPACE · LEAP FROM ROPE';
    if(a.jumpPressed){p.rope=-1;p.ropeReleaseUntil=s.time+.35;p.vx+=move*180;p.vy=-520;p.jumpBuffer=0;emit(s,'jump','');}
  }else if(p.cart>=0){
    const c=w.carts[p.cart];p.x=c.x;p.y=c.y-30;p.vx=c.vx;p.vy=0;p.grounded=false;p.action='crouch';s.context='SPACE · JUMP FREE   /   E · LEAVE CART';
    if(a.jumpPressed){p.cart=-1;p.vy=-650;p.jumpBuffer=0;emit(s,'jump','');}
  }else{
    p.climbing=!!(nearbyLadder&&(vertical!==0||(p.climbing&&!move&&!a.jumpPressed)));
    if(p.climbing){p.x=nearbyLadder.x;p.vx=0;p.vy=vertical*205;p.y=clamp(p.y+p.vy*dt,nearbyLadder.y1+35,nearbyLadder.y2);p.grounded=false;p.action='climb';if(a.jumpPressed){p.climbing=false;p.vy=-580;p.vx=move*280;p.jumpBuffer=0;}}
    else{
      const target=move*310,accel=p.grounded?2600:1200;
      p.vx+=clamp(target-p.vx,-accel*dt,accel*dt);
      if(move)p.facing=move;
      p.coyote=p.grounded?.11:Math.max(0,p.coyote-dt);
      if(p.jumpBuffer>0&&p.coyote>0){launchJump(p,-685);emit(s,'jump','');}
      if(a.jumpReleased&&p.vy<-270)p.vy=-270;
      p.vy=Math.min(p.vy+1500*dt,900);
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.grounded=false;p.standing=null;
      for(const plat of w.platforms){
        if(plat.fallen>0)continue;
        if(p.vy>=0&&p.x+15>plat.x&&p.x-15<plat.x+plat.w&&oldY<=plat.y+Math.max(3,plat.dy||0)&&p.y>=plat.y){
          if(p.vy>230)p.landingUntil=s.time+.3;p.y=plat.y;p.vy=0;p.grounded=true;p.standing=plat.id;
          if(plat.kind==='crumble'&&plat.timer<0){plat.timer=0;emit(s,'crumble','Keep moving — the floor is giving way.');}
        }
      }
      p.action=!p.grounded?'jump':a.down?'crouch':Math.abs(p.vx)>30?'run':'idle';
    }
  }
  p.x=clamp(p.x,23,WIDTH-23);
  const solids=[...w.walls.filter(x=>x.hp>0),...(!w.gate.open?[w.gate]:[])];
  for(const block of solids){if(overlaps(body(p),block)){p.x=p.x<block.x+block.w/2?block.x-18:block.x+block.w+18;p.vx=0;}}
  // Keep ownership of the current floor through a jump from its upper ledges.
  // Access shafts change depth only after crossing into the adjacent floor.
  let newDepth=s.depth;
  while(newDepth<6&&p.y>floorY(newDepth)+STRIDE*.55)newDepth++;
  while(newDepth>0&&p.y<floorY(newDepth-1)+100)newDepth--;
  if(newDepth!==s.depth){s.depth=newDepth;emit(s,'depth',DEPTHS[s.depth].name);}
  if(s.depth>s.reached&&p.y>=floorY(s.depth)-20){s.reached=s.depth;p.hp=Math.min(p.maxHp,p.hp+2);s.saveRevision++;emit(s,'checkpoint','ACCESS BEACON '+String(s.depth).padStart(2,'0')+' · CHECKPOINT SAVED');}
  const nearShaft=w.ladders.some(l=>!l.short&&Math.abs(p.x-l.x)<70&&p.y>=l.y1&&p.y<=l.y2+50);
  if((p.y>floorY(s.depth)+125&&!nearShaft)||p.y>HEIGHT+100)fallReset(s);
  if(a.shoot&&p.cooldown===0&&p.rope<0){
    p.cooldown=.19;p.action='shoot';const dir=a.up?-1:a.down&&!p.grounded?1:0;
    s.shots.push({x:p.x+(dir?0:p.facing*32),y:p.y-32,vx:dir?0:p.facing*900,vy:dir*900,life:1.2,enemy:false});emit(s,'shoot','');
  }
  for(const coin of w.coins){if(!coin.taken&&distance({x:p.x,y:p.y-27},coin)<42){coin.taken=true;s.coins+=10;burst(s,coin.x,coin.y,'#edbd6d',5);emit(s,'coin','');}}
  for(const seal of w.seals){if(!seal.taken&&distance({x:p.x,y:p.y-27},seal)<55){seal.taken=true;s.coins+=250;s.saveRevision++;burst(s,seal.x,seal.y,'#82ded5',24);emit(s,'seal','NUMBER SEAL '+seal.number+' RECOVERED');}}
  for(const chest of w.treasures){if(!chest.taken&&distance({x:p.x,y:p.y-27},chest)<56&&(!chest.wall||w.walls.find(x=>x.id===chest.wall)?.hp<=0)){chest.taken=true;s.coins+=500;s.secrets++;p.hp=Math.min(6,p.hp+2);s.saveRevision++;emit(s,'treasure','TREASURE ROOM · +500 RELICS · INTEGRITY RESTORED');burst(s,chest.x,chest.y,'#edbd6d',30);}}
  for(const h of w.hazards){if(overlaps(body(p),h)&&p.cart<0){fallReset(s);break;}}
  for(const r of w.rolling){if(distance({x:p.x,y:p.y-24},r)<r.r+20)hurt(s,1,r.x);}
  if(s.train.active&&s.depth===1&&overlaps(body(p),{x:s.train.x,y:floorY(1)-105,w:1150,h:105})){hurt(s,2,s.train.x+600);}
  for(const e of w.enemies){
    if(e.hp<=0||Math.abs(e.depth-s.depth)>1)continue;
    e.resting=(s.time+e.id*.17)%7<.8;
    e.running=e.type==='guard'&&!e.resting&&Math.abs(p.x-e.x)<330&&Math.abs(p.y-e.y)<100;
    if(!e.resting&&!(e.attackUntil>s.time))e.x+=e.vx*dt*(e.running?1.65:1);
    if(e.x<e.min||e.x>e.max){e.vx*=-1;e.x=clamp(e.x,e.min,e.max);}
    e.facing=e.attackUntil>s.time?Math.sign(p.x-e.x)||-1:Math.sign(e.vx);
    if(e.type==='drone')e.y=e.baseY+Math.sin(s.time*2+e.id)*24;
    e.shot-=dt;
    if(e.shot<=0&&Math.abs(p.x-e.x)<680&&Math.abs(p.y-e.y)<240){
      e.shot=e.type==='drone'?3.1:2.3;e.attackUntil=s.time+.4;const sx=e.x,sy=e.y-(e.type==='drone'?0:33);const angle=Math.atan2(p.y-30-sy,p.x-sx);
      s.shots.push({x:sx,y:sy,vx:Math.cos(angle)*210,vy:Math.sin(angle)*210,enemy:true,life:4});
    }
    if(distance({x:p.x,y:p.y-28},{x:e.x,y:e.y-(e.type==='guard'?30:0)})<37)hurt(s,1,e.x);
  }
  const b=w.boss;b.flash=Math.max(0,b.flash-dt);
  if(s.depth===6&&w.gate.open&&p.x>1320&&b.hp>0){
    if(!b.active){b.active=true;emit(s,'boss','THE NUMBER WARDEN · Shoot the heart. Jump the shockwave.');}
    b.phase+=dt;b.x=2120+Math.sin(b.phase*.6)*190;b.facing=Math.sign(p.x-b.x)||-1;b.shot-=dt;b.pulse-=dt;
    if(b.shot<=0){b.attackUntil=s.time+.4;b.shot=b.hp<30?.95:1.45;const angle=Math.atan2(p.y-30-(b.y-80),p.x-b.x);for(let j=-1;j<=1;j++)s.shots.push({x:b.x,y:b.y-80,vx:Math.cos(angle+j*.17)*240,vy:Math.sin(angle+j*.17)*240,enemy:true,life:5});}
    if(b.pulse<=0){b.attackUntil=s.time+.48;b.pulse=b.hp<30?2.8:4.2;s.shots.push({x:b.x-30,y:b.y-14,vx:-330,vy:0,enemy:true,life:7,wave:true});emit(s,'wave','SHOCKWAVE · JUMP');}
    if(distance({x:p.x,y:p.y-30},{x:b.x,y:b.y-65})<100)hurt(s,2,b.x);
  }
  for(const shot of s.shots){
    shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;
    if(shot.enemy){if(overlaps({x:shot.x-(shot.wave?17:6),y:shot.y-(shot.wave?10:6),w:shot.wave?34:12,h:shot.wave?20:12},body(p))){hurt(s,1,shot.x);shot.life=0;}}
    else{
      for(const e of w.enemies){if(e.hp>0&&Math.abs(shot.x-e.x)<32&&Math.abs(shot.y-(e.y-(e.type==='guard'?30:0)))<40){e.hp--;e.hurtUntil=s.time+.28;shot.life=0;burst(s,shot.x,shot.y,'#82ded5',7);if(e.hp<=0){e.deadAt=s.time;s.kills++;s.coins+=50;emit(s,'enemy','');}break;}}
      for(const wall of w.walls){if(wall.hp>0&&overlaps({x:shot.x-5,y:shot.y-5,w:10,h:10},wall)){wall.hp--;shot.life=0;burst(s,shot.x,shot.y,'#b2aa86');if(wall.hp===0){s.saveRevision++;emit(s,'secret','SECRET PASSAGE OPENED · Treasure lies beyond.');}}}
      if(!w.gate.open&&overlaps({x:shot.x,y:shot.y,w:6,h:6},w.gate))shot.life=0;
      if(b.active&&b.hp>0&&shot.life>0&&Math.abs(shot.x-b.x)<76&&Math.abs(shot.y-(b.y-78))<85){b.hp--;b.hurtUntil=s.time+.26;b.flash=.1;shot.life=0;burst(s,shot.x,shot.y,'#edbd6d');if(b.hp===0){b.deadAt=s.time;s.coins+=2000;emit(s,'boss-down','THE WARDEN HAS FALLEN · Enter the lift to the surface →');burst(s,b.x,b.y-90,'#edbd6d',70);}}
    }
  }
  s.shots=s.shots.filter(x=>x.life>0&&x.x>-100&&x.x<WIDTH+100);
  for(const sp of s.sparks){sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.vy+=240*dt;sp.life-=dt;}s.sparks=s.sparks.filter(x=>x.life>0);
  if(s.depth===6&&Math.abs(p.x-w.gate.x)<150&&!w.gate.open)s.context=w.seals.every(x=>x.taken)?'E · INSERT 03 / 13 / 31':'E · CHECK THE THREE-SEAL GATE';
  if(s.depth===6&&b.hp<=0&&p.x>2570){s.mode='won';s.saveRevision++;emit(s,'won','You brought the light back.');}
}
