import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const product=base+'products/night-protocol-hoodie/';
const ready=async page=>{await expect(page.locator('#store-data')).toBeAttached();await expect(page.locator('#sound-toggle')).toHaveText('Sound off');};

test('visual: homepage renders, keeps content accessible, and does not load game or video',async({page},info)=>{
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{window.__metrics={lcp:0,cls:0};try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__metrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__metrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch{}});
  await page.goto(base+'?build=a4eb5ec6');await ready(page);await page.evaluate(()=>document.fonts.ready);await expect(page.getByRole('heading',{level:1})).toHaveText(/Equipment\s*for the world\s*after midnight/);
  await expect(page.locator('.hero-image')).toBeVisible();await expect.poll(()=>page.locator('.hero-image').evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  await page.screenshot({path:info.outputPath('home-viewport.png')});
  const metrics=await page.evaluate(()=>({...window.__metrics,width:innerWidth,height:innerHeight,domReady:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd,resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize}))}));
  await writeFile(info.outputPath('performance.json'),JSON.stringify(metrics,null,2));
  expect(requests.some(u=>/\/src\/main\.js|motion-atlases|\.mp4|\.mp3/.test(u))).toBe(false);
  expect(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&!el.closest('.equipment-art,.signal-portrait,.lookbook-strip,.hero,dialog')).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))}))).toMatchObject({scroll:info.project.use.viewport.width});
  for(const section of await page.locator('main>section').all()){await section.scrollIntoViewIfNeeded();}await expect.poll(()=>page.locator('main img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));await page.screenshot({path:info.outputPath('home-full.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('shopping cart: variants, quantity, persistence, removal, focus and demo checkout',async({page},info)=>{
  await page.goto(product);await ready(page);await page.getByRole('radio',{name:'M',exact:true}).check();await page.getByLabel('Quantity',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Add this item to shopping cart'}).click();const cart=page.getByRole('dialog',{name:'Your Loadout'});await expect(cart).toBeVisible();await expect(cart).toContainText('M / Obsidian');await expect(cart.locator('.cart-subtotal')).toContainText('$158');
  await page.getByRole('button',{name:/Increase quantity/}).click();await expect(cart.locator('.cart-subtotal')).toContainText('$237');
  await cart.getByRole('button',{name:'Proceed to checkout',exact:true}).click();await expect(cart).toContainText('No order has been placed.');
  await page.screenshot({path:info.outputPath('cart.png')});
  await page.keyboard.press('Escape');await expect(cart).not.toBeVisible();await expect(page.getByRole('button',{name:'Add this item to shopping cart'})).toBeFocused();
  await page.reload();await page.getByRole('button',{name:'Open shopping cart'}).click();await expect(cart.locator('.cart-subtotal')).toContainText('$237');
  await page.getByRole('button',{name:/Remove Night Protocol/}).click();await expect(cart).toContainText('Your loadout is empty.');await expect(cart.getByRole('button',{name:'Proceed to checkout',exact:true})).toBeDisabled();
});

test('catalog filters, sorting, no-results and quick view work',async({page})=>{
  await page.goto(base+'shop/?category=Accessories');await expect(page.locator('#result-count')).toHaveText('3 products');
  await page.getByLabel('Search products',{exact:true}).fill('charm');await expect(page.locator('[data-product-card]:visible')).toHaveCount(1);
  await page.getByRole('button',{name:'Quick view',exact:true}).click();await expect(page.getByRole('dialog',{name:'GOTHTECHNOLOGY Luggage Charm'})).toBeVisible();await page.getByRole('button',{name:'Add this item to shopping cart'}).click();await expect(page.getByRole('dialog',{name:'Your Loadout'})).toContainText('$19.99');await page.keyboard.press('Escape');
  await page.getByLabel('Search products',{exact:true}).fill('zzz-no-match');await expect(page.locator('#no-results')).toBeVisible();
  await page.locator('#no-results').getByRole('button',{name:'Reset filters'}).click();await expect(page.locator('#result-count')).toHaveText('9 products');await page.getByRole('combobox',{name:'Sort',exact:true}).selectOption('price-low');
  const order=await page.locator('[data-product-card]').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).sort((a,b)=>Number(a.style.order)-Number(b.style.order)).map(n=>n.dataset.handle));expect(order[0]).toBe('black-signal-digital-pack');
  await page.getByLabel('Search products',{exact:true}).fill('beanie');
  const beanieCard=page.locator('[data-product-card]:visible');await expect(beanieCard).toHaveCount(1);await expect(beanieCard.locator('img')).toHaveAttribute('src',/\/media\/detroit-beanie\.webp$/);
  await beanieCard.getByRole('button',{name:'Quick view',exact:true}).click();const beanieQuickView=page.getByRole('dialog',{name:'Detroit Skyline Embroidered Beanie'});
  await expect(beanieQuickView).toBeVisible();await expect(beanieQuickView.getByRole('combobox',{name:'Color',exact:true})).toHaveValue('Black');await expect(beanieQuickView.locator('img')).toHaveAttribute('src',/\/media\/detroit-beanie\.webp$/);
});

test('homepage category tile uses the ashtray artwork and retains the Collectibles filter',async({page})=>{
  await page.goto(base);
  const categories=page.locator('#armory .equipment-case');
  await expect(categories.nth(3).getByRole('heading')).toHaveText('Orignal ArtWork');
  const collectibles=categories.filter({has:page.getByRole('heading',{name:'Collectibles',exact:true})});
  await expect(collectibles.locator('img')).toHaveAttribute('src',/\/media\/mascot-leaf-collectible\.webp$/);
  await collectibles.click();
  await expect(page).toHaveURL(/shop\/\?category=Collectibles$/);
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(1);
  await expect(page.getByRole('link',{name:'I Love Detroit Ashtray',exact:true})).toBeVisible();
});

test('signal keychain cards use matching artwork and retain their collection filter defaults',async({page})=>{
  const signals=[['The Analog: Cyan circuit keychain','detroit-2084',3,'analog'],['The Disciples: Gold guardian keychain','night-protocol',1,'disciples'],['The Observers: Silver observer keychain','static-saints',1,'observers'],['The Null: Shadow hood keychain','cyber-cathedral',1,'null']];
  for(const [name,handle,count,artwork] of signals){
    await page.goto(base+'#character-vault');
    const card=page.getByRole('link',{name,exact:true});
    await expect(card.locator('img')).toHaveAttribute('src',base+'media/keychain-'+artwork+'-campaign.webp');
    await card.click();await expect(page).toHaveURL(base+'collections/'+handle+'/');
    await expect(page.getByRole('combobox',{name:'Collection',exact:true})).toHaveValue(handle);
    await expect(page.locator('[data-product-card]:visible')).toHaveCount(count);
  }
  await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption('');
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(9);
  await page.reload();await expect(page.locator('[data-product-card]:visible')).toHaveCount(9);
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Collection',exact:true})).toHaveValue('cyber-cathedral');
  await expect(page.locator('[data-product-card]:visible')).toHaveCount(1);
});

test('every signal column shows its game artwork and opens the matching fighter',async({page})=>{
  const fighters=[['DETROIT_LENS_NOIR','Detroit Lens Noir','detroit-lens-noir'],['MASTER_EZRA','Master Ezra','master-ezra'],['AMARA_VALENTINE','Amara Valentine','amara-valentine'],['KALYX','Kalyx','kalyx']];
  for(const [index,[id,name,image]] of fighters.entries()){
    await page.goto(base+'#character-vault');
    const card=page.locator('#character-vault .cinematic-card').nth(index);
    await expect(card.locator('.signal-card img')).toBeVisible();
    await expect(card.locator('.signal-game img')).toHaveAttribute('src',base+'assets/user-roster/'+image+'-headshot.webp');
    await card.getByRole('link',{name:'Play as '+name,exact:true}).click();
    await expect(page).toHaveURL(base+'play/?character='+id);
    await expect(page.locator('#requested-character')).toContainText('Starting character: '+name);
  }
});

test('mobile navigation, search and keyboard dialog containment',async({page})=>{
  await page.goto(base);if(await page.getByRole('button',{name:'Open navigation menu'}).isVisible()){await page.getByRole('button',{name:'Open navigation menu'}).click();await expect(page.getByRole('dialog',{name:'The Armory'})).toBeVisible();await page.getByRole('dialog',{name:'The Armory'}).getByRole('link',{name:'SHOP',exact:true}).click();await expect(page).toHaveURL(/shop\/$/);}
  await page.getByRole('button',{name:'Search the store'}).click();await page.getByLabel('Search equipment and collections').fill('hoodie');await expect(page.locator('#search-results')).toContainText('Night Protocol');
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('#search-dialog'))).toBe(true);}
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Search the store'})).toBeFocused();
});

