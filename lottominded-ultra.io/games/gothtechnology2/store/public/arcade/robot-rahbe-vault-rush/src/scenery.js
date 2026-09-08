// Environment-only presentation. The gameplay ground/collision geometry is unchanged.
import {CONFIG,ZONES} from './config.js';

export function drawScenery(c,images,s,vw,vh,ground,reduced){
 const zone=ZONES[s.zone],phase=reduced?0:s.distance;
 const paint=(entry,alpha=1)=>{
  const art=images[entry.art],h=Math.max(ground+35,vw*art.height/art.width),w=h*art.width/art.height;
  const focal=vw<750?entry.portraitFocus:.5;
  const pan=reduced?0:Math.sin(s.distance/4200)*Math.max(0,w-vw)*.035;
  const left=Math.max(vw-w,Math.min(0,vw*.5-w*focal+pan));
  c.save();c.globalAlpha=alpha;c.drawImage(art,left,ground+35-h,w,h);c.restore();
 };
 paint(zone);
 const section=s.distance%CONFIG.sceneryLength,blend=Math.max(0,(section-(CONFIG.sceneryLength-400))/400);
 if(blend>0&&!reduced)paint(ZONES[(s.zone+1)%ZONES.length],blend);
 // Darken only the HUD edge and the lane; keep the location itself in daylight.
 const shade=c.createLinearGradient(0,0,0,ground+30);
 shade.addColorStop(0,'#071719a6');shade.addColorStop(.32,'#07171910');shade.addColorStop(.72,'#07171900');shade.addColorStop(1,'#07171948');
 c.fillStyle=shade;c.fillRect(0,0,vw,ground+35);
 const river=zone.region==='riverwalk';
 if(river){
  // Waterside railing moves more slowly than the promenade.
  c.fillStyle='#172e2d';c.fillRect(0,ground-64,vw,4);c.fillRect(0,ground-29,vw,3);
  for(let x=-(phase*.25%95);x<vw+95;x+=95){c.fillRect(x,ground-68,5,63);c.fillStyle='#708f8566';c.fillRect(x+5,ground-64,1,59);c.fillStyle='#172e2d';}
 }
 // A lit, paved running surface replaces the interior vault's riveted floor.
 const path=c.createLinearGradient(0,ground-18,0,ground+3);path.addColorStop(0,river?'#d6c7a8':'#718078');path.addColorStop(1,river?'#aaa68e':'#4c5e55');c.fillStyle=path;c.fillRect(0,ground-18,vw,21);
 const curb=c.createLinearGradient(0,ground+3,0,ground+61);curb.addColorStop(0,river?'#8f927e':'#43584c');curb.addColorStop(.15,river?'#7a816e':'#364e42');curb.addColorStop(1,'#172e27');c.fillStyle=curb;c.fillRect(0,ground+3,vw,58);
 for(let x=-(s.distance%160);x<vw+160;x+=160){c.strokeStyle=river?'#5f695666':'#172d2755';c.lineWidth=1;c.beginPath();c.moveTo(x+14,ground-12);c.lineTo(x,ground+2);c.lineTo(x,ground+61);c.stroke();if(!river){c.fillStyle='#e3d9a8';c.fillRect(x+46,ground-9,40,3);}}
 c.fillStyle=river?'#e2d4b0':'#cad3bf';c.fillRect(0,ground,vw,3);c.fillStyle='#132923';c.fillRect(0,ground+59,vw,5);
 const face=c.createLinearGradient(0,ground+61,0,vh);face.addColorStop(0,river?'#263c39':'#243b2c');face.addColorStop(1,'#071718');c.fillStyle=face;c.fillRect(0,ground+64,vw,vh-ground-64);
}
