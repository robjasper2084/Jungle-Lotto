import * as T from 'three';
import {createGraphicsQuality,GRAPHICS_PRESETS,resolveGraphics} from './sharedGraphicsQuality.ts';
export type {GraphicsChoice as Quality} from './sharedGraphicsQuality.ts';
export const QUALITY_PRESETS=GRAPHICS_PRESETS;
export const resolveQuality=resolveGraphics;
const density={low:.30,balanced:.65,high:1,ultra:1};
export function makeElmwoodQuality(renderer:T.WebGLRenderer,_sun:T.DirectionalLight,scene:T.Scene,canvas:HTMLCanvasElement){
 // Both games use the same saved preset and advanced controls on this origin.
 try{if(!localStorage.getItem('swoop-graphics-quality')){const old=localStorage.getItem('elmwood-quality');if(old&&['auto','low','balanced','high'].includes(old))localStorage.setItem('swoop-graphics-quality',old);}}catch{}
 const extras=()=>{
  const resolved=canvas.dataset.quality as keyof typeof density,flowers=(density[resolved]??1)*Math.max(.5,Number(canvas.dataset.adaptiveDetail)||1);
  scene.traverse(o=>{const mesh=o as T.InstancedMesh;if(mesh.isInstancedMesh&&mesh.userData.flowerCapacity)mesh.count=Math.max(1,Math.round(mesh.userData.flowerCapacity*flowers));});
  canvas.dataset.flowerDensity=String(flowers);
  const menu=document.querySelector<HTMLSelectElement>('#menu-quality');if(menu)menu.value=canvas.dataset.qualityChoice??'auto';
 };
 const graphics=createGraphicsQuality(renderer,scene,canvas,extras);
 const host=document.createElement('div');document.querySelector('aside')!.prepend(host);graphics.mount(host);
 host.replaceWith(host.firstElementChild!);
 const select=document.querySelector<HTMLSelectElement>('[aria-label="Graphics detail"]')!;select.id='elmwood-quality';
 const description=select.closest('fieldset')!.querySelector<HTMLElement>('[role="status"]')!;description.id='quality-description';select.setAttribute('aria-describedby',description.id);
 return {get current(){return {...graphics.current,flowers:density[canvas.dataset.quality as keyof typeof density]??1,wind:canvas.dataset.quality!=='low'};},get choice(){return graphics.choice;},apply:graphics.apply,resize:graphics.resize,setAdaptiveDetail:graphics.setAdaptiveDetail,setResolutionScale:graphics.setResolutionScale,downgradeAuto:graphics.downgradeAuto};
}
