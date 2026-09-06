import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const product=base+'products/night-protocol-hoodie/';
const settle=async page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const ready=async page=>{await expect(page.locator('#store-data')).toBeAttached();await expect(page.locator('#sound-toggle')).toHaveText(/^Sound (?:on|off)$/);};

test('visual: homepage renders, keeps content accessible, and only loads the silent hero video',async({page},info)=>{
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{window.__metrics={lcp:0,cls:0};try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__metrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__metrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch{}});
  await page.goto(base+'?build=a4eb5ec6');await ready(page);await page.evaluate(()=>document.fonts.ready);await expect(page.getByRole('heading',{level:1})).toHaveText(/Equipment\s*for the world\s*after midnight/);
  await expect(page.locator('img.hero-image')).toBeVisible();await expect.poll(()=>page.locator('img.hero-image').evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  await page.screenshot({path:info.outputPath('home-viewport.png')});
  const metrics=await page.evaluate(()=>({...window.__metrics,width:innerWidth,height:innerHeight,domReady:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd,resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize}))}));
  await writeFile(info.outputPath('performance.json'),JSON.stringify(metrics,null,2));
  expect(requests.filter(u=>!u.includes('armory-hero-higgsfield-loop.mp4')).some(u=>/\/src\/main\.js|motion-atlases|\.mp4|lottomind-vault-174hz-background\.mp3|\/cathedral\.|\/model\.|\/three\./.test(u))).toBe(false);
  expect(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&!el.closest('.equipment-art,.signal-portrait,.lookbook-strip,.hero,dialog')).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))}))).toMatchObject({scroll:info.project.use.viewport.width});
  for(const section of await page.locator('main>section').all()){await section.scrollIntoViewIfNeeded();}await expect.poll(()=>page.locator('main img[src]').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));await page.screenshot({path:info.outputPath('home-full.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('Armory background music stays user initiated and follows the visitor across pages',async({page})=>{
  await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('play'));return Promise.resolve();};});
  await page.goto(base);
  const audio=page.locator('#armory-background-music');
  await expect(audio).toHaveAttribute('src',base+'media/lottomind-vault-174hz-background.mp3');
  await expect(audio).not.toHaveAttribute('autoplay','');await expect(audio).toHaveAttribute('loop','');await expect(audio).toHaveAttribute('preload','none');
  const heroSound=page.locator('[data-toggle-sound]');
  await expect(heroSound).toBeVisible();await expect(heroSound).toHaveText('Sound off');await expect(page.locator('#sound-toggle')).toHaveText('Sound off');
  await heroSound.click();await expect(heroSound).toHaveText('Sound on');await expect(page.locator('#sound-toggle')).toHaveText('Sound on');
  await page.goto(base+'shop/');await expect(page.locator('[data-background-audio]')).toHaveCount(1);await expect(page.locator('#sound-toggle')).toHaveText('Sound on');
  await page.locator('[data-open-settings]').last().click();await page.locator('#sound-toggle').click();
  await expect(page.locator('#sound-toggle')).toHaveText('Sound off');await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed','false');
});