test('product gallery and honest 2.5D display remain usable',async({page},info)=>{
  await page.goto(product);await page.getByRole('button',{name:'Embroidery reference',exact:true}).click();await expect(page.locator('#gallery-image')).toHaveAttribute('src',/embroidery/);
  await page.getByRole('button',{name:'Zoom image',exact:true}).click();await expect(page.locator('#gallery-zoom')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/Open depth display/}).click();await expect(page.locator('.depth-frame img')).toBeVisible();await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('[data-viewer-status]')).toContainText('not supplied');
  await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.locator('.product-information').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('product.png')});
  await page.goto(base+'products/black-signal-beanie/');await expect(page.getByRole('heading',{level:1})).toHaveText('Detroit Skyline Embroidered Beanie');
  await expect(page.locator('#gallery-image')).toHaveAttribute('src',/\/media\/detroit-beanie\.webp$/);await expect(page.getByRole('radio',{name:'Black',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Zoom image',exact:true}).click();await expect(page.locator('#gallery-zoom')).toHaveAttribute('aria-pressed','true');
});

test('reduced motion and WebGL fallback keep shopping available',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base);
  await expect(page.locator('#scene-status')).toHaveText('Static armory');expect(requests.some(u=>/scene\.[^/]+\.js/.test(u))).toBe(false);
  await page.getByRole('button',{name:'Open shopping cart'}).click();await expect(page.getByRole('dialog',{name:'Your Loadout'})).toContainText('Your loadout is empty.');await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl')return null;return original.call(this,type,...args);};});await page.reload();await expect(page.locator('#scene-status')).toHaveText('Static armory');await expect(page.getByRole('link',{name:'Shop the drop',exact:true})).toBeVisible();
});

