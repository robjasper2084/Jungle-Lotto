import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { finished } from 'node:stream/promises';
import { legacyIntegration } from '../../scripts/store-integration.mjs';
import { DemoProvider, DEMO_CART_KEY } from '../../store/commerce/demo.ts';
import { demoProducts, filterProducts, selectVariant } from '../../store/content/catalog.ts';
import { fromDecimal, formatMoney, subtotal, quantity } from '../../store/commerce/money.ts';
import { ShopifyProvider, normalizeProduct, validateCheckoutUrl } from '../../store/commerce/shopify.ts';
import { validGameMessage, acceptGameMessage, cosmeticReward, monetaryRewards } from '../../store/game/messages.ts';
import { chooseQuality, PerformanceGovernor } from '../../store/three/governor.ts';
import { createConfig } from '../../store/config.ts';
import { createAnalytics } from '../../store/state/analytics.ts';
import { conversionMode, launchReadiness, productReadiness } from '../../store/commerce/mode.ts';
import { launchOwner, pendingInformation, type LaunchOwner } from '../../store/content/launch.ts';
import { createSubscription, disconnectedMessage, secureEndpoint, type SubscriptionRequest } from '../../store/state/subscription.ts';
import { serialize } from '../../store/utilities/serialize.ts';
const memory=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};};
const hoodie=demoProducts[0],variant=hoodie.variants[0];

