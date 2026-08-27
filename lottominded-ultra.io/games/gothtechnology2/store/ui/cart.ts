import type { Cart, CommerceProvider, Product } from '../commerce/types';
import { createProvider } from '../commerce/provider';
import { config } from '../config';
import { selectVariant } from '../content/catalog';
import { formatMoney } from '../commerce/money';
import { href, media } from '../utilities/paths';
import { $, $$, escape as e, storage, saved, save, openDialog, announce } from './dom';

export function initCart(products: Product[]) {
  const provider: CommerceProvider = createProvider(storage());
  const key = `gothtechnology.armory.cart.shopify.${config.shopify.domain}.v1`;
  let cart: Cart | null = null, busy = false, initialization: Promise<Cart> | null = null;
  const status = $('#cart-status')!;
  const checkoutButton = $<HTMLButtonElement>('#checkout-button')!;
  async function ensureCart(): Promise<Cart> {
    if (cart) return cart;
    return initialization ??= (async () => {
      const id = config.commerceMode === 'shopify' ? saved(key) : 'demo-loadout';
      cart = (id ? await provider.getCart(id) : null) ?? await provider.createCart();
      if (!cart.demo) save(key, cart.id);
      render(); return cart;
    })().finally(()=>{initialization=null;});
  }
  function render() {
    if (!cart) return;
    const focus = document.activeElement as HTMLElement | null;
    const focusKey = focus?.dataset.focusKey;
    $$('[data-cart-count]').forEach(el=>el.textContent=String(cart!.totalQuantity));
    $('#cart-lines')!.innerHTML = cart.lines.length ? cart.lines.map((line,i)=>`<article class="cart-line" data-line="${e(line.id)}">${line.image ? `<img src="${e(media(line.image.src))}" alt="${e(line.image.alt)}" width="88" height="105"/>` : '<div class="cart-placeholder" aria-hidden="true">GT<br/>CONCEPT</div>'}<div><h3><a href="${e(href(`products/${line.productHandle}/`))}">${e(line.title)}</a></h3><p>${e(line.size)} / ${e(line.color)}</p><p>${e(formatMoney(line.price))} each</p><div class="cart-line-controls"><div class="quantity-controls"><button data-quantity="-1" data-focus-key="minus-${i}" aria-label="Decrease quantity for ${e(line.title)}" ${line.quantity<=1?'disabled':''}>−</button><input type="number" min="1" max="99" value="${line.quantity}" data-line-quantity data-focus-key="quantity-${i}" aria-label="Quantity for ${e(line.title)}"/><button data-quantity="1" data-focus-key="plus-${i}" aria-label="Increase quantity for ${e(line.title)}" ${line.quantity>=99?'disabled':''}>+</button></div><strong>${e(formatMoney(line.total))}</strong><button class="cart-remove" data-remove-line data-focus-key="remove-${i}">Remove<span class="sr-only"> ${e(line.title)}</span></button></div></div></article>`).join('') : `<div class="empty-state"><h3>Your loadout is empty.</h3><p>Find something that carries your signal.</p><a class="text-link" href="${e(href('shop/'))}">Explore the armory →</a></div>`;
    $('#cart-summary')!.innerHTML=`<div class="cart-subtotal"><span>Subtotal</span><strong>${e(formatMoney(cart.subtotal))}</strong></div><p class="cart-note">${cart.demo?'Demo prices. No payment is collected and no order is placed.':'Shipping, taxes, and any applicable discounts are calculated at Shopify checkout. Availability and prices are rechecked there.'}</p>`;
    status.textContent=cart.warnings.join(' ');
    checkoutButton.disabled=!cart.lines.length;
    if(focusKey) { const next=$$<HTMLElement>('[data-focus-key]').find(el=>el.dataset.focusKey===focusKey); (next??checkoutButton).focus({preventScroll:true}); }
  }
  async function mutate(action: (current:Cart)=>Promise<Cart>, success: string) {
    if(busy) return false;
    busy=true; status.textContent='Updating your loadout…'; $('#cart-lines')?.setAttribute('aria-busy','true');
    try { cart=await action(await ensureCart()); render(); announce(success); return true; }
    catch(error) { status.textContent=error instanceof Error?error.message:'Your cart could not be updated. Please try again.'; announce(status.textContent); return false; }
    finally { busy=false; $('#cart-lines')?.removeAttribute('aria-busy'); }
  }
  async function openCart(trigger?:HTMLElement) {
    openDialog('cart-dialog',trigger); status.textContent='Loading your loadout…';
    try { await ensureCart(); if(cart && !cart.demo) { cart=await provider.getCart(cart.id)??await provider.createCart(); save(key,cart.id); } render(); }
    catch { status.textContent='The store could not load your cart. Reconnect and open Loadout to try again.'; }
  }
  async function checkout() {
    if(busy) return;
    busy=true; checkoutButton.disabled=true; status.textContent='Checking availability…';
    try {
      const current=await ensureCart();
      if(!current.lines.length) throw new Error('Add an item before checkout.');
      if(!current.demo && !config.launchApproved) throw new Error('Store preview: the owner must approve product details, policies, and checkout before payments open.');
      const url=await provider.getCheckoutUrl(current.id);
      // Provider validates the exact configured checkout hostname before this redirect.
      window.location.assign(url);
    } catch(error) { status.textContent=error instanceof Error?error.message:'Checkout could not be opened. No new order was placed by this page.'; }
    finally { busy=false; checkoutButton.disabled=!cart?.lines.length; }
  }
  checkoutButton.addEventListener('click',()=>void checkout());
  document.addEventListener('click', event=>{
    const target=event.target as Element;
    const cartTrigger=target.closest<HTMLElement>('[data-open-cart]');
    if(cartTrigger) void openCart(cartTrigger);
    const lineElement=target.closest<HTMLElement>('[data-line]');
    const line=cart?.lines.find(l=>l.id===lineElement?.dataset.line);
    if(line && target.closest('[data-remove-line]')) void mutate(c=>provider.removeCartLine(c.id,line.id),'Item removed from shopping cart.');
    const delta=target.closest<HTMLElement>('[data-quantity]')?.dataset.quantity;
    if(line && delta) void mutate(c=>provider.updateCartLine(c.id,line.id,line.quantity+Number(delta)),'Shopping cart quantity updated.');
    const quick=target.closest<HTMLElement>('[data-quick-view]');
    if(quick) showQuick(quick.dataset.quickView!);
  });
  $('#cart-lines')!.addEventListener('change',event=>{
    const input=event.target as HTMLInputElement;
    if(!input.matches('[data-line-quantity]'))return;
    const id=input.closest<HTMLElement>('[data-line]')?.dataset.line;
    if(id) void mutate(c=>provider.updateCartLine(c.id,id,Number(input.value)),'Shopping cart quantity updated.');
  });
  function updateForm(form: HTMLFormElement) {
    const product=products.find(p=>p.handle===form.dataset.addForm); if(!product)return;
    const data=new FormData(form), variant=selectVariant(product,String(data.get('size')),String(data.get('color')));
    const price=$('[data-selected-price]',form.closest('[data-product-detail]')??form); if(price)price.textContent=formatMoney(variant?.price??product.price);
    const notice=$('[data-variant-status]',form); if(notice)notice.textContent=!variant?'This combination does not exist. Choose another size or color.':!variant.available?'This variant is unavailable.':product.demo?'Demo options — real inventory is not connected.':'Available. Final inventory and price checked at checkout.';
    const submit=$<HTMLButtonElement>('[type=submit]',form); if(submit)submit.disabled=!variant?.available;
  }
  async function add(form:HTMLFormElement, buy=false) {
    if(form.dataset.busy==='true'||busy) return;
    const product=products.find(p=>p.handle===form.dataset.addForm); if(!product||!form.reportValidity())return;
    const data=new FormData(form), variant=selectVariant(product,String(data.get('size')),String(data.get('color')));
    const note=$('[data-purchase-status]',form); if(!variant?.available) {if(note)note.textContent='Select an available size and color.';return;}
    form.dataset.busy='true'; const button=$<HTMLButtonElement>('[type=submit]',form)!; button.disabled=true;
    if(note)note.textContent='Adding to your loadout…';
    const ok=await mutate(c=>provider.addCartLine(c.id,variant.id,Number(data.get('quantity'))),'Item added to shopping cart.');
    if(ok) { if(note)note.textContent='Added to shopping cart.'; openDialog('cart-dialog',button); if(buy)await checkout(); }
    else if(note)note.textContent=status.textContent;
    form.dataset.busy='false'; updateForm(form);
  }
  function bindForm(form:HTMLFormElement) {
    updateForm(form); form.addEventListener('change',()=>updateForm(form));
    form.addEventListener('submit',event=>{event.preventDefault();void add(form);});
    $('[data-buy-now]',form)?.addEventListener('click',()=>void add(form,true));
  }
  function showQuick(handle:string) {
    const p=products.find(x=>x.handle===handle); if(!p)return;
    const initial=p.variants.find(v=>v.available)??p.variants[0];
    $('#quick-content')!.innerHTML=`<div class="quick-layout">${p.images[0]?`<img src="${e(media(p.images[0].src))}" alt="${e(p.images[0].alt)}"/>`:'<div class="empty-state">Product imagery pending<br/>CONCEPT DISPLAY</div>'}<div><p class="mono gold">${e(p.collection.replaceAll('-',' '))}</p><h2 id="quick-title">${e(p.title)}</h2><p>${e(formatMoney(p.price))} ${p.demo?' / DEMO PRODUCT':''}</p><form data-add-form="${e(p.handle)}"><label>Size<select name="size">${p.sizes.map(x=>`<option ${x===initial?.size?'selected':''}>${e(x)}</option>`).join('')}</select></label><label>Color<select name="color">${p.colors.map(x=>`<option ${x===initial?.color?'selected':''}>${e(x)}</option>`).join('')}</select></label><label>Quantity<input type="number" name="quantity" min="1" max="99" value="1" required/></label><p class="availability" data-variant-status></p><button class="button" type="submit" aria-label="Add this item to shopping cart">Add to Loadout →</button><p data-purchase-status role="status"></p></form><a class="text-link" href="${e(href(`products/${p.handle}/`))}">View full product →</a></div></div>`;
    $('#quick-status')!.textContent=''; bindForm($<HTMLFormElement>('[data-add-form]',$('#quick-content')!)!); openDialog('quick-dialog');
  }
  $$<HTMLFormElement>('[data-add-form]').forEach(bindForm);
  if(config.commerceMode==='demo'||saved(key)) void ensureCart().catch(()=>{announce('Saved cart is temporarily unavailable. Open Loadout to retry.');});
}
