import './photography.css';
import {captureRect,boundedZoom,shutterDelay} from './photoMath.ts';

export const clipMime=(supports:(s:string)=>boolean)=>['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(supports)??'';

export type PhotoCaptureFrame=Readonly<{x:number;y:number;width:number;height:number;canvasWidth:number;canvasHeight:number;capturedAt:number}>;
export type PhotoObserver<Snapshot>={snapshot:(frame:PhotoCaptureFrame)=>Snapshot;complete:(blob:Blob,snapshot:Snapshot,frame:PhotoCaptureFrame)=>void};

/** Observers return plain, structured-cloneable metadata, never live scene objects. */
function freezePhotoSnapshot<Snapshot>(value:Snapshot):Snapshot {
 const snapshot=structuredClone(value),seen=new WeakSet<object>();
 const freeze=(item:unknown)=>{if(!item||typeof item!=='object'||seen.has(item))return;seen.add(item);for(const child of Object.values(item))freeze(child);Object.freeze(item);};
 freeze(snapshot);return snapshot;
}

/** One bounded local capture at a time; no uploads, voice recording or device permissions. */
export class CameraCapture {
 private rideCapture=false;private heroButton=document.createElement('button');private clipBar=document.createElement('div');
 viewfinder=true;zoom=1;exposure=0;private delay=0;private shutterAt=0;
 private zoomInput=document.createElement('input');private zoomReadout=document.createElement('output');private grid=document.createElement('div');private gridOn=false;
 private finderButton=document.createElement('button');
 private lcd=document.createElement('div');private lcdInfo=document.createElement('span');
 private layoutAt=0;
 get finder(){return this.active&&this.viewfinder;}
 active=false;private available=false;private pendingPhoto=false;private pendingRecord=false;private shutterHeld=false;
 private recorder?:MediaRecorder;private stream?:MediaStream;private audioRelease?:()=>void;
 private recordingCanvas?:HTMLCanvasElement;private context?:CanvasRenderingContext2D;
 private chunks:Blob[]=[];private bytes=0;private started=0;private drawn=0;private file?:File;private url='';private timer=0;private recordPoster='';private poster='';
 private root=document.createElement('section');private toggle=document.createElement('button');
 readonly panel=document.createElement('div');private photo=document.createElement('button');private record=document.createElement('button');
 private save=document.createElement('a');private share=document.createElement('button');private review=document.createElement('button');private status=document.createElement('span');
 private preview=document.createElement('dialog');private media=document.createElement('div');
 private disposed=false;
 private photoObservers=new Set<(frame:PhotoCaptureFrame)=>(blob:Blob)=>void>();
 /** Snapshot runs synchronously after rendering; complete runs only for a successful still image. */
 observePhotos<Snapshot>(observer:PhotoObserver<Snapshot>):()=>void {
  const prepare=(frame:PhotoCaptureFrame)=>{const snapshot=freezePhotoSnapshot(observer.snapshot(frame));return(blob:Blob)=>{if(!this.disposed&&this.photoObservers.has(prepare))observer.complete(blob,snapshot,frame);};};
  if(!this.disposed)this.photoObservers.add(prepare);
  return()=>{this.photoObservers.delete(prepare);};
 }
 constructor(private canvas:HTMLCanvasElement,private changed:()=>void,private audio:()=>{stream:MediaStream;release:()=>void}|undefined){
  this.root.id='camera-capture';this.root.hidden=true;this.root.setAttribute('aria-label','Camera · P');
  this.toggle.type='button';this.toggle.textContent='Take photos · P';this.toggle.setAttribute('aria-pressed','false');this.toggle.onclick=()=>this.setActive(!this.active);
  this.panel.className='capture-panel';this.panel.hidden=true;
  this.finderButton.type='button';this.finderButton.textContent='Viewfinder';this.finderButton.setAttribute('aria-pressed','false');
  this.finderButton.onclick=()=>{this.viewfinder=!this.viewfinder;this.finderButton.setAttribute('aria-pressed',String(this.viewfinder));this.syncFinder();this.canvas.focus();};
  this.lcd.id='camera-viewfinder';this.lcd.hidden=true;this.lcd.setAttribute('aria-hidden','true');
  const brand=document.createElement('strong');brand.textContent='STATIC / FIELD CAMERA';this.lcdInfo.className='lcd-info';const focus=document.createElement('i');focus.className='lcd-focus';this.lcd.append(brand,this.lcdInfo,focus);document.body.append(this.lcd);
  const zoomLabel=document.createElement('label');zoomLabel.className='capture-zoom';zoomLabel.textContent='ZOOM';this.zoomInput.type='range';this.zoomInput.min='1';this.zoomInput.max='4';this.zoomInput.step='.05';this.zoomInput.value='1';this.zoomInput.setAttribute('aria-label','Camera zoom');this.zoomReadout.textContent='1.00×';this.zoomInput.oninput=()=>this.setZoom(Number(this.zoomInput.value));zoomLabel.append(this.zoomInput,this.zoomReadout);
  this.panel.append(this.finderButton,zoomLabel);
  const options=document.createElement('details');options.className='capture-options';const summary=document.createElement('summary');summary.textContent='Camera settings';const controls=document.createElement('div');
  const exposureLabel=document.createElement('label');exposureLabel.textContent='EXPOSURE';const ev=document.createElement('input'),evValue=document.createElement('output');ev.type='range';ev.min='-2';ev.max='2';ev.step='.25';ev.value='0';ev.setAttribute('aria-label','Exposure compensation');evValue.textContent='0 EV';ev.oninput=()=>{this.exposure=Number(ev.value);evValue.textContent=(this.exposure>0?'+':'')+this.exposure.toFixed(2)+' EV';};exposureLabel.append(ev,evValue);
  const timerLabel=document.createElement('label');timerLabel.textContent='SELF TIMER';const timerChoice=document.createElement('select');timerChoice.setAttribute('aria-label','Photo self timer');for(const [v,t]of [['0','Off'],['3','3 seconds'],['10','10 seconds']])timerChoice.add(new Option(t,v));timerChoice.onchange=()=>{this.delay=shutterDelay(Number(timerChoice.value));this.cancelShutter();};timerLabel.append(timerChoice);
  const gridButton=document.createElement('button');gridButton.type='button';gridButton.textContent='Thirds grid';gridButton.setAttribute('aria-pressed','false');gridButton.onclick=()=>{this.gridOn=!this.gridOn;gridButton.setAttribute('aria-pressed',String(this.gridOn));this.syncFinder();};controls.append(exposureLabel,timerLabel,gridButton);options.append(summary,controls);this.panel.append(options);
  this.grid.id='camera-thirds-grid';this.grid.hidden=true;this.grid.setAttribute('aria-hidden','true');document.body.append(this.grid);
  this.canvas.addEventListener('wheel',e=>{if(!this.active)return;e.preventDefault();this.setZoom(this.zoom+(e.deltaY<0?.1:-.1));},{passive:false});
  this.photo.type=this.record.type=this.share.type=this.review.type='button';
  this.photo.textContent='Photo';this.photo.onclick=()=>this.shutter();this.record.textContent='Record';this.record.onclick=()=>this.toggleRecording();
  this.save.textContent='Save';this.save.className='capture-save';this.share.textContent='Share';this.share.onclick=()=>void this.shareFile();
  this.review.textContent='Review';this.review.onclick=()=>this.showReview();this.status.setAttribute('role','status');this.status.textContent='Photos + 60-second clips · game sound only';
  this.save.hidden=this.share.hidden=this.review.hidden=true;this.panel.append(this.photo,this.record,this.save,this.share,this.review,this.status);this.heroButton.id='hero-cam-record';this.heroButton.type='button';this.heroButton.textContent='Hero-Cam · O';this.heroButton.title='Record while riding or flying';this.heroButton.onclick=()=>this.toggleHero();this.clipBar.className='hero-clip-bar';this.root.append(this.toggle,this.heroButton,this.panel,this.clipBar);document.body.append(this.root);
  this.preview.className='capture-preview';const close=document.createElement('button');close.textContent='Back to game';close.onclick=()=>this.preview.close();this.preview.append(this.media,close);document.body.append(this.preview);
  this.preview.addEventListener('close',()=>{this.media.replaceChildren();this.canvas.focus();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.cancelShutter();this.stop();}});window.addEventListener('blur',()=>this.cancelShutter());
 }
 private syncFinder(){this.finderButton.setAttribute('aria-pressed',String(this.viewfinder));this.lcd.hidden=!this.finder;document.body.classList.toggle('royale-viewfinder',this.finder);this.grid.hidden=!this.active||!this.gridOn||this.finder;this.lcd.classList.toggle('thirds-grid',this.gridOn);this.layoutAt=0;this.layoutFinder(performance.now()+300);}
 private layoutFinder(now:number){
  if(now-this.layoutAt<250)return;this.layoutAt=now;
  const f=captureRect(innerWidth,innerHeight);this.lcd.style.inset='auto';Object.assign(this.lcd.style,{left:f.x+'px',top:f.y+'px',width:f.w+'px',height:f.h+'px'});
 }
 frame(){if(!this.finder)return {x:0,y:0,w:this.canvas.width,h:this.canvas.height};const r=this.lcd.getBoundingClientRect(),border=parseFloat(getComputedStyle(this.lcd).borderLeftWidth)||0,c=this.canvas.getBoundingClientRect(),sx=this.canvas.width/c.width,sy=this.canvas.height/c.height;return{x:Math.max(0,Math.round((r.left+border-c.left)*sx)),y:Math.max(0,Math.round((r.top+border-c.top)*sy)),w:Math.max(2,Math.round((r.width-border*2)*sx)),h:Math.max(2,Math.round((r.height-border*2)*sy))};}
 private drawScene(context:CanvasRenderingContext2D,f=this.frame()){context.drawImage(this.canvas,f.x,f.y,f.w,f.h,0,0,context.canvas.width,context.canvas.height);}
 setZoom(value:number){this.zoom=boundedZoom(value);this.zoomInput.value=String(this.zoom);this.zoomReadout.textContent=this.zoom.toFixed(2)+'×';}
 private cancelShutter(){if(this.shutterAt)this.status.textContent='Photo timer cancelled';this.shutterAt=0;}
 setActive(value:boolean){this.cancelShutter();this.active=value&&this.available;document.body.classList.toggle('royale-camera-mode',this.active);this.syncFinder();this.shutterHeld=false;this.pendingPhoto=false;if(!this.active&&!this.rideCapture)this.stop();this.toggle.textContent=this.active?'Put camera away · P':'Take photos · P';this.toggle.setAttribute('aria-pressed',String(this.active));this.panel.hidden=!this.active;this.changed();this.canvas.focus();}
 update(available:boolean){this.available=available;this.root.hidden=!available;if(!available){if(this.active)this.setActive(false);this.stop();}}
 trigger(pressed:boolean){if(pressed&&!this.shutterHeld)this.shutter();this.shutterHeld=pressed;}
 shutter(){if(!this.active||this.pendingPhoto||this.shutterAt)return;if(this.delay){this.shutterAt=performance.now()+this.delay;this.status.textContent='Photo in '+this.delay/1000+'s';}else{this.pendingPhoto=true;this.status.textContent='Taking photo…';}}
 /** Called immediately after the WebGL render, before the drawing buffer is cleared. */
 afterRender(now:number){
  if(this.disposed)return;
  if(this.shutterAt){if(now>=this.shutterAt){this.shutterAt=0;this.pendingPhoto=true;}else this.status.textContent='Photo in '+Math.ceil((this.shutterAt-now)/1000)+'s';}
  if(this.finder){this.layoutFinder(now);const f=this.frame();this.lcdInfo.textContent=(this.recorder?.state==='recording'?'● REC '+Math.floor((now-this.started)/1000)+'s':'LIVE')+' · '+this.zoom+'× · '+f.w+' × '+f.h;this.canvas.dataset.viewfinder='lcd';}else delete this.canvas.dataset.viewfinder;
  if(this.pendingPhoto){
   this.pendingPhoto=false;const photo=document.createElement('canvas'),f=this.frame();photo.width=f.w;photo.height=f.h;
   try{
    const context=photo.getContext('2d');if(!context)throw new Error('Photo canvas unavailable');
    this.drawScene(context,f);
    const frame:PhotoCaptureFrame=Object.freeze({x:f.x,y:f.y,width:f.w,height:f.h,canvasWidth:this.canvas.width,canvasHeight:this.canvas.height,capturedAt:now});
    const completions:((blob:Blob)=>void)[]=[];
    for(const prepare of this.photoObservers){try{completions.push(prepare(frame));}catch{/* A scoring failure must not prevent saving the photo. */}}
    photo.toBlob(blob=>{
     try{
      if(this.disposed)return;
      if(blob&&blob.size){this.finish(blob,'jpg');for(const complete of completions){try{complete(blob);}catch{/* Keep the capture available if an observer fails. */}}}
      else this.status.textContent='Photo failed. Please try again.';
     }finally{photo.width=photo.height=0;}
    },'image/jpeg',.92);
   }catch{photo.width=photo.height=0;this.status.textContent='Photo failed. Please try again.';}
  }
  if(this.pendingRecord&&this.recorder){this.pendingRecord=false;this.drawScene(this.context!);this.recordPoster=this.recordingCanvas!.toDataURL('image/jpeg',.7);this.recorder.start(1000);this.started=now;this.timer=window.setTimeout(()=>this.stop(),60000);}
  if(this.recorder?.state==='recording'&&now-this.drawn>=1000/24){this.drawn=now;this.drawScene(this.context!);this.status.textContent='● Recording '+Math.floor((now-this.started)/1000)+' / 60s · game sound';if(now-this.started>=60000)this.stop();}
 }
 toggleHero(){if(!this.available)return;if(this.recorder){this.stop();return;}if(this.active)this.setActive(false);this.rideCapture=true;this.start();this.canvas.focus();}
 toggleRecording(){if(this.recorder)this.stop();else this.start();}
 private start(){
  if((!this.active&&!this.rideCapture)||this.recorder)return;
  if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream){this.status.textContent='Video recording is unavailable in this browser. Photos still work.';return;}
  try{
   const stage=this.recordingCanvas=document.createElement('canvas'),f=this.frame(),scale=Math.min(1,1280/f.w,720/f.h);
   stage.width=Math.max(2,Math.floor(f.w*scale/2)*2);stage.height=Math.max(2,Math.floor(f.h*scale/2)*2);this.context=stage.getContext('2d',{alpha:false})!;this.drawScene(this.context);
   const stream=this.stream=stage.captureStream(24),sound=this.audio();if(sound){sound.stream.getAudioTracks().forEach(t=>stream.addTrack(t));this.audioRelease=sound.release;}
   const mimeType=clipMime(s=>MediaRecorder.isTypeSupported(s));this.recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:3000000,audioBitsPerSecond:96000});this.chunks=[];this.bytes=0;this.started=performance.now();
   const recorder=this.recorder;recorder.ondataavailable=e=>{if(e.data.size){this.chunks.push(e.data);this.bytes+=e.data.size;if(this.bytes>=24*1024*1024)this.stop();}};
   recorder.onstop=()=>{const blob=new Blob(this.chunks,{type:recorder.mimeType});this.chunks=[];this.cleanRecording();if(blob.size)this.finish(blob,blob.type.includes('mp4')?'mp4':'webm');};
   recorder.onerror=()=>{this.stop();this.status.textContent='Recording stopped. You can retry or take a photo.';};
   this.heroButton.textContent='● Stop Hero-Cam · O';this.heroButton.setAttribute('aria-pressed','true');this.clipBar.append(this.status);this.pendingRecord=true;this.record.textContent='Stop recording';this.record.setAttribute('aria-pressed','true');
  }catch(error){this.cleanRecording();this.status.textContent='Video unavailable: '+(error as Error).message;}
 }
 stop(){if(this.recorder?.state==='recording')this.recorder.stop();else if(this.pendingRecord){this.pendingRecord=false;this.cleanRecording();}clearTimeout(this.timer);}
 private cleanRecording(){clearTimeout(this.timer);this.stream?.getTracks().forEach(t=>t.stop());this.audioRelease?.();this.audioRelease=undefined;this.stream=undefined;this.recorder=undefined;if(this.recordingCanvas)this.recordingCanvas.width=this.recordingCanvas.height=0;this.recordingCanvas=undefined;this.context=undefined;this.rideCapture=false;this.heroButton.textContent='Hero-Cam · O';this.heroButton.setAttribute('aria-pressed','false');this.record.textContent='Record';this.record.setAttribute('aria-pressed','false');}
 private finish(blob:Blob,extension:string){if(this.url)URL.revokeObjectURL(this.url);this.poster=extension==='jpg'?'':this.recordPoster;this.file=new File([blob],'Belle-Isle-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+extension,{type:blob.type});this.url=URL.createObjectURL(this.file);this.save.href=this.url;this.save.download=this.file.name;this.save.hidden=this.share.hidden=this.review.hidden=false;this.status.textContent=(extension==='jpg'?'Photo':'Video')+' ready · Save to keep this replay';this.clipBar.append(this.save,this.review,this.share,this.status);this.root.dataset.captureType=blob.type;this.root.dataset.captureBytes=String(blob.size);}
 private async shareFile(){if(!this.file)return;if(!navigator.canShare?.({files:[this.file]})){this.status.textContent='Tap Save, then upload the file in your social app.';return;}try{await navigator.share({title:'Belle Isle Explorer',files:[this.file]});this.status.textContent='Shared.';}catch(error){if((error as Error).name!=='AbortError')this.status.textContent='Share unavailable. Tap Save to keep your capture.';}}
 private showReview(){if(!this.file)return;const item=document.createElement(this.file.type.startsWith('video/')?'video':'img');item.src=this.url;if(item instanceof HTMLVideoElement){item.controls=true;item.playsInline=true;item.poster=this.poster;}else item.alt='Your in-game photo';this.media.replaceChildren(item);this.changed();this.preview.showModal();}
 get reviewing(){return this.preview.open;}
 dispose(){this.disposed=true;this.photoObservers.clear();this.stop();if(this.recorder)this.recorder.onstop=null;this.cleanRecording();if(this.url)URL.revokeObjectURL(this.url);document.body.classList.remove('royale-camera-mode','royale-viewfinder');this.cancelShutter();this.grid.remove();this.lcd.remove();this.root.remove();this.preview.remove();}
}