class PreviewResponse extends PassThrough {
  statusCode=200;
  headers=new Map<string,string|number>();
  setHeader(name:string,value:string|number){this.headers.set(name.toLowerCase(),value);}
}
type PreviewMiddleware=(req:{url:string},res:PreviewResponse,next:()=>void)=>Promise<void>;
function previewMiddleware(base:string){
  let handler:PreviewMiddleware|undefined;
  const {hooks}=legacyIntegration();
  hooks['astro:config:done']({config:{base}});
  hooks['astro:server:setup']({server:{middlewares:{use(fn:PreviewMiddleware){handler=fn;}}}});
  assert.ok(handler);
  return handler;
}
async function previewResponse(handler:PreviewMiddleware,url:string){
  const res=new PreviewResponse(),chunks:Buffer[]=[];
  let passedThrough=false;
  res.on('data',(chunk:Buffer)=>chunks.push(chunk));
  const complete=finished(res);
  await handler({url},res,()=>{passedThrough=true;res.end();});
  await complete;
  return {res,passedThrough,body:Buffer.concat(chunks)};
}
test('legacy dev middleware serves game entry before and after Astro strips the base',async()=>{
  for(const base of ['/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/','/']){
    const middleware=previewMiddleware(base);
    for(const prefix of new Set([base,'/']))for(const route of ['legacy-game/','legacy-game/index.html?character=KALYX']){
      const result=await previewResponse(middleware,prefix+route),html=result.body.toString();
      assert.equal(result.passedThrough,false,prefix+route);
      assert.equal(result.res.statusCode,200);
      assert.match(String(result.res.headers.get('content-type')),/text\/html/);
      assert.ok(html.includes(`<base href="${base}">`));
      assert.ok(html.includes('./legacy-game/reward-sdk.js'));
      assert.ok(html.includes('./legacy-game/bridge.js'));
      assert.ok(html.includes('./src/main.js'));
    }
  }
});
test('legacy dev middleware preserves raw game modules, SDK and assets with query strings',async()=>{
  const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/',middleware=previewMiddleware(base);
  const files=[['src/main.js','../../src/main.js','text/javascript'],['legacy-game/reward-sdk.js','../../../../assets/js/lm-game-rewards-sdk.js','text/javascript'],['assets/user-stage/detroit-riverfront.webp','../../assets/user-stage/detroit-riverfront.webp','image/webp']];
  for(const prefix of [base,'/'])for(const [route,source,type] of files){
    const result=await previewResponse(middleware,prefix+route+'?build=regression');
    assert.equal(result.passedThrough,false,prefix+route);
    assert.equal(result.res.statusCode,200);
    assert.equal(result.res.headers.get('content-type'),type);
    assert.deepEqual(result.body,await readFile(new URL(source,import.meta.url)));
  }
  assert.equal((await previewResponse(middleware,'/play/')).passedThrough,true);
  assert.equal((await previewResponse(middleware,'/assets/not-present.webp')).res.statusCode,404);
  assert.equal((await previewResponse(middleware,'/assets/%2e%2e%2f%2e%2e%2fpackage.json')).res.statusCode,403);
});
test('money uses integer minor units across zero, two, and three-decimal currencies',()=>{
  assert.deepEqual(fromDecimal('79.10','USD'),{amount:7910,currency:'USD'});
  assert.deepEqual(fromDecimal('1800','JPY'),{amount:1800,currency:'JPY'});
  assert.deepEqual(fromDecimal('1.235','KWD'),{amount:1235,currency:'KWD'});
  assert.equal(formatMoney({amount:7900,currency:'USD'}),'$79');
  assert.equal(subtotal([fromDecimal('0.10','USD'),fromDecimal('0.20','USD')]).amount,30);
  assert.throws(()=>fromDecimal('3.123','USD'));assert.throws(()=>fromDecimal('-4','USD'));assert.throws(()=>fromDecimal('9007199254740999','USD'));
  assert.throws(()=>subtotal([fromDecimal('3','EUR')]));assert.throws(()=>quantity(1.5));assert.throws(()=>quantity(100));
});
test('cart adds, merges, updates, removes and persists without trusting stored prices',async()=>{
  const storage=memory(),provider=new DemoProvider(storage);const empty=await provider.createCart();assert.equal(empty.totalQuantity,0);
  await provider.addCartLine(empty.id,variant.id,1);let cart=await provider.addCartLine(empty.id,variant.id,2);
  assert.equal(cart.lines.length,1);assert.equal(cart.subtotal.amount,26700);
  cart=await provider.updateCartLine(cart.id,cart.lines[0].id,2);assert.equal(cart.subtotal.amount,17800);
  const saved=JSON.parse(storage.getItem(DEMO_CART_KEY)!);assert.equal(saved.lines[0].price,undefined);
  cart=(await new DemoProvider(storage).getCart(cart.id))!;assert.equal(cart.totalQuantity,2);
  cart=await provider.removeCartLine(cart.id,cart.lines[0].id);assert.equal(cart.lines.length,0);
});
test('cart rejects unavailable variants, invalid quantities and corrupted storage',async()=>{
  const products=structuredClone(demoProducts);products[0].variants[0].available=false;
  const storage=memory();storage.setItem(DEMO_CART_KEY,JSON.stringify({version:1,lines:[{variantId:variant.id,quantity:1},{variantId:'unknown',quantity:1},{variantId:hoodie.variants[1].id,quantity:100}]}));
  const provider=new DemoProvider(storage,products);assert.equal((await provider.createCart()).lines.length,0);
  await assert.rejects(provider.addCartLine('demo-loadout',variant.id,1),/unavailable/);
  await assert.rejects(provider.addCartLine('demo-loadout',hoodie.variants[1].id,-1),/quantity/);
  storage.setItem(DEMO_CART_KEY,'broken-json');assert.equal((await new DemoProvider(storage).createCart()).warnings.length,1);
});
test('demo checkout never creates a fake order; storage failure remains usable',async()=>{
  const blocked={getItem:()=>null,setItem:()=>{throw Error('blocked');},removeItem:()=>{}};
  const provider=new DemoProvider(blocked);const cart=await provider.addCartLine('demo-loadout',variant.id,1);
  assert.equal(cart.totalQuantity,1);assert.match(cart.warnings[0],/this page only/);
  await assert.rejects(provider.getCheckoutUrl(cart.id),/payments are disabled/);
});
test('cart restoration recalculates current prices and rejects duplicate lines',async()=>{
  const storage=memory();storage.setItem(DEMO_CART_KEY,JSON.stringify({version:1,lines:[{variantId:variant.id,quantity:2,price:1},{variantId:variant.id,quantity:2}]}));
  const changed=structuredClone(demoProducts);changed[0].variants[0].price.amount=8100;
  const cart=await new DemoProvider(storage,changed).createCart();assert.equal(cart.totalQuantity,2);assert.equal(cart.subtotal.amount,16200);
});
test('filters combine variant options and handle search, availability and price sorting',()=>{
  assert.equal(filterProducts(demoProducts,{search:'hoodie',size:'M',color:'Obsidian'}).length,1);
  assert.equal(filterProducts(demoProducts,{search:'no-such-product'}).length,0);
  assert.equal(filterProducts(demoProducts,{availability:'unavailable'}).length,3);
  assert.equal(filterProducts(demoProducts,{sort:'price-low'})[0].price.amount,1199);
  assert.equal(filterProducts(demoProducts,{sort:'price-high'})[0].price.amount,12900);
  assert.equal(selectVariant(hoodie,'M','Obsidian')?.size,'M');assert.equal(selectVariant(hoodie,'XXXS','Obsidian'),null);
  const p=structuredClone(hoodie);p.variants=[{...variant,size:'S',color:'Red'},{...variant,id:'v2',size:'M',color:'Blue'}];
  assert.equal(filterProducts([p],{size:'S',color:'Blue'}).length,0);
});

