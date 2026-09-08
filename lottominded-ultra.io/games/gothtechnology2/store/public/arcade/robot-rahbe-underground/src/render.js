import {WIDTH,STRIDE,DEPTHS,floorY} from './world.js';
import {clamp,ropeEnd} from './simulation.js';
import {RAHBE_MOTIONS} from './rahbe-motions.js';
import {DETROIT_ART,DETROIT_SCENES} from './detroit-art.js';
import {VILLAIN_MOTIONS} from './villain-motions.js';
export const MANIFEST={rahbe:'assets/characters/rahbe.png',...Object.fromEntries(Object.entries(RAHBE_MOTIONS).map(([name,data])=>['rahbe-'+name,data.sheet])),...Object.fromEntries(Object.entries(VILLAIN_MOTIONS).map(([name,data])=>['motion-'+name,data.sheet])),...DETROIT_ART};
const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export class Renderer{
  constructor(images){this.images=images;this.camera={x:0,y:0};this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.previewTime=0;this.heroMotion='';this.heroMotionStart=0;this.villainStates=new WeakMap();this.villainMotions={};}
  reset(s){this.camera.x=s.player.x-600;this.camera.y=s.player.y-420;}
  draw(ctx,s,width,height,delta){
    this.previewTime+=delta;
    const title=s.mode==='title';const zoom=width<700?.85:clamp(width/1280,.78,1.4);const vw=width/zoom,vh=height/zoom;
    const targetX=clamp(s.player.x-vw*.42,0,Math.max(0,WIDTH-vw));
    const targetY=clamp(s.player.y-vh*.64,-160,floorY(6)-vh*.6);
    const ease=this.reduced?1:1-Math.exp(-delta*6);
    this.camera.x+=(targetX-this.camera.x)*ease;this.camera.y+=(targetY-this.camera.y)*ease;
    if(title){this.camera.x=780;this.camera.y=-80;}
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#09171b';ctx.fillRect(0,0,width,height);
    const art=this.images['detroit-street'];
    if(art){const scale=Math.max(width/art.width,height/art.height);ctx.globalAlpha=title?.83:.18;ctx.drawImage(art,(width-art.width*scale)/2,(height-art.height*scale)/2,art.width*scale,art.height*scale);ctx.globalAlpha=1;}
    if(!title){ctx.scale(zoom,zoom);ctx.translate(-this.camera.x,-this.camera.y);
      this.paintWorld(ctx,s,{x:this.camera.x,y:this.camera.y,w:vw,h:vh},false);
    }
    ctx.restore();
    const vignette=ctx.createRadialGradient(width*.5,height*.46,height*.12,width*.5,height*.46,Math.max(width,height)*.72);vignette.addColorStop(0,'#010b0d00');vignette.addColorStop(1,title?'#010b0dba':'#010b0d88');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
    if(s.player.invuln>1.35&&!title){ctx.fillStyle='#b638241c';ctx.fillRect(0,0,width,height);}
  }
  paintWorld(c,s,view,title){
    this.currentDepth=s.depth;this.villainMotions={};
    const w=s.world,t=s.time;const left=Math.max(0,view.x-220),right=Math.min(WIDTH,view.x+view.w+220);
    for(let depth=0;depth<7;depth++){
      const y=floorY(depth);if(y<view.y-100||y-STRIDE>view.y+view.h)continue;
      this.background(c,depth,y,left,right,s,view);
    }
    for(const h of w.hazards){if(h.y<view.y-70||h.y>view.y+view.h)continue;this.hazard(c,h,t);}
    for(const plat of w.platforms){if(plat.x+plat.w<left||plat.x>right||plat.y<view.y-120||plat.y>view.y+view.h+50)continue;this.platform(c,plat,s.time);}
    for(const l of w.ladders){if(l.x<left||l.x>right||l.y2<view.y||l.y1>view.y+view.h)continue;
      const im=this.images['art-ladder'];if(im){c.save();c.beginPath();c.rect(l.x-25,l.y1,50,l.y2-l.y1);c.clip();for(let yy=l.y1;yy<l.y2;yy+=142)c.drawImage(im,0,im.height*.14,im.width,im.height*.68,l.x-25,yy,50,142);c.restore();}
      if(!l.short){this.light(c,l.x-45,l.y1+10,'#8adde0',36);this.label(c,'↓',l.x,l.y1-17,19,'#82ded5');}
    }
    for(const r of w.ropes){const end=ropeEnd(r,t);c.lineWidth=5;c.strokeStyle='#b2a480';c.beginPath();c.moveTo(r.x,r.y);c.lineTo(end.x,end.y);c.stroke();c.lineWidth=1;c.strokeStyle='#f4db9a';c.beginPath();c.moveTo(r.x-1,r.y);c.lineTo(end.x-1,end.y);c.stroke();c.fillStyle='#edbd6d';c.beginPath();c.arc(r.x,r.y,9,0,Math.PI*2);c.fill();this.light(c,end.x,end.y,'#edbd6d',22);}
    for(const sign of w.signs){if(sign.x<left-250||sign.x>right||sign.y<view.y||sign.y>view.y+view.h)continue;const size=sign.large?26:sign.small?10:14;c.font=`${size}px 'Courier New',monospace`;const tw=c.measureText(sign.text).width;c.fillStyle='#0a191c';c.fillRect(sign.x-12,sign.y-size-9,tw+24,size+20);c.strokeStyle=sign.large?'#83b6af':'#85948760';c.strokeRect(sign.x-12,sign.y-size-9,tw+24,size+20);this.label(c,sign.text,sign.x,sign.y,size,sign.large?'#b0cbc1':'#a3b6a7','left');}
    for(let i=0;i<7;i++){const x=i%2?2670:190,y=floorY(i);if(y<view.y||y>view.y+view.h+90)continue;this.beacon(c,x,y,i<=s.reached,t);}
    for(const coin of w.coins){if(coin.taken||coin.x<left||coin.x>right||coin.y<view.y||coin.y>view.y+view.h)continue;this.coin(c,coin.x,coin.y+Math.sin(t*3+coin.id)*3,9,t+coin.id);}
    for(const seal of w.seals){if(seal.taken)continue;const pulse=this.reduced?1:Math.sin(t*3)*.12+1;this.light(c,seal.x,seal.y,'#82ded5',65);c.save();c.translate(seal.x,seal.y);c.rotate(Math.PI/4);c.strokeStyle='#82ded5';c.lineWidth=2;c.strokeRect(-23*pulse,-23*pulse,46*pulse,46*pulse);c.fillStyle='#102e31';c.fillRect(-18,-18,36,36);c.restore();this.label(c,seal.number,seal.x,seal.y+6,17,'#d8f2d5');}
    for(const wall of w.walls){if(wall.hp>0){const im=this.images['art-wall'];if(im){this.shadow(c,wall.x+20,wall.y+wall.h,42);c.drawImage(im,wall.x-4,wall.y,wall.w+8,wall.h);}this.light(c,wall.x+20,wall.y+90,'#d6a061',30);}}
    for(const chest of w.treasures){if(!chest.taken){this.light(c,chest.x,chest.y,'#eabd60',80);const im=this.images['art-chest'];if(im)c.drawImage(im,chest.x-32,chest.y-28,64,57);}}
    for(const cart of w.carts)this.cart(c,cart,t);
    if(s.train.active)this.train(c,s.train.x,floorY(1),t);
    for(const r of w.rolling){this.coin(c,r.x,r.y,r.r,t*3);this.light(c,r.x,r.y,'#dc9d3a',65);}
    this.gate(c,w.gate,w.seals,t);
    for(const e of w.enemies){if(e.hp<=0&&t-(e.deadAt??-10)>3.2||e.x<left||e.x>right||e.y<view.y-60||e.y>view.y+view.h+120)continue;this.enemy(c,e,t);}
    const b=w.boss;if(b.y>view.y&&b.y<view.y+view.h+200&&(b.hp>0||t-(b.deadAt??-10)<3.2)){this.villain(c,b,t,'warden');if(b.active&&b.pulse<.75&&b.hp>0){c.strokeStyle='#e1b762';c.lineWidth=2;c.beginPath();c.ellipse(b.x,b.y,160,16,0,0,Math.PI*2);c.stroke();}}
    if(b.hp<=0){const x=w.exit.x,y=w.exit.y;this.light(c,x,y,'#82ded5',130);c.strokeStyle='#82ded5';c.lineWidth=3;c.strokeRect(x-40,y-100,80,170);for(let i=0;i<7;i++){c.fillStyle='#82ded520';c.fillRect(x-37,y-95+i*24,74,12);}this.label(c,'↑ SURFACE',x,y-125,12,'#a7f0dc');}
    if(!title)this.player(c,s.player,t,s.mode);
    if(s.player.cart>=0)this.cart(c,w.carts[s.player.cart],t,true);
    for(const shot of s.shots){c.strokeStyle=shot.enemy?(this.highContrast?'#ffac44':'#f29257'):(this.highContrast?'#ffffff':'#9effe2');c.lineWidth=shot.wave?13:shot.enemy?6:4;c.lineCap='round';c.beginPath();c.moveTo(shot.x,shot.y);c.lineTo(shot.x-shot.vx*.016,shot.y-shot.vy*.016);c.stroke();c.lineCap='butt';if(shot.wave)this.light(c,shot.x,shot.y,'#ffa861',24);}
    if(!this.reduced)for(const p of s.sparks){c.globalAlpha=Math.min(1,p.life*3);c.fillStyle=p.color;c.fillRect(p.x,p.y,3,3);}c.globalAlpha=title?.46:1;
    // Dust and light shafts stay in world coordinates; reduced motion keeps them still.
    for(let i=0;i<42;i++){const x=(noise(i+7)*WIDTH),y=(noise(i+99)*3700+(this.reduced?0:t*(2+i%3)))%3700;if(x<left||x>right||y<view.y||y>view.y+view.h)continue;c.fillStyle='#c5dac23d';c.fillRect(x,y,2,2);}
  }
  label(c,text,x,y,size,color,align='center'){c.save();c.font=`${size}px 'Courier New',monospace`;c.textAlign=align;c.fillStyle=color;c.fillText(text,x,y);c.restore();}
  light(c,x,y,color,r){c.save();const g=c.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color+'60');g.addColorStop(.25,color+'20');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
  background(c,depth,y,left,right,s,view){
    const art=this.images[DETROIT_SCENES[depth]];
    const top=depth===0?y-900:y-STRIDE+42;
    c.save();c.beginPath();c.rect(view.x-2,top,view.w+4,y+42-top);c.clip();
    c.fillStyle='#101d21';c.fillRect(view.x-2,top,view.w+4,y+42-top);
    if(art){
      // One continuous image per depth pans slowly behind the playable geometry.
      const aw=Math.max(1420,view.w*1.16),ah=aw*art.height/art.width;
      const progress=clamp(view.x/Math.max(1,WIDTH-view.w),0,1);
      c.drawImage(art,view.x-progress*(aw-view.w),y+43-ah,aw,ah);
    }
    const shade=c.createLinearGradient(0,y-430,0,y+42);shade.addColorStop(0,'#04101508');shade.addColorStop(.7,'#06131800');shade.addColorStop(1,'#03101460');c.fillStyle=shade;c.fillRect(view.x,top,view.w,y+42-top);
    if(depth===1||depth===3){
      for(const offset of [4,17]){const rail=c.createLinearGradient(0,y+offset,0,y+offset+6);rail.addColorStop(0,'#c7c9b6');rail.addColorStop(.4,'#596a68');rail.addColorStop(1,'#152627');c.fillStyle=rail;c.fillRect(left,y+offset,right-left,6);}
      if(depth===1)for(const x of [770,1730,2640]){c.fillStyle='#162222';c.fillRect(x,y-256,14,121);const color=s.train.warning||s.train.active?'#ef7758':'#82ded5';c.fillStyle=color;c.beginPath();c.arc(x+7,y-245,6,0,7);c.fill();this.light(c,x+7,y-245,color,45);}
    }
    c.restore();
    // Atmospheric foreground pools occupy a separate moving layer.
    if(!this.reduced){c.save();c.globalAlpha=.08;for(let i=0;i<4;i++){const x=view.x+(i*430+s.time*9+depth*97)%(view.w+500)-250;const fog=c.createRadialGradient(x,y-18,1,x,y-18,180);fog.addColorStop(0,'#a2bfbd');fog.addColorStop(1,'#a2bfbd00');c.fillStyle=fog;c.fillRect(x-180,y-110,360,150);}c.restore();}
  }
  platform(c,p,t){
    if(p.fallen>0)return;
    const crumble=p.kind==='crumble',moving=p.kind==='moving'||p.kind==='elevator';
    const shake=crumble&&p.timer>0&&!this.reduced?Math.sin(t*70)*1.5:0;
    c.save();c.translate(shake,0);
    // A deep face, upper bevel, and cast shadow keep the collision lip readable.
    const shadow=c.createLinearGradient(0,p.y+8,0,p.y+67);shadow.addColorStop(0,'#000a');shadow.addColorStop(1,'#0000');c.fillStyle=shadow;c.fillRect(p.x+9,p.y+8,p.w,59);
    const im=this.images[moving?'art-elevator':crumble?'art-wall':'art-platform'];
    const h=moving?36:crumble?43:48,tw=moving?p.w:crumble?56:160;
    c.save();c.beginPath();c.rect(p.x,p.y-5,p.w,h+8);c.clip();
    if(im)for(let x=p.x;x<p.x+p.w;x+=tw)c.drawImage(im,x,p.y-5,tw,h);
    else{c.fillStyle='#38474b';c.fillRect(p.x,p.y,p.w,h);}
    c.restore();
    c.fillStyle=moving?'#8becd7':crumble?'#e5b879':'#d2c8a7';c.fillRect(p.x,p.y,p.w,2);
    c.fillStyle='#0a171b88';c.fillRect(p.x,p.y+h-9,p.w,7);
    if(moving){this.light(c,p.x+p.w/2,p.y+18,'#82ded5',48);if(p.kind==='elevator'){c.strokeStyle='#9baba980';c.lineWidth=3;c.beginPath();c.moveTo(p.x+9,p.baseY-220);c.lineTo(p.x+9,p.y);c.moveTo(p.x+p.w-9,p.baseY-220);c.lineTo(p.x+p.w-9,p.y);c.stroke();}}
    c.restore();
  }
  hazard(c,h,t){
    const im=this.images[h.type==='spikes'?'art-spikes':'art-fire'];if(!im)return;
    if(h.type==='spikes'){const tile=90;c.save();c.beginPath();c.rect(h.x,h.y-2,h.w,h.h+8);c.clip();for(let x=h.x;x<h.x+h.w;x+=tile)c.drawImage(im,x,h.y,tile,h.h+4);c.restore();}
    else{this.light(c,h.x+h.w/2,h.y,'#f29d48',h.w*.8);c.fillStyle='#6a291b';c.fillRect(h.x,h.y+14,h.w,20);for(let x=h.x;x<h.x+h.w;x+=62){const f=this.reduced?1:Math.floor(t*11+x)%4;c.drawImage(im,f*256,0,256,256,x-5,h.y-58,86,96);}}
  }
  coin(c,x,y,r,t){
    const im=this.images['art-coin'];if(!im)return;c.save();c.translate(x,y);
    if(r>20){c.rotate(t);c.shadowColor='#0009';c.shadowBlur=8;c.shadowOffsetY=5;}else c.scale(.8+Math.abs(Math.sin(t))* .2,1);
    c.drawImage(im,-r,-r,r*2,r*2);c.restore();
  }
  beacon(c,x,y,on,t){c.fillStyle='#182e2c';c.fillRect(x-14,y-51,28,51);c.strokeStyle='#709281';c.strokeRect(x-14,y-51,28,51);c.fillStyle=on?'#83ddc7':'#657064';c.fillRect(x-9,y-45,18,7);if(on){this.light(c,x,y-40,'#82ded5',55);this.label(c,'◆',x,y-66,13,'#82ded5');}}
  cart(c,o,t,front=false){
    const im=this.images['art-cart'];if(!im)return;
    if(front){c.save();c.beginPath();c.rect(o.x-62,o.y-33,124,48);c.clip();c.drawImage(im,o.x-62,o.y-73,124,88);c.restore();}
    else{this.shadow(c,o.x,o.y+10,64);c.drawImage(im,o.x-62,o.y-73,124,88);}
  }
  train(c,x,y,t){
    const im=this.images['art-train'];if(!im)return;
    for(let i=0;i<5;i++)c.drawImage(im,x+i*236,y-113,236,126);
    this.light(c,x+1180,y-60,'#ffe1a0',140);
  }
  enemy(c,e,t){
    this.villain(c,e,t,e.type);
  }
  shadow(c,x,y,r){
    c.save();c.translate(x,y);c.scale(1,.20);const g=c.createRadialGradient(0,0,1,0,0,r);g.addColorStop(0,'#0009');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);c.restore();
  }
  villain(c,e,t,kind){
    const data=VILLAIN_MOTIONS[kind];
    let name=e.hp<=0?'defeat':e.attackUntil>t?'attack':kind==='warden'&&e.pulse<.7?'charge':e.hurtUntil>t?'hit':e.shot<.38?(kind==='guard'?'idle':'charge'):kind==='warden'?(e.active?'move':'idle'):e.resting?'idle':e.running?'run':'move';
    if(!data?.states[name])name=name==='run'?'move':name;
    const last=this.villainStates.get(e);
    if(!last||last.name!==name)this.villainStates.set(e,{name,since:t});
    const age=name==='defeat'?t-(e.deadAt??t):t-this.villainStates.get(e).since;
    if(kind==='warden'||e.depth===this.currentDepth)this.villainMotions[kind]=name;
    const isDrone=kind==='drone',baseY=e.y+(isDrone?39:8),size=data?.drawSize||(kind==='warden'?242:isDrone?104:112);
    if(!isDrone)this.shadow(c,e.x,e.y+9,kind==='warden'?84:35);
    c.save();c.translate(e.x,baseY);
    // Generated enemies face left; only mirror when their movement faces right.
    if((e.facing??Math.sign(e.vx||-1))>0)c.scale(-1,1);
    if(name==='defeat')c.globalAlpha=clamp(1-(age-2)/1.2,0,1);
    const im=this.images['motion-'+kind],state=data?.states[name];
    if(im&&state){let f=Math.floor(age*state.fps);f=state.loop?f%4:Math.min(3,f);c.drawImage(im,f*256,state.row*256,256,256,-size/2,-size,size,size);}
    else{const art=this.images['art-'+kind];if(art)c.drawImage(art,-size*.46,-size,size*.92,size);}
    c.restore();
    if(name==='charge'||name==='attack')this.light(c,e.x,e.y-(isDrone?0:kind==='warden'?100:43),'#ffc878',kind==='warden'?95:38);
  }
  gate(c,g,seals,t){
    const im=this.images['art-gate'];if(!im)return;
    if(g.open){c.save();c.globalAlpha=.3;c.drawImage(im,g.x-37,g.y-50,145,75);c.restore();return;}
    this.shadow(c,g.x+g.w/2,g.y+g.h,90);c.drawImage(im,g.x-37,g.y,145,g.h+7);
    for(let i=0;i<3;i++){const y=g.y+47+i*69;c.fillStyle='#0a191ce8';c.fillRect(g.x+19,y-18,34,32);this.label(c,seals[i].number,g.x+35,y+5,16,seals[i].taken?'#8df2db':'#cfab70');}
  }
  player(c,p,t,mode){
    let name=p.action;
    if(p.action==='climb')name='ladder';
    if(p.rope>=0)name=p.ropeGrabUntil>t?'rope-grab':'rope-swing';
    if(p.ropeReleaseUntil>t)name='rope-release';
    if(p.cart>=0)name='cart';
    if(p.landingUntil>t&&Math.abs(p.vx)<80&&p.rope<0&&p.cart<0)name='landing';
    if(p.cooldown>.04&&p.rope<0&&p.cart<0)name=p.aim?'aim-vertical':'shoot';
    if(p.hurtUntil>t)name='hurt';
    if(mode==='dead')name='defeat';if(mode==='won')name='victory';
    if(this.heroMotion!==name){this.heroMotion=name;this.heroMotionStart=this.previewTime;}
    const motion=RAHBE_MOTIONS[name],age=this.previewTime-this.heroMotionStart;
    if(p.grounded)this.shadow(c,p.x,p.y+7,35);
    this.light(c,p.x,p.y-30,'#8cdfdc',60);c.save();c.translate(p.x,p.y+2);
    if(name==='rope-swing'){c.translate(0,-52);c.rotate(-(p.swingAngle||0));c.translate(0,92);}
    c.scale(p.facing,1);
    if(p.invuln>0&&mode!=='dead'&&name!=='hurt'&&Math.floor(t*14)%2)c.globalAlpha=.42;
    if(motion&&this.images['rahbe-'+name]){
      const count=motion.frames.length;let index=Math.floor(age*(motion.fps||10));
      index=motion.loop?index%count:Math.min(index,count-1);
      if(name==='ladder'){if(Math.abs(p.vy)<1)index=0;else if(p.vy>0)index=count-1-index;}
      if(name==='rope-swing')index=(p.swingAngle||0)>0?0:1;
      if(name==='cart'&&p.cartBoardUntil<=t)index=2+Math.floor(t*7)%2;
      if(name==='aim-vertical')index=p.aim<0?1:3;
      if(name==='ladder'&&index===2)c.scale(-1,1);
      const frame=motion.frames[index],size=motion.drawSize||110;
      c.drawImage(this.images['rahbe-'+name],frame.x,frame.y,frame.w,frame.h,-size/2,-size,size,size);
    }else{
      let row=5,frame=Math.floor(t*5)%8;
      if(p.action==='run'){row=0;frame=Math.floor(t*12)%8;}
      if(p.action==='jump'||p.action==='climb'||p.action==='swing'){row=2;frame=p.vy<0?2:3;}
      if(p.action==='crouch'){row=3;frame=2;}
      if(name==='shoot'){row=4;frame=1+Math.floor(t*18)%7;}
      const im=this.images.rahbe;if(im){const cw=im.width/8,ch=im.height/6;c.drawImage(im,frame*cw+3,row*ch+3,cw-6,ch-6,-47,-86,94,94);}
    }
    c.restore();c.fillStyle='#9cdfca';c.beginPath();c.moveTo(p.x-4,p.y-98);c.lineTo(p.x+4,p.y-98);c.lineTo(p.x,p.y-93);c.fill();
  }
}