test('shopping cart: launch preferences, quantity, persistence, alert flow and focus',async({page},info)=>{
  await page.goto(product);await ready(page);await page.getByRole('radio',{name:'M',exact:true}).check();await page.getByLabel('Quantity',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Save to Launch Loadout',exact:true}).click();const cart=page.getByRole('dialog',{name:'Your Launch Loadout'});await expect(cart).toBeVisible();await expect(cart).toContainText('M / Obsidian');await expect(cart.locator('.cart-subtotal')).toContainText('$178');
  await page.getByRole('button',{name:/Increase quantity/}).click();await expect(cart.locator('.cart-subtotal')).toContainText('$267');
  await expect(cart).toContainText('Save products and options on this device for launch day.');
  await page.screenshot({path:info.outputPath('launch-loadout.png'),scale:'css'});
  await cart.getByRole('button',{name:'Get Launch Alert',exact:true}).click();
  const alert=page.locator('#launch-alert-dialog');await expect(alert).toBeVisible();
  await expect(alert.locator('[data-launch-selection]')).toContainText('M / Obsidian × 3');
  await expect(alert.getByLabel('Email address',{exact:true})).toBeDisabled();await expect(alert.getByRole('checkbox')).toBeDisabled();
  await expect(alert.getByRole('button',{name:'Get Launch Alert',exact:true})).toBeDisabled();await expect(alert).toContainText('Your email was not saved or sent.');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('qa@example.test');
  await page.screenshot({path:info.outputPath('launch-alert.png'),scale:'css'});
  await page.keyboard.press('Escape');await expect(cart).not.toBeVisible();await expect(page.getByRole('button',{name:'Save to Launch Loadout',exact:true})).toBeFocused();
  await page.reload();await page.getByRole('button',{name:'Open launch loadout'}).click();await expect(cart.locator('.cart-subtotal')).toContainText('$267');
  await page.getByRole('button',{name:/Remove Knight Protocol/}).click();await expect(cart).toContainText('Your launch loadout is empty.');await expect(cart.getByRole('button',{name:'Get Launch Alert',exact:true})).toBeDisabled();
});

test('catalog filters, sorting, no-results and product actions work',async({page})=>{
  await page.goto(base+'shop/');const defaultOrder=await page.locator('[data-product-card]').evaluateAll(nodes=>nodes.filter(node=>!node.hidden).sort((a,b)=>Number(a.style.order)-Number(b.style.order)).map(node=>node.dataset.handle));expect(defaultOrder.slice(0,3)).toEqual(['night-protocol-hoodie','detroit-2084-shirt','detroit-winter-sunset-artwork']);
  const ticker=page.locator('.lotto-ticker');await expect(ticker).toContainText('LottoMind Lottery and Tool Generator App Coming Soon');await expect(ticker).toBeVisible();expect(await ticker.locator('.lotto-ticker-track span').first().evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(page.viewportSize().width<=560?36:44);
  await page.goto(base+'shop/?category=Accessories');await expect(page.locator('#result-count')).toHaveText('5 products');
  const mobsterCharm=page.locator('[data-product-card][data-handle="mobster-luggage-charm"]');await expect(mobsterCharm).toContainText('Mobster Luggage Charm');await expect(mobsterCharm).toContainText('$19.99');
  await expect(mobsterCharm.locator('img')).toHaveAttribute('src',/\/media\/mobster-luggage-charm-armory-campaign-v2\.webp$/);
  await expect(page.locator('[data-product-card][data-handle="gothtechnology-luggage-charm"] img')).toHaveAttribute('src',/\/media\/gothtechnology-luggage-charm-armory-higgsfield-v1\.webp$/);
  const railAdapter=page.locator('[data-product-card][data-handle="black-signal-digital-pack"]');await expect(railAdapter).toContainText('Black Signal Gun Charm Rail Adapter Pack');await expect(railAdapter).toContainText('$12');
  await expect(railAdapter.locator('img')).toHaveAttribute('src',/\/media\/black-signal-gun-charm-rail-adapter-black-group-reference\.webp$/);
  await expect(page.locator('[data-product-card][data-handle="key-knife-keychain"] img')).toHaveAttribute('src',/\/media\/key-knife-gothic-open-side-campaign\.webp$/);
  await page.getByLabel('Search products',{exact:true}).fill('GOTHTECHNOLOGY Luggage Charm');await expect(page.locator('[data-product-card]:visible')).toHaveCount(1);
  await page.getByRole('button',{name:'Save to Launch Loadout: GOTHTECHNOLOGY Luggage Charm',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Your Launch Loadout'})).toContainText('$19.99');await page.keyboard.press('Escape');
  await page.getByLabel('Search products',{exact:true}).fill('zzz-no-match');await expect(page.locator('#no-results')).toBeVisible();
  await page.locator('#no-results').getByRole('button',{name:'Clear filters'}).click();await expect(page.locator('#result-count')).toHaveText('19 products');
  await page.getByLabel('Search products',{exact:true}).fill('Boog');await expect(page.locator('[data-product-card]:visible')).toHaveCount(1);
  const boogeyman=page.locator('[data-product-card][data-handle="boogeyman-graphic-hoodie"]');await expect(boogeyman).toContainText('Pending');await expect(boogeyman.locator('img')).toHaveAttribute('src',/-campaign\.webp$/);await expect(boogeyman.locator('[data-save-product],[data-quick-view]')).toHaveCount(0);await expect(page.locator('[data-product-card][data-handle="boogie-man-knit-sweater"]')).toHaveCount(0);
  await page.getByLabel('Search products',{exact:true}).fill('');
  await page.getByRole('combobox',{name:'Sort',exact:true}).selectOption('price-low');
  const order=await page.locator('[data-product-card]').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).sort((a,b)=>Number(a.style.order)-Number(b.style.order)).map(n=>n.dataset.handle));expect(order[0]).toBe('key-knife-keychain');
  await page.getByLabel('Search products',{exact:true}).fill('hoodie');
  await page.getByRole('button',{name:/Choose Options for Knight Protocol/}).click();
  const quick=page.locator('#quick-dialog');await expect(quick).toBeVisible();
  await quick.getByRole('combobox',{name:'Size',exact:true}).selectOption('L');
  await quick.getByRole('button',{name:'Save to Launch Loadout',exact:true}).click();
  await expect(page.locator('#cart-dialog')).toContainText('L / Obsidian');
});

test('homepage keeps the four core beats and links deeper world-building from navigation',async({page})=>{
  await page.goto(base);
  for(const selector of ['#current-drop','#featured','#character-vault','#enter-the-fight'])await expect(page.locator(selector)).toBeVisible();
  await expect(page.locator('.site-header .wordmark span')).toHaveText('// Bloom Through Gloom');
  await expect(page.locator('.site-footer .wordmark span')).toHaveText('// THE ARMORY');
  await expect(page.getByRole('heading',{level:1,name:'Equipment for the world after midnight'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Shop the current drop',exact:true})).toHaveAttribute('href','#current-drop');
  await expect(page.getByRole('button',{name:'Watch transmission',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Explore the Armory',exact:true})).toHaveAttribute('href','#armory');
  await expect(page.locator('.lotto-ticker')).toHaveCount(0);
  const storyOrder=await page.locator('main > section').evaluateAll(nodes=>nodes.filter(node=>node.matches('#current-drop,#armory,#featured,#character-vault,#combat-lookbook,#enter-the-fight,.armory-origin,.newsletter')).map(node=>node.id||(node.classList.contains('armory-origin')?'origin':'newsletter')));
  expect(storyOrder).toEqual(['current-drop','armory','featured','character-vault','combat-lookbook','enter-the-fight','origin','newsletter']);
  await expect(page.locator('#current-drop .drop-price')).toContainText('$89');
  await expect(page.locator('[data-product-card][data-handle="night-protocol-hoodie"]')).toContainText('$89');
  await expect(page.locator('#featured [data-product-card][data-handle="boogeyman-graphic-hoodie"]')).toHaveCount(0);
  await expect(page.locator('#featured [data-product-card][data-handle="static-saints-patch-set"]')).toHaveCount(0);
  await expect(page.locator('#featured [data-product-card][data-handle="detroit-winter-sunset-artwork"] img')).toHaveAttribute('src',/detroit-winter-sunset-simple-frame-campaign\.webp$/);
  await expect(page.locator('#featured [data-product-card]')).toHaveCount(6);
  await expect(page.locator('#featured [data-product-card]').first()).toHaveAttribute('data-handle','detroit-winter-sunset-artwork');
  const armoryCases=page.locator('#armory .equipment-case');await expect(armoryCases).toHaveCount(6);await expect(armoryCases.locator('h3')).toHaveText(['Original Artwork','Apparel','Accessories','Collectibles','Digital','Bundles']);
  const originalArtworkCase=page.getByRole('link',{name:/Original Artwork/});await expect(originalArtworkCase.locator('img')).toHaveAttribute('src',base+'media/detroit-winter-sunset-simple-frame-campaign.webp');
  const accessoriesCase=page.getByRole('link',{name:/Accessories/});await expect(accessoriesCase.locator('img')).toHaveAttribute('src',base+'media/key-knife-signal-ensemble-campaign.webp');
  const categoryArtwork=page.locator('#armory .category-product-art img');await expect(categoryArtwork).toHaveCount(4);expect(await categoryArtwork.evaluateAll(images=>images.every(image=>getComputedStyle(image).objectFit==='cover'))).toBe(true);
  const figures=page.locator('.drop-showcase>figure');await expect(figures).toHaveCount(2);const geometry=await figures.evaluateAll(items=>items.map(figure=>{const button=figure.querySelector('.material-hotspot')?.getBoundingClientRect(),art=figure.querySelector('.equipment-art')?.getBoundingClientRect();return {buttonTop:button?.top,artTop:art?.top,artHeight:art?.height};}));expect(Math.abs(geometry[0].buttonTop-geometry[1].buttonTop)).toBeLessThan(1);expect(Math.abs(geometry[0].artTop-geometry[1].artTop)).toBeLessThan(1);expect(Math.abs(geometry[0].artHeight-geometry[1].artHeight)).toBeLessThan(1);
  await page.getByRole('button',{name:'Inspect embroidery',exact:true}).click();const material=page.getByRole('dialog',{name:'The embroidery study'});await expect(material).toBeVisible();const embroideryFilm=page.getByLabel('Embroidery study supplied product film');await expect(embroideryFilm).toBeVisible();await expect(embroideryFilm).toHaveAttribute('src',base+'media/embroidery-study-supplied-film-v1.mp4');await expect(embroideryFilm).toHaveAttribute('controls','');await expect(embroideryFilm).toHaveAttribute('autoplay','');expect(await embroideryFilm.evaluate(video=>!video.muted&&video.volume===1)).toBe(true);await expect(material.locator('#material-image')).toBeHidden();await expect(material.getByRole('button',{name:'Zoom detail'})).toBeHidden();await page.keyboard.press('Escape');await expect(embroideryFilm).not.toHaveAttribute('src');
  await page.getByRole('button',{name:'Inspect the charm',exact:true}).click();const charmFilm=page.getByLabel('Signature charm supplied product film');await expect(page.getByRole('dialog',{name:'The signature charm'})).toBeVisible();await expect(charmFilm).toBeVisible();await expect(charmFilm).toHaveAttribute('src',base+'media/signature-charm-supplied-film-v1.mp4');await expect(charmFilm).toHaveAttribute('autoplay','');expect(await charmFilm.evaluate(video=>!video.muted&&video.volume===1)).toBe(true);await expect(material.locator('#material-image')).toBeHidden();await page.keyboard.press('Escape');
  await expect(page.locator('main .campaign-film,main #combat-lookbook,main .armory-origin,main #armory')).toHaveCount(4);
  await expect(page.locator(`.desktop-nav a[href="${base}lookbook/"]`)).toHaveCount(1);
  await expect(page.locator(`.desktop-nav a[href="${base}about/"]`)).toHaveCount(1);
});

test('signal keychain cards use matching artwork and retain their collection filter defaults',async({page})=>{
  const signals=[['The Mobster: Cyan circuit keychain','detroit-2084',5,'signal-analog-armory-campaign-v2.webp'],['The Champ: Gold guardian keychain','night-protocol',1,'keychain-disciples-campaign.webp'],['The Mobster: Gold mobster keychain','static-saints',2,'keychain-mobster-suit-gold-arch-reference.webp'],['The Observer: Gold observer keychain','cyber-cathedral',2,'gothtechnology-luggage-charm-armory-higgsfield-v1.webp']];
  for(const [name,handle,count,artwork] of signals){
    await page.goto(base+'#character-vault');
    const card=page.getByRole('link',{name,exact:true});
    await expect(card.locator('img')).toHaveAttribute('src',base+'media/'+artwork);
    if(handle==='cyber-cathedral')await expect(card.locator('.signal-portrait')).toHaveClass(/signal-portrait-cover/);
    await card.click();await expect(page).toHaveURL(base+'collections/'+handle+'/');await page.waitForLoadState('domcontentloaded');await ready(page);
    if(await page.locator('.filter-disclosure summary').isVisible() && !(await page.locator('.filter-disclosure').evaluate(el=>el.open)))await page.locator('.filter-disclosure summary').click();
    await expect(page.getByRole('combobox',{name:'Collection',exact:true})).toHaveValue(handle);
    await expect(page.locator('[data-product-card]:visible')).toHaveCount(count);
  }
  await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption('');
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(17);
  await page.reload();await expect(page.locator('[data-product-card]:visible')).toHaveCount(17);
  if(await page.locator('.filter-disclosure summary').isVisible())await page.locator('.filter-disclosure summary').click();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Collection',exact:true})).toHaveValue('cyber-cathedral');
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(2);
});

test('homepage signal row keeps the collectibles without game-character portraits',async({page})=>{
  await page.goto(base+'#character-vault');
  const cards=page.locator('#character-vault .signal-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toHaveAttribute('aria-label','The Observer: Gold observer keychain');
  await expect(cards.last()).toHaveAttribute('aria-label','The Mobster: Cyan circuit keychain');
  await expect(page.locator('#character-vault .signal-inspect')).toHaveCount(4);
  await expect(page.locator('#character-vault .signal-game')).toHaveCount(0);
  await expect(page.locator('footer nav[aria-label="Shop"]')).toContainText('All Gear');
  await expect(page.locator('footer nav[aria-label="Shop"]')).not.toContainText('All Equipment');
});

test('Original Artwork collection presents both Detroit works with a simple winter-sunset frame',async({page})=>{
  await page.goto(base+'collections/original-artwork/');
  await expect(page.getByRole('heading',{level:1})).toHaveText('Original Artwork.');
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(2);
  await expect(page.locator('[data-product-card][data-handle="detroit-riverfront-sunset-artwork"]')).toContainText('Pending');
  await expect(page.locator('[data-product-card][data-handle="detroit-winter-sunset-artwork"]')).toContainText('Pending');
  await page.goto(base+'products/detroit-winter-sunset-artwork/');
  await expect(page.getByRole('button',{name:'Simple frame alternate campaign',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Simple frame alternate campaign',exact:true}).click();
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/detroit-winter-sunset-simple-frame-alt\.webp$/);
  await page.getByRole('button',{name:'Unframed artwork campaign',exact:true}).click();
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/detroit-winter-sunset-retouched-artwork\.webp$/);
  await expect(page.locator('.gallery-main [data-gallery-kind]')).toHaveText('CAMPAIGN CONCEPT');
});

const signalFighters=[['DETROIT_LENS_NOIR','Detroit Lens Noir','detroit-lens-noir'],['MASTER_EZRA','Master Ezra','master-ezra'],['AMARA_VALENTINE','Amara Valentine','amara-valentine'],['KALYX','Kalyx','kalyx']];
for(const [index,[id,name,image]] of signalFighters.entries()){
  test('collection signal columns still open their matching fighters: '+name,async({page})=>{
    await page.goto(base+'collections/');await ready(page);
    const card=page.locator('.collection-signals .cinematic-card').nth(index);
    await expect(card.locator('.signal-card img')).toBeVisible();
    if(index===3)await expect(card.locator('.signal-card img')).toHaveAttribute('src',base+'media/keychain-observer-gold-arch-reference.webp');
    await expect(card.locator('.signal-game img')).toHaveAttribute('src',base+'assets/user-roster/'+image+'-headshot.webp');
    await card.getByRole('link',{name:'Play as '+name,exact:true}).click();
    await expect(page).toHaveURL(base+'play/?character='+id);
    await expect(page.locator('#requested-character')).toContainText('Starting character: '+name);
  });
}

test('mobile navigation, search and keyboard dialog containment',async({page})=>{
  await page.goto(base);if(await page.getByRole('button',{name:'Open navigation menu'}).isVisible()){await page.getByRole('button',{name:'Open navigation menu'}).click();await expect(page.getByRole('dialog',{name:'The Armory'})).toBeVisible();await page.getByRole('dialog',{name:'The Armory'}).getByRole('link',{name:'SHOP',exact:true}).click();await expect(page).toHaveURL(/shop\/$/);await page.waitForLoadState('domcontentloaded');await ready(page);}
  await page.getByRole('button',{name:'Search the store'}).click();await page.getByLabel('Search equipment and collections').fill('hoodie');await expect(page.locator('#search-results')).toContainText('Knight Protocol');
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('#search-dialog'))).toBe(true);}
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Search the store'})).toBeFocused();
});

test('product gallery uses image-aware modes and honest 2.5D remains lazy',async({page},info)=>{
  const requests=[];page.on('request',request=>requests.push(request.url()));
  await page.goto(product);await expect(page.locator('.gallery-main')).toHaveAttribute('data-gallery-orientation','landscape');expect(requests.some(url=>/\/model\.[^/]*\.js/.test(url))).toBe(false);
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/night-protocol-hoodie-no-charm-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$89');
  await expect(page.locator('.development-status')).toContainText('The LottoMind charm shown in some supplied reference imagery is not included with the hoodie.');
  const hoodieFilm=page.getByLabel('Knight Protocol Embroidered Hoodie supplied product film');await expect(hoodieFilm).toBeVisible();await expect(hoodieFilm.locator('source')).toHaveAttribute('src',base+'media/knight-protocol-supplied-product-film-v1.mp4');await expect(hoodieFilm).toHaveAttribute('controls','');await expect(hoodieFilm).toHaveAttribute('autoplay','');await expect(hoodieFilm).not.toHaveAttribute('muted','');
  await page.getByRole('button',{name:'Embroidery reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/embroidery/);await expect(page.locator('.gallery-main')).toHaveClass(/is-landscape/);
  await page.getByRole('button',{name:'Cathedral styling reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/night-protocol-hoodie-cathedral-styling-reference/);await expect(page.locator('.gallery-main')).toHaveClass(/is-landscape/);
  await page.getByRole('button',{name:'Zoom image',exact:true}).click();await expect(page.locator('#gallery-zoom')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/Open depth display/}).click();await expect(page.locator('.depth-frame img')).toBeVisible();await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('[data-viewer-status]')).toContainText('not supplied');
  await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.locator('.product-information').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('product.png')});
  await page.goto(base+'shop/');
  await expect(page.locator('[data-product-card][data-handle="detroit-2084-shirt"] img')).toHaveAttribute('src',/\/media\/detroit-2084-tee-reference\.webp$/);
  await expect(page.locator('[data-product-card][data-handle="black-signal-beanie"] img')).toHaveAttribute('src',/\/media\/detroit-skyline-beanie-reference\.webp$/);
  await expect(page.locator('[data-product-card][data-handle="detroit-skull-cap-alt"] img')).toHaveAttribute('src',/\/media\/detroit-skull-cap-alt-reference\.webp$/);
  await page.goto(base+'products/black-signal-beanie/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit Skyline Embroidered Beanie');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/detroit-skyline-beanie-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$19');await expect(page.getByRole('radio',{name:'Black',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Zoom image',exact:true}).click();await expect(page.locator('#gallery-zoom')).toHaveAttribute('aria-pressed','true');
  await page.goto(base+'products/detroit-skull-cap-alt/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit Embroidered Skull Cap — Alt Version');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/detroit-skull-cap-alt-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$22');await expect(page.getByRole('radio',{name:'Black',exact:true})).toBeChecked();
  await page.goto(base+'products/detroit-2084-shirt/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit 2084 Graphic T-Shirt');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/detroit-2084-tee-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$36');
  await page.goto(base+'products/detroit-skyline-cap/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit Skyline Embroidered Cap');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/detroit-skyline-cap-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$32');
  await page.goto(base+'products/boogeyman-graphic-hoodie/');await expect(page.getByRole('heading',{level:1})).toHaveText('Boogeyman Graphic Hoodie');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/boogeyman-graphic-hoodie-campaign\.webp$/);await expect(page.locator('.gallery-main [data-gallery-kind]')).toHaveText('CAMPAIGN CONCEPT');await expect(page.locator('[data-selected-price]')).toHaveText('Pending');await expect(page.getByRole('button',{name:'Price pending',exact:true})).toBeDisabled();
  await page.goto(base+'products/gothtechnology-luggage-charm/');await expect(page.getByRole('heading',{level:1})).toHaveText('GOTHTECHNOLOGY Luggage Charm');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/gothtechnology-luggage-charm-armory-higgsfield-v1\.webp$/);await expect(page.locator('.gallery-main [data-gallery-kind]')).toHaveText('CAMPAIGN CONCEPT');
  await page.getByRole('button',{name:'Product reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/charm\.webp$/);await expect(page.locator('.gallery-main [data-gallery-kind]')).toHaveText('SUPPLIED PRODUCT REFERENCE');
  await page.goto(base+'products/mobster-luggage-charm/');await expect(page.getByRole('heading',{level:1})).toHaveText('Mobster Luggage Charm');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/mobster-luggage-charm-cyan-arch-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$19.99');
  await expect(page.getByRole('button',{name:'Load 3D model',exact:true})).toBeVisible();await page.getByRole('button',{name:'Load 3D model',exact:true}).click();await expect(page.locator('.model-stage canvas')).toBeVisible();await expect(page.locator('[data-viewer-status]')).toContainText('3D model loaded');
  const mobsterVideo=page.getByTitle('Mobster Luggage Charm attachment demonstration');await expect(mobsterVideo).toBeVisible();await expect(mobsterVideo).toHaveAttribute('src','https://www.youtube-nocookie.com/embed/0yPqZEvKnFU?rel=0&playsinline=1');await expect(mobsterVideo).not.toHaveAttribute('allow',/autoplay/);
  await expect(page.getByText('The rail adapter and sporting equipment shown in the demonstration are not included with the Mobster Luggage Charm.',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'Watch on YouTube',exact:false})).toHaveAttribute('href','https://www.youtube.com/shorts/0yPqZEvKnFU');
  await page.getByRole('button',{name:'Equipment context',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/mobster-luggage-charm-equipment-context-reference\.webp$/);
  await page.goto(base+'products/static-saints-patch-set/');await expect(page.getByRole('heading',{level:1})).toHaveText('Static Saints Embroidered Patch Set');await expect(page.locator('[data-selected-price]')).toHaveText('$20');
  await expect(page.locator('.gallery-thumbs button')).toHaveCount(6);await expect(page.getByRole('radio',{name:'Black-backed Die-cut',exact:true})).toBeChecked();
  await page.getByRole('radio',{name:'Rectangular Black',exact:true}).check();await page.getByRole('button',{name:'Rectangular armory campaign concept',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/static-saints-patch-rectangular-armory-campaign\.webp$/);
  await expect(page.locator('.gallery-main')).toHaveAttribute('data-gallery-orientation','landscape');
  await page.goto(base+'products/static-saints-detroit-rug/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit Skyline Cutout Rug');await expect(page.locator('[data-selected-price]')).toHaveText('Pending');await expect(page.locator('.gallery-thumbs button')).toHaveCount(2);await expect(page.getByRole('button',{name:'Price pending',exact:true})).toBeDisabled();
  await page.goto(base+'products/black-signal-digital-pack/');await expect(page.getByRole('heading',{level:1})).toHaveText('Black Signal Gun Charm Rail Adapter Pack');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/black-signal-gun-charm-rail-adapter-black-group-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$12');
  const adapterFilm=page.getByLabel('Black Signal Gun Charm Rail Adapter Pack supplied product film');await expect(adapterFilm).toBeVisible();await expect(adapterFilm.locator('source')).toHaveAttribute('src',base+'media/black-signal-rail-adapter-supplied-film-v1.mp4');await expect(adapterFilm).toHaveAttribute('controls','');await expect(adapterFilm).toHaveAttribute('autoplay','');await expect(adapterFilm).not.toHaveAttribute('muted','');
  await expect(page.getByRole('button',{name:'Equipment context',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'White-background group reference',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Front reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/black-signal-gun-charm-rail-adapter-black-fabric-reference\.webp$/);
  await page.getByRole('button',{name:'Underside reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/black-signal-gun-charm-rail-adapter-underside-reference\.webp$/);await expect(page.locator('.gallery-main')).toHaveAttribute('data-gallery-orientation','square');
  await expect(page.getByText('Digital contents & license',{exact:true})).toHaveCount(0);await expect(page.getByText('Shipping & returns',{exact:true})).toBeVisible();
  await page.goto(base+'products/key-knife-keychain/');await expect(page.getByRole('heading',{level:1})).toHaveText('Key Knife Keychain — 2-Inch Utility Pocketknife');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/key-knife-black-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$11.99');
  await expect(page.getByRole('radio',{name:'Black',exact:true})).toBeChecked();await page.getByRole('radio',{name:'Silver',exact:true}).check();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/key-knife-silver-reference\.webp$/);
  await expect(page.getByRole('button',{name:'Open-blade Gothic armory campaign concept',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Signal ensemble campaign concept',exact:true})).toBeVisible();await expect(page.locator('.gallery-thumbs button')).toHaveCount(8);
  await page.goto(base+'products/key-knife-gun-attachment-bundle/');await expect(page.getByRole('heading',{level:1})).toHaveText('Key Knife + Paint/ Gun Attachment Bundle');
  await expect(page.locator('[data-selected-price]')).toHaveText('$39');await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/key-knife-gun-attachment-bundle-closed-reference\.webp$/);
  await expect(page.getByText('UTILITY KNIFE SAFETY & LEGAL REVIEW',{exact:true})).toBeVisible();await expect(page.getByText('The Mobster luggage charm pictured in the supplied references is styling only and is not included.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Open bundle reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/key-knife-gun-attachment-bundle-open-reference\.webp$/);await expect(page.locator('.gallery-thumbs button')).toHaveCount(2);
});

test('reduced motion and WebGL fallback keep shopping available',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base+'shop/');
  await expect(page.locator('.lotto-ticker-track')).toHaveCSS('animation-name','none');
  await page.goto(base);await expect(page.locator('.lotto-ticker')).toHaveCount(0);
  await expect(page.locator('#scene-status')).toHaveText('Armory Online — Static Display');expect(requests.some(u=>/scene\.[^/]+\.js/.test(u))).toBe(false);
  await page.getByRole('button',{name:'Open launch loadout'}).click();await expect(page.getByRole('dialog',{name:'Your Launch Loadout'})).toContainText('Your launch loadout is empty.');await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl')return null;return original.call(this,type,...args);};});await page.reload();await expect(page.locator('#scene-status')).toHaveText('Armory Online — Static Display');await expect(page.getByRole('link',{name:'Shop the current drop',exact:true})).toBeVisible();
});

test('inline films load only after Play and stay paused when returning',async({page})=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base+'lookbook/');
  const host=page.locator('[data-inline-film]').first(),video=host.locator('video');
  await host.scrollIntoViewIfNeeded();await page.waitForTimeout(1000);
  expect(requests.some(url=>/\.mp4/.test(url))).toBe(false);await expect(video).not.toHaveAttribute('src');
  await host.locator('[data-origin-film-toggle]').click();await expect.poll(()=>video.evaluate(v=>!v.paused&&!v.muted&&v.volume===1)).toBe(true);
  await host.locator('[data-origin-film-toggle]').click();await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
  await page.locator('h1').scrollIntoViewIfNeeded();await host.scrollIntoViewIfNeeded();expect(await video.evaluate(v=>v.paused)).toBe(true);
});
test('reduced motion and save-data keep films on request',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true},configurable:true}));
  await page.goto(base+'about/');const host=page.locator('[data-inline-film]'),video=host.locator('video');
  await host.scrollIntoViewIfNeeded();await expect(video).not.toHaveAttribute('src');
  await host.locator('[data-origin-film-toggle]').click();await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
});
test('Lookbook transmission is requested explicitly and can always close',async({page})=>{
  await page.goto(base+'lookbook/');await page.getByRole('button',{name:'Watch the 15-second charm film'}).click();
  await expect(page.locator('#transmission-dialog')).toBeVisible();await expect(page.locator('#store-video')).toHaveAttribute('src',/charm-transmission-silent/);await expect(page.locator('#store-video')).toHaveAttribute('autoplay','');expect(await page.locator('#store-video').evaluate(video=>!video.muted&&video.volume===1)).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#store-video')).not.toHaveAttribute('src');
});
for(const [surface,path,watchLabel] of [['Homepage','','Watch Campaign Film'],['Shop','shop/','Watch commercial']]){
test(surface+' commercial opens with sound on request and releases media on close',async({page})=>{
  await page.goto(base+path);const dialog=page.locator('#home-commercial'),video=page.locator('#home-commercial-video');
  await page.waitForTimeout(9000);await expect(dialog).not.toBeVisible();await expect(video).not.toHaveAttribute('src');
  const trigger=page.getByRole('button',{name:watchLabel,exact:true});await trigger.click();
  await expect(dialog).toBeVisible();await expect.poll(()=>video.evaluate(v=>!v.paused&&!v.muted&&v.volume>0)).toBe(true);
  await dialog.getByRole('button',{name:'Mute sound',exact:true}).click();expect(await video.evaluate(v=>v.muted)).toBe(true);
  await page.keyboard.press('Escape');await expect(video).not.toHaveAttribute('src');await expect(trigger).toBeFocused();
  await trigger.click();await expect.poll(()=>video.evaluate(v=>!v.paused&&!v.muted)).toBe(true);
});
test(surface+' commercial never interrupts an open launch loadout',async({page})=>{
  await page.goto(base+path);await page.getByRole('button',{name:'Open launch loadout',exact:true}).click();
  await page.waitForTimeout(9000);await expect(page.locator('#cart-dialog')).toBeVisible();await expect(page.locator('#home-commercial-video')).not.toHaveAttribute('src');
});
}

test('disconnected newsletter is visibly unavailable and does not collect personal data',async({page})=>{
  const posts=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});await page.goto(base);const form=page.locator('#newsletter-form');
  await expect(form).toHaveAttribute('data-subscription-connected','false');await expect(form.getByLabel('Email address',{exact:true})).toBeDisabled();await expect(form.getByRole('checkbox',{name:/I agree to receive/})).toBeDisabled();await expect(form.getByRole('button',{name:'Get Launch Alert',exact:true})).toBeDisabled();await expect(form.locator('.form-status')).toContainText('not saved or sent');expect(posts).toEqual([]);
});

test('game portal preserves the runtime, preselects a fighter and rejects forged messages',async({page},info)=>{
  test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'play/?character=KALYX');await expect(page.locator('#rahbee-promo')).toBeVisible();await expect(page.getByRole('link',{name:'Play Robot RAHBE',exact:true})).toHaveAttribute('href',/games\/shadow-ops-canvas\/$/);await page.getByRole('button',{name:'Continue to GOTHTECHNOLOGY',exact:true}).click();await expect(page.locator('#rahbee-promo')).not.toBeVisible();await expect(page.locator('#game-frame')).toHaveCount(0);await page.getByRole('button',{name:'Launch game',exact:true}).click();await expect(page.locator('#game-connection')).toContainText('Game ready',{timeout:45000});
  // A late iframe load must not overwrite the earlier validated ready message.
  await page.locator('#game-frame').dispatchEvent('load');await expect(page.locator('#game-connection')).toContainText('Game ready');
  const frame=page.frames().find(f=>f.url().includes('/legacy-game/'));expect(frame).toBeTruthy();expect(await frame.evaluate(()=>window.__gothTechnologyGame.player1Id)).toBe('KALYX');
  await page.evaluate(()=>window.postMessage({type:'GOTHTECH_MATCH_COMPLETED',characterId:'KALYX',result:'win',durationSeconds:60},location.origin));await expect(page.locator('#game-reward-status')).not.toContainText('unlocked');
  await frame.evaluate(()=>window.__gothTechnologyGame.openMode('training'));await expect.poll(()=>frame.evaluate(()=>window.__gothTechnologyGame.matchAssetsReady),{timeout:45000}).toBe(true);
  await frame.evaluate(()=>{const g=window.__gothTechnologyGame;g.startVersus();});
  await expect.poll(()=>frame.evaluate(()=>['versus','fight'].includes(window.__gothTechnologyGame.phase))).toBe(true);
  await page.screenshot({path:info.outputPath('play.png')});await expect(page.getByRole('link',{name:'Back to Store',exact:false})).toBeVisible();expect(errors).toEqual([]);
});

test('all required static routes, metadata, galleries, and media resolve',async({page,request},info)=>{
  test.skip(info.project.name!=='desktop','Static routes need one pass');
  const sitemap=await request.get(base+'sitemap.xml');expect(sitemap.status()).toBe(200);const paths=[...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
  for(const path of paths){const response=await request.get(path);expect(response.status(),path).toBe(200);const html=await response.text();expect(html,path).toContain('rel="canonical"');expect(html,path).toContain('<h1');expect(html,path).toContain('noindex,follow');expect(html,path).not.toMatch(/\"@type\"\s*:\s*\"(?:Offer|AggregateOffer)\"/);}
  await page.goto(base+'lookbook/');for(const img of await page.locator('main img').all()){await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);}
});

test('widths 320 through 1920 do not overflow or hide purchase controls',async({page},info)=>{
  test.skip(info.project.name!=='desktop','Breakpoint sweep needs one Chromium pass');test.setTimeout(90000);
  for(const width of [320,360,375,390,428,768,1024,1440,1920]){await page.setViewportSize({width,height:900});for(const path of [base,product,base+'shop/']){await page.goto(path);await ready(page);await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth),width+' '+path).toBe(width);if(path===base){expect(await page.locator('#drop-title').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].every(rect=>rect.right<=el.getBoundingClientRect().right+2);})).toBe(true);await expect(page.getByRole('link',{name:'Shop the current drop',exact:true})).toBeVisible();expect(await page.locator('.cathedral-hero').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(700);expect(await page.locator('#hero-title').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(39);await page.screenshot({path:info.outputPath('home-'+width+'.png'),scale:'css'});}expect(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();if(r.width<=0||r.right<=innerWidth+1||el.closest('dialog'))return false;for(let p=el.parentElement;p;p=p.parentElement){if(['hidden','clip'].includes(getComputedStyle(p).overflowX)&&p.getBoundingClientRect().right<=innerWidth+1)return false;}return true;}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,80),right:el.getBoundingClientRect().right}))),width+' '+path).toEqual([]);}await expect(page.getByLabel('Search products',{exact:true})).toBeVisible();}
});
test('shop uses one readable product column at 500px',async({page})=>{
  await page.setViewportSize({width:500,height:900});await page.goto(base+'shop/');
  const layout=await page.locator('.products-grid').evaluate(grid=>{const card=grid.querySelector('.product-card');const title=card.querySelector('h3');const meta=card.querySelector('.mono');return{columns:getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,title:parseFloat(getComputedStyle(title).fontSize),meta:parseFloat(getComputedStyle(meta).fontSize),scroll:document.documentElement.scrollWidth,width:innerWidth};});
  expect(layout).toMatchObject({columns:1,scroll:500,width:500});expect(layout.title).toBeGreaterThanOrEqual(22);expect(layout.meta).toBeGreaterThanOrEqual(12);
});
test('conversion UI: keyboard, mobile filters, settings and sticky action',async({page},info)=>{
  await page.goto(base);await ready(page);await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
  const settings=page.locator('.hero-settings');await settings.click();
  const dialog=page.locator('#experience-dialog');await expect(dialog).toBeVisible();
  await dialog.getByLabel('Display quality').selectOption('fallback');await page.keyboard.press('Escape');await expect(settings).toBeFocused();
  await page.reload();await settings.click();await expect(dialog.getByLabel('Display quality')).toHaveValue('fallback');
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('#experience-dialog'))).toBe(true);}
  await page.screenshot({path:info.outputPath('experience-settings.png'),scale:'css'});await page.keyboard.press('Escape');
  await page.goto(base+'shop/');
  const disclosure=page.locator('.filter-disclosure'),summary=disclosure.locator('summary');
  const compact=info.project.use.viewport.width<=760;
  if(compact){await expect(disclosure).not.toHaveAttribute('open');await summary.click();}
  await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('Accessories');await expect(page.locator('#result-count')).toHaveText('5 products');
  if(compact)await summary.click();
  await page.getByRole('button',{name:'Clear category filter'}).click();await expect(page.locator('#result-count')).toHaveText('19 products');
  if(compact)await expect(summary).toBeFocused();
  await page.goto(product);await ready(page);
  if(compact){await expect(page.locator('.mobile-product-bar')).toBeVisible();await page.locator('.mobile-product-bar [data-select-options]').click();await expect(page.locator('#product-options')).toBeFocused();await expect(page.locator('.mobile-product-bar')).not.toBeVisible();await page.locator('.site-footer').scrollIntoViewIfNeeded();await expect(page.locator('.mobile-product-bar')).not.toBeVisible();}
});
test('responsive evidence: sections, shop, product, lookbook, about and play',async({page},info)=>{
  test.skip(info.project.name!=='desktop','One controlled screenshot set');test.setTimeout(90000);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    await page.goto(base);await ready(page);await page.evaluate(()=>document.fonts.ready);
    for(const [name,selector] of [['drop','#current-drop'],['featured','#featured'],['signals','#character-vault'],['portal','#enter-the-fight']]){
      const section=page.locator(selector);await section.scrollIntoViewIfNeeded();const bounds=await section.boundingBox();if(bounds.height>900){await page.evaluate(selector=>window.scrollTo({top:document.querySelector(selector).getBoundingClientRect().top+scrollY-80,behavior:'instant'}),selector);await settle(page);await page.screenshot({path:info.outputPath(name+'-'+width+'.png'),scale:'css'});}else await section.screenshot({path:info.outputPath(name+'-'+width+'.png'),scale:'css'});
    }
    for(const [name,path] of [['shop','shop/'],['product','products/night-protocol-hoodie/'],['lookbook','lookbook/'],['about','about/'],['play','play/']]){
      await page.goto(base+path);await ready(page);await page.evaluate(()=>document.fonts.ready);
      if(name==='shop'&&width===390)await page.locator('.filter-disclosure summary').click();
      if(name==='product')await page.locator('.product-information').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
      if(name==='shop')await page.locator('.filters').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
      await settle(page);
      await page.screenshot({path:info.outputPath(name+'-'+width+'.png'),scale:'css'});
    }
    if(width===390){await page.getByRole('button',{name:'Open navigation menu'}).click();await page.screenshot({path:info.outputPath('mobile-menu.png'),scale:'css'});await page.keyboard.press('Escape');}
  }
});