test('Detroit beanie is searchable in black and keeps its reference image in the saved cart',async()=>{
  const products=filterProducts(demoProducts,{search:'Detroit Skyline Embroidered Beanie',color:'Black'});
  assert.equal(products.length,1);
  const beanie=products[0],beanieVariant=selectVariant(beanie,'One size','Black');
  assert.ok(beanieVariant);
  const storage=memory(),provider=new DemoProvider(storage);
  assert.equal((await provider.getProduct('black-signal-beanie'))?.id,beanie.id);
  const cart=await provider.addCartLine((await provider.createCart()).id,beanieVariant.id,1);
  const restored=(await new DemoProvider(storage).getCart(cart.id))!;
  assert.equal(restored.lines[0].title,'Detroit Skyline Embroidered Beanie');
  assert.equal(beanie.price.amount,1900);
  assert.equal(formatMoney(beanie.price),'$19');
  assert.equal(restored.lines[0].color,'Black');
  assert.equal(restored.lines[0].image?.src,'media/detroit-skyline-beanie-reference.webp');
});
test('alternate Detroit skull cap is a distinct $22 Shop product with its supplied portrait reference',async()=>{
  const products=filterProducts(demoProducts,{search:'Detroit Embroidered Skull Cap',color:'Black'});
  assert.equal(products.length,1);
  const cap=products[0],capVariant=selectVariant(cap,'One size','Black');
  assert.ok(capVariant);
  assert.equal(cap.handle,'detroit-skull-cap-alt');
  assert.equal(cap.title,'Detroit Embroidered Skull Cap — Alt Version');
  assert.equal(cap.price.amount,2200);
  assert.equal(formatMoney(cap.price),'$22');
  assert.equal(cap.featured,false);
  assert.equal(cap.images[0]?.src,'media/detroit-skull-cap-alt-reference.webp');
  assert.deepEqual([cap.images[0]?.width,cap.images[0]?.height],[896,1200]);
  const storage=memory(),provider=new DemoProvider(storage);
  const cart=await provider.addCartLine((await provider.createCart()).id,capVariant.id,1);
  const restored=(await new DemoProvider(storage).getCart(cart.id))!;
  assert.equal(restored.lines[0].title,'Detroit Embroidered Skull Cap — Alt Version');
  assert.equal(restored.lines[0].image?.src,'media/detroit-skull-cap-alt-reference.webp');
});
test('Detroit 2084 shirt keeps its $36 preview price and supplied artwork in the saved cart',async()=>{
  const shirt=demoProducts.find(product=>product.handle==='detroit-2084-shirt')!;
  assert.equal(shirt.title,'Detroit 2084 Graphic T-Shirt');
  assert.equal(shirt.price.amount,3600);
  assert.equal(formatMoney(shirt.price),'$36');
  assert.equal(shirt.images[0]?.src,'media/detroit-2084-tee-reference.webp');
  const storage=memory(),provider=new DemoProvider(storage);
  const cart=await provider.addCartLine((await provider.createCart()).id,shirt.variants[0].id,1);
  const restored=(await new DemoProvider(storage).getCart(cart.id))!;
  assert.equal(restored.lines[0].image?.src,'media/detroit-2084-tee-reference.webp');
});
test('Knight Protocol hoodie uses the $89 preview price, no-charm lead image and inclusion disclosure',async()=>{
  const hoodie=demoProducts.find(product=>product.handle==='night-protocol-hoodie')!;
  assert.equal(hoodie.price.amount,8900);
  assert.equal(formatMoney(hoodie.price),'$89');
  assert.ok(hoodie.variants.every(variant=>variant.price.amount===8900));
  assert.equal(hoodie.images[0]?.src,'media/night-protocol-hoodie-no-charm-reference.webp');
  assert.equal(hoodie.images[3]?.src,'media/night-protocol-hoodie-cathedral-styling-reference.webp');
  assert.deepEqual([hoodie.images[3]?.width,hoodie.images[3]?.height],[1600,900]);
  assert.equal(hoodie.video,'media/knight-protocol-supplied-product-film-v1.mp4');
  assert.match(hoodie.information.includedItems ?? '',/charm.+not included with the hoodie/i);
  const storage=memory(),provider=new DemoProvider(storage);
  const cart=await provider.addCartLine((await provider.createCart()).id,hoodie.variants[0].id,2);
  assert.equal(cart.subtotal.amount,17800);
  assert.equal(cart.lines[0].image?.src,'media/night-protocol-hoodie-no-charm-reference.webp');
});
test('Boogeyman hoodie keeps its themed campaign art and remains unsellable until the owner supplies a price',()=>{
  const hoodie=demoProducts.find(product=>product.handle==='boogeyman-graphic-hoodie')!;
  assert.equal(demoProducts.some(product=>product.handle==='boogie-man-knit-sweater'),false);
  assert.equal(hoodie.title,'Boogeyman Graphic Hoodie');
  assert.equal(hoodie.featured,false);
  assert.equal(hoodie.price.amount,0);
  assert.ok(hoodie.variants.every(variant=>!variant.available));
  assert.equal(hoodie.images[0]?.kind,'CAMPAIGN CONCEPT');
  assert.equal(hoodie.images[1]?.kind,'SUPPLIED PRODUCT REFERENCE');
  assert.match(hoodie.images[0]?.src ?? '',/-campaign\.webp$/);
  assert.match(hoodie.images[1]?.src ?? '',/-supplied\.webp$/);
});
test('Detroit skyline cap is a separate $32 store product with supplied artwork',async()=>{
  const cap=demoProducts.find(product=>product.handle==='detroit-skyline-cap')!;
  assert.equal(cap.title,'Detroit Skyline Embroidered Cap');
  assert.equal(cap.price.amount,3200);
  assert.equal(formatMoney(cap.price),'$32');
  assert.equal(cap.colors[0],'Black');
  assert.equal(cap.images[0]?.src,'media/detroit-skyline-cap-reference.webp');
  const storage=memory(),provider=new DemoProvider(storage);
  const cart=await provider.addCartLine((await provider.createCart()).id,cap.variants[0].id,1);
  const restored=(await new DemoProvider(storage).getCart(cart.id))!;
  assert.equal(restored.lines[0].image?.src,'media/detroit-skyline-cap-reference.webp');
});
test('Detroit ashtray keeps its existing product link and uses armory campaign art on cards',async()=>{
  const [ashtray]=filterProducts(demoProducts,{search:'I Love Detroit Ashtray',category:'Collectibles'});
  assert.ok(ashtray);
  assert.equal(ashtray.handle,'cyber-cathedral-art-print');
  assert.equal(ashtray.cardImage?.src,'media/i-love-detroit-ashtray-armory-campaign-v2.webp');
  assert.equal(ashtray.cardImage?.kind,'CAMPAIGN CONCEPT');
  const storage=memory(),provider=new DemoProvider(storage);
  const cart=await provider.addCartLine((await provider.createCart()).id,ashtray.variants[0].id,1);
  const restored=(await new DemoProvider(storage).getCart(cart.id))!;
  assert.equal(restored.lines[0].title,'I Love Detroit Ashtray');
  assert.equal(restored.lines[0].image?.src,'media/mascot-leaf-collectible.webp');
});
test('LottoMind charm uses exact cents in the catalog and cart',async()=>{
  const charm=demoProducts.find(p=>p.handle==='gothtechnology-luggage-charm')!;
  assert.equal(charm.price.amount,1999);
  assert.equal(formatMoney(charm.price),'$19.99');
  assert.ok(charm.variants.every(v=>v.price.amount===1999));
  assert.equal(charm.cardImage?.src,'media/gothtechnology-luggage-charm-armory-higgsfield-v1.webp');
  assert.equal(charm.cardImage?.kind,'CAMPAIGN CONCEPT');
  assert.equal(charm.images[0]?.src,'media/gothtechnology-luggage-charm-armory-higgsfield-v1.webp');
  assert.equal(charm.images[1]?.src,'media/charm.webp');
  const provider=new DemoProvider(memory());
  const cart=await provider.addCartLine((await provider.createCart()).id,charm.variants[0].id,2);
  assert.equal(cart.subtotal.amount,3998);
});
test('Static Saints patch set is $20 and includes the supplied white embroidery reference',()=>{
  const patches=demoProducts.find(product=>product.handle==='static-saints-patch-set')!;
  assert.equal(patches.price.amount,2000);
  assert.equal(patches.featured,false);
  assert.equal(formatMoney(patches.price),'$20');
  assert.deepEqual(patches.images.map(image=>image.src),[
    'media/patch.webp',
    'media/static-saints-patch-white-reference.webp',
  ]);
  assert.equal(patches.images[1]?.label,'White embroidery reference');
  assert.equal(patches.images[1]?.kind,'DETAIL REFERENCE');
});
test('Original Artwork collection keeps both supplied Detroit references price-pending and features only the winter alt',()=>{
  const artwork=demoProducts.filter(product=>product.collection==='original-artwork');
  assert.deepEqual(artwork.map(product=>product.handle),['detroit-riverfront-sunset-artwork','detroit-winter-sunset-artwork']);
  for(const product of artwork){
    assert.equal(product.price.amount,0);
    assert.equal(product.featured,product.handle==='detroit-winter-sunset-artwork');
    assert.ok(product.variants.every(variant=>!variant.available));
    assert.equal(product.cardImage?.kind,'CAMPAIGN CONCEPT');
    assert.equal(product.images[0]?.kind,'CAMPAIGN CONCEPT');
    assert.equal(product.images[2]?.kind,'SUPPLIED PRODUCT REFERENCE');
  }
  assert.equal(artwork[0].images[1]?.src,'media/detroit-riverfront-sunset-artwork-gothic-frame-alt.webp');
  assert.equal(artwork[1].images[1]?.src,'media/detroit-winter-sunset-artwork-gothic-frame-alt.webp');
  assert.equal(artwork[1].cardImage?.src,'media/detroit-winter-sunset-artwork-gothic-frame-alt.webp');
  assert.equal(artwork[0].images[1]?.label,'Gothic frame alt');
  assert.equal(artwork[1].images[1]?.label,'Gothic frame alt');
  assert.equal(artwork[0].images[1]?.kind,'CAMPAIGN CONCEPT');
  assert.equal(artwork[1].images[1]?.kind,'CAMPAIGN CONCEPT');
  assert.equal(artwork[0].images[2]?.src,'media/detroit-riverfront-sunset-artwork-supplied.webp');
  assert.equal(artwork[1].images[2]?.src,'media/detroit-winter-sunset-artwork-supplied.webp');
});
test('Mobster luggage charm replaces the desk mat at $19.99 with supplied artwork',async()=>{
  assert.equal(demoProducts.some(product=>product.handle==='combat-grid-desk-mat'),false);
  const charm=demoProducts.find(product=>product.handle==='mobster-luggage-charm')!;
  assert.equal(charm.title,'Mobster Luggage Charm');
  assert.equal(charm.productType,'Accessories');
  assert.equal(charm.price.amount,1999);
  assert.equal(formatMoney(charm.price),'$19.99');
  assert.equal(charm.cardImage?.src,'media/mobster-luggage-charm-armory-campaign-v2.webp');
  assert.equal(charm.cardImage?.kind,'CAMPAIGN CONCEPT');
  assert.equal(charm.images[0]?.src,'media/mobster-luggage-charm-cyan-arch-reference.webp');
  assert.equal(charm.images[1]?.src,'media/mobster-luggage-charm-equipment-context-reference.webp');
  assert.equal(charm.images[1]?.label,'Equipment context');
  assert.equal(charm.video,'https://www.youtube-nocookie.com/embed/0yPqZEvKnFU?rel=0&autoplay=1');
  assert.equal(charm.video.includes('autoplay=1'),true);
  const storage=memory(),provider=new DemoProvider(storage);
  const cart=await provider.addCartLine((await provider.createCart()).id,charm.variants[0].id,1);
  const restored=(await new DemoProvider(storage).getCart(cart.id))!;
  assert.equal(restored.lines[0].title,'Mobster Luggage Charm');
  assert.equal(restored.lines[0].image?.src,'media/mobster-luggage-charm-cyan-arch-reference.webp');
});
test('Key Knife is one $11.99 Shop product with black and silver variants plus six campaign displays',async()=>{
  const knife=demoProducts.find(product=>product.handle==='key-knife-keychain')!;
  assert.ok(knife);
  assert.equal(knife.title,'Key Knife Keychain — 2-Inch Utility Pocketknife');
  assert.match(knife.description,/Looks like a key.+slim profile.+keyring/i);
  assert.match(knife.description,/treat it as sharp/i);
  assert.match(knife.description,/age requirements.+safety guidance.+legal carry and shipping restrictions/i);
  assert.equal(knife.productType,'Accessories');
  assert.equal(knife.price.amount,1199);
  assert.equal(formatMoney(knife.price),'$11.99');
  assert.equal(knife.featured,false);
  assert.deepEqual(knife.colors,['Black','Silver']);
  assert.deepEqual(knife.variants.map(variant=>variant.color),['Black','Silver']);
  assert.equal(knife.cardImage?.src,'media/key-knife-gothic-open-side-campaign.webp');
  assert.deepEqual(knife.images.slice(0,2).map(image=>image.src),['media/key-knife-black-reference.webp','media/key-knife-silver-reference.webp']);
  assert.equal(knife.images[2].src,'media/key-knife-gothic-open-side-campaign.webp');
  assert.equal(knife.images[2].label,'Open-blade Gothic armory campaign concept');
  assert.equal(knife.images.filter(image=>image.kind==='CAMPAIGN CONCEPT').length,6);
  const silver=selectVariant(knife,'One size','Silver');assert.ok(silver);
  const storage=memory(),provider=new DemoProvider(storage);
  const cart=await provider.addCartLine((await provider.createCart()).id,silver.id,1);
  assert.equal(cart.lines[0].color,'Silver');
  assert.equal(cart.lines[0].price.amount,1199);
  const [productPage,filters,catalogUI]=await Promise.all([
    readFile(new URL('../../store/pages/products/[handle].astro',import.meta.url),'utf8'),
    readFile(new URL('../../store/components/Filters.astro',import.meta.url),'utf8'),
    readFile(new URL('../../store/ui/catalog.ts',import.meta.url),'utf8'),
  ]);
  assert.match(productPage,/UTILITY KNIFE SAFETY/);
  assert.match(productPage,/Compact everyday carry concept/);
  assert.match(productPage,/Easy attachment to keys, wristlets, or bags/);
  assert.match(productPage,/never carry it concealed where prohibited/);
  assert.match(productPage,/Building personalized carry kits/);
  assert.match(productPage,/Save & Get Launch Alert/);
  assert.match(productPage,/class="model-viewer-title"/);
  assert.doesNotMatch(productPage,/not a garment model/i);
  assert.match(filters,/>All Gear</);
  assert.match(catalogUI,/ArrowRight/);
  assert.match(catalogUI,/Spacebar/);
});
test('Key Knife and gun attachment bundle is a $39 Shop-only bundle with closed and open references',()=>{
  const bundle=demoProducts.find(product=>product.handle==='key-knife-gun-attachment-bundle')!;
  assert.ok(bundle);
  assert.equal(bundle.title,'Key Knife + Gun Attachment Bundle');
  assert.equal(bundle.productType,'Bundles');
  assert.equal(bundle.price.amount,3900);
  assert.equal(formatMoney(bundle.price),'$39');
  assert.equal(bundle.featured,false);
  assert.deepEqual(bundle.colors,['Black']);
  assert.deepEqual(bundle.images.map(image=>image.src),[
    'media/key-knife-gun-attachment-bundle-closed-reference.webp',
    'media/key-knife-gun-attachment-bundle-open-reference.webp',
  ]);
  assert.match(bundle.description,/Mobster luggage charm.+styling only.+not included/i);
  assert.match(bundle.description,/rail compatibility and fit.+age requirements.+legal carry and shipping restrictions/i);
});
test('default Shop order places Detroit Winter Sunset Artwork third in the featured row',()=>{
  const featured=filterProducts(demoProducts);
  assert.deepEqual(featured.slice(0,3).map(product=>product.handle),[
    'night-protocol-hoodie',
    'detroit-2084-shirt',
    'detroit-winter-sunset-artwork',
  ]);
});
test('New Drop declares the supplied looping background track and browser fallback controller',async()=>{
  const [home,experience]=await Promise.all([
    readFile(new URL('../../store/pages/index.astro',import.meta.url),'utf8'),
    readFile(new URL('../../store/ui/experience.ts',import.meta.url),'utf8'),
  ]);
  assert.match(home,/data-background-audio/);assert.match(home,/loop preload="none"/);assert.doesNotMatch(home,/<audio[^>]*data-background-audio[^>]*autoplay/);
  assert.match(home,/media\/lottomind-vault-174hz-background\.mp3/);
  assert.match(experience,/saved\(soundPreference\)!=='off'/);assert.match(experience,/await ambient\.play\(\)/);
});
test('Black Signal rail adapter keeps one canonical title, $12 price and supplied photo views',async()=>{
  const adapter=demoProducts.find(product=>product.handle==='black-signal-digital-pack')!;
  assert.equal(adapter.title,'Black Signal Gun Charm Rail Adapter Pack');
  assert.equal(adapter.productType,'Accessories');
  assert.equal(adapter.digital,false);
  assert.equal(adapter.price.amount,1200);
  assert.equal(adapter.video,'media/black-signal-rail-adapter-supplied-film-v1.mp4');
  assert.equal(formatMoney(adapter.price),'$12');
  assert.deepEqual(adapter.images.map(image=>image.src),[
    'media/black-signal-gun-charm-rail-adapter-black-group-reference.webp',
    'media/black-signal-gun-charm-rail-adapter-equipment-context-reference.webp',
    'media/black-signal-gun-charm-rail-adapter-charm-group-reference.webp',
    'media/black-signal-gun-charm-rail-adapter-black-fabric-reference.webp',
    'media/black-signal-gun-charm-rail-adapter-underside-reference.webp',
  ]);
  const storage=memory(),provider=new DemoProvider(storage);
  const cart=await provider.addCartLine((await provider.createCart()).id,adapter.variants[0].id,1);
  const restored=(await new DemoProvider(storage).getCart(cart.id))!;
  assert.equal(restored.lines[0].title,'Black Signal Gun Charm Rail Adapter Pack');
  assert.equal(restored.lines[0].image?.src,'media/black-signal-gun-charm-rail-adapter-black-group-reference.webp');
});
const settings={domain:'armory-demo.myshopify.com',token:'a'.repeat(32),version:'2026-07'};
const money={amount:'79.00',currencyCode:'USD'};
const rawVariant={id:'gid://shopify/ProductVariant/1',title:'M / Black',availableForSale:true,price:money,selectedOptions:[{name:'Size',value:'M'},{name:'Color',value:'Black'}]};
const rawProduct={id:'gid://shopify/Product/1',handle:'night-protocol-hoodie',title:'Hoodie',description:'Real owner description',productType:'Apparel',tags:[],priceRange:{minVariantPrice:money},images:{nodes:[{url:'https://cdn.shopify.com/p.png',altText:'Hoodie'}]},collections:{nodes:[{handle:'night-protocol'}]},variants:{nodes:[rawVariant],pageInfo:{hasNextPage:false,endCursor:'v1'}},seo:{}};
const rawCart={id:'gid://shopify/Cart/1?key=example',checkoutUrl:'https://armory-demo.myshopify.com/checkouts/example',totalQuantity:1,cost:{subtotalAmount:money},lines:{nodes:[{id:'line-1',quantity:1,cost:{totalAmount:money,amountPerQuantity:money},merchandise:{...rawVariant,product:{handle:'night-protocol-hoodie',title:'Hoodie'}}}],pageInfo:{hasNextPage:false}}};
test('Shopify normalizes real products without demo stock claims',()=>{
  const product=normalizeProduct(rawProduct);assert.equal(product.demo,false);assert.equal(product.inventory,null);assert.equal(product.variants[0].size,'M');assert.equal(product.price.amount,7900);
});
test('Shopify rejects private credentials and unsafe checkout destinations',()=>{
  assert.throws(()=>new ShopifyProvider({...settings,token:'shpat_private'}));
  for(const url of ['http://armory-demo.myshopify.com/a','https://armory-demo.myshopify.com.evil.test/a','https://user:pass@armory-demo.myshopify.com/a','javascript:alert(1)','https://armory-demo.myshopify.com:444/a'])assert.throws(()=>validateCheckoutUrl(url,[settings.domain]));
  assert.equal(validateCheckoutUrl(rawCart.checkoutUrl,[settings.domain]),rawCart.checkoutUrl);
});
test('Shopify cart mutations use correct variables, refresh totals, and surface user errors',async()=>{
  const calls:any[]=[];let reject=false;
  const fetcher=(async (_url:any,options:any)=>{const body=JSON.parse(options.body);calls.push(body);const name=['cartLinesAdd','cartLinesUpdate','cartLinesRemove','cartCreate'].find(n=>body.query.includes(n));return new Response(JSON.stringify({data:name?{[name]:{cart:rawCart,userErrors:reject?[{message:'Sold out'}]:[],warnings:[]}}:{cart:rawCart}}));}) as typeof fetch;
  const provider=new ShopifyProvider(settings,fetcher);
  await provider.createCart();await provider.addCartLine(rawCart.id,rawVariant.id,2);await provider.updateCartLine(rawCart.id,'line-1',3);await provider.removeCartLine(rawCart.id,'line-1');
  assert.deepEqual(calls[1].variables.lines,[{merchandiseId:rawVariant.id,quantity:2}]);
  assert.deepEqual(calls[2].variables.lines,[{id:'line-1',quantity:3}]);assert.deepEqual(calls[3].variables.lineIds,['line-1']);
  assert.equal(await provider.getCheckoutUrl(rawCart.id),rawCart.checkoutUrl);
  reject=true;await assert.rejects(provider.addCartLine(rawCart.id,rawVariant.id,1),/Sold out/);
});
test('Shopify paginates catalog and variant connections',async()=>{
  let count=0;
  const fetcher=(async(_url:any,options:any)=>{count++;const {query,variables}=JSON.parse(options.body);
    if(query.includes('query Variants'))return new Response(JSON.stringify({data:{product:{variants:{nodes:[{...rawVariant,id:'v2'}],pageInfo:{hasNextPage:false,endCursor:'v2'}}}}}));
    const product=structuredClone(rawProduct);if(!variables.after)product.variants.pageInfo.hasNextPage=true;
    return new Response(JSON.stringify({data:{products:{nodes:variables.after?[]:[product],pageInfo:{hasNextPage:!variables.after,endCursor:'p1'}}}}));
  }) as typeof fetch;
  const products=await new ShopifyProvider(settings,fetcher).getProducts();assert.equal(products[0].variants.length,2);assert.equal(count,3);
});
test('Shopify exposes network and GraphQL failures without leaking credentials',async()=>{
  const offline=new ShopifyProvider(settings,(async()=>{throw Error(settings.token);}) as typeof fetch);
  await assert.rejects(offline.createCart(),error=>error instanceof Error&&/could not be reached/.test(error.message)&&!error.message.includes(settings.token));
  const denied=new ShopifyProvider(settings,(async()=>new Response(JSON.stringify({errors:[{message:'denied'}]}))) as typeof fetch);
  await assert.rejects(denied.createCart(),/Storefront API access/);
});
test('game messages require exact source, origin, schema and known characters',()=>{
  const data={type:'GOTHTECH_CHARACTER_SELECTED',characterId:'KALYX'},source={} as Window;
  assert.equal(validGameMessage(data),true);assert.equal(validGameMessage({...data,discount:'FREE'}),false);assert.equal(validGameMessage({...data,characterId:'UNKNOWN'}),false);
  assert.equal(acceptGameMessage({data,origin:'https://site.test',source},'https://site.test',source),true);
  assert.equal(acceptGameMessage({data,origin:'https://evil.test',source},'https://site.test',source),false);
  assert.equal(acceptGameMessage({data,origin:'https://site.test',source:null},'https://site.test',source),false);
  assert.equal(validGameMessage({type:'GOTHTECH_MATCH_COMPLETED',characterId:'KALYX',result:'win',durationSeconds:Infinity}),false);
});
test('game badges are cosmetic only and monetary service stays disabled',async()=>{
  assert.equal(cosmeticReward({type:'GOTHTECH_MATCH_COMPLETED',characterId:'KALYX',result:'win',durationSeconds:10}),null);
  assert.equal(cosmeticReward({type:'GOTHTECH_MATCH_COMPLETED',characterId:'KALYX',result:'win',durationSeconds:35})?.monetaryValue,0);
  await assert.rejects(monetaryRewards.issueSession(),/disabled/);assert.equal((await monetaryRewards.claim('forged')).eligible,false);
});
test('quality honors safety preferences and falls back after persistent poor frame times',()=>{
  const hints={webgl:true,reducedMotion:false,saveData:false,memory:8,cores:8};assert.equal(chooseQuality(hints),'high');
  assert.equal(chooseQuality({...hints,reducedMotion:true,choice:'high'}),'fallback');assert.equal(chooseQuality({...hints,saveData:true}),'fallback');
  assert.equal(chooseQuality({...hints,webgl:false}),'fallback');assert.equal(chooseQuality({...hints,memory:2}),'fallback');assert.equal(chooseQuality({...hints,mobile:true}),'low');
  const governor=new PerformanceGovernor('high');for(let i=0;i<180;i++)governor.sample(55);assert.equal(governor.quality,'balanced');
  for(let i=0;i<360;i++)governor.sample(55);assert.equal(governor.quality,'fallback');
});
test('configuration and analytics fail closed, and embedded JSON cannot close a script',()=>{
  assert.equal(createConfig().commerceMode,'demo');assert.equal(createConfig().features.enableMonetaryGameRewards,false);assert.throws(()=>createConfig({PUBLIC_COMMERCE_MODE:'fake'}));
  const sent:any[]=[];const analytics=createAnalytics((...args)=>sent.push(args));analytics.trackEvent('add_to_cart',{quantity:1});assert.equal(sent.length,0);
  analytics.setConsent(true);analytics.trackEvent('add_to_cart',{quantity:1,email:'private@example.com',handle:'safe'});assert.deepEqual(sent[0],['add_to_cart',{quantity:1,handle:'safe'}]);
  const payload={title:'</script><script>alert(1)</script>'};assert.equal(serialize(payload).includes('<'),false);assert.deepEqual(JSON.parse(serialize(payload)),payload);
});

