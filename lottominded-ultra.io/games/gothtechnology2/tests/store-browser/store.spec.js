import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const product=base+'products/night-protocol-hoodie/';
const settle=async page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const ready=async page=>{await expect(page.locator('#store-data')).toBeAttached();await expect(page.locator('#sound-toggle')).toHaveText(/^Sound (?:on|off)$/);};

test('visual: homepage renders, keeps content accessible, and does not load game or video',async({page},info)=>{
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{window.__metrics={lcp:0,cls:0};try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__metrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__metrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch{}});
  await page.goto(base+'?build=a4eb5ec6');await ready(page);await page.evaluate(()=>document.fonts.ready);await expect(page.getByRole('heading',{level:1})).toHaveText(/Equipment\s*for the world\s*after midnight/);
  await expect(page.locator('.hero-image')).toBeVisible();await expect.poll(()=>page.locator('.hero-image').evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  await page.screenshot({path:info.outputPath('home-viewport.png')});
  const metrics=await page.evaluate(()=>({...window.__metrics,width:innerWidth,height:innerHeight,domReady:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd,resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize}))}));
  await writeFile(info.outputPath('performance.json'),JSON.stringify(metrics,null,2));
  expect(requests.some(u=>/\/src\/main\.js|motion-atlases|\.mp4|\/cathedral\.|\/model\.|\/three\./.test(u))).toBe(false);
  expect(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&!el.closest('.equipment-art,.signal-portrait,.lookbook-strip,.hero,dialog')).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))}))).toMatchObject({scroll:info.project.use.viewport.width});
  for(const section of await page.locator('main>section').all()){await section.scrollIntoViewIfNeeded();}await expect.poll(()=>page.locator('main img[src]').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));await page.screenshot({path:info.outputPath('home-full.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('New Drop supplies looping background music with a browser-policy fallback control',async({page})=>{
  await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('play'));return Promise.resolve();};});
  await page.goto(base);
  const audio=page.locator('#new-drop-music');
  await expect(audio).toHaveAttribute('src',base+'media/lottomind-vault-174hz-background.mp3');
  await expect(audio).toHaveAttribute('autoplay','');await expect(audio).toHaveAttribute('loop','');await expect(audio).toHaveAttribute('preload','auto');
  await expect(page.locator('#sound-toggle')).toHaveText('Sound on');
  await page.locator('.hero-settings').click();await page.locator('#sound-toggle').click();
  await expect(page.locator('#sound-toggle')).toHaveText('Sound off');await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed','false');
  await page.goto(base+'shop/');await expect(page.locator('[data-background-audio]')).toHaveCount(0);
});