test('hero background loops silently and respects pause, scrolling and motion settings',async({page})=>{
  await page.goto(base);await ready(page);
  const video=page.locator('#hero-background-video'),toggle=page.locator('[data-toggle-hero-video]');
  await expect.poll(()=>video.evaluate(v=>!v.paused&&v.currentTime>0&&v.muted&&v.loop)).toBe(true);
  expect(await video.evaluate(v=>v.playbackRate)).toBe(0.4);
  await expect(page.locator('#arrival')).toHaveAttribute('data-video-ready','true');
  await toggle.focus();await page.keyboard.press('Enter');await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
  await page.locator('#featured').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollTo(0,0));await expect(toggle).toHaveText('Play background');
  await toggle.click();await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
  await page.locator('#featured').scrollIntoViewIfNeeded();await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
  await page.evaluate(()=>scrollTo(0,0));await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
  await page.locator('[data-open-settings]').first().click();await page.locator('#scene-pause').click();
  await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);await expect(toggle).toHaveText('Motion off');
});
for(const preference of ['reduced','saved-reduced','save-data'])test('hero background keeps its still image without fetching video: '+preference,async({page})=>{
  if(preference==='reduced')await page.emulateMedia({reducedMotion:'reduce'});
  if(preference==='saved-reduced')await page.addInitScript(()=>localStorage.setItem('gothtechnology.armory.motion','reduced'));
  if(preference==='save-data')await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true},configurable:true}));
  const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base);await ready(page);
  await expect(page.locator('[data-toggle-hero-video]')).toHaveText('Motion off');
  await expect(page.locator('#hero-background-video')).not.toHaveAttribute('src');
  await expect(page.locator('img.hero-image')).toHaveCSS('opacity','0.75');
  expect(requests.some(url=>url.includes('armory-hero-higgsfield-loop.mp4'))).toBe(false);
});

