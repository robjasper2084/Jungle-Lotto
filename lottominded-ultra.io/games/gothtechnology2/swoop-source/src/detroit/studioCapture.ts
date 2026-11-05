import * as T from 'three';
import {toLocal,toMap} from './geo-profile.ts';
import {MACK_STUDIO,studioMap,studioCoordinates} from './mackStudioSite.ts';
import {STUDIO_VIEWS} from './studioInteriorLayout.ts';
import {lottoMap,LOTTO_SHOP} from './lottoShopSite.ts';
import {pennyMap} from './pennyShopSite.ts';
import './studioCapture.css';
/** Local canvas capture, without a microphone or network upload. */
export class StudioCapture{
 readonly panel=document.createElement('details');
 private view=document.createElement('select');private photo=document.createElement('button');private photoLink=document.createElement('a');private preview=document.createElement('img');private clip=document.createElement('video');private video=document.createElement('button');private download=document.createElement('a');private status=document.createElement('p');
 private photoPending=false;private recorder?:MediaRecorder;private stream?:MediaStream;private stopTimer?:ReturnType<typeof setTimeout>;private available=false;
 constructor(private canvas:HTMLCanvasElement,private focus:()=>void){
  this.panel.className='studio-capture';this.panel.hidden=true;this.panel.setAttribute('aria-label','Photo and video studio');
  const summary=document.createElement('summary');summary.textContent='Studio cameras + capture';const heading=document.createElement('strong');heading.textContent='GOTHTECH / PRODUCTION';
  this.view.setAttribute('aria-label','Studio camera');for(const [value,label]of [['ride','Ride camera'],['wide','Studio wide'],['stage','Green screen stage'],['edit','Editing + sound desk'],['makeup','Makeup + wardrobe'],['storefront','GothTech storefront'],['store','GothTech showroom'],['galleryfront','Serengeti storefront'],['gallery','Serengeti print shop'],['galleryphotos','Serengeti photo exhibition'],['lottofront','LottoMind storefront'],['pennyfront','Penny Auction storefront'],['cinema','Giant cinema wall'],['stream','Giant live stream wall'],['arcade','Studio arcade cabinets']])this.view.add(new Option(label,value));
  this.view.add(new Option('Innovation Floor hoodie','innovation'));this.view.add(new Option('Innovation Floor rooftop','roofsign'));
  this.view.onchange=()=>this.focus();this.photo.textContent='Take studio photo';this.photo.onclick=()=>{this.photoPending=true;this.status.textContent='Taking photo…';this.focus();};this.photoLink.textContent='Download PNG photo';this.photoLink.hidden=true;this.preview.alt='Latest studio photo';this.preview.hidden=true;
  this.video.textContent='Record studio video';this.video.onclick=()=>this.recorder?.state==='recording'?this.stopVideo():this.startVideo();this.download.textContent='Download studio video';this.download.hidden=true;this.status.setAttribute('role','status');this.status.textContent='PNG photos · silent video · up to 30 seconds';
  this.clip.controls=true;this.clip.playsInline=true;this.clip.muted=true;this.clip.hidden=true;this.clip.setAttribute('aria-label','Latest studio video');
  const actions=document.createElement('div');actions.append(this.photo,this.video,this.photoLink,this.download);this.panel.append(summary,heading,this.view,actions,this.preview,this.clip,this.status);this.panel.addEventListener('keydown',e=>e.stopPropagation());document.body.append(this.panel);
  window.addEventListener('pagehide',()=>this.stopVideo());
 }
 open(){this.view.value='wide';this.panel.open=true;}
 update(x:number,z:number,visible:boolean,camera:T.PerspectiveCamera){
  const map=toMap(x,0,z),at=studioCoordinates(map.x,map.z);this.available=visible&&Math.hypot(map.x-MACK_STUDIO.x,map.z-MACK_STUDIO.z)<175;this.panel.hidden=!this.available;
  if(!this.available){this.view.value='ride';this.photoPending=false;this.stopVideo();return;}
  const preset=this.view.value==='roofsign'?{eye:[0,7.6,42],target:[0,7.52,19.6],horizontal:70}:STUDIO_VIEWS[this.view.value as keyof typeof STUDIO_VIEWS];
  if(this.view.value==='lottofront'||this.view.value==='pennyfront'){
   const mapAt=this.view.value==='lottofront'?lottoMap:pennyMap,eye=mapAt(0,23),target=mapAt(0,1);
   const a=toLocal(eye.x,LOTTO_SHOP.floor+3.2,eye.z),b=toLocal(target.x,LOTTO_SHOP.floor+2.2,target.z);
   camera.position.set(a.x,a.y,a.z);camera.lookAt(b.x,b.y,b.z);camera.fov=T.MathUtils.clamp(T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(86/2))/camera.aspect)),40,108);camera.updateProjectionMatrix();
  }
  if(preset){
   const position=(values:readonly number[])=>{const p=studioMap(values[0],values[2]);return toLocal(p.x,MACK_STUDIO.floor+values[1],p.z);};
   const eye=position(preset.eye),target=position(preset.target);camera.position.set(eye.x,eye.y,eye.z);camera.lookAt(target.x,target.y,target.z);camera.fov=T.MathUtils.clamp(T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(preset.horizontal/2))/camera.aspect)),40,108);camera.updateProjectionMatrix();
  }
  this.canvas.dataset.studio=JSON.stringify({u:+at.u.toFixed(2),v:+at.v.toFixed(2),camera:this.view.value,recording:this.recorder?.state==='recording'});
 }
 afterRender(){
  if(!this.photoPending||!this.available)return;this.photoPending=false;
  try{const data=this.canvas.toDataURL('image/png');if(data==='data:,')throw Error('Empty canvas');this.photoLink.href=data;this.photoLink.download='gothtech-studio-'+Date.now()+'.png';this.photoLink.hidden=false;this.preview.src=data;this.preview.hidden=false;this.status.textContent='Photo ready · '+this.canvas.width+' × '+this.canvas.height+' · download to save';this.canvas.dataset.studioPhoto=String(Math.floor(data.split(',')[1].length*3/4));}catch{this.status.textContent='Photo capture failed. Try again.';}
 }
 private startVideo(){
  if(!this.available)return;if(typeof MediaRecorder==='undefined'||!this.canvas.captureStream){this.status.textContent='Video capture is unavailable in this browser. Photo capture is available.';return;}
  try{
   const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('No supported encoder');
   const chunks:Blob[]=[];let bytes=0;this.stream=this.canvas.captureStream(30);const recorder=new MediaRecorder(this.stream,{mimeType:type,videoBitsPerSecond:4_000_000});this.recorder=recorder;
   recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>32*1024*1024&&recorder.state==='recording')recorder.stop();}};
   recorder.onstop=()=>{if(this.stopTimer)clearTimeout(this.stopTimer);this.stream?.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type});this.video.textContent='Record studio video';this.canvas.dataset.studioVideo=String(blob.size);if(!blob.size){this.status.textContent='No video captured. Try again.';return;}const reader=new FileReader();reader.onload=()=>{const data=String(reader.result);this.download.href=data;this.download.download='gothtech-studio-'+Date.now()+'.'+(type.includes('mp4')?'mp4':'webm');this.download.hidden=false;this.clip.src=data;this.clip.hidden=false;this.status.textContent='Video ready · preview or download to save';};reader.onerror=()=>{this.status.textContent='Video could not be prepared. Try again.';};reader.readAsDataURL(blob);};
   recorder.onerror=()=>{this.stream?.getTracks().forEach(t=>t.stop());this.video.textContent='Record studio video';this.status.textContent='Video capture failed. Try again.';};
   this.download.hidden=true;recorder.start(500);this.stopTimer=setTimeout(()=>this.stopVideo(),30_000);this.video.textContent='Stop studio recording';this.status.textContent='Recording · stops after 30 seconds · silent';this.focus();
  }catch{this.stream?.getTracks().forEach(t=>t.stop());this.status.textContent='Video capture could not start. Photo capture is available.';}
 }
 private stopVideo(){if(this.stopTimer)clearTimeout(this.stopTimer);if(this.recorder?.state==='recording')this.recorder.stop();}
}
