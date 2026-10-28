import type {Command} from '../../../../ride-core/src/royale/rules.ts';
import './cameraCapture.css';

/** The shutter never doubles as a combat input. Applied before prediction or networking. */
export function photographyInput(c:Command){return {...c,fire:false,light:false,heavy:false,brawl:false,dogAttack:false,utility:false,reload:false,cycleMode:false};}
export const clipMime=(supports:(s:string)=>boolean)=>['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(supports)??'';

/** One bounded local capture at a time; no uploads, voice recording or device permissions. */
export class CameraCapture {
 viewfinder=true;zoom=1;private finderButton=document.createElement('button');private zoomButton=document.createElement('button');
 private lcd=document.createElement('div');private lcdInfo=document.createElement('span');
 private layoutAt=0;
 get finder(){return this.active&&this.viewfinder;}
 active=false;private available=false;private pendingPhoto=false;private pendingRecord=false;private shutterHeld=false;
 private recorder?:MediaRecorder;private stream?:MediaStream;private audioRelease?:()=>void;
 private recordingCanvas?:HTMLCanvasElement;private context?:CanvasRenderingContext2D;
 private chunks:Blob[]=[];private bytes=0;private started=0;private drawn=0;private file?:File;private url='';private timer=0;private recordPoster='';private poster='';
 private root=document.createElement('section');private toggle=document.createElement('button');
 private panel=document.createElement('div');private photo=document.createElement('button');private record=document.createElement('button');
 private save=document.createElement('a');private share=document.createElement('button');private review=document.createElement('button');private status=document.createElement('span');
 private preview=document.createElement('dialog');private media=document.createElement('div');
 constructor(private canvas:HTMLCanvasElement,private changed:()=>void,private audio:()=>{stream:MediaStream;release:()=>void}|undefined){
  this.root.id='camera-capture';this.root.hidden=true;this.root.setAttribute('aria-label','Camera mode');
  this.toggle.type='button';this.toggle.textContent='Camera mode';this.toggle.setAttribute('aria-pressed','false');this.toggle.onclick=()=>this.setActive(!this.active);
  this.panel.className='capture-panel';this.panel.hidden=true;
  this.finderButton.type=this.zoomButton.type='button';this.finderButton.textContent='Viewfinder';this.finderButton.setAttribute('aria-pressed','true');
  this.finderButton.onclick=()=>{this.viewfinder=!this.viewfinder;this.finderButton.setAttribute('aria-pressed',String(this.viewfinder));this.syncFinder();this.canvas.focus();};
  this.zoomButton.textContent='Zoom 1×';this.zoomButton.setAttribute('aria-label','Viewfinder zoom');this.zoomButton.onclick=()=>{this.zoom=this.zoom===1?2:this.zoom===2?4:1;this.zoomButton.textContent='Zoom '+this.zoom+'×';this.canvas.focus();};
  this.lcd.id='camera-viewfinder';this.lcd.hidden=true;this.lcd.setAttribute('aria-hidden','true');
  const brand=document.createElement('strong');brand.textContent='STATIC / FIELD CAMERA';this.lcdInfo.className='lcd-info';const focus=document.createElement('i');focus.className='lcd-focus';this.lcd.append(brand,this.lcdInfo,focus);document.body.append(this.lcd);
  this.panel.append(this.finderButton,this.zoomButton);
  this.photo.type=this.record.type=this.share.type=this.review.type='button';
  this.photo.textContent='Photo';this.photo.onclick=()=>this.shutter();this.record.textContent='Record';this.record.onclick=()=>this.toggleRecording();
  this.save.textContent='Save';this.save.className='capture-save';this.share.textContent='Share';this.share.onclick=()=>void this.shareFile();
  this.review.textContent='Review';this.review.onclick=()=>this.showReview();this.status.setAttribute('role','status');this.status.textContent='Photos + 60-second clips · game sound only';
  this.save.hidden=this.share.hidden=this.review.hidden=true;this.panel.append(this.photo,this.record,this.save,this.share,this.review,this.status);this.root.append(this.toggle,this.panel);document.body.append(this.root);
  this.preview.className='capture-preview';const close=document.createElement('button');close.textContent='Back to game';close.onclick=()=>this.preview.close();this.preview.append(this.media,close);document.body.append(this.preview);
  this.preview.addEventListener('close',()=>{this.media.replaceChildren();this.canvas.focus();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
 }
 private syncFinder(){this.lcd.hidden=!this.finder;document.body.classList.toggle('royale-viewfinder',this.finder);this.zoomButton.hidden=!this.viewfinder;this.layoutAt=0;}
 private layoutFinder(now:number){
  if(now-this.layoutAt<250)return;this.layoutAt=now;
  const hud=document.getElementById('hud')?.getBoundingClientRect(),portrait=innerWidth<700;
  const left=portrait?12:Math.max(120,(hud?.right??240)+18),right=portrait?12:Math.max(120,innerWidth-(document.querySelector('.royale-map')?.getBoundingClientRect().left??innerWidth-180)+18);
  this.lcd.style.inset=`${portrait?Math.max(160,(hud?.bottom??240)+12):76}px ${right}px ${innerHeight<500?100:portrait?260:166}px ${left}px`;
 }
 private frame(){if(!this.finder)return {x:0,y:0,w:this.canvas.width,h:this.canvas.height};const r=this.lcd.getBoundingClientRect(),border=parseFloat(getComputedStyle(this.lcd).borderLeftWidth)||0,c=this.canvas.getBoundingClientRect(),sx=this.canvas.width/c.width,sy=this.canvas.height/c.height;return{x:Math.max(0,Math.round((r.left+border-c.left)*sx)),y:Math.max(0,Math.round((r.top+border-c.top)*sy)),w:Math.max(2,Math.round((r.width-border*2)*sx)),h:Math.max(2,Math.round((r.height-border*2)*sy))};}
 private drawScene(context:CanvasRenderingContext2D){const f=this.frame();context.drawImage(this.canvas,f.x,f.y,f.w,f.h,0,0,context.canvas.width,context.canvas.height);}
 setActive(value:boolean){this.active=value&&this.available;document.body.classList.toggle('royale-camera-mode',this.active);this.syncFinder();this.shutterHeld=false;this.pendingPhoto=false;if(!this.active)this.stop();this.toggle.textContent=this.active?'Combat mode':'Camera mode';this.toggle.setAttribute('aria-pressed',String(this.active));this.panel.hidden=!this.active;this.changed();this.canvas.focus();}
 update(available:boolean){this.available=available;this.root.hidden=!available;if(!available&&this.active)this.setActive(false);}
 trigger(pressed:boolean){if(pressed&&!this.shutterHeld)this.shutter();this.shutterHeld=pressed;}
 shutter(){if(this.active&&!this.pendingPhoto){this.pendingPhoto=true;this.status.textContent='Taking photo…';}}
 /** Called immediately after the WebGL render, before the drawing buffer is cleared. */
 afterRender(now:number){
  if(this.finder){this.layoutFinder(now);const f=this.frame();this.lcdInfo.textContent=(this.recorder?.state==='recording'?'● REC '+Math.floor((now-this.started)/1000)+'s':'LIVE')+' · '+this.zoom+'× · '+f.w+' × '+f.h;this.canvas.dataset.viewfinder='lcd';}else delete this.canvas.dataset.viewfinder;
  if(this.pendingPhoto){this.pendingPhoto=false;const photo=document.createElement('canvas'),f=this.frame();photo.width=f.w;photo.height=f.h;this.drawScene(photo.getContext('2d')!);photo.toBlob(blob=>{if(blob)this.finish(blob,'jpg');else this.status.textContent='Photo failed. Please try again.';photo.width=photo.height=0;},'image/jpeg',.92);}
  if(this.pendingRecord&&this.recorder){this.pendingRecord=false;this.drawScene(this.context!);this.recordPoster=this.recordingCanvas!.toDataURL('image/jpeg',.7);this.recorder.start(1000);this.started=now;this.timer=window.setTimeout(()=>this.stop(),60000);}
  if(this.recorder?.state==='recording'&&now-this.drawn>=1000/24){this.drawn=now;this.drawScene(this.context!);this.status.textContent='● Recording '+Math.floor((now-this.started)/1000)+' / 60s · game sound';if(now-this.started>=60000)this.stop();}
 }
 toggleRecording(){if(this.recorder)this.stop();else this.start();}
 private start(){
  if(!this.active||this.recorder)return;
  if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream){this.status.textContent='Video recording is unavailable in this browser. Photos still work.';return;}
  try{
   const stage=this.recordingCanvas=document.createElement('canvas'),f=this.frame(),scale=Math.min(1,1280/f.w,720/f.h);
   stage.width=Math.max(2,Math.floor(f.w*scale/2)*2);stage.height=Math.max(2,Math.floor(f.h*scale/2)*2);this.context=stage.getContext('2d',{alpha:false})!;this.drawScene(this.context);
   const stream=this.stream=stage.captureStream(24),sound=this.audio();if(sound){sound.stream.getAudioTracks().forEach(t=>stream.addTrack(t));this.audioRelease=sound.release;}
   const mimeType=clipMime(s=>MediaRecorder.isTypeSupported(s));this.recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:3000000,audioBitsPerSecond:96000});this.chunks=[];this.bytes=0;this.started=performance.now();
   const recorder=this.recorder;recorder.ondataavailable=e=>{if(e.data.size){this.chunks.push(e.data);this.bytes+=e.data.size;if(this.bytes>=24*1024*1024)this.stop();}};
   recorder.onstop=()=>{const blob=new Blob(this.chunks,{type:recorder.mimeType});this.chunks=[];this.cleanRecording();if(blob.size)this.finish(blob,blob.type.includes('mp4')?'mp4':'webm');};
   recorder.onerror=()=>{this.stop();this.status.textContent='Recording stopped. You can retry or take a photo.';};
   this.pendingRecord=true;this.record.textContent='Stop recording';this.record.setAttribute('aria-pressed','true');
  }catch(error){this.cleanRecording();this.status.textContent='Video unavailable: '+(error as Error).message;}
 }
 stop(){if(this.recorder?.state==='recording')this.recorder.stop();else if(this.pendingRecord){this.pendingRecord=false;this.cleanRecording();}clearTimeout(this.timer);}
 private cleanRecording(){clearTimeout(this.timer);this.stream?.getTracks().forEach(t=>t.stop());this.audioRelease?.();this.audioRelease=undefined;this.stream=undefined;this.recorder=undefined;if(this.recordingCanvas)this.recordingCanvas.width=this.recordingCanvas.height=0;this.recordingCanvas=undefined;this.context=undefined;this.record.textContent='Record';this.record.setAttribute('aria-pressed','false');}
 private finish(blob:Blob,extension:string){if(this.url)URL.revokeObjectURL(this.url);this.poster=extension==='jpg'?'':this.recordPoster;this.file=new File([blob],'Static-Royale-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+extension,{type:blob.type});this.url=URL.createObjectURL(this.file);this.save.href=this.url;this.save.download=this.file.name;this.save.hidden=this.share.hidden=this.review.hidden=false;this.status.textContent=(extension==='jpg'?'Photo':'Video')+' ready · Save or Share before taking another';this.root.dataset.captureType=blob.type;this.root.dataset.captureBytes=String(blob.size);}
 private async shareFile(){if(!this.file)return;if(!navigator.canShare?.({files:[this.file]})){this.status.textContent='Tap Save, then upload the file in your social app.';return;}try{await navigator.share({title:'Static Royale',files:[this.file]});this.status.textContent='Shared.';}catch(error){if((error as Error).name!=='AbortError')this.status.textContent='Share unavailable. Tap Save to keep your capture.';}}
 private showReview(){if(!this.file)return;const item=document.createElement(this.file.type.startsWith('video/')?'video':'img');item.src=this.url;if(item instanceof HTMLVideoElement){item.controls=true;item.playsInline=true;item.poster=this.poster;}else item.alt='Your in-game photo';this.media.replaceChildren(item);this.preview.showModal();}
 get reviewing(){return this.preview.open;}
 dispose(){this.stop();if(this.recorder)this.recorder.onstop=null;this.cleanRecording();if(this.url)URL.revokeObjectURL(this.url);document.body.classList.remove('royale-camera-mode','royale-viewfinder');this.lcd.remove();this.root.remove();this.preview.remove();}
}
