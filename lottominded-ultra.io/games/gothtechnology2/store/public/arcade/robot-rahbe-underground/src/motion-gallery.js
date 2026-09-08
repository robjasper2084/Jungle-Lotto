import {RAHBE_MOTIONS} from './rahbe-motions.js';
import {VILLAIN_MOTIONS} from './villain-motions.js';
const names={rahbe:'ROBOT RAHBE',drone:'Security Drone',guard:'Robot Guard',warden:'Number Warden'};
const labels={idle:'Ready / idle',move:'Patrol / advance',run:'Run',jump:'Jump',crouch:'Crouch',shoot:'Fire',charge:'Alert / charge',attack:'Attack',hit:'Damage reaction',defeat:'Defeat',ladder:'Climb ladder','rope-grab':'Grab rope','rope-swing':'Swing','rope-release':'Release rope',cart:'Board / ride cart',landing:'Land',hurt:'Damage reaction',victory:'Victory','aim-vertical':'Aim up / down'};
const base={idle:5,run:0,jump:2,crouch:3,shoot:4};
const images={};let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,flip=false,time=0,last=performance.now();
const paths={'assets/characters/rahbe.png':true};
for(const data of [...Object.values(RAHBE_MOTIONS),...Object.values(VILLAIN_MOTIONS)])paths[data.sheet]=true;
await Promise.all(Object.keys(paths).map(path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[path]=im;resolve();};im.onerror=()=>reject(new Error(path));im.src=path;}))).catch(e=>{document.getElementById('loading').textContent='Could not load '+e.message;throw e;});
const cards=Object.keys(names).map(kind=>{
const options=kind==='rahbe'?[...Object.keys(base),...Object.keys(RAHBE_MOTIONS)]:Object.keys(VILLAIN_MOTIONS[kind].states);
const el=document.createElement('article');el.className='card';el.innerHTML='<div class="card-top"><div><h2>'+names[kind]+'</h2><small>'+(kind==='rahbe'?'ORIGINAL HERO · 40 NEW FRAMES':'6 ACTIONS · 24 FRAMES')+'</small></div><span class="frame-label"></span></div><canvas width="640" height="410" aria-label="'+names[kind]+' animation preview"></canvas><div class="card-bottom"><select aria-label="'+names[kind]+' action">'+options.map(n=>'<option value="'+n+'">'+(labels[n]||n)+'</option>').join('')+'</select><a download>SPRITE SHEET ↓</a></div>';
document.getElementById('cards').append(el);const card={kind,el,canvas:el.querySelector('canvas'),select:el.querySelector('select'),anchor:el.querySelector('a'),frame:el.querySelector('.frame-label')};
card.select.value=kind==='rahbe'?'run':'move';card.select.onchange=()=>{time=0;};return card;
});
document.getElementById('loading').textContent='All character sheets ready';
function button(){document.getElementById('play').textContent=playing?'PAUSE ANIMATIONS':'PLAY ANIMATIONS';document.getElementById('play').setAttribute('aria-pressed',String(playing));}
button();document.getElementById('play').onclick=()=>{playing=!playing;button();};document.getElementById('flip').onclick=()=>{flip=!flip;document.getElementById('flip').setAttribute('aria-pressed',String(flip));document.getElementById('flip').textContent=flip?'FACE LEFT':'FACE RIGHT';};
function draw(now){
if(playing)time+=Math.min((now-last)/1000,.1);last=now;
for(const card of cards){
const c=card.canvas.getContext('2d'),name=card.select.value;
c.clearRect(0,0,640,410);
const floor=c.createLinearGradient(0,290,0,410);floor.addColorStop(0,'#53716d22');floor.addColorStop(1,'#031014');c.fillStyle=floor;c.fillRect(0,294,640,116);
c.strokeStyle='#83ae9d16';for(let i=-5;i<7;i++){c.beginPath();c.moveTo(320+i*30,294);c.lineTo(320+i*180,410);c.stroke();}c.beginPath();c.moveTo(0,344);c.lineTo(640,344);c.stroke();
c.save();c.translate(320,340);c.scale(1,.18);const shadow=c.createRadialGradient(0,0,2,0,0,130);shadow.addColorStop(0,'#000c');shadow.addColorStop(1,'#0000');c.fillStyle=shadow;c.fillRect(-130,-130,260,260);c.restore();
let path,sx,sy,sw,sh,count=4,fps=10,frame;
if(card.kind==='rahbe'&&name in base){path='assets/characters/rahbe.png';sw=images[path].width/8;sh=images[path].height/6;count=8;frame=Math.floor(time*fps)%count;sx=frame*sw+3;sy=base[name]*sh+3;sw-=6;sh-=6;}
else if(card.kind==='rahbe'){const data=RAHBE_MOTIONS[name];path=data.sheet;fps=data.fps;frame=Math.floor(time*fps)%4;({x:sx,y:sy,w:sw,h:sh}=data.frames[frame]);}
else{const data=VILLAIN_MOTIONS[card.kind],state=data.states[name];path=data.sheet;fps=state.fps;frame=Math.floor(time*fps)%4;sx=frame*256;sy=state.row*256;sw=sh=256;}
c.save();c.translate(320,346);const direction=card.kind==='rahbe'?(flip?1:-1):(flip?-1:1);c.scale(direction,1);const size=card.kind==='warden'?326:310;c.drawImage(images[path],sx,sy,sw,sh,-size/2,-size,size,size);c.restore();
card.frame.textContent='FRAME '+String(frame+1).padStart(2,'0')+' / '+String(count).padStart(2,'0');card.anchor.href=path;card.canvas.dataset.motion=name;card.canvas.dataset.frame=String(frame);
}
requestAnimationFrame(draw);
}requestAnimationFrame(draw);
