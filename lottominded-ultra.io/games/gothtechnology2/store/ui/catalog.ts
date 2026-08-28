import type { Product } from '../commerce/types';
import { analytics } from '../state/analytics';
import { filterProducts } from '../content/catalog';
import { formatMoney } from '../commerce/money';
import { href } from '../utilities/paths';
import { $, $$, escape as e, openDialog } from './dom';
export function initCatalog(products:Product[]) {
  const form=$<HTMLFormElement>('#product-filters'), grid=$('#product-grid');
  if(form&&grid) {
    const disclosure=$<HTMLDetailsElement>('.filter-disclosure',form)!;
    const compact=matchMedia('(max-width:760px)');
    const syncDisclosure=()=>{disclosure.open=!compact.matches;};
    syncDisclosure();compact.addEventListener('change',syncDisclosure);
    const fields=['search','category','collection','size','color','availability','sort'];
    const defaults=Object.fromEntries(fields.map(name=>[name,(form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement).value]));
    const applyURL=()=>{const query=new URLSearchParams(location.search);fields.forEach(name=>{const field=form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;field.value=query.get(name)??defaults[name];});};
    const update=(write=true)=>{
      const filters=Object.fromEntries(new FormData(form).entries()) as Record<string,string>;
      const results=filterProducts(products,filters), order=new Map(results.map((p,i)=>[p.handle,i]));
      $$('[data-product-card]',grid).forEach(card=>{const wrapper=card.closest<HTMLElement>('[data-product-wrapper]')??card;const index=order.get(card.dataset.handle!);wrapper.hidden=index===undefined;wrapper.style.order=String(index??999);});
      $('#result-count')!.textContent=`${results.length} ${results.length===1?'product':'products'}`;$('#no-results')!.hidden=results.length!==0;
      const active=fields.filter(name=>name!=='sort' && filters[name] && filters[name]!==defaults[name]);
      $('#active-filters')!.innerHTML=active.map(name=>`<button type="button" class="filter-chip" data-clear-filter="${e(name)}" aria-label="Clear ${e(name)} filter">${e(name==='search'?'Search':filters[name])} ×</button>`).join('');
      $('[data-filter-count]')!.textContent=active.length ? '('+active.length+')' : '';
      if(write){analytics.trackEvent(filters.search?'search':'apply_filter',{count:results.length});const url=new URL(location.href);fields.forEach(name=>filters[name]!==defaults[name]?url.searchParams.set(name,filters[name]??''):url.searchParams.delete(name));history.replaceState(null,'',url);}
    };
    $('#active-filters')?.addEventListener('click',event=>{
      const button=(event.target as Element).closest<HTMLElement>('[data-clear-filter]');
      if(!button)return;
      const name=button.dataset.clearFilter!;
      (form.elements.namedItem(name) as HTMLInputElement).value=defaults[name];
      update();
      const field=form.elements.namedItem(name) as HTMLInputElement;
      if(field.closest('details') && !disclosure.open) $('.filter-disclosure summary',form)?.focus();
      else field.focus();
    });
    applyURL();update(false);form.addEventListener('input',()=>update());form.addEventListener('submit',e=>{e.preventDefault();update();});
    const reset=()=>{fields.forEach(name=>(form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement).value=defaults[name]);update();};
    form.addEventListener('reset',event=>{event.preventDefault();reset();});$('[data-reset-filters]')?.addEventListener('click',reset);
    window.addEventListener('popstate',()=>{applyURL();update(false);});
  }
  document.addEventListener('click',event=>{const target=event.target as Element;const search=target.closest<HTMLElement>('[data-open-search]'),menu=target.closest<HTMLElement>('[data-open-menu]');if(search)openDialog('search-dialog',search);if(menu)openDialog('menu-dialog',menu);});
  const search=$<HTMLInputElement>('#global-search');
  search?.addEventListener('input',()=>{const found=filterProducts(products,{search:search.value}).slice(0,6);$('#search-results')!.innerHTML=found.length?found.map(p=>`<a class="search-result" href="${e(href(`products/${p.handle}/`))}"><span>${e(p.title)}</span><span>${e(formatMoney(p.price))}</span></a>`).join(''):'<p>No matching products. Try a different signal.</p>';});
  $$<HTMLButtonElement>('[data-gallery-src]').forEach(button=>button.addEventListener('click',()=>{const img=$<HTMLImageElement>('#gallery-image')!;img.src=button.dataset.gallerySrc!;img.alt=button.dataset.galleryAlt!; const caption=$('[data-gallery-kind]:not(button)'); if(caption)caption.textContent=button.dataset.galleryKind || 'SUPPLIED PRODUCT REFERENCE';$$('[data-gallery-src]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
  $('#gallery-zoom')?.addEventListener('click',event=>{const button=event.currentTarget as HTMLElement;const zoom=button.closest('.gallery-main')!.classList.toggle('is-zoomed');button.setAttribute('aria-pressed',String(zoom));button.textContent=zoom?'Reset zoom':'Zoom image';});
  const bar=$<HTMLElement>('.mobile-product-bar'), purchase=$('#product-options'), footer=$('.site-footer');
  if(bar && purchase && footer && 'IntersectionObserver' in window){
    let formVisible=false,footerVisible=false;
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){if(entry.target===purchase)formVisible=entry.isIntersecting;if(entry.target===footer)footerVisible=entry.isIntersecting;}
      bar.hidden=formVisible||footerVisible;
    },{threshold:0});
    observer.observe(purchase);observer.observe(footer);
    window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  }
  $('[data-select-options]')?.addEventListener('click',()=>{(purchase as HTMLElement|null)?.focus();});
  $('[data-share-product]')?.addEventListener('click',async()=>{const status=$('[data-share-status]')!;try{const url=location.origin+location.pathname;if(navigator.share)await navigator.share({title:document.title,url});else{await navigator.clipboard.writeText(url);status.textContent='Product link copied.';}}catch{status.textContent='You can share the page address from your browser.';}});
}
