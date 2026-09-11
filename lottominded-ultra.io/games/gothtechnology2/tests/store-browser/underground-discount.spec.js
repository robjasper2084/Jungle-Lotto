import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
async function screenshot(page,info,name){
  const path=process.env.UNDERGROUND_SCREENSHOTS;
  if(path){await mkdir(path,{recursive:true});await page.screenshot({path:join(path,info.project.name+'-'+name+'.png')});}
}

for(const tier of [{points:12000,percent:5,price:'$101.46'},{points:30000,percent:10,price:'$96.12'},{points:60000,percent:15,price:'$90.78'},{points:120000,percent:20,price:'$85.44'}]){
  test(`New Drop Underground game discount reaches ${tier.percent}% through a pickup and carries into price previews`,async({page,isMobile},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.emulateMedia({reducedMotion:'reduce'});
    // Isolated test checkpoint, one real collectible below the tier boundary.
    await page.addInitScript(({base,points})=>{
      if(window.top===window&&location.pathname===base&&!sessionStorage.getItem('reward-fixture')){
        localStorage.setItem('rahbe-underground-v1',JSON.stringify({version:1,reached:0,coins:(points-1000)/100,secrets:0,seals:[],taken:[],treasures:[],wallOpen:false}));
        sessionStorage.setItem('reward-fixture','1');
      }
    },{base,points:tier.points});
    await page.goto(base+'#current-drop');
    await page.locator('.underground-copy').getByRole('button',{name:'Play Underground',exact:true}).click();
    const popup=page.locator('#underground-dialog'),game=page.frameLocator('#underground-dialog iframe');
    await expect(game.locator('#continue')).toBeVisible({timeout:25000});
    await expect(popup.locator('[data-underground-loading]')).toBeHidden();
    await game.locator('#continue').click();
    const frame=page.frames().find(frame=>frame.url().includes('/arcade/robot-rahbe-underground/'));
    const score=()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().score);
    expect(await score()).toBe(tier.points-1000);
    if(isMobile){
      const button=await game.getByRole('button',{name:'Move right',exact:true}).boundingBox();
      await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();
      await expect.poll(score,{intervals:[30]}).toBeGreaterThanOrEqual(tier.points);await page.mouse.up();
    }else{
      await page.keyboard.down('d');await expect.poll(score,{intervals:[30]}).toBeGreaterThanOrEqual(tier.points);await page.keyboard.up('d');
    }
    await expect(popup.locator('[data-reward-percent]')).toHaveText(`${tier.percent}%`);
    await expect(game.locator('#loot')).toContainText(tier.points.toLocaleString('en-US'));
    if(tier.percent===20){
      await expect(popup.locator('[data-reward-next]')).toHaveText('Maximum 20% discount preview reached');
      await screenshot(page,info,'discount-earned');
    }
    await popup.getByRole('button',{name:'Close game',exact:true}).click();
    await expect(page.locator('#underground-rewards [data-reward-percent]')).toHaveText(`${tier.percent}%`);
    const best=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('gothtechnology.arcade.discount-preview.v2')).runs).reduce((sum,run)=>sum+run.score-run.baseline,0));
    expect(best).toBeGreaterThanOrEqual(tier.points);
    await page.reload();
    await expect(page.locator('#underground-rewards [data-reward-percent]')).toHaveText(`${tier.percent}%`);
    if(tier.percent===20){
      await page.locator('.underground-copy').getByRole('button',{name:'Play Underground',exact:true}).click();
      await expect(game.locator('#start')).toBeEnabled({timeout:25000});
      await game.locator('#start').click();
      await expect(popup.locator('[data-reward-percent]')).toHaveText('20%');
      await popup.getByRole('button',{name:'Close game',exact:true}).click();
      expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('gothtechnology.arcade.discount-preview.v2')).runs).reduce((sum,run)=>sum+run.score-run.baseline,0))).toBe(best);
    }
    await page.goto(base+'products/night-protocol-hoodie/');
    await expect(page.locator('[data-selected-price]')).toHaveText('$106.80');
    const price=page.locator('.product-information>[data-game-price-preview]');
    await expect(price.locator('[data-game-price-label]')).toHaveText(`With your ${tier.percent}% game discount`);
    await expect(price.locator('[data-game-price-value]')).toHaveText(tier.price);
    await expect(price).toContainText('Not redeemable yet');
    await page.getByRole('radio',{name:'M',exact:true}).check();
    await page.getByRole('button',{name:'Save to Launch Loadout',exact:true}).click();
    const cart=page.getByRole('dialog',{name:'Your Launch Loadout'});
    await expect(cart.locator('.cart-subtotal')).toContainText('$106.80');
    await expect(cart.locator('[data-cart-game-total]')).toHaveText(tier.price);
    await expect(cart.getByRole('button',{name:'Alerts coming soon',exact:true})).toBeDisabled();
    if(tier.percent===20)await screenshot(page,info,'discount-loadout');
    expect(errors).toEqual([]);
  });
}

test('New Drop Underground price comparisons cover all priced products and preserve pending concepts',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base+'shop/');
  const products=await page.locator('#store-data').evaluate(node=>JSON.parse(node.textContent).products);
  const priced=products.filter(product=>product.price.amount>0);
  expect(priced).toHaveLength(14);
  const money=amount=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:amount%100===0?0:2}).format(amount/100);
  for(const product of products){
    const card=page.locator(`[data-product-card][data-handle="${product.handle}"]`);
    if(product.price.amount>0){
      await expect(card.locator('.price-line')).toContainText(money(product.price.amount));
      await expect(card.locator('[data-game-price-value]')).toHaveText(money(product.price.amount-Math.round(product.price.amount*.2)));
      await expect(card).toContainText('120,000 points required');
    }else{
      await expect(card.locator('.price-line')).toContainText('Pending');
      await expect(card.locator('[data-game-price-preview]')).toHaveCount(0);
    }
  }
  await page.getByRole('button',{name:'Choose Options for Knight Protocol Embroidered Hoodie',exact:true}).click();
  const quick=page.getByRole('dialog',{name:'Knight Protocol Embroidered Hoodie'});
  await expect(quick).toContainText('$106.80');
  await expect(quick.locator('[data-game-price-value]')).toHaveText('$85.44');
  await screenshot(page,info,'price-comparison');
  await quick.getByRole('button',{name:'Close quick view',exact:true}).click();
  await page.goto(base+'products/night-protocol-hoodie/');
  await page.locator('.product-information > [data-game-price-preview]').evaluate(node=>node.scrollIntoView({block:'center'}));
  await screenshot(page,info,'product-discount');
});
