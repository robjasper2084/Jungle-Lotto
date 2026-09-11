(function installBrandCompanion() {
  'use strict';
  const root = window.__LOTTOMIND_ROOT__ || '';
  const native = window.Capacitor?.isNativePlatform?.() || location.protocol === 'capacitor:';
  const store = native ? 'https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/' : `${root}/lottominded-ultra.io/games/gothtechnology2/`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let dataPromise, rewardPromise, data;
  const money = price => new Intl.NumberFormat('en-US', {style:'currency', currency:price.currency}).format(price.amount / 100);
  const localUrl = path => new URL(path, new URL(store, location.href)).href;
  function load() {
    if (!dataPromise) dataPromise = fetch(`${store}api/companion.json`).then(response => {
      if (!response.ok) throw new Error('Catalog unavailable');
      return response.json();
    }).then(value => {
      if (value.version !== 1 || !Array.isArray(value.products) || !Array.isArray(value.games)) throw new Error('Catalog unavailable');
      data = value; return value;
    }).catch(error => { dataPromise = null; throw error; });
    return dataPromise;
  }
  function rewards() {
    if (!rewardPromise) rewardPromise = import(localUrl('arcade/rewards.js')).catch(error => { rewardPromise = null; throw error; });
    return rewardPromise;
  }
  function strip() {
    return `<nav class="gt-connection-bar" aria-label="GOTHTECHNOLOGY connection"><button type="button" data-route="companion">GOTHTECHNOLOGY <span>× LottoMind</span></button><a href="${store}shop/">Shop the brand ↗</a></nav>`;
  }
  function teaser() {
    return `<section class="panel gt-teaser"><img src="${store}media/underground-armory-campaign-v1.webp" alt="Robot RAHBE Underground campaign art" loading="lazy"/><div><span class="eyebrow">The GOTHTECHNOLOGY companion</span><h2>Create. Play.<br/>Carry your signal.</h2><p>Take Knight Protocol from the Armory into your games, music, and creative studio.</p><div class="gt-actions"><button class="primary-btn" type="button" data-route="companion">Explore the connection</button><button class="ghost-btn" type="button" data-route="store">Shop GOTHTECHNOLOGY</button></div></div></section>`;
  }
  function pending(kind) {
    return `<div class="gt-loaded" data-gt-view="${kind}" aria-busy="true"><p role="status">Connecting to the Armory…</p><a href="${store}shop/">Open the GOTHTECHNOLOGY catalog →</a></div>`;
  }
  function hub() { return `<section class="screen gt-screen"><div class="panel gt-intro"><span class="eyebrow">GOTHTECHNOLOGY × LottoMind</span><h1>Carry your signal.</h1><p>The digital companion to GOTHTECHNOLOGY. Create. Play. Carry your signal.</p><div class="gt-actions"><a class="primary-btn" href="${store}#current-drop">Explore Knight Protocol</a><button class="ghost-btn" data-route="store">Shop GOTHTECHNOLOGY</button></div></div>${pending('hub')}</section>`; }
  function shop() { return `<section class="screen gt-screen"><div class="panel gt-intro"><span class="eyebrow">Marketplace Vault / The Armory</span><h1>Shop GOTHTECHNOLOGY</h1><p>The same products and prices as the brand website. Open a product to select options and save it to your launch loadout.</p><p class="gt-note">Concept previews. No orders or payments.</p><div class="gt-actions"><a class="primary-btn" href="${store}shop/">Open full storefront</a><button class="ghost-btn" data-route="marketplace">Marketplace Vault</button></div></div>${pending('shop')}<details class="panel gt-archive"><summary>Earlier LottoMind gear</summary><p>Your earlier LottoMind merchandise selections remain in their separate saved cart.</p><button class="ghost-btn" data-route="legacyGear">View earlier gear & saved cart</button></details></section>`; }
  function rewardStrip() {
    return `<section class="panel gt-rewards" aria-label="Shared game discount preview"><dl><div><dt>Total game points</dt><dd data-gt-points>—</dd></div><div><dt>Discount preview</dt><dd data-gt-discount>—</dd></div><div><dt>Next milestone</dt><dd data-gt-next>Loading…</dd></div></dl><p class="gt-note">Five GOTHTECHNOLOGY games share progress on this browser. Preview only; not redeemable. Separate from LottoCredits.</p><p class="gt-note" data-gt-storage role="status"></p><a href="${store}#underground-rewards">How rewards work →</a></section>`;
  }
  function track(value) {
    return `<section class="panel gt-track"><span class="eyebrow">Drop 001 / The soundtrack</span><h2>${escape(value.soundtrack.title)}</h2><p>${escape(value.soundtrack.description)}</p><audio class="radio-audio" controls preload="none" src="${escape(value.soundtrack.src)}" aria-label="Play Knight Protocol soundtrack"></audio><p class="gt-note" data-gt-audio-error role="status" hidden>Soundtrack unavailable. Try again or open LottoMind Radio.</p><div class="gt-actions"><button class="ghost-btn" data-route="radioStation">LottoMind Radio</button><button class="ghost-btn" data-route="studio">Sonic Studio</button></div></section>`;
  }
  function briefs(value) {
    return `<section class="panel"><span class="eyebrow">Create your transmission</span><h2>Choose a creative brief.</h2><p>Start with a branded prompt. Video Studio builds an editable local storyboard; these are not rendered films.</p><div class="gt-briefs">${value.briefs.map(brief => `<article><img src="${escape(brief.image)}" alt="${escape(brief.title)} campaign concept" loading="lazy"/><h3>${escape(brief.title)}</h3><p>${escape(brief.caption)}</p><details><summary>Read the brief</summary><p>${escape(brief.prompt)}</p></details><div class="gt-actions"><button class="primary-btn" data-action="gt-brief" data-brief="${escape(brief.id)}" data-destination="dreamVideo">Use in Video Studio</button><button class="ghost-btn" data-action="gt-brief" data-brief="${escape(brief.id)}" data-destination="dreams">Use in Dream Oracle</button></div></article>`).join('')}</div></section>`;
  }
  function hubContent(value) {
    return `${rewardStrip()}<section class="panel gt-drop"><img src="${store}media/night-protocol-hoodie-armory-card-v1.webp" alt="Knight Protocol hoodie campaign concept"/><div><span class="eyebrow">Drop 001 / Detroit</span><h2>Knight Protocol</h2><p>A hoodie, an everyday companion, and a world beneath the city. Follow the same story through the shop, the arcade, and the studio.</p><a class="primary-btn" href="${escape(value.drop.collectionUrl)}">Explore the collection →</a></div></section><section class="panel"><span class="eyebrow">No purchase required</span><h2>Choose a game.</h2><div class="gt-games">${value.games.map((game,index) => `<a href="${escape(game.url)}"><span>${String(index+1).padStart(2,'0')} / PLAY</span><h3>${escape(game.title)}</h3><p>${escape(game.rule)}</p><strong>Play game →</strong></a>`).join('')}</div></section>${track(value)}${briefs(value)}<section class="panel gt-share"><div><span class="eyebrow">Take the signal with you</span><h2>One link to the drop.</h2><p>Scan to visit the public drop. Save the QR for a tag, campaign, or future packaging.</p><div class="gt-actions"><button class="ghost-btn" data-gt-copy-link>Copy public drop link</button><a href="${escape(value.drop.qr)}" download="knight-protocol-qr.svg">Download QR</a></div><p data-gt-copy-status role="status"></p><a href="${escape(value.drop.publicUrl)}">Open public drop →</a></div><img src="${escape(value.drop.qr)}" alt="QR code for the Knight Protocol public drop" width="192" height="192"/></section><section class="panel gt-account"><h2>Your LottoMind account</h2><p>Open the existing account and wallet tools in LottoMind. Store discount previews remain on this browser; they do not authorize account credits or purchases.</p><button class="ghost-btn" data-route="profile">Account & wallet status</button></section>`;
  }
  function productCard(product) {
    return `<article class="gt-product" data-gt-product data-category="${escape(product.category)}" data-title="${escape(product.title.toLowerCase())}"><a href="${escape(product.url)}" class="gt-product-art">${product.image ? `<img src="${escape(product.image.src)}" alt="${escape(product.image.alt)}" loading="lazy" style="${escape(Object.entries(product.image.framing || {}).map(([key,value])=>key+':'+value).join(';'))}"/>` : ''}</a><div class="gt-product-copy"><small>${escape(product.collectionTitle || 'GOTHTECHNOLOGY')}</small><h2><a href="${escape(product.url)}">${escape(product.title)}</a></h2><details><summary>Pricing & details</summary><p>${escape(product.description)}</p><p>${escape(product.colors.join(' / '))}</p>${product.price.amount > 0 ? `<p>Before game discount<br/><strong>${escape(money(product.price))}</strong></p><p class="gt-price-preview" data-gt-price="${product.price.amount}" data-currency="${escape(product.price.currency)}">Discount preview loading…</p>` : '<p>Price pending</p>'}<p class="gt-note">Concept preview · Not redeemable yet</p></details><a class="gt-product-link" href="${escape(product.url)}">View product & options →</a></div></article>`;
  }
  function shopContent(value) {
    return `${rewardStrip()}<section class="panel gt-catalog"><div class="gt-filters"><label>Search products<input type="search" data-gt-search placeholder="Hoodie, charm, Detroit…"/></label><label>Category<select data-gt-category><option value="">All gear</option>${[...new Set(value.products.map(product=>product.category))].map(category=>`<option>${escape(category)}</option>`).join('')}</select></label></div><p data-gt-count role="status">${value.products.length} products</p><div class="gt-products">${value.products.map(productCard).join('')}</div><p data-gt-empty hidden>No products match. Try another search or category.</p></section>`;
  }
  async function updateRewards(container = document) {
    if (!container.querySelector('[data-gt-points]')) return;
    try {
      const module = await rewards(), progress = module.readDiscountPreview();
      container.querySelectorAll('[data-gt-points]').forEach(node=>node.textContent=progress.totalPoints.toLocaleString('en-US'));
      container.querySelectorAll('[data-gt-discount]').forEach(node=>node.textContent=`${progress.percent}%`);
      container.querySelectorAll('[data-gt-next]').forEach(node=>node.textContent=progress.next ? `${progress.remaining.toLocaleString('en-US')} points to ${progress.next.percent}%` : 'Maximum 20% preview');
      container.querySelectorAll('[data-gt-storage]').forEach(node=>node.textContent=progress.saved ? '' : 'Session only — browser storage is unavailable.');
      container.querySelectorAll('[data-gt-price]').forEach(node=>{ const estimate=module.discountEstimate(progress.totalPoints,Number(node.dataset.gtPrice));node.textContent=progress.percent ? `With your ${progress.percent}% game discount preview: ${money({amount:estimate.total,currency:node.dataset.currency})}` : 'Play to build a discount preview of up to 20%.'; });
    } catch {
      container.querySelectorAll('[data-gt-next]').forEach(node=>node.textContent='Progress unavailable');
      container.querySelectorAll('[data-gt-price]').forEach(node=>node.textContent='Open the storefront to check your discount preview.');
    }
  }
  function bind(container,value) {
    const filter=()=>{ const term=container.querySelector('[data-gt-search]')?.value.toLowerCase().trim()||'',category=container.querySelector('[data-gt-category]')?.value||'';let count=0;container.querySelectorAll('[data-gt-product]').forEach(card=>{card.hidden=Boolean((term&&!card.dataset.title.includes(term))||(category&&card.dataset.category!==category));if(!card.hidden)count++;});const label=container.querySelector('[data-gt-count]');if(label)label.textContent=`${count} products`;const empty=container.querySelector('[data-gt-empty]');if(empty)empty.hidden=count>0;};
    container.querySelector('[data-gt-search]')?.addEventListener('input',filter);
    container.querySelector('[data-gt-category]')?.addEventListener('change',filter);
    container.querySelector('[data-gt-copy-link]')?.addEventListener('click',async()=>{const status=container.querySelector('[data-gt-copy-status]');try{await navigator.clipboard.writeText(value.drop.publicUrl);status.textContent='Public drop link copied.';}catch{status.textContent=`Copy this link: ${value.drop.publicUrl}`;}});
    container.querySelectorAll('audio').forEach(player=>{player.addEventListener('play',()=>document.querySelectorAll('audio').forEach(other=>{if(other!==player)other.pause();}));player.addEventListener('error',()=>{const notice=player.parentElement.querySelector('[data-gt-audio-error]');if(notice)notice.hidden=false;});});
    void updateRewards(container);
  }
  function hydrate(rootElement) {
    rootElement.querySelectorAll('[data-gt-view]').forEach(container=>{void load().then(value=>{if(!container.isConnected)return;container.innerHTML=container.dataset.gtView==='shop'?shopContent(value):hubContent(value);container.removeAttribute('aria-busy');bind(container,value);}).catch(()=>{if(!container.isConnected)return;container.removeAttribute('aria-busy');container.innerHTML=`<section class="panel"><h2>The Armory could not connect.</h2><p role="status">Check your connection or open the storefront directly.</p><a class="primary-btn" href="${store}shop/">Open GOTHTECHNOLOGY</a><button class="ghost-btn" data-gt-retry>Retry connection</button></section>`;container.querySelector('[data-gt-retry]').addEventListener('click',()=>{container.setAttribute('aria-busy','true');hydrate(rootElement);});});});
  }
  function getBrief(id) { return data?.briefs.find(brief=>brief.id===id); }
  window.addEventListener('storage',()=>void updateRewards());
  window.addEventListener('pageshow',()=>void updateRewards());
  window.addEventListener('focus',()=>void updateRewards());
  function buildPlan(text) {
    const brief = data?.briefs.find(item => text.startsWith(item.prompt.split('.')[0]));
    if (!brief) return null;
    const scenes = {
      'knight-protocol': [['Detroit after midnight','0–4 sec','A quiet street, wet stone, and a narrow line of gold light.'],['The 313 hoodie','4–8 sec','Move close to the black hoodie and its embroidery. Cyan stays a small accent.'],['The everyday companion','8–12 sec','The LottoMind charm moves gently on a bag. Hold on the gold clasp.'],['Carry your signal','12–15 sec','A still black-and-gold end card: GOTHTECHNOLOGY. Bloom Through Gloom.']],
      underground: [['The city above','0–4 sec','A quiet Detroit street at midnight.'],['The entrance','4–8 sec','A gold-lit arch leads beneath the street.'],['Follow RAHBE','8–12 sec','RAHBE follows a restrained cyan signal through the underground vault.'],['Enter the arcade','12–15 sec','End on the game title and a clear invitation to play. No purchase required.']],
      'detroit-2084': [['The skyline','0–4 sec','Detroit at dusk, framed in black and antique gold.'],['After the rain','4–8 sec','An amber streetlight reflects across wet pavement.'],['The companion','8–12 sec','A close view of the LottoMind character and its cyan circuit details.'],['Your transmission','12–15 sec','Carry your signal appears on black. Leave space for the brand mark.']],
    };
    return { branded:true, title:`${brief.title} Storyboard`, tone:'Campaign concept', prompt:text, image:brief.image, frames:scenes[brief.id],
      reading:{id:`gt-${brief.id}`,title:`${brief.title} Storyboard`,symbols:[],numbers:[],note:text,summary:'Local campaign storyboard. Not a rendered video.'} };
  }
  function studio(plan) {
    return `<section class="screen gt-screen"><section class="panel"><span class="eyebrow">GOTHTECHNOLOGY / Video Studio</span><h1>${escape(plan.title)}</h1><p>A four-shot campaign template. Edit your brief and save the plan on this device. No video has been rendered.</p><button class="ghost-btn" data-route="companion">Choose another brief</button></section><section class="panel gt-video-builder"><label for="gt-creative-prompt">Your creative brief</label><textarea id="gt-creative-prompt" data-bind="dreamText" rows="8">${escape(plan.prompt)}</textarea><div class="gt-actions"><button class="primary-btn" data-action="build-dream-video">Generate Scenes</button><button class="ghost-btn" data-action="save-video-storyboard">Save Storyboard</button><button class="ghost-btn" data-route="records">Open Records</button></div></section><section class="panel" id="dream-video-storyboard" aria-labelledby="dream-video-storyboard-title"><h2 id="dream-video-storyboard-title" tabindex="-1">${escape(plan.title)}</h2><p>Four suggested shots. Your edited brief is saved alongside them.</p><img class="gt-board-image" src="${escape(plan.image)}" alt="Campaign concept for the storyboard"/><ol class="gt-board-scenes">${plan.frames.map(([title,time,description])=>`<li><small>${escape(time)}</small><h3>${escape(title)}</h3><p>${escape(description)}</p></li>`).join('')}</ol></section></section>`;
  }
  window.LottoMindBrand = { strip, teaser, hub, shop, hydrate, getBrief, buildPlan, studio, store };
})();
