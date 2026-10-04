import * as T from 'three';
import {localFootageButton} from './localFootage.ts';
import {blockingFiles,blockingMime,blockingSize,validateShot,type BlockingShot,type BlockingSample} from './blockingPack.ts';

type Actor={name:string;root:T.Object3D};
type Job={shot:BlockingShot;out:HTMLCanvasElement;ctx:CanvasRenderingContext2D;recorder:MediaRecorder;stream:MediaStream;chunks:Blob[];bytes:number;started:number;ending:boolean;samples:BlockingSample[];images:{file:string;time:number;promise:Promise<Blob>}[];restore:()=>void;mime:string;cancelled:boolean};
/** A local, bounded reference export. No account, upload or generation call. */
export class FilmBlocking{
 readonly panel=document.createElement('details');
 private start=document.createElement('input');private end=document.createElement('input');private aspect=document.createElement('select');private style=document.createElement('select');private notes=document.createElement('textarea');private make=document.createElement('button');private cancel=document.createElement('button');private download=document.createElement('a');private status=document.createElement('p');private url='';private job?:Job;
 private preview=document.createElement('details');private video=document.createElement('video');private stills=document.createElement('div');private previewUrls:string[]=[];
 private game:string;private canvas:HTMLCanvasElement;private getClip:()=>{duration:number;camera:string;subject:string};private begin:(shot:BlockingShot)=>()=>void;
 private completedVideo?:Blob;
 constructor(game:string,canvas:HTMLCanvasElement,getClip:()=>{duration:number;camera:string;subject:string},begin:(shot:BlockingShot)=>()=>void){
  this.game=game;this.canvas=canvas;this.getClip=getClip;this.begin=begin;
  this.panel.className='film-blocking';const summary=document.createElement('summary');summary.textContent='Blocking video / Higgsfield files';this.panel.append(summary);
  const intro=document.createElement('p');intro.textContent='Export a 3–30 second shot with video, 3 reference images, camera/actor data and a prompt. Files stay on your device. No Higgsfield credits used.';this.panel.append(intro);
  const fields=document.createElement('div');fields.className='film-blocking-fields';
  const field=(text:string,control:HTMLElement)=>{const label=document.createElement('label');label.append(document.createTextNode(text),control);fields.append(label);};
  for(const input of [this.start,this.end]){input.type='number';input.min='0';input.step='.1';input.inputMode='decimal';}field('Shot start (seconds)',this.start);field('Shot end (seconds)',this.end);
  for(const [value,label]of [['16:9','Landscape · 16:9'],['9:16','Portrait · 9:16'],['1:1','Square · 1:1']])this.aspect.add(new Option(label,value));field('Export framing',this.aspect);
  this.style.add(new Option('Clean reference · recommended','clean'));this.style.add(new Option('Blocking guide · labels + time','guide'));field('Video style',this.style);
  this.notes.rows=2;this.notes.maxLength=1800;this.notes.placeholder='Lighting, mood, action or details to preserve';field('Creative direction',this.notes);this.panel.append(fields);
  const actions=document.createElement('div');actions.className='film-actions';this.make.textContent='Create Higgsfield pack';this.cancel.textContent='Cancel export';this.cancel.hidden=true;this.download.textContent='Download blocking pack (.zip)';this.download.hidden=true;actions.append(this.make,this.cancel,this.download);this.panel.append(actions,this.status);this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
  this.preview.className='film-blocking-preview';this.preview.hidden=true;const previewTitle=document.createElement('summary');previewTitle.textContent='Preview video and reference images';this.video.controls=true;this.video.playsInline=true;this.video.muted=true;this.video.preload='metadata';this.video.setAttribute('aria-label','Blocking video preview');this.stills.className='film-blocking-stills';this.preview.append(previewTitle,this.video,this.stills);this.panel.append(this.preview);
  this.make.onclick=()=>this.create();this.cancel.onclick=()=>this.abort('Export cancelled. Your replay is unchanged.');
  actions.append(localFootageButton(()=>this.completedVideo,this.status));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.job)this.abort('Export cancelled because the tab was hidden. Keep the game visible while exporting.');});
  canvas.addEventListener('webglcontextlost',()=>this.abort('Graphics context lost. Restore the game before exporting again.'));
 }
 get busy(){return !!this.job;}
 get time(){const j=this.job;if(!j)return 0;return Math.min(j.shot.end,j.shot.start+(j.started?(performance.now()-j.started)/1000:0));}
 get captureAspect(){return this.job?.shot.aspect;}
 setup(duration:number){this.start.value='0';this.end.value=String(Math.min(6,duration));this.start.max=this.end.max=String(duration);this.make.disabled=duration<3;if(duration<3)this.status.textContent='Record at least 3 seconds to create a blocking shot.';else if(!this.url)this.status.textContent='Choose the replay camera above, then set your shot range.';}
 private lock(locked:boolean){for(const c of [this.start,this.end,this.aspect,this.style,this.notes,this.make])c.disabled=locked;this.cancel.hidden=!locked;}
 private create(){
  if(this.job)return;let restore:(()=>void)|undefined,pendingStream:MediaStream|undefined;
  try{
   const clip=this.getClip(),shot:BlockingShot={start:Number(this.start.value),end:Number(this.end.value),aspect:this.aspect.value as BlockingShot['aspect'],guides:this.style.value==='guide',notes:this.notes.value,camera:clip.camera,subject:clip.subject};validateShot(shot,clip.duration);
   if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream)throw Error('This browser cannot export video. Try a current Chrome, Edge or Safari browser.');
   const mime=blockingMime(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('No supported video encoder. Try another browser.');
   const out=document.createElement('canvas');Object.assign(out,blockingSize(shot.aspect));const ctx=out.getContext('2d',{alpha:false});if(!ctx)throw Error('Video canvas could not be created.');
   const stream=pendingStream=out.captureStream(30);let recorder:MediaRecorder;try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4_000_000});}catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
   restore=this.begin(shot);const j:Job={shot,out,ctx,recorder,stream,chunks:[],bytes:0,started:0,ending:false,samples:[],images:[],restore,mime,cancelled:false};this.job=j;this.lock(true);this.download.hidden=true;this.status.textContent='Rendering blocking shot… keep this tab visible.';
   recorder.ondataavailable=e=>{if(!e.data.size||j.cancelled)return;j.bytes+=e.data.size;if(j.bytes>40*1024*1024){this.abort('Export exceeded the mobile memory budget. Choose a shorter shot.');return;}j.chunks.push(e.data);};
   recorder.onerror=()=>this.abort('Video encoder failed. Try a shorter shot or another browser.');
   recorder.onstop=()=>{j.stream.getTracks().forEach(t=>t.stop());if(!j.cancelled)void this.finish(j);};
  }catch(error){pendingStream?.getTracks().forEach(t=>t.stop());restore?.();this.lock(false);this.status.textContent=error instanceof Error?error.message:'Could not start blocking export.';}
 }
 /** Called immediately after WebGL renders, before its drawing buffer expires. */
 frame(camera:T.PerspectiveCamera,actors:Actor[],viewport:{x:number;y:number;width:number;height:number},sourceTime:number){
  const j=this.job;if(!j||j.ending)return;
  try{
   const sx=this.canvas.width/innerWidth,sy=this.canvas.height/innerHeight;
   j.ctx.drawImage(this.canvas,viewport.x*sx,(innerHeight-viewport.y-viewport.height)*sy,viewport.width*sx,viewport.height*sy,0,0,j.out.width,j.out.height);
   const elapsed=sourceTime-j.shot.start,length=j.shot.end-j.shot.start;
   // Stills are always clean, including when guide labels are requested.
   for(const [i,at]of [0,length/2,length].entries())if(elapsed>=at-.025&&!j.images.some(s=>s.file===`reference-${i+1}.jpg`)){
    const promise=new Promise<Blob>((resolve,reject)=>j.out.toBlob(b=>b?resolve(b):reject(Error('Reference image capture failed.')),'image/jpeg',.92));
    // Attach an immediate handler so an encoding failure never becomes an unhandled rejection.
    void promise.catch(()=>{});j.images.push({file:`reference-${i+1}.jpg`,time:+elapsed.toFixed(3),promise});
   }
   if(!j.samples.length||elapsed-j.samples.at(-1)!.time>=.095||sourceTime>=j.shot.end){
    const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),round=(values:number[])=>values.map(v=>+v.toFixed(5));
    j.samples.push({time:+elapsed.toFixed(3),sourceTime:+sourceTime.toFixed(3),camera:{position:round(camera.position.toArray()),quaternion:round(camera.quaternion.toArray()),fov:camera.fov,aspect:camera.aspect},actors:actors.map(a=>{a.root.updateWorldMatrix(true,false);a.root.matrixWorld.decompose(p,q,s);return{name:a.name,position:round(p.toArray()),quaternion:round(q.toArray()),scale:round(s.toArray())};})});
   }
   if(j.shot.guides){const c=j.ctx;c.font='bold 20px sans-serif';c.fillStyle='#101e20cc';c.fillRect(12,12,290,40);c.fillStyle='#fff';c.fillText(`BLOCKING  ${elapsed.toFixed(1)} / ${length.toFixed(1)} s`,24,39);for(const a of actors){const p=a.root.getWorldPosition(new T.Vector3());p.y+=1.8;p.project(camera);if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;const x=(p.x*.5+.5)*j.out.width,y=(-p.y*.5+.5)*j.out.height;c.fillStyle='#101e20cc';c.fillRect(x-8,y-22,c.measureText(a.name).width+16,30);c.fillStyle='#fff';c.fillText(a.name,x,y);}}
   if(!j.started){j.recorder.start(500);j.started=performance.now();}
   if(Math.floor(elapsed)!==Math.floor((j.samples.at(-2)?.time??-1)))this.status.textContent=`Rendering ${elapsed.toFixed(1)} / ${length.toFixed(1)} s…`;
   if(sourceTime>=j.shot.end){j.ending=true;this.status.textContent='Packaging video, reference images and motion files…';j.recorder.stop();}
  }catch(error){this.abort(error instanceof Error?error.message:'Blocking capture failed.');}
 }
 private async finish(j:Job){
  try{
   const video=new Blob(j.chunks,{type:j.mime});if(video.size<100)throw Error('Video encoder produced an empty file.');
   this.completedVideo=video;
   const name='blocking.'+(j.mime.includes('mp4')?'mp4':'webm'),{zipSync,strToU8}=await import('fflate');
   const files:Record<string,Uint8Array>={[name]:new Uint8Array(await video.arrayBuffer())},images:Blob[]=[];
   for(const still of j.images){const image=await still.promise;images.push(image);files[still.file]=new Uint8Array(await image.arrayBuffer());}
   for(const [file,text]of Object.entries(blockingFiles(this.game,j.shot,name,j.samples,j.images.map(({file,time})=>({file,time})))))files[file]=strToU8(text);
   if(j.cancelled)return;if(j.images.length!==3)throw Error('The shot missed a reference frame. Try the export again.');
   const archive=zipSync(files,{level:0}),blob=new Blob([archive as Uint8Array<ArrayBuffer>],{type:'application/zip'});if(this.url)URL.revokeObjectURL(this.url);this.url=URL.createObjectURL(blob);this.download.href=this.url;this.download.download=this.game.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-higgsfield-blocking.zip';this.download.hidden=false;
   this.video.pause();this.previewUrls.forEach(url=>URL.revokeObjectURL(url));this.previewUrls=[URL.createObjectURL(video),...images.map(image=>URL.createObjectURL(image))];this.video.src=this.previewUrls[0];this.stills.replaceChildren(...j.images.map((still,i)=>{const link=document.createElement('a'),img=document.createElement('img'),caption=document.createElement('span');link.href=this.previewUrls[i+1];link.download=still.file;img.src=link.href;img.alt=['Start reference','Middle reference','End reference'][i];caption.textContent=img.alt+' · JPG';link.append(img,caption);return link;}));this.preview.hidden=false;
   this.status.textContent=`Pack ready · ${(blob.size/1048576).toFixed(1)} MB · ${name.endsWith('.mp4')?'MP4':'WebM (MP4 conversion instructions included)'} + 3 JPGs + motion files. Download, unzip, then select your references in Higgsfield.`;
  }catch(error){if(!j.cancelled)this.status.textContent=error instanceof Error?error.message:'Could not package blocking files.';}
  finally{if(this.job===j){this.job=undefined;j.restore();this.lock(false);}j.chunks=[];j.samples=[];}
 }
 abort(message='Export cancelled. Your replay is unchanged.'){
  this.video.pause();
  const j=this.job;if(!j)return;j.cancelled=true;this.job=undefined;if(j.recorder.state!=='inactive')j.recorder.stop();j.stream.getTracks().forEach(t=>t.stop());j.restore();j.chunks=[];this.lock(false);this.download.hidden=!this.url;this.status.textContent=message;
 }
}