test('charm and knife preview bundle links the components and shows its price and safety notice',async({page})=>{
  await page.goto(base+'products/key-knife-keychain/');
  await expect(page.locator('.charm-knife-offer')).toContainText('$29.99');
  await page.getByRole('link',{name:'View bundle details',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('Mobster Charm + Key Knife Bundle');
  await expect(page.locator('[data-selected-price]')).toHaveText('$29.99');
  await expect(page.locator('.product-safety-notice')).toContainText('not available for purchase');
  await expect(page.locator('.development-status')).toContainText('one Mobster Luggage Charm and one black Key Knife');
  await page.locator('#product-options button[type=submit]').click();
  await expect(page.locator('#cart-dialog')).toContainText('Mobster Charm + Key Knife Bundle');
  await expect(page.locator('#cart-dialog')).toContainText('$29.99');
});

test('fragrance concept stories expand with the keyboard and artwork pairings link to the matching scent',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'products/armory-fragrance-roller-collection/');
  await expect(page.getByRole('heading',{level:1})).toHaveText('Armory Fragrance Roller Collection');
  await expect(page.getByRole('button',{name:'Price pending',exact:true})).toBeDisabled();
  await page.getByRole('link',{name:'Explore the nine scent concepts',exact:true}).click();
  const concepts=page.getByRole('region',{name:'Character and artwork scent concepts'});
  await expect(concepts.locator('.scent-card')).toHaveCount(9);
  await expect(concepts.locator('.fragrance-note')).toContainText('not confirmed ingredients, formulas or available variants');
  const mobster=concepts.locator('#scent-the-mobster');
  const summary=mobster.locator('summary');await summary.focus();await page.keyboard.press('Enter');
  await expect(mobster.locator('details')).toHaveAttribute('open','');
  await expect(mobster.locator('.scent-composition')).toContainText('Black tea: dry, dark and quietly bitter.');
  await page.keyboard.press('Enter');await expect(mobster.locator('details')).not.toHaveAttribute('open');
  await page.getByRole('link',{name:'Explore Detroit Winter Sunset Artwork',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit Winter Sunset Artwork');
  const pairing=page.getByRole('region',{name:'Suggested fragrance bundles'});
  await expect(pairing.locator('.fragrance-pairing')).toHaveCount(1);
  await expect(pairing).toContainText('not purchasable bundles');
  await pairing.getByRole('link',{name:'Explore Detroit 2084 scent concept',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/products/armory-fragrance-roller-collection/#scent-detroit-2084$'));
  const artwork=page.locator('#scent-detroit-2084');
  await expect(artwork).toBeInViewport();
  await artwork.locator('summary').click();
  await expect(artwork.locator('.scent-scene')).toContainText('Orange horizon');
  await expect(artwork.locator('.scent-scene')).toContainText('Icy river');
  await expect(artwork.locator('.scent-scene')).toContainText('Bare branches');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('fragrance stays out of homepage features and opens its gold-arch gallery from Shop',async({page})=>{
  await page.goto(base);await ready(page);await expect(page.locator('#featured [data-handle="armory-fragrance-roller-collection"]')).toHaveCount(0);
  await page.goto(base+'shop/?category=Fragrance');await ready(page);await expect(page.locator('#result-count')).toHaveText('1 product');
  const card=page.locator('[data-handle="armory-fragrance-roller-collection"]');await expect(card.locator('img')).toHaveAttribute('src',/gold-arch-card\.webp$/);
  await card.locator('h3 a').click();await expect(page.locator('h1')).toHaveText('Armory Fragrance Roller Collection');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/gold-arch-campaign\.webp$/);await expect(page.locator('.gallery-thumbs button')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'Price pending',exact:true})).toBeDisabled();await expect(page.locator('.fragrance-identities li')).toHaveCount(9);
  const galleryBounds=await page.locator('#gallery-image').boundingBox();expect(Math.abs(galleryBounds.height-galleryBounds.width)).toBeLessThan(2);
  await page.locator('.gallery-thumbs button').nth(1).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/circuit-grid-campaign\.webp$/);
});
