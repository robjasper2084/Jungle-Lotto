import * as T from 'three';
import type {HoverRide} from './hover.ts';
import type {ParkMap} from './terrain.ts';
import {referenceSpawn} from './sunsetReferencePolicy.ts';
import {REFERENCE_PLACES} from './referenceIsland.ts';
import './sunsetPreview.css';
/** Review views use the playable rider and world; no alternate screenshot scene. */
export function createSunsetPreview(camera:T.PerspectiveCamera,ride:()=>HoverRide|undefined,active:()=>boolean,clear:()=>void,spawn:{x:number;z:number;heading:number},map:ParkMap){
 let view:'ride'|'waterfront'|'rider'='ride',initialized=false;
 let selected=0;
 const bar=document.createElement('aside');bar.id='sunset-preview';bar.setAttribute('aria-label','Sunset Point local preview');
 bar.innerHTML='<div><small>LOCAL PREVIEW</small><strong>Sunset Point</strong></div><nav aria-label="Preview views"><button type="button" data-view="ride" aria-pressed="true">Ride</button><button type="button" data-view="waterfront" aria-pressed="false">Waterfront</button><button type="button" data-view="rider" aria-pressed="false">Close view</button><button type="button" data-reset aria-label="Return to Sunset Point">↺</button></nav><p>G take off · W/S speed · A/D steer · Space brake · V camera</p>';
 document.body.append(bar);bar.hidden=true;document.getElementById('startup-scene')!.textContent='SUNSET POINT';for(const id of['startup-next','startup-motion'])document.getElementById(id)?.setAttribute('hidden','');
 const places=document.createElement('select');places.setAttribute('aria-label','Preview island location');REFERENCE_PLACES.forEach((p,i)=>places.add(new Option(p.name,String(i))));bar.querySelector('strong')!.replaceWith(places);
 const buttons=Array.from(bar.querySelectorAll<HTMLButtonElement>('button[data-view]'));
 for(const b of buttons)b.onclick=()=>{clear();ride()?.clear();view=b.dataset.view as typeof view;buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===b)));document.body.classList.toggle('sunset-showcase',view!=='ride');};
 function travel(){const p=referenceSpawn(map,REFERENCE_PLACES[selected]);clear();ride()?.clear();ride()?.sim.reset(p.x,p.z,p.heading);buttons[0].click();}
 places.onchange=()=>{selected=Number(places.value);travel();};
 const reset=bar.querySelector<HTMLButtonElement>('[data-reset]')!;reset.setAttribute('aria-label','Return to selected location');reset.onclick=travel;
 const point=new T.Vector3(),look=new T.Vector3();
 const sync=()=>{bar.hidden=!active()||!ride()?.riding;document.body.classList.toggle('sunset-showcase',!bar.hidden&&view!=='ride');};
 return{sync,get showcase(){return active()&&!!ride()?.riding&&view!=='ride';},update(){
  bar.hidden=!active()||!ride()?.riding;if(!bar.hidden&&!initialized){ride()!.sim.reset(spawn.x,spawn.z,spawn.heading);initialized=true;}if(view==='ride'||bar.hidden)return;
  const p=ride()!.sim.pose;
  if(view==='waterfront'){if(selected===0){point.set(60,35,1488);look.set(-300,-18,1550);}else{const site=REFERENCE_PLACES[selected];point.set(p.x+75,p.y+50,p.z+85);look.set(site.x,8,site.z);}camera.fov=44;}
  else{const h=p.heading,c=Math.cos(h),s=Math.sin(h);point.set(p.x-3.8*c+5.5*s,p.y+2.0,p.z+3.8*s+5.5*c);look.set(p.x,p.y+1.05,p.z+.15);camera.fov=38;}
  camera.position.copy(point);camera.lookAt(look);camera.updateProjectionMatrix();
 }};
}
