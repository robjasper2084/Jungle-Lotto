import * as T from 'three';
export type Quality='auto'|'low'|'balanced'|'high';
export const QUALITY_PRESETS={
 low:{label:'Low · lighter devices',pixelRatio:.85,shadows:0,distance:150,flowers:.30,fps:30,wind:false},
 balanced:{label:'Balanced',pixelRatio:1.25,shadows:1024,distance:260,flowers:.65,fps:60,wind:true},
 high:{label:'High · detailed',pixelRatio:2,shadows:2048,distance:420,flowers:1,fps:60,wind:true},
} as const;
export function resolveQuality(value:string,cores=4,memory=4):keyof typeof QUALITY_PRESETS{
 if(value==='low'||value==='balanced'||value==='high')return value;
 return cores<=4||memory<=4?'low':'balanced';
}
export function makeElmwoodQuality(renderer:T.WebGLRenderer,sun:T.DirectionalLight,scene:T.Scene,canvas:HTMLCanvasElement){
 let choice:Quality='auto';try{const saved=localStorage.getItem('elmwood-quality');if(['auto','low','balanced','high'].includes(saved??''))choice=saved as Quality;}catch{}
 const cores=navigator.hardwareConcurrency||4,memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory??4;
 let current=QUALITY_PRESETS[resolveQuality(choice,cores,memory)];
 const select=document.createElement('select');select.id='elmwood-quality';select.setAttribute('aria-describedby','quality-description');
 select.add(new Option('Automatic · recommended','auto'));for(const [id,preset] of Object.entries(QUALITY_PRESETS))select.add(new Option(preset.label,id));select.value=choice;
 const label=document.createElement('label');label.htmlFor=select.id;label.textContent='Graphics';
 const description=document.createElement('p');description.id='quality-description';description.style.fontSize='12px';
 document.querySelector('aside')!.prepend(label,select,description);
 function apply(){current=QUALITY_PRESETS[resolveQuality(choice,cores,memory)];renderer.setPixelRatio(Math.min(devicePixelRatio,current.pixelRatio));renderer.shadowMap.enabled=current.shadows>0;sun.castShadow=current.shadows>0;
  const size=current.shadows||512;if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;}renderer.shadowMap.needsUpdate=true;
  scene.traverse(o=>{const mesh=o as T.InstancedMesh;if(mesh.isInstancedMesh&&mesh.userData.flowerCapacity)mesh.count=Math.max(1,Math.round(mesh.userData.flowerCapacity*current.flowers));});
  Object.assign(canvas.dataset,{quality:resolveQuality(choice,cores,memory),qualityChoice:choice,pixelRatio:String(renderer.getPixelRatio()),shadowSize:String(current.shadows),flowerDensity:String(current.flowers),frameLimit:String(current.fps)});
  description.textContent=`${current.label} · ${current.fps} FPS limit. Changes apply immediately.`;
  select.value=choice;document.querySelector<HTMLSelectElement>('#menu-quality')?.setAttribute('data-applied',choice);
 }
 select.onchange=()=>{choice=select.value as Quality;try{localStorage.setItem('elmwood-quality',choice);}catch{}apply();};apply();
 return {get current(){return current;},apply};
}
