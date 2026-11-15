import {DefaultLoadingManager} from 'three';
import pins from './assetPins.json' with {type:'json'};
import vehiclePins from './vehicles/assetPins.json' with {type:'json'};

/** Keep the local authoring build self-contained; production uses exact committed bytes. */
export function configureAssetDelivery(){
 if(!import.meta.env.PROD||['127.0.0.1','localhost'].includes(location.hostname))return;
 const urls=new Map([pins,vehiclePins].flatMap(group=>group.files.map(file=>[new URL('./'+file.path,document.baseURI).href,group.base+((file as {source?:string}).source??file.path)] as const)));

 // The skyline is a modest, required first-view model. Begin its transfer
 // early; do not preload the 30 MB landmark archive or every selectable vehicle.
 // Reuse exact immutable URLs so the GLTFLoader fetch can share the HTTP cache.
 const head=document.head;
 if(head){
  const hinted=new Set(Array.from(head.querySelectorAll<HTMLLinkElement>('link[data-belle-asset-hint]')).map(link=>link.href));
  const hint=(rel:'preconnect'|'preload',href:string)=>{
   if(hinted.has(href))return;
   const link=document.createElement('link');link.rel=rel;link.href=href;link.crossOrigin='anonymous';
   if(rel==='preload'){link.as='fetch';link.fetchPriority='high';}
   link.dataset.belleAssetHint=rel;head.append(link);hinted.add(href);
  };
  for(const origin of new Set([pins.base,vehiclePins.base].map(base=>new URL(base).origin+'/')))hint('preconnect',origin);
  const skyline=urls.get(new URL('./belle/detroit-skyline.glb',document.baseURI).href);
  if(skyline)hint('preload',skyline);
 }
 DefaultLoadingManager.setURLModifier(url=>{const canonical=new URL(url,document.baseURI);canonical.search='';canonical.hash='';return urls.get(canonical.href)??url;});
}
