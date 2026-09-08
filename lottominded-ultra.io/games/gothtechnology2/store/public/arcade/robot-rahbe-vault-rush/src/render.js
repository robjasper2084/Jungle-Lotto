import {drawScenery} from './scenery.js';
import {SPRITES,drawHero,drawEnemy} from '../../robot-rahbe-arcade/shared/sprites.js';
import {POWERUPS} from './config.js';
const root='../robot-rahbe-underground/assets/';
export const MANIFEST={...Object.fromEntries(['hero','hero-defeat','hero-hurt','hero-landing','hero-victory','enemy-drone','enemy-guard','enemy-warden'].map(k=>[k,SPRITES[k]])),riverwalk:'./assets/environment/detroit-riverwalk.webp',cullen:'./assets/environment/riverwalk-cullen-plaza.webp',milliken:'./assets/environment/riverwalk-milliken-harbor.webp',dequindre:'./assets/environment/dequindre-cut.webp',campbell:'./assets/environment/dequindre-campbell-terrace.webp',freight:'./assets/environment/dequindre-freight-yard.webp',...Object.fromEntries(['platform','wall','elevator','coin','spikes','gate'].map(k=>[k,root+'environment/detroit/'+k+'.png']))};
export class Renderer{
 constructor(images){this.images=images;this.settings={};}
 label(c,text,x,y,size=11,color='#c3e5cc',align='left'){c.save();c.font=`bold ${size}px 'Courier New',monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);c.restore();}
 glow(c,x,y,r,color='173,221,202'){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${color},.23)`);g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 draw(c,s,width,height){
  const vw=Math.max(700,Math.min(1150,width/(height/570))),scale=width/vw,vh=height/scale,ground=vh*.72,hero=vw<750?150:vw*.28,reduced=this.settings.reducedMotion||this.settings.quality==='low',cue=Math.max(12,10/scale),p=s.player;
  c.save();c.scale(scale,scale);c.fillStyle='#061517';c.fillRect(0,0,vw,vh);
  drawScenery(c,this.images,s,vw,vh,ground,reduced);
  for(const o of s.obstacles){const x=hero+o.x-s.distance;if(x>vw+180||x+o.w<-120||o.destroyed)continue;c.save();
   if(o.hit)c.globalAlpha=.5;
   c.fillStyle='#0006';c.beginPath();c.ellipse(x+o.w/2+12,ground+7,o.w*.7,10,0,0,7);c.fill();
   if(['gap','crumble'].includes(o.type)){
    const open=o.type==='gap'||o.crumbleAt&&o.crumbleAt<s.time;c.fillStyle=open?'#02080c':'#655749';c.fillRect(x,ground-22,o.w,vh-ground+22);if(!open){c.drawImage(this.images.platform,x,ground,o.w,55);c.strokeStyle='#d9a977';c.beginPath();c.moveTo(x+10,ground);c.lineTo(x+38,ground+15);c.lineTo(x+54,ground+3);c.lineTo(x+90,ground+45);c.stroke();}c.fillStyle='#e5b079';c.fillRect(x-3,ground-3,3,50);c.fillRect(x+o.w,ground-3,3,50);if(this.settings.warnings!==false)this.label(c,'↑ GAP',x+o.w/2,ground-43,cue,'#ffe4b4','center');
   }else if(o.type==='platform'){c.drawImage(this.images.platform,x,ground-90,o.w,45);c.fillStyle='#b9e0cc';c.fillRect(x,ground-90,o.w,3);}
   else if(o.type==='dashWall'){c.drawImage(this.images.gate,x-12,ground-182,o.w+24,185);this.glow(c,x+o.w/2,ground-85,90,'240,192,100');if(this.settings.warnings!==false)this.label(c,'→ DASH',x+o.w/2,ground-202,cue,'#f8d58a','center');}
   else if(o.type==='laser'){c.fillStyle='#b84737';c.fillRect(x,ground-110,o.w,53);c.fillStyle='#ffb18f';c.fillRect(x,ground-65,o.w,5);this.glow(c,x+o.w/2,ground-77,80,'255,104,70');if(this.settings.warnings!==false)this.label(c,'↓ SLIDE',x+o.w/2,ground-133,cue,'#ffe1c5','center');}
   else if(o.type==='beam'){
    c.strokeStyle='#abc5b862';c.lineWidth=3;for(const xx of [x+10,x+o.w-10]){c.beginPath();c.moveTo(xx,ground-180);c.lineTo(xx,Math.max(0,ground-420));c.stroke();}
    c.drawImage(this.images.elevator,x-9,ground-180,o.w+18,123);
    c.fillStyle='#e9bd71';c.fillRect(x-2,ground-67,o.w+4,7);
    for(let xx=x;xx<x+o.w;xx+=20){c.fillStyle='#162824';c.beginPath();c.moveTo(xx,ground-66);c.lineTo(xx+8,ground-66);c.lineTo(xx+14,ground-60);c.lineTo(xx+6,ground-60);c.fill();}
    if(this.settings.warnings!==false)this.label(c,'↓ SLIDE',x+o.w/2,ground-195,cue,'#f7dfab','center');
   }else{
    c.drawImage(this.images[o.type==='spikes'?'spikes':'wall'],x-4,ground-(o.type==='spikes'?53:64),o.w+8,o.type==='spikes'?57:68);
    c.fillStyle=this.settings.highContrast?'#fff':'#f0c788';c.fillRect(x,ground-4,o.w,3);
    if(this.settings.warnings!==false)this.label(c,'↑ JUMP',x+o.w/2,ground-88,cue,'#f7dfab','center');
   }c.restore();
  }
  for(const coin of s.coins){if(coin.taken)continue;const x=hero+coin.x-s.distance;if(x<-30||x>vw+30)continue;this.glow(c,x,ground-coin.y,30,'245,197,94');c.drawImage(this.images.coin,x-13,ground-coin.y-13,26,26);}
  for(const e of s.enemies){const x=hero+e.x-s.distance;if(x<-180||x>vw+180)continue;drawEnemy(c,this.images,{x,y:ground-e.y,kind:e.kind,state:e.hp<=0?'defeat':e.hurtUntil>s.time?'hit':e.warning?'charge':'move',time:e.hp<=0?s.time-e.deadAt:e.age,size:e.size});if(e.warning&&this.settings.warnings!==false)this.label(c,'! INCOMING',x,ground-e.y-e.size-10,cue,'#ffc38c','center');if(e.boss&&e.hp>0){c.fillStyle='#09181f';c.fillRect(x-80,ground-e.y-e.size-35,160,8);c.fillStyle='#e5b782';c.fillRect(x-80,ground-e.y-e.size-35,160*e.hp/e.maxHp,8);this.label(c,'VAULT HUNTER',x,ground-e.y-e.size-49,cue,'#f6d996','center');}}
  for(const item of s.pickups){const x=hero+item.x-s.distance;if(item.taken||x<-30||x>vw+50)continue;const color=item.type==='key'||item.type==='reader'?'#edce87':item.type==='chip'?'#b3a2ed':'#acdec4';this.glow(c,x,ground-item.y,42);c.fillStyle='#09222c';c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.roundRect(x-19,ground-item.y-19,38,38,8);c.fill();c.stroke();this.label(c,item.type==='chip'?item.digit:item.type==='key'?'K':item.type==='reader'?'E':POWERUPS[item.type]?.icon||'+',x,ground-item.y+6,17,color,'center');if(item.type==='reader')this.label(c,'BANK VAULT · E',x,ground-item.y-31,cue,color,'center');}
  for(const shot of s.shots.items){const x=hero+shot.x-s.distance;c.strokeStyle=shot.enemy?'#ffad77':this.settings.highContrast?'#ffffff':shot.weapon==='beam'?'#f0d694':'#f3a6cf';c.lineWidth=shot.h;c.lineCap='round';c.beginPath();c.moveTo(x,ground-shot.y);c.lineTo(x-(shot.enemy?-1:1)*shot.w,ground-shot.y);c.stroke();c.lineCap='butt';}
  if(p.powers.companion)drawEnemy(c,this.images,{x:hero-80,y:ground-p.y-65,kind:'drone',time:s.time,size:65});
  c.save();c.fillStyle='#0007';c.beginPath();c.ellipse(hero,ground+7,Math.max(12,43-p.y*.07),7,0,0,7);c.fill();
  this.glow(c,hero,ground-p.y-45,p.overdriveTime>0?170:85,p.overdriveTime>0?'246,204,132':'173,221,202');if(p.invuln>0&&s.mode!=='dead'&&!reduced&&!this.settings.reducedFlashing&&Math.floor(s.time*12)%2)c.globalAlpha=.45;
  if(p.dashTime>0&&!reduced){for(let i=3;i>0;i--){c.globalAlpha=.12;drawHero(c,this.images,{x:hero-i*35,y:ground-p.y,action:'dash',time:s.time,size:132});}c.globalAlpha=1;}
  drawHero(c,this.images,{x:hero,y:ground-p.y,action:s.mode==='title'?'idle':s.mode==='dead'?'death':p.action,time:p.actionTime,vy:p.vy,size:132});
  if(p.shield){c.strokeStyle='#a5e6d6';c.lineWidth=2;c.beginPath();c.ellipse(hero,ground-p.y-50,58,66,0,0,Math.PI*2);c.stroke();}
  c.restore();
  if(!reduced&&this.settings.particles!==false){for(const e of s.particles.items){c.globalAlpha=Math.min(1,e.life*2);c.fillStyle=e.color;c.fillRect(hero+e.x-s.distance,ground-e.y,4,4);}c.globalAlpha=1;}
  const next=s.obstacles.find(o=>!o.passed&&o.x+o.w>s.distance);if(this.settings.warnings!==false&&next&&s.mode==='playing'&&next.x-s.distance>vw-hero-80){const x=vw-25;this.label(c,['beam','laser'].includes(next.type)?'↓ SLIDE NEXT':next.type==='dashWall'?'→ DASH NEXT':'↑ JUMP NEXT',x,ground-145,cue,'#ecdcb1','right');}
  if(p.overdriveTime>0){c.strokeStyle='#edca8480';c.lineWidth=8;c.strokeRect(4,4,vw-8,vh-8);}
  c.restore();
 }
}
