import {routeGuide} from './routeGuide.ts';
import * as T from 'three';
import {CHALLENGES,DistrictRun,readRecords,recordRun,type Challenge,type Records} from './district.ts';
import {cutPoint,heightAt} from './world.ts';
import {GEO,toLocal} from './geo-profile.ts';
export function routePosition(d:number,u=0){const p=cutPoint(d,u);return {...toLocal(p.x,heightAt(p.x,p.z),p.z),heading:-p.heading};}
export function discoveryTargets(){
 const bridge=GEO.bridges.find(b=>b.name==='Gratiot Avenue')!;
 const wall=GEO.walls.reduce((best,w)=>Math.abs(w.at-1798)<Math.abs(best.at-1798)?w:best);
 const p=cutPoint(wall.at+3.9,wall.offset),ry=p.heading-Math.PI+(wall.offset>0?-Math.PI/2:Math.PI/2);
 return [
  {id:'gateway',name:'Gratiot gateway',...routePosition(bridge.at,-4.7),lift:2.4},
  {id:'mural',name:'Heron mural',...toLocal(p.x+Math.sin(ry)*.19,heightAt(p.x,p.z)+wall.height/2,p.z+Math.cos(ry)*.19),lift:0},
  {id:'freight',name:'Freight Yard',...routePosition(2052,-10),lift:3},
 ].map(p=>({...p,y:p.y+p.lift}));
}
const $=(id:string)=>document.getElementById(id)!;
const medalName=['Unplayed','Bronze','Silver','Gold'];
export class DistrictView {
 readonly group=new T.Group();readonly targets=discoveryTargets();records:Records={};selected='gratiot-dash';
 private markers:T.Group[]=[];private photoMarker:T.Mesh;private photos:Record<string,string>={};
 constructor(scene:T.Scene,onStart:(c:Challenge)=>void,onRetry:()=>void,onFree:()=>void,onFrame:()=>void,onPhoto:()=>void){
  try{this.records=readRecords(localStorage.getItem('digital-static-district-end-to-end-v3'));const parsed=JSON.parse(localStorage.getItem('digital-static-album-v1')??'{}');for(const t of this.targets)if(typeof parsed[t.id]==='string'&&parsed[t.id].startsWith('data:image/jpeg;base64,')&&parsed[t.id].length<500000)this.photos[t.id]=parsed[t.id];}catch{}
  scene.add(this.group);this.photoMarker=new T.Mesh(new T.OctahedronGeometry(.22),new T.MeshBasicMaterial({color:0xe9d694}));this.group.add(this.photoMarker);this.photoMarker.visible=false;
  const board=document.createElement('div');board.id='districtBoard';board.innerHTML='<p class="eyebrow">DISTRICT 01 · CUT ENTRANCE → MACK AVENUE</p><h2>One stretch. Five reasons to ride.</h2><p class="boardIntro">Five full-length challenges. One finish at Mack Avenue.</p><div id="districtCards"></div><p id="districtTotals"></p><details><summary>Your photo album</summary><div id="districtAlbum"></div></details>';$('menu').append(board);
  const overlay=document.createElement('section');overlay.id='challengeHUD';overlay.hidden=true;overlay.innerHTML='<small id="challengeType"></small><strong id="challengeTitle"></strong><p id="challengeProgress"></p><p id="challengeHint"></p><div><button id="retryChallenge">Retry</button><button id="leaveChallenge">Free Ride</button><button id="framePhoto" hidden>Frame subject</button><button id="capturePhoto" hidden>Photo · F</button></div>';document.body.append(overlay);
  const results=document.createElement('section');results.id='challengeResults';results.hidden=true;results.setAttribute('role','dialog');results.setAttribute('aria-modal','true');results.setAttribute('aria-labelledby','resultTitle');results.innerHTML='<div><p class="eyebrow" id="resultMedal"></p><h2 id="resultTitle"></h2><p id="resultCopy"></p><button id="resultRetry">Ride again</button><button id="resultBoard">Challenge board</button><button id="resultFree">Free Ride</button></div>';document.body.append(results);
  $('retryChallenge').onclick=$('resultRetry').onclick=onRetry;$('leaveChallenge').onclick=$('resultFree').onclick=onFree;$('framePhoto').onclick=onFrame;$('capturePhoto').onclick=onPhoto;
  $('resultBoard').onclick=()=>{results.hidden=true;$('menuButton').click();};
  for(const [i,c]of CHALLENGES.entries()){
   const card=document.createElement('button');card.className='districtCard';card.disabled=true;card.dataset.kind=c.kind;card.dataset.challenge=c.id;card.innerHTML=`<span class="challengeNumber">0${i+1}</span><span><small>${c.kind==='trial'?'TIME TRIAL':c.kind==='style'?'STYLE CHALLENGE':'DISCOVERY'} · ${c.kind==='discovery'?'3 photographs + Mack finish':`${Math.round(c.end-c.start)} m`}</small><strong>${c.title}</strong><span>${c.description}</span><em id="best-${c.id}"></em></span><b aria-hidden="true">↗</b>`;card.onclick=()=>{this.selected=c.id;onStart(c);};$('districtCards').append(card);
  }
  this.refreshBoard();this.renderAlbum();
 }
 filter(kind:string){for(const card of document.querySelectorAll<HTMLElement>('.districtCard'))card.hidden=kind!=='free'&&card.dataset.kind!==kind;}
 refreshBoard(){let medals=0;for(const c of CHALLENGES){const r=this.records[c.id];medals+=r?.medal??0;$('best-'+c.id).textContent=r?`${medalName[r.medal]} · Best ${c.kind==='trial'?r.value.toFixed(1)+' s':c.kind==='discovery'?r.value+'/3 photos':r.value+' pts'} · ${r.completions} finish${r.completions===1?'':'es'}`:c.kind==='trial'?`Gold ≤ ${c.gold} s · Silver ≤ ${c.silver} s` :c.kind==='style'?`Gold ${c.gold} pts · Silver ${c.silver} pts`:'Find all three subjects';}$('districtTotals').textContent=`${CHALLENGES.filter(c=>this.records[c.id]).length}/5 challenges completed · ${medals}/15 medal stars · Saved on this browser`;}
 setRun(run?:DistrictRun){
  for(const g of this.markers){this.group.remove(g);g.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});}this.markers=[];this.photoMarker.visible=false;$('challengeResults').hidden=true;$('challengeHUD').hidden=!run;
  if(!run)return;const c=run.challenge;$('challengeTitle').textContent=c.title;$('challengeProgress').textContent=run.progress;$('challengeHint').textContent=run.reason||run.challenge.description;$('challengeType').textContent=c.kind==='trial'?'TIME TRIAL':c.kind==='style'?'STYLE CHALLENGE':'DISCOVERY';$('challengeHint').textContent=c.description;
  $('framePhoto').hidden=$('capturePhoto').hidden=c.kind!=='discovery';
  for(const [index,d]of (c.gates.length?c.gates:[c.end]).entries()){const g=new T.Group(),p=routePosition(d,c.gateOffsets?.[index]??0);g.position.set(p.x,p.y+.035,p.z);g.rotation.y=p.heading;
   const mat=()=>new T.MeshBasicMaterial({color:0xe9cf82,transparent:true,opacity:.8});
   for(const x of [-(c.gateWidth??3.4)/2,(c.gateWidth??3.4)/2]){const post=new T.Mesh(new T.CylinderGeometry(.075,.075,3.0,6),mat());post.position.set(x,1.5,0);g.add(post);}
   const crossbar=new T.Mesh(new T.BoxGeometry(c.gateWidth??3.4,.12,.12),mat());crossbar.position.y=3;g.add(crossbar);
   const stripe=new T.Mesh(new T.BoxGeometry(c.gateWidth??3.4,.018,.22),mat());g.add(stripe);this.group.add(g);this.markers.push(g);
  }
  if(c.kind==='style'&&c.id!=='silk-line')for(const d of [c.start+20,c.start+50,c.start+80]){const p=routePosition(d),g=new T.Group();g.position.set(p.x,p.y+.05,p.z);g.rotation.y=p.heading;const mat=new T.MeshBasicMaterial({color:0xe9cf82,transparent:true,opacity:.6});for(const x of [-1,1]){const m=new T.Mesh(new T.BoxGeometry(.15,.015,1.6),mat.clone());m.position.x=x;g.add(m);}mat.dispose();this.group.add(g);this.markers.push(g);}
 }
 update(run:DistrictRun|undefined,x:number,z:number,heading=0){if(!run)return;$('challengeProgress').textContent=run.progress;$('challengeHint').textContent=run.reason||run.challenge.description;this.markers.forEach((m,i)=>m.visible=i>=run.gateCount);const next=run.challenge.gates[run.gateCount];if(next!==undefined)$('challengeProgress').textContent=run.progress+' / '+routeGuide(x,z,heading,routePosition(next,run.challenge.gateOffsets?.[run.gateCount]??0));
  if(run.challenge.kind==='discovery'&&!run.reason){const t=this.targets.find(t=>!run.photos.has(t.id));if(t){this.photoMarker.visible=true;this.photoMarker.position.set(t.x,t.y+.8,t.z);$('challengeHint').textContent=`${t.name} · ${Math.round(Math.hypot(t.x-x,t.z-z))} m · Stop within 42 m. Frame subject, then Photo / F. Drag to reframe.`;}else {this.photoMarker.visible=false;$('challengeHint').textContent='All photographs collected. Follow the gold gates to Mack Avenue.';}}
 }
 finish(run:DistrictRun){let improved=false;if(run.done){improved=recordRun(this.records,run);try{localStorage.setItem('digital-static-district-end-to-end-v3',JSON.stringify(this.records));}catch{$('districtTotals').textContent='Browser storage full: this result is saved for this session only.';}this.refreshBoard();}
  $('resultMedal').textContent=run.failed?'A NEW LINE AWAITS':`${medalName[run.medal]} · ${improved?'PERSONAL BEST':'COMPLETE'}`;$('resultTitle').textContent=run.failed?'Try that line again.':run.challenge.title;$('resultCopy').textContent=run.failed?run.reason:`${run.progress}. ${run.medal<3?'Go again for the next medal.':'A gold run. Find another line on the board.'}`;$('challengeResults').hidden=false;$('resultRetry').focus();
 }
 savePhoto(id:string,canvas:HTMLCanvasElement){const small=document.createElement('canvas');small.width=640;small.height=Math.round(640*canvas.height/canvas.width);small.getContext('2d')!.drawImage(canvas,0,0,small.width,small.height);this.photos[id]=small.toDataURL('image/jpeg',.78);try{localStorage.setItem('digital-static-album-v1',JSON.stringify(this.photos));}catch{}this.renderAlbum();}
 private renderAlbum(){$('districtAlbum').replaceChildren();for(const t of this.targets){const data=this.photos[t.id];if(!data)continue;const a=document.createElement('a');a.href=data;a.download=`Detroit-${t.id}.jpg`;const img=document.createElement('img');img.src=data;img.alt=t.name;a.append(img,document.createTextNode(`${t.name} · Save photo`));$('districtAlbum').append(a);}if(!Object.keys(this.photos).length)$('districtAlbum').textContent='Your discovery photographs will appear here.';}
}