test('inline Lookbook films autoplay muted only in view and preserve a manual pause',async({page})=>{
  await page.goto(base+'lookbook/');await ready(page);
  const first=page.locator('#lookbook-detroit-film'),riverfront=page.locator('#lookbook-riverfront-film');
  await first.scrollIntoViewIfNeeded();
  await expect.poll(()=>first.evaluate(v=>!v.paused&&v.muted&&v.currentTime>0)).toBe(true);
  await expect.poll(()=>riverfront.evaluate(v=>v.paused)).toBe(true);
  await page.getByRole('button',{name:'Pause Lookbook film',exact:true}).click();
  await riverfront.scrollIntoViewIfNeeded();
  await expect.poll(()=>riverfront.evaluate(v=>!v.paused&&v.muted&&v.currentTime>0)).toBe(true);
  await first.scrollIntoViewIfNeeded();
  await expect.poll(()=>riverfront.evaluate(v=>v.paused)).toBe(true);
  await expect(page.getByRole('button',{name:'Play Lookbook film',exact:true})).toBeVisible();
  expect(await first.evaluate(v=>v.paused)).toBe(true);
  await page.getByRole('button',{name:'Play Lookbook film',exact:true}).click();
  const firstHost=page.locator('[data-inline-film]').filter({has:first});
  await firstHost.getByRole('button',{name:'Turn sound on',exact:true}).click();
  await expect(firstHost.getByRole('button',{name:'Mute sound',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Open shopping cart',exact:true}).click();
  await expect.poll(()=>first.evaluate(v=>v.paused)).toBe(true);
  await page.getByRole('button',{name:'Close shopping cart',exact:true}).click();
  await expect.poll(()=>first.evaluate(v=>!v.paused&&v.muted)).toBe(true);
});

test('reduced motion keeps inline films on request and manual playback remains available',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'lookbook/');await ready(page);
  const film=page.locator('#lookbook-riverfront-film');await film.scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Play riverfront film',exact:true})).toBeVisible();
  expect(await film.evaluate(v=>v.paused&&v.muted)).toBe(true);
  await page.getByRole('button',{name:'Play riverfront film',exact:true}).click();
  await expect.poll(()=>film.evaluate(v=>!v.paused)).toBe(true);
  await page.getByRole('button',{name:'Pause riverfront film',exact:true}).click();
  await page.goto(base+'about/');
  const origin=page.locator('#detroit-origin-film');await origin.scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Play Detroit film',exact:true})).toBeVisible();
  expect(await origin.evaluate(v=>v.paused&&v.muted)).toBe(true);
});

test('Lookbook silent transmission is requested explicitly and can always close',async({page})=>{
  await page.goto(base+'lookbook/');await expect(page.locator('#store-video')).not.toHaveAttribute('src');await page.getByRole('button',{name:'Watch the 15-second charm film',exact:true}).click();await expect(page.getByRole('dialog',{name:'Transmission received'})).toBeVisible();
  await expect.poll(()=>page.locator('#store-video').evaluate(video=>video.readyState)).toBeGreaterThan(0);expect(await page.locator('#store-video').evaluate(video=>video.muted)).toBe(true);
  await page.getByRole('button',{name:'Do not show again',exact:true}).click();await expect(page.locator('#transmission-dialog')).not.toBeVisible();await expect(page.locator('#store-video')).not.toHaveAttribute('src');
});

test('homepage commercial starts muted once per session and supports replay',async({page})=>{
  await page.goto(base);await ready(page);
  const dialog=page.locator('#home-commercial'),video=page.locator('#home-commercial-video');
  await expect(video).not.toHaveAttribute('src');
  await expect(dialog).toBeVisible({timeout:15000});
  await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThan(1);
  expect(await video.evaluate(v=>v.muted)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();await expect(video).not.toHaveAttribute('src');
  await page.reload();await page.waitForTimeout(9000);
  await expect(dialog).not.toBeVisible();await expect(video).not.toHaveAttribute('src');
  await page.getByRole('button',{name:'Watch transmission',exact:true}).click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button',{name:'Don’t show automatically again',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button',{name:'Watch transmission',exact:true}).click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button',{name:'Close commercial',exact:true}).click();
});

test('homepage commercial waits for an open shopping cart',async({page})=>{
  await page.goto(base);await page.getByRole('button',{name:'Open shopping cart',exact:true}).click();
  await page.waitForTimeout(9000);
  await expect(page.locator('#cart-dialog')).toBeVisible();
  await expect(page.locator('#home-commercial')).not.toBeVisible();
  await expect(page.locator('#home-commercial-video')).not.toHaveAttribute('src');
  await page.getByRole('button',{name:'Close shopping cart',exact:true}).click();
  await expect(page.locator('#home-commercial')).toBeVisible({timeout:10000});
  await page.keyboard.press('Escape');
});

test('reduced motion leaves the homepage commercial on request',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base);
  await page.waitForTimeout(9000);await expect(page.locator('#home-commercial')).not.toBeVisible();
  await page.getByRole('button',{name:'Watch transmission',exact:true}).click();
  await expect(page.locator('#home-commercial')).toBeVisible();
  expect(await page.locator('#home-commercial-video').evaluate(v=>v.paused&&v.muted)).toBe(true);
  await page.getByRole('button',{name:'Close commercial',exact:true}).click();
});