test('shopping cart: launch preferences, quantity, persistence, alert flow and focus',async({page},info)=>{
  await page.goto(product);await ready(page);await page.getByRole('radio',{name:'M',exact:true}).check();await page.getByLabel('Quantity',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Save to Launch Loadout',exact:true}).click();const cart=page.getByRole('dialog',{name:'Your Launch Loadout'});await expect(cart).toBeVisible();await expect(cart).toContainText('M / Obsidian');await expect(cart.locator('.cart-subtotal')).toContainText('$158');
  await page.getByRole('button',{name:/Increase quantity/}).click();await expect(cart.locator('.cart-subtotal')).toContainText('$237');
  await page.screenshot({path:info.outputPath('launch-loadout.png'),scale:'css'});
  await cart.getByRole('button',{name:'Get Launch Alert',exact:true}).click();
  const alert=page.locator('#launch-alert-dialog');await expect(alert).toBeVisible();
  await expect(alert.locator('[data-launch-selection]')).toContainText('M / Obsidian × 3');
  await alert.getByLabel('Email address',{exact:true}).fill('qa@example.test');await alert.getByRole('checkbox').check();
  await alert.getByRole('button',{name:'Get Launch Alert',exact:true}).click();await expect(alert).toContainText('Your email was not saved or sent.');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('qa@example.test');
  await page.screenshot({path:info.outputPath('launch-alert.png'),scale:'css'});
  await page.keyboard.press('Escape');await expect(cart).not.toBeVisible();await expect(page.getByRole('button',{name:'Save to Launch Loadout',exact:true})).toBeFocused();
  await page.reload();await page.getByRole('button',{name:'Open launch loadout'}).click();await expect(cart.locator('.cart-subtotal')).toContainText('$237');
  await page.getByRole('button',{name:/Remove Knight Protocol/}).click();await expect(cart).toContainText('Your launch loadout is empty.');await expect(cart.getByRole('button',{name:'Get Launch Alert',exact:true})).toBeDisabled();
});

test('catalog filters, sorting, no-results and product actions work',async({page})=>{
  await page.goto(base+'shop/?category=Accessories');await expect(page.locator('#result-count')).toHaveText('4 products');
  const mobsterCharm=page.locator('[data-product-card][data-handle="mobster-luggage-charm"]');await expect(mobsterCharm).toContainText('Mobster Luggage Charm');await expect(mobsterCharm).toContainText('$19.99');
  await expect(mobsterCharm.locator('img')).toHaveAttribute('src',/\/media\/mobster-luggage-charm-black-background-card-reference\.webp$/);
  const railAdapter=page.locator('[data-product-card][data-handle="black-signal-digital-pack"]');await expect(railAdapter).toContainText('Gun Charm Heavy Duty Rail Adapter');await expect(railAdapter).toContainText('$12');
  await expect(railAdapter.locator('img')).toHaveAttribute('src',/\/media\/black-signal-gun-charm-rail-adapter-black-group-reference\.webp$/);
  await page.getByLabel('Search products',{exact:true}).fill('GOTHTECHNOLOGY Luggage Charm');await expect(page.locator('[data-product-card]:visible')).toHaveCount(1);
  await page.getByRole('button',{name:'Save to Launch Loadout: GOTHTECHNOLOGY Luggage Charm',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Your Launch Loadout'})).toContainText('$19.99');await page.keyboard.press('Escape');
  await page.getByLabel('Search products',{exact:true}).fill('zzz-no-match');await expect(page.locator('#no-results')).toBeVisible();
  await page.locator('#no-results').getByRole('button',{name:'Clear filters'}).click();await expect(page.locator('#result-count')).toHaveText('10 products');
  await page.getByRole('combobox',{name:'Sort',exact:true}).selectOption('price-low');
  const order=await page.locator('[data-product-card]').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).sort((a,b)=>Number(a.style.order)-Number(b.style.order)).map(n=>n.dataset.handle));expect(order[0]).toBe('black-signal-digital-pack');
  await page.getByLabel('Search products',{exact:true}).fill('hoodie');
  await page.getByRole('button',{name:/Choose Options for Knight Protocol/}).click();
  const quick=page.locator('#quick-dialog');await expect(quick).toBeVisible();
  await quick.getByRole('combobox',{name:'Size',exact:true}).selectOption('L');
  await quick.getByRole('button',{name:'Save to Launch Loadout',exact:true}).click();
  await expect(page.locator('#cart-dialog')).toContainText('L / Obsidian');
});

test('homepage category tile uses the ashtray artwork and retains the Collectibles filter',async({page})=>{
  await page.goto(base);
  const categories=page.locator('#armory .equipment-case');
  await expect(categories.nth(3).getByRole('heading')).toHaveText('Original Artwork');
  const collectibles=categories.filter({has:page.getByRole('heading',{name:'Collectibles',exact:true})});
  await expect(collectibles.locator('img')).toHaveAttribute('src',/\/media\/mascot-leaf-collectible\.webp$/);
  await collectibles.click();
  await expect(page).toHaveURL(/shop\/\?category=Collectibles$/);
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(1);
  await expect(page.getByRole('link',{name:'I Love Detroit Ashtray',exact:true})).toBeVisible();
});

test('signal keychain cards use matching artwork and retain their collection filter defaults',async({page})=>{
  const signals=[['The Analog: Cyan circuit keychain','detroit-2084',4,'keychain-analog-mobster-adapter-black-reference.webp'],['The Champ: Gold guardian keychain','night-protocol',1,'keychain-disciples-campaign.webp'],['The Mobster: Gold mobster keychain','static-saints',1,'keychain-mobster-suit-gold-arch-reference.webp'],['The Observer: Gold observer keychain','cyber-cathedral',2,'keychain-analog-mobster-cyan-arch-reference.webp']];
  for(const [name,handle,count,artwork] of signals){
    await page.goto(base+'#character-vault');
    const card=page.getByRole('link',{name,exact:true});
    await expect(card.locator('img')).toHaveAttribute('src',base+'media/'+artwork);
    await card.click();await expect(page).toHaveURL(base+'collections/'+handle+'/');await page.waitForLoadState('domcontentloaded');await ready(page);
    if(await page.locator('.filter-disclosure summary').isVisible() && !(await page.locator('.filter-disclosure').evaluate(el=>el.open)))await page.locator('.filter-disclosure summary').click();
    await expect(page.getByRole('combobox',{name:'Collection',exact:true})).toHaveValue(handle);
    await expect(page.locator('[data-product-card]:visible')).toHaveCount(count);
  }
  await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption('');
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(10);
  await page.reload();await expect(page.locator('[data-product-card]:visible')).toHaveCount(10);
  if(await page.locator('.filter-disclosure summary').isVisible())await page.locator('.filter-disclosure summary').click();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Collection',exact:true})).toHaveValue('cyber-cathedral');
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(2);
});

test('homepage signal row keeps the collectibles without game-character portraits',async({page})=>{
  await page.goto(base+'#character-vault');
  await expect(page.locator('#character-vault .signal-card')).toHaveCount(4);
  await expect(page.locator('#character-vault .signal-inspect')).toHaveCount(4);
  await expect(page.locator('#character-vault .signal-game')).toHaveCount(0);
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

test('product gallery and honest 2.5D display remain usable',async({page},info)=>{
  await page.goto(product);await page.getByRole('button',{name:'Embroidery reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/embroidery/);
  await page.getByRole('button',{name:'Zoom image',exact:true}).click();await expect(page.locator('#gallery-zoom')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/Open depth display/}).click();await expect(page.locator('.depth-frame img')).toBeVisible();await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('[data-viewer-status]')).toContainText('not supplied');
  await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.locator('.product-information').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('product.png')});
  await page.goto(base);
  await expect(page.locator('[data-product-card][data-handle="detroit-2084-shirt"] img')).toHaveAttribute('src',/\/media\/detroit-2084-tee-reference\.webp$/);
  await expect(page.locator('[data-product-card][data-handle="black-signal-beanie"] img')).toHaveAttribute('src',/\/media\/detroit-skyline-beanie-reference\.webp$/);
  await page.goto(base+'products/black-signal-beanie/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit Skyline Embroidered Beanie');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/detroit-skyline-beanie-reference\.webp$/);await expect(page.getByRole('radio',{name:'Black',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Zoom image',exact:true}).click();await expect(page.locator('#gallery-zoom')).toHaveAttribute('aria-pressed','true');
  await page.goto(base+'products/detroit-2084-shirt/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit 2084 Graphic T-Shirt');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/detroit-2084-tee-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$36');
  await page.goto(base+'products/detroit-skyline-cap/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit Skyline Embroidered Cap');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/detroit-skyline-cap-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$32');
  await page.goto(base+'products/mobster-luggage-charm/');await expect(page.getByRole('heading',{level:1})).toHaveText('Mobster Luggage Charm');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/mobster-luggage-charm-cyan-arch-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$19.99');
  await expect(page.getByRole('button',{name:'Load 3D model',exact:true})).toBeVisible();await page.getByRole('button',{name:'Load 3D model',exact:true}).click();await expect(page.locator('.model-stage canvas')).toBeVisible();await expect(page.locator('[data-viewer-status]')).toContainText('3D model loaded');
  const mobsterVideo=page.getByTitle('Mobster Luggage Charm attachment demonstration');await expect(mobsterVideo).toBeVisible();await expect(mobsterVideo).toHaveAttribute('src','https://www.youtube-nocookie.com/embed/0yPqZEvKnFU?rel=0');
  await expect(page.getByText('The rail adapter and sporting equipment shown in the demonstration are not included with the Mobster Luggage Charm.',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'Watch on YouTube',exact:false})).toHaveAttribute('href','https://www.youtube.com/shorts/0yPqZEvKnFU');
  await page.getByRole('button',{name:'Equipment context',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/mobster-luggage-charm-equipment-context-reference\.webp$/);
  await page.goto(base+'products/black-signal-digital-pack/');await expect(page.getByRole('heading',{level:1})).toHaveText('Black Signal Gun Charm Rail Adaptern Pack');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/black-signal-gun-charm-rail-adapter-black-group-reference\.webp$/);await expect(page.locator('[data-selected-price]')).toHaveText('$12');
  await expect(page.getByRole('button',{name:'Equipment context',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'White-background group reference',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Front reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/black-signal-gun-charm-rail-adapter-black-fabric-reference\.webp$/);
  await page.getByRole('button',{name:'Underside reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/black-signal-gun-charm-rail-adapter-underside-reference\.webp$/);
  await expect(page.getByText('Digital contents & license',{exact:true})).toHaveCount(0);await expect(page.getByText('Shipping & returns',{exact:true})).toBeVisible();
});

test('reduced motion and WebGL fallback keep shopping available',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base);
  await expect(page.locator('#scene-status')).toHaveText('Armory Online — Static Display');expect(requests.some(u=>/scene\.[^/]+\.js/.test(u))).toBe(false);
  await page.getByRole('button',{name:'Open launch loadout'}).click();await expect(page.getByRole('dialog',{name:'Your Launch Loadout'})).toContainText('Your launch loadout is empty.');await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl')return null;return original.call(this,type,...args);};});await page.reload();await expect(page.locator('#scene-status')).toHaveText('Armory Online — Static Display');await expect(page.getByRole('link',{name:'Explore Drop 001',exact:true})).toBeVisible();
});

test('inline films load only after Play and stay paused when returning',async({page})=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base+'lookbook/');
  const host=page.locator('[data-inline-film]').first(),video=host.locator('video');
  await host.scrollIntoViewIfNeeded();await page.waitForTimeout(1000);
  expect(requests.some(url=>/\.mp4/.test(url))).toBe(false);await expect(video).not.toHaveAttribute('src');
  await host.locator('[data-origin-film-toggle]').click();await expect.poll(()=>video.evaluate(v=>!v.paused&&v.muted)).toBe(true);
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
  await expect(page.locator('#transmission-dialog')).toBeVisible();await expect(page.locator('#store-video')).toHaveAttribute('src',/charm-transmission-silent/);
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

test('newsletter consent is required and demo does not send personal data',async({page})=>{
  const posts=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});await page.goto(base);await page.locator('#newsletter-form').getByLabel('Email address',{exact:true}).fill('qa@example.test');await page.locator('#newsletter-form').getByRole('button',{name:'Get Launch Alert',exact:true}).click();await expect(page.locator('#newsletter-form .form-status')).toContainText('Please agree');
  await page.locator('#newsletter-form').getByRole('checkbox',{name:/I agree to receive/}).check();await page.locator('#newsletter-form').getByRole('button',{name:'Get Launch Alert',exact:true}).click();await expect(page.locator('#newsletter-form .form-status')).toContainText('not saved or sent');expect(posts).toEqual([]);
});

test('game portal preserves the runtime, preselects a fighter and rejects forged messages',async({page},info)=>{
  test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'play/?character=KALYX');await expect(page.locator('#game-frame')).toHaveCount(0);await page.getByRole('button',{name:'Launch game',exact:true}).click();await expect(page.locator('#game-connection')).toContainText('Game ready',{timeout:45000});
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
  for(const width of [320,360,375,390,428,768,1024,1440,1920]){await page.setViewportSize({width,height:900});for(const path of [base,product,base+'shop/']){await page.goto(path);await ready(page);await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth),width+' '+path).toBe(width);if(path===base){expect(await page.locator('#drop-title').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].every(rect=>rect.right<=el.getBoundingClientRect().right+2);})).toBe(true);await expect(page.getByRole('link',{name:'Explore Drop 001',exact:true})).toBeVisible();expect(await page.locator('.hero-positioning').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);expect(await page.locator('.hero-status').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13);await page.screenshot({path:info.outputPath('home-'+width+'.png'),scale:'css'});}expect(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();if(r.width<=0||r.right<=innerWidth+1||el.closest('dialog'))return false;for(let p=el.parentElement;p;p=p.parentElement){if(['hidden','clip'].includes(getComputedStyle(p).overflowX)&&p.getBoundingClientRect().right<=innerWidth+1)return false;}return true;}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,80),right:el.getBoundingClientRect().right}))),width+' '+path).toEqual([]);}await expect(page.getByLabel('Search products',{exact:true})).toBeVisible();}
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
  await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('Accessories');await expect(page.locator('#result-count')).toHaveText('4 products');
  if(compact)await summary.click();
  await page.getByRole('button',{name:'Clear category filter'}).click();await expect(page.locator('#result-count')).toHaveText('10 products');
  if(compact)await expect(summary).toBeFocused();
  await page.goto(product);await ready(page);
  if(compact){await expect(page.locator('.mobile-product-bar')).toBeVisible();await page.locator('.mobile-product-bar [data-select-options]').click();await expect(page.locator('#product-options')).toBeFocused();await expect(page.locator('.mobile-product-bar')).not.toBeVisible();await page.locator('.site-footer').scrollIntoViewIfNeeded();await expect(page.locator('.mobile-product-bar')).not.toBeVisible();}
});
test('responsive evidence: sections, shop, product, lookbook, about and play',async({page},info)=>{
  test.skip(info.project.name!=='desktop','One controlled screenshot set');test.setTimeout(90000);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    await page.goto(base);await ready(page);await page.evaluate(()=>document.fonts.ready);
    for(const [name,selector] of [['drop','#current-drop'],['featured','#featured'],['campaign','.campaign-film'],['signals','#character-vault'],['portal','#enter-the-fight']]){
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
