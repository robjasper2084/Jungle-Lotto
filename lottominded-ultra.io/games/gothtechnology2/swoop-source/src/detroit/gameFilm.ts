import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {FilmBlocking} from './filmBlocking.ts';
import './gameFilm.css';
import {saveFilm,savedFilms} from './savedFilms.ts';
export type FilmActor={root:T.Object3D;body?:T.Object3D};
type Frame={t:number;values:Float32Array};
/** Bounded in-memory animation recording, independent of live physics and scoring. */
export class GameFilm{
 readonly panel=document.createElement('section');
 readonly toolbar=document.createElement('div');private replayBar=document.createElement('section');
 private recordButtons:HTMLButtonElement[]=[];private watchButtons:HTMLButtonElement[]=[];private notes:HTMLElement[]=[];
 private slider=document.createElement('input');private cameraMode=document.createElement('select');private speed=document.createElement('select');private subject=document.createElement('select');private playButton=document.createElement('button');private exportButton=document.createElement('button');private download=document.createElement('a');
 private frames:Frame[]=[];private sources:T.Object3D[]=[];private nodes:T.Object3D[]=[];private ghosts:T.Object3D[]=[];private roots:FilmActor[]=[];private group=new T.Group();private fullBody=new Set<number>();
 private recording=false;playing=false;private frozen=false;private elapsed=0;private next=0;private time=0;private limit=1800;private uiAt=0;private available=false;private recorder?:MediaRecorder;private stream?:MediaStream;private videoUrl='';
 private focus=new T.Vector3();private direction=new T.Vector3();private qa=new T.Quaternion();private qb=new T.Quaternion();private wanted=new T.Vector3();
 private getActors:()=>FilmActor[];private pauseRide:()=>void;private canvas:HTMLCanvasElement;private title:string;
 private blocking:FilmBlocking;
 private library:ReturnType<typeof savedFilms>;
 constructor(title:string,canvas:HTMLCanvasElement,getActors:()=>FilmActor[],pause:()=>void){
  this.title=title;this.canvas=canvas;this.getActors=getActors;this.pauseRide=pause;this.group.name=title+' cinematic replay';
  this.panel.className='game-film-settings';this.panel.innerHTML='<h3>Gameplay recording</h3><p>Record up to two minutes of your riders and companions, then replay with orbit, drone, side or chase cameras. Unrendered recording stays in this tab. Download a replay video to save it to your device and browser library. The latest recording replaces the previous one; scenery and bystanders are not rewound.</p>';
  this.library=savedFilms(title);this.panel.append(this.library.section);
  this.toolbar.className='game-film-toolbar';this.toolbar.setAttribute('aria-label','Gameplay recording');this.toolbar.hidden=true;
  for(const container of [this.panel,this.toolbar]){const row=document.createElement('div');row.className='film-actions';const record=document.createElement('button'),watch=document.createElement('button');record.textContent='Record ride';watch.textContent='Cinematic replay';record.onclick=()=>this.recording?this.stopRecording():this.startRecording();watch.onclick=()=>this.startReplay();row.append(record,watch);const note=document.createElement('span');note.setAttribute('role','status');container.append(row,note);this.recordButtons.push(record);this.watchButtons.push(watch);this.notes.push(note);}
  document.body.append(this.toolbar);this.replayBar.className='game-film-replay';this.replayBar.hidden=true;this.replayBar.setAttribute('aria-label','Cinematic playback');
  const heading=document.createElement('strong');heading.textContent='CINEMATIC REPLAY';
  for(const [value,label]of [['auto','Cinematic cuts'],['orbit','Orbit'],['drone','Drone follow'],['side','Side tracking'],['chase','Chase']])this.cameraMode.add(new Option(label,value));this.cameraMode.setAttribute('aria-label','Replay camera');
  for(const v of [.5,1,1.5])this.speed.add(new Option(v+'×',String(v)));this.speed.value='1';this.speed.setAttribute('aria-label','Replay speed');
  this.subject.setAttribute('aria-label','Replay subject');this.subject.add(new Option('Rider 1','0'));
  this.slider.type='range';this.slider.min='0';this.slider.max='0';this.slider.step='.01';this.slider.setAttribute('aria-label','Replay timeline');this.slider.oninput=()=>{this.time=Number(this.slider.value);};
  this.playButton.textContent='Pause replay';this.playButton.onclick=()=>{this.frozen=!this.frozen;if(!this.frozen&&this.time>=this.duration)this.time=0;this.sync();};
  const exit=document.createElement('button');exit.textContent='Back to ride';exit.onclick=()=>this.stopReplay();
  this.exportButton.textContent='Download replay video · silent';this.exportButton.onclick=()=>this.exportVideo();this.download.textContent='Download video';this.download.hidden=true;
  const row=document.createElement('div');row.className='film-actions';row.append(this.playButton,this.cameraMode,this.subject,this.speed,this.exportButton,this.download,exit);this.replayBar.append(heading,this.slider,row);
  this.blocking=new FilmBlocking(title,canvas,()=>({duration:this.duration,camera:this.cameraMode.value,subject:this.subject.selectedOptions[0]?.text??'Rider 1'}),shot=>{
   if(this.recorder?.state==='recording')throw Error('Wait for the current video export to finish.');
   const previous={time:this.time,speed:this.speed.value,frozen:this.frozen},controls=[this.slider,this.playButton,this.cameraMode,this.subject,this.speed,this.exportButton];
   for(const control of controls)control.disabled=true;this.time=shot.start;this.frozen=false;this.speed.value='1';
   return()=>{this.time=previous.time;this.speed.value=previous.speed;this.frozen=previous.frozen;for(const control of controls)control.disabled=false;this.sync();};
  });this.replayBar.append(this.blocking.panel);
  this.replayBar.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();this.stopReplay();}e.stopPropagation();});document.body.append(this.replayBar);this.sync();
 }
 get duration(){return this.frames.at(-1)?.t??0;}
 get position(){return this.focus;}
 private note(message:string){for(const n of this.notes)n.textContent=message;}
 private sync(){for(const b of this.recordButtons){b.textContent=this.recording?'Stop recording':'Record ride';b.disabled=this.playing||!this.available&&!this.recording;}for(const b of this.watchButtons)b.disabled=this.frames.length<2||this.playing;this.playButton.textContent=this.frozen?'Play replay':'Pause replay';this.slider.max=String(this.duration);}
 private startRecording(){
  if(!this.available)return;this.stopReplay();this.roots=this.getActors();if(!this.roots.length){this.note('Start a ride first.');return;}for(const ghost of this.ghosts)ghost.traverse(n=>{const mesh=n as T.SkinnedMesh;if(mesh.isSkinnedMesh)mesh.skeleton.dispose();});this.group.clear();this.sources=[];this.nodes=[];this.ghosts=[];this.fullBody.clear();this.frames=[];this.uiAt=0;
  for(const actor of this.roots){const ghost=clone(actor.root),original:T.Object3D[]=[],copies:T.Object3D[]=[];actor.root.traverse(n=>original.push(n));ghost.traverse(n=>copies.push(n));const offset=this.nodes.length;original.forEach((n,i)=>{if(n===actor.body||n===actor.root)this.fullBody.add(offset+i);});this.sources.push(...original);this.nodes.push(...copies);this.ghosts.push(ghost);this.group.add(ghost);}
  this.limit=Math.max(2,Math.min(1800,Math.floor(24*1024*1024/(this.nodes.length*8*4))));this.elapsed=this.next=this.time=0;this.recording=true;this.download.hidden=true;this.note('REC · resume riding to capture');this.sync();
 }
 private stopRecording(){this.recording=false;this.note(this.frames.length>1?`Clip ready · ${this.duration.toFixed(1)} s`:'Ride a little longer to create a clip.');this.sync();}
 capture(dt:number,active:boolean,available:boolean){
  if(this.available!==available){this.available=available;this.sync();}this.toolbar.hidden=!available||this.playing;
  if(!this.recording)return;if(!available){this.stopRecording();return;}if(!active)return;
  const current=this.getActors();if(current.length!==this.roots.length||current.some((a,i)=>a.root!==this.roots[i].root)){this.stopRecording();return;}
  this.elapsed+=dt;if(this.elapsed+1e-5<this.next)return;this.next=this.elapsed+1/15;
  const values=new Float32Array(this.nodes.length*8);this.sources.forEach((n,i)=>{const k=i*8;values.set([n.position.x,n.position.y,n.position.z,n.quaternion.x,n.quaternion.y,n.quaternion.z,n.quaternion.w,this.fullBody.has(i)||n.visible?1:0],k);});
  this.frames.push({t:this.frames.length?this.elapsed:0,values});this.slider.max=String(this.duration);this.canvas.dataset.recordedFrames=String(this.frames.length);
  if(this.frames.length>=this.limit||this.elapsed>=120){this.stopRecording();return;}if(this.elapsed-this.uiAt>.2){this.uiAt=this.elapsed;this.note('REC · '+this.elapsed.toFixed(1)+' s / '+Math.min(120,Math.floor(this.limit/15))+' s');}
 }
 private startReplay(){if(this.frames.length<2)return;this.stopRecording();this.pauseRide();this.playing=true;this.frozen=false;this.time=0;this.replayBar.hidden=false;this.toolbar.hidden=true;document.body.classList.add('cinematic-replaying');this.subject.replaceChildren(...this.roots.filter(a=>a.body).map((_,i)=>new Option('Rider '+(i+1),String(i))));if(!this.subject.options.length)this.subject.add(new Option('Rider 1','0'));this.blocking.setup(this.duration);this.sync();this.playButton.focus();}
 stopReplay(){this.blocking.abort();if(this.recorder?.state==='recording')this.recorder.stop();this.playing=false;this.group.removeFromParent();this.replayBar.hidden=true;document.body.classList.remove('cinematic-replaying');this.sync();this.canvas.focus();}
 render(dt:number,renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,prepare?:(focus:T.Vector3,wanted:T.Vector3)=>void){
  if(!this.playing)return false;if(this.blocking.busy)this.time=this.blocking.time;else if(!this.frozen)this.time=Math.min(this.duration,this.time+dt*Number(this.speed.value));
  let lo=0,hi=this.frames.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(this.frames[mid].t<=this.time)lo=mid;else hi=mid;}const a=this.frames[lo],b=this.frames[hi],u=T.MathUtils.clamp((this.time-a.t)/Math.max(.001,b.t-a.t),0,1);
  this.nodes.forEach((n,i)=>{const k=i*8,aa=a.values,bb=b.values;n.position.set(T.MathUtils.lerp(aa[k],bb[k],u),T.MathUtils.lerp(aa[k+1],bb[k+1],u),T.MathUtils.lerp(aa[k+2],bb[k+2],u));this.qa.set(aa[k+3],aa[k+4],aa[k+5],aa[k+6]);this.qb.set(bb[k+3],bb[k+4],bb[k+5],bb[k+6]);n.quaternion.copy(this.qa).slerp(this.qb,u);n.visible=(u<.5?aa:bb)[k+7]>0;});
  scene.add(this.group);this.group.updateMatrixWorld(true);const riders=this.roots.map((r,i)=>r.body?this.ghosts[i]:null).filter((r):r is T.Object3D=>!!r),subject=riders[Number(this.subject.value)]??this.ghosts[0];subject.getWorldPosition(this.focus);this.focus.y+=1;subject.getWorldDirection(this.direction);const yaw=Math.atan2(this.direction.x,this.direction.z);
  const modes=['chase','side','drone','orbit'],mode=this.cameraMode.value==='auto'?modes[Math.floor(this.time/6)%modes.length]:this.cameraMode.value,angle=mode==='orbit'?this.time*.22:mode==='side'?yaw+Math.PI/2:yaw+Math.PI;
  const distance=mode==='drone'?11:mode==='orbit'?6:5;this.wanted.set(this.focus.x+Math.sin(angle)*distance,this.focus.y+(mode==='drone'?8:mode==='orbit'?2.5:1.4),this.focus.z+Math.cos(angle)*distance);prepare?.(this.focus,this.wanted);camera.position.copy(this.wanted);camera.lookAt(this.focus);camera.fov=mode==='drone'?52:56;
  const ratio=this.blocking.captureAspect?.split(':').map(Number);camera.aspect=ratio?ratio[0]/ratio[1]:innerWidth/innerHeight;camera.updateProjectionMatrix();
  const width=Math.min(innerWidth,innerHeight*camera.aspect),height=width/camera.aspect,viewport={x:(innerWidth-width)/2,y:(innerHeight-height)/2,width,height};
  const originals=this.roots.map(r=>r.root.visible);this.roots.forEach(r=>r.root.visible=false);renderer.setScissorTest(false);renderer.setViewport(viewport.x,viewport.y,viewport.width,viewport.height);renderer.render(scene,camera);
  let rider=0,companion=0;this.blocking.frame(camera,this.ghosts.map((root,i)=>({root,name:this.roots[i].body?'Rider '+(++rider):'Companion '+(++companion)})),viewport,this.time);
  this.roots.forEach((r,i)=>r.root.visible=originals[i]);this.group.removeFromParent();
  this.slider.value=String(this.time);this.canvas.dataset.cinematicReplay=JSON.stringify({time:+this.time.toFixed(2),duration:this.duration,camera:mode,frames:this.frames.length});
  if(this.time>=this.duration){this.frozen=true;if(this.recorder?.state==='recording')this.recorder.stop();this.sync();}return true;
 }
 private exportVideo(){
  if(typeof MediaRecorder==='undefined'||!this.canvas.captureStream){this.note('Video export is unavailable in this browser; cinematic replay still works.');this.exportButton.textContent='Video unavailable';return;}
  if(this.recorder?.state==='recording')return;
  try{const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error();this.stream=this.canvas.captureStream(30);const recorder=new MediaRecorder(this.stream,{mimeType:type,videoBitsPerSecond:5_000_000}),chunks:Blob[]=[];this.recorder=recorder;this.exportButton.disabled=true;this.exportButton.textContent='Rendering video…';this.download.hidden=true;let bytes=0;
   recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>100*1024*1024&&recorder.state==='recording')recorder.stop();}};
   recorder.onstop=()=>{this.stream?.getTracks().forEach(t=>t.stop());if(this.videoUrl)URL.revokeObjectURL(this.videoUrl);const blob=new Blob(chunks,{type});this.videoUrl=URL.createObjectURL(blob);this.download.href=this.videoUrl;this.download.download=this.title.toLowerCase().replaceAll(' ','-')+'-cinematic.'+(type.includes('mp4')?'mp4':'webm');this.download.hidden=!blob.size;if(blob.size){this.download.click();void saveFilm(this.title,this.download.download,blob).then(()=>this.library.refresh()).catch(()=>this.note('Video ready to download; browser storage is full or unavailable.'));}this.exportButton.disabled=false;this.exportButton.textContent='Download replay video · silent';};
   recorder.onerror=()=>{this.stream?.getTracks().forEach(t=>t.stop());this.exportButton.disabled=false;this.exportButton.textContent='Video export failed';};this.time=0;this.frozen=false;this.speed.value='1';recorder.start(1000);this.sync();
  }catch{this.stream?.getTracks().forEach(t=>t.stop());this.exportButton.disabled=false;this.exportButton.textContent='Video unavailable';}
 }
}
