import * as T from 'three';
import {budgetPixelRatio,makeTextureBudget} from './renderBudget.ts';
export type GraphicsChoice='auto'|'low'|'balanced'|'high';
export const GRAPHICS_PRESETS={low:{label:'Low · older phones',pixelRatio:.8,shadows:0,distance:180,fps:30,textureSize:512,maxPixels:600000},balanced:{label:'Balanced',pixelRatio:1.25,shadows:1024,distance:300,fps:60,textureSize:1024,maxPixels:1600000},high:{label:'High · maximum detail',pixelRatio:2,shadows:2048,distance:420,fps:60,textureSize:2048,maxPixels:4000000}} as const;
export function resolveGraphics(value:string,cores=4,memory=4){if(value==='low'||value==='balanced'||value==='high')return value;return cores<=4||memory<=4?'low':'balanced';}
export function createGraphicsQuality(renderer:T.WebGLRenderer,scene:T.Scene,canvas:HTMLCanvasElement){
 let choice:GraphicsChoice='auto';try{const saved=localStorage.getItem('swoop-graphics-quality');if(['auto','low','balanced','high'].includes(saved??''))choice=saved as GraphicsChoice;}catch{}
 const cores=navigator.hardwareConcurrency||4,memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory??4;
 let current=GRAPHICS_PRESETS[resolveGraphics(choice,cores,memory)];
 const fields:HTMLSelectElement[]=[],descriptions:HTMLElement[]=[],originalShadows=new WeakMap<T.Light,boolean>();
 const budgetTextures=makeTextureBudget();
 const resize=()=>{renderer.setPixelRatio(budgetPixelRatio(devicePixelRatio,current.pixelRatio,innerWidth,innerHeight,current.maxPixels));renderer.setSize(innerWidth,innerHeight);};
 function apply(){current=GRAPHICS_PRESETS[resolveGraphics(choice,cores,memory)];resize();renderer.shadowMap.enabled=current.shadows>0;
  scene.traverse(o=>{const light=o as T.DirectionalLight;if(light.isLight&&light.shadow){if(!originalShadows.has(light))originalShadows.set(light,light.castShadow);light.castShadow=!!current.shadows&&!!originalShadows.get(light);const size=current.shadows||512;if(light.shadow.mapSize.x!==size){light.shadow.mapSize.set(size,size);light.shadow.map?.dispose();light.shadow.map=null;}}
  });budgetTextures(scene,current.textureSize);
  renderer.shadowMap.needsUpdate=true;document.documentElement.dataset.renderQuality=current===GRAPHICS_PRESETS.low?'compact':'detailed';document.documentElement.dataset.drawDistance=String(current.distance);
  Object.assign(canvas.dataset,{qualityChoice:choice,quality:resolveGraphics(choice,cores,memory),frameLimit:String(current.fps),shadowSize:String(current.shadows),textureLimit:String(current.textureSize),pixelRatio:String(renderer.getPixelRatio())});
  for(const s of fields)s.value=choice;for(const d of descriptions)d.textContent=current.label+' · '+current.fps+' FPS target · '+(current.shadows?'dynamic shadows':'shadows off')+'. Saves automatically.';
 }
 function mount(parent:HTMLElement){const field=document.createElement('fieldset');field.className='touchSettings graphicsSettings';const legend=document.createElement('legend');legend.textContent='Graphics & performance';const label=document.createElement('label');label.textContent='Detail level';const select=document.createElement('select');select.setAttribute('aria-label','Graphics detail');select.add(new Option('Automatic · recommended','auto'));for(const [v,p]of Object.entries(GRAPHICS_PRESETS))select.add(new Option(p.label,v));select.value=choice;const description=document.createElement('p');description.setAttribute('role','status');select.onchange=()=>{choice=select.value as GraphicsChoice;try{localStorage.setItem('swoop-graphics-quality',choice);}catch{}apply();};fields.push(select);descriptions.push(description);label.append(select);field.append(legend,label,description);parent.append(field);apply();}
 apply();return {apply,mount,resize,get choice(){return choice;},get current(){return current;}};
}
