import type { Product } from '../commerce/types';
import { $, $$ } from '../ui/dom';
import { media } from '../utilities/paths';
import { isReduced } from '../ui/experience';
import { config } from '../config';
export function initViewers(products:Product[]) {
  if(!config.features.enableProductModels){$$('[data-load-viewer]').forEach(button=>button.hidden=true);return;}
  $$('[data-load-viewer]').forEach(button=>button.addEventListener('click',async()=>{
    const root=button.closest<HTMLElement>('.model-viewer')!,stage=$<HTMLElement>('.model-stage',root)!,controls=$<HTMLElement>('.model-controls',root)!,note=$('[data-viewer-status]',root)!;
    if(root.dataset.loaded==='true')return;
    const product=products.find(p=>p.handle===root.dataset.handle)!;
    if(isReduced()){note.textContent='Reduced motion is active. Use the standard image gallery and zoom above.';return;}
    if(!product.model&&!product.images.length){note.textContent='Product photography and a model are not supplied yet. The concept illustration remains available above.';return;}
    root.dataset.loaded='true';stage.hidden=false;controls.hidden=false;button.setAttribute('aria-expanded','true');
    if(product.model) {
      try { const {mountModel}=await import('./model');const dispose=await mountModel(stage,controls,product.model,product,()=>{note.textContent='Model unavailable. Use the product gallery above.';stage.hidden=true;controls.hidden=true;});window.addEventListener('pagehide',dispose,{once:true}); }
      catch{note.textContent='3D is unavailable here. The product gallery and shopping controls still work.';stage.hidden=true;controls.hidden=true;root.dataset.loaded='false';}
      return;
    }
    const frame=document.createElement('div');frame.className='depth-frame';
    const img=document.createElement('img');img.src=media(product.images[0].src);img.alt=product.images[0].alt;frame.append(img);stage.append(frame);
    stage.classList.add('depth-stage');let angle=0,scale=1,dragX:number|null=null;
    const draw=()=>{frame.style.transform=`perspective(800px) rotateY(${angle}deg) scale(${scale})`;};
    const set=(view:string)=>{
      if(view==='front'||view==='reset'){angle=0;scale=1;img.src=media(product.images[0].src);img.alt=product.images[0].alt;}
      if(view==='left')angle=Math.max(-22,angle-8);if(view==='right')angle=Math.min(22,angle+8);
      if(view==='detail'){const detail=product.images.find(i=>/detail|embroidery/i.test(i.label));if(detail){img.src=media(detail.src);img.alt=detail.alt;}scale=1.14;}
      if(view==='back'){const back=product.images.find(i=>/back view|rear/i.test(i.label));if(back){img.src=media(back.src);img.alt=back.alt;}else{note.textContent='A back-view photograph was not supplied. This display cannot show an invented reverse side.';return;}}
      note.textContent='2.5D reference display. Use left/right arrows to tilt, +/− to zoom, or Reset view.';draw();
    };
    controls.addEventListener('click',event=>{const view=(event.target as Element).closest<HTMLElement>('[data-view]')?.dataset.view;if(view)set(view);});
    stage.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();set(event.key==='ArrowLeft'?'left':'right');}if(event.key==='+'||event.key==='-'){event.preventDefault();scale=Math.max(.8,Math.min(1.2,scale+(event.key==='+'?.05:-.05)));draw();}if(event.key==='Home')set('reset');});
    stage.addEventListener('pointerdown',event=>{dragX=event.clientX;});
    stage.addEventListener('pointermove',event=>{if(dragX===null)return;angle=Math.max(-22,Math.min(22,angle+(event.clientX-dragX)*.12));dragX=event.clientX;draw();});
    for(const name of ['pointerup','pointercancel','pointerleave'])stage.addEventListener(name,()=>{dragX=null;});
    document.addEventListener('store:preferences',()=>{if(isReduced()){angle=0;scale=1;draw();stage.hidden=true;controls.hidden=true;note.textContent='Reduced motion is active. Use the standard gallery above.';}});
    set('front');
  }));
}
