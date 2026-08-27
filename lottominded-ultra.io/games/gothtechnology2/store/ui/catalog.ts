import type { Product } from '../commerce/types';
import { filterProducts } from '../content/catalog';
import { formatMoney } from '../commerce/money';
import { href } from '../utilities/paths';
import { $, $$, escape as e, openDialog } from './dom';
export function initCatalog(products:Product[]) {
  const form=$<HTMLFormElement>('#product-filters'), grid=$('#product-grid');
  if(form&&grid) {
    const fields=['search','category','collection','size','color','availability','sort'];
    const applyURL=()=>{const query=new URLSearchParams(location.search);fields.forEach(name=>{const field=form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;field.value=query.get(name)??(name==='sort'?'featured':'');});};
    const update=(write=true)=>{
      const filters=Object.fromEntries(new FormData(form).entries()) as Record<string,string>;
      const results=filterProducts(products,filters), order=new Map(results.map((p,i)=>[p.handle,i]));
      $$('[data-product-card]',grid).forEach(card=>{const wrapper=card.closest<HTMLElement>('[data-product-wrapper]')??card;const index=order.get(card.dataset.handle!);wrapper.hidden=index===undefined;wrapper.style.order=String(index??999);});
      $('#result-count')!.textContent=`${results.length} ${results.length===1?'product':'products'}`;$('#no-results')!.hidden=results.length!==0;
      if(write){const url=new URL(location.href);fields.forEach(name=>filters[name]?url.searchParams.set(name,filters[name]):url.searchParams.delete(name));history.replaceState(null,'',url);}
    };
    applyURL();update(false);form.addEventListener('input',()=>update());form.addEventListener('submit',e=>{e.preventDefault();update();});
    const reset=()=>{fields.forEach(name=>(form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement).value=name==='sort'?'featured':'');update();};
    form.addEventListener('reset',event=>{event.preventDefault();reset();});$('[data-reset-filters]')?.addEventListener('click',reset);
    window.addEventListener('popstate',()=>{applyURL();update(false);});
  }
  document.addEventListener('click',event=>{const target=event.target as Element;const search=target.closest<HTMLElement>('[data-open-search]'),menu=target.closest<HTMLElement>('[data-open-menu]');if(search)openDialog('search-dialog',search);if(menu)openDialog('menu-dialog',menu);});
  const search=$<HTMLInputElement>('#global-search');
  search?.addEventListener('input',()=>{const found=filterProducts(products,{search:search.value}).slice(0,6);$('#search-results')!.innerHTML=found.length?found.map(p=>`<a class="search-result" href="${e(href(`products/${p.handle}/`))}"><span>${e(p.title)}</span><span>${e(formatMoney(p.price))}</span></a>`).join(''):'<p>No matching products. Try a different signal.</p>';});
  $$<HTMLButtonElement>('[data-gallery-src]').forEach(button=>button.addEventListener('click',()=>{const img=$<HTMLImageElement>('#gallery-image')!;img.src=button.dataset.gallerySrc!;img.alt=button.dataset.galleryAlt!;$$('[data-gallery-src]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
  $('#gallery-zoom')?.addEventListener('click',event=>{const button=event.currentTarget as HTMLElement;const zoom=button.closest('.gallery-main')!.classList.toggle('is-zoomed');button.setAttribute('aria-pressed',String(zoom));button.textContent=zoom?'Reset zoom':'Zoom image';});
  $('[data-share-product]')?.addEventListener('click',async()=>{const status=$('[data-share-status]')!;try{const url=location.origin+location.pathname;if(navigator.share)await navigator.share({title:document.title,url});else{await navigator.clipboard.writeText(url);status.textContent='Product link copied.';}}catch{status.textContent='You can share the page address from your browser.';}});
}