test('newsletter consent is required and demo does not send personal data',async({page})=>{
  const posts=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});await page.goto(base);await page.getByLabel('Email address',{exact:true}).fill('qa@example.test');await page.getByRole('button',{name:'Join the signal',exact:true}).click();await expect(page.locator('#newsletter-form .form-status')).toContainText('not connected');
  await page.getByRole('checkbox',{name:/I agree to receive/}).check();await page.getByRole('button',{name:'Join the signal',exact:true}).click();await expect(page.locator('#newsletter-form .form-status')).toContainText('not saved or sent');expect(posts).toEqual([]);
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
  for(const path of paths){const response=await request.get(path);expect(response.status(),path).toBe(200);const html=await response.text();expect(html,path).toContain('rel="canonical"');expect(html,path).toContain('<h1');}
  await page.goto(base+'lookbook/');for(const img of await page.locator('main img').all()){await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);}
});

test('widths 320 through 1920 do not overflow or hide purchase controls',async({page},info)=>{
  test.skip(info.project.name!=='desktop','Breakpoint sweep needs one Chromium pass');
  for(const width of [320,360,390,428,768,1024,1440,1920]){await page.setViewportSize({width,height:900});for(const path of [base,product,base+'shop/']){await page.goto(path);expect(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();if(r.width<=0||r.right<=innerWidth+1||el.closest('dialog'))return false;for(let p=el.parentElement;p;p=p.parentElement){if(['hidden','clip'].includes(getComputedStyle(p).overflowX)&&p.getBoundingClientRect().right<=innerWidth+1)return false;}return true;}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,80),right:el.getBoundingClientRect().right}))),width+' '+path).toEqual([]);}await expect(page.getByLabel('Search products',{exact:true})).toBeVisible();}
});
