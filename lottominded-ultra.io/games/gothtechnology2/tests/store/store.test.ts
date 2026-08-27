import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoProvider, DEMO_CART_KEY } from '../../store/commerce/demo.ts';
import { demoProducts, filterProducts, selectVariant } from '../../store/content/catalog.ts';
import { fromDecimal, formatMoney, subtotal, quantity } from '../../store/commerce/money.ts';
import { ShopifyProvider, normalizeProduct, validateCheckoutUrl } from '../../store/commerce/shopify.ts';
import { validGameMessage, acceptGameMessage, cosmeticReward, monetaryRewards } from '../../store/game/messages.ts';
import { chooseQuality, PerformanceGovernor } from '../../store/three/governor.ts';
import { createConfig } from '../../store/config.ts';
import { createAnalytics } from '../../store/state/analytics.ts';
import { serialize } from '../../store/utilities/serialize.ts';
const memory=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};};
const hoodie=demoProducts[0],variant=hoodie.variants[0];
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
  assert.equal(cart.lines.length,1);assert.equal(cart.subtotal.amount,23700);
  cart=await provider.updateCartLine(cart.id,cart.lines[0].id,2);assert.equal(cart.subtotal.amount,15800);
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
  assert.equal(filterProducts(demoProducts,{availability:'unavailable'}).length,0);
  assert.equal(filterProducts(demoProducts,{sort:'price-low'})[0].price.amount,1200);
  assert.equal(filterProducts(demoProducts,{sort:'price-high'})[0].price.amount,12900);
  assert.equal(selectVariant(hoodie,'M','Obsidian')?.size,'M');assert.equal(selectVariant(hoodie,'XXXS','Obsidian'),null);
  const p=structuredClone(hoodie);p.variants=[{...variant,size:'S',color:'Red'},{...variant,id:'v2',size:'M',color:'Blue'}];
  assert.equal(filterProducts([p],{size:'S',color:'Blue'}).length,0);
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