test('interest mode remains safe even when a launch flag is set without owner facts',()=>{
  const approvedFlag=createConfig({PUBLIC_COMMERCE_MODE:'shopify',PUBLIC_LAUNCH_APPROVED:'true',PUBLIC_SHOPIFY_STORE_DOMAIN:settings.domain,PUBLIC_SHOPIFY_STOREFRONT_TOKEN:settings.token});
  assert.equal(conversionMode(demoProducts,approvedFlag),'interest');
  assert.equal(launchReadiness(demoProducts,approvedFlag).ready,false);
  assert.ok(launchReadiness(demoProducts,approvedFlag).issues.some(issue=>issue.includes('checkout test')));
});
test('approved commerce requires complete products, policies and a tested checkout',()=>{
  const product=normalizeProduct(rawProduct);
  product.information={...pendingInformation(),materials:'Test fixture cotton',careInstructions:'Test fixture care',processingTime:'Test fixture processing',shippingMessage:'Test fixture shipping',returnMessage:'Test fixture returns',sizeGuide:'Test fixture size chart',measurements:'Test fixture measurements',productionStatus:'approved',photographyStatus:'approved',priceApproved:true};
  const owner={...Object.fromEntries(Object.entries(launchOwner).map(([key,value])=>[key,value===null?'Owner-approved test fixture':value])),supportEmail:'support@example.test',accessibilityEmail:'access@example.test',shippingRegions:['Test region'],policiesApproved:true,checkoutTested:true} as LaunchOwner;
  const cfg=createConfig({PUBLIC_COMMERCE_MODE:'shopify',PUBLIC_LAUNCH_APPROVED:'true',PUBLIC_SHOPIFY_STORE_DOMAIN:settings.domain,PUBLIC_SHOPIFY_STOREFRONT_TOKEN:settings.token});
  assert.deepEqual(productReadiness(product),[]);
  assert.equal(conversionMode([product],cfg,owner),'commerce');
  for(const field of ['materials','careInstructions','sizeGuide','shippingMessage','returnMessage'] as const){
    const broken=structuredClone(product);broken.information[field]=null;
    assert.equal(conversionMode([broken],cfg,owner),'interest',field);
  }
  assert.equal(conversionMode([product],cfg,{...owner,checkoutTested:false}),'interest');
  const digital={...product,digital:true};
  assert.ok(productReadiness(digital).includes('licenseInformation'));
  assert.ok(productReadiness(digital).includes('digitalContents'));
});
const alertRequest: SubscriptionRequest={email:'qa@example.test',consent:true,source:'/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/',interests:[{handle:hoodie.handle,variantId:variant.id,size:variant.size,color:variant.color,quantity:2}]};
test('disconnected and unapproved subscriptions do not transmit an email',async()=>{
  let calls=0;const fetcher=(async()=>{calls++;return new Response('{}');}) as typeof fetch;
  for(const [endpoint,approved] of [['',false],['https://mail.example.test/subscribe',false]] as const){
    assert.deepEqual(await createSubscription(endpoint,approved,fetcher).subscribe(alertRequest),{ok:false,message:disconnectedMessage});
  }
  assert.equal(calls,0);
});
test('subscription validates consent, email, identifiers and HTTPS without URL credentials',async()=>{
  let calls=0;const fetcher=(async()=>{calls++;return new Response('{}');}) as typeof fetch;
  const service=createSubscription('https://mail.example.test/subscribe',true,fetcher);
  for(const request of [{...alertRequest,consent:false},{...alertRequest,email:'invalid'},{...alertRequest,source:'/page?email=private'},{...alertRequest,interests:[{...alertRequest.interests[0],quantity:100}]}]){
    assert.equal((await service.subscribe(request)).ok,false);
  }
  for(const url of ['http://mail.example.test/','https://user:pass@mail.example.test/','javascript:alert(1)','/relative']){
    assert.equal(secureEndpoint(url),null);
    assert.equal((await createSubscription(url,true,fetcher).subscribe(alertRequest)).ok,false);
  }
  assert.equal(calls,0);
});
test('subscription sends one scoped request and requires an explicit service acknowledgment',async()=>{
  let captured: RequestInit|undefined;
  const fetcher=(async(_url,options)=>{captured=options;return new Response(JSON.stringify({status:'pending_confirmation'}));}) as typeof fetch;
  const result=await createSubscription('https://mail.example.test/subscribe',true,fetcher).subscribe(alertRequest);
  assert.equal(result.ok,true);
  assert.equal(captured?.credentials,'omit');assert.equal(captured?.redirect,'error');
  const body=JSON.parse(String(captured?.body));assert.equal(body.email,'qa@example.test');assert.equal(body.consent,true);
  assert.deepEqual(body.productHandles,[hoodie.handle]);assert.equal(body.interests[0].quantity,2);
  for(const response of [new Response('{}'),new Response('bad'),new Response('{}',{status:500})]){
    assert.equal((await createSubscription('https://mail.example.test/subscribe',true,(async()=>response) as typeof fetch).subscribe(alertRequest)).ok,false);
  }
  const offline=(async()=>{throw new Error('offline');}) as typeof fetch;
  assert.equal((await createSubscription('https://mail.example.test/subscribe',true,offline).subscribe(alertRequest)).ok,false);
});
test('conversion events stay no-op until consent and never carry contact or search text',()=>{
  const calls:unknown[]=[];const tracker=createAnalytics((...args)=>calls.push(args));
  tracker.trackEvent('launch_alert_submit',{email:'private@example.test'});assert.equal(calls.length,0);
  tracker.setConsent(true);tracker.trackEvent('search',{count:2,search:'private query',email:'private@example.test',name:'Person'});
  assert.deepEqual(calls,[['search',{count:2}]]);
});

