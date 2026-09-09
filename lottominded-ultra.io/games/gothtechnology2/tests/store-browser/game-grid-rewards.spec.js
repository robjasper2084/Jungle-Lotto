import {test,expect} from '@playwright/test';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const key='gothtechnology.arcade.discount-preview.v2';
for(const {surface,id,index,path,title} of [
 {surface:'Play',id:'static-wars',index:1,path:base+'arcade/shadow-ops-canvas/',title:'Robot RAHBE / Shadow Ops'},
 {surface:'popup',id:'static-wars',index:1,path:base+'arcade/shadow-ops-canvas/',title:'Robot RAHBE / Shadow Ops'},
 {surface:'popup',id:'static-wave',index:2,path:base+'../opengw-levels/',title:'2084 Static WAV'},
]){
 test('Game Grid '+surface+' routes '+id+' through shared rewards and updates its links',async({page},info)=>{
  test.setTimeout(100000);const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base+(surface==='Play'?'play/':'#underground-rewards'));
  if(surface==='Play'){
   await page.getByRole('button',{name:'Continue to GOTHTECHNOLOGY',exact:true}).click();
   await page.getByRole('button',{name:'Launch game',exact:true}).click();
   await expect(page.locator('#game-connection')).toContainText('Game ready',{timeout:45000});
  }else{
   await page.locator('[data-open-reward-game="gothtechnology"]').click();
   await expect(page.locator('[data-underground-loading]')).toBeHidden({timeout:60000});
  }
  const frame=page.frames().find(f=>f.url().includes('/legacy-game/'));
  const canvas=frame.locator('#game'),box=await canvas.boundingBox();
  await canvas.click({position:{x:280/1280*box.width,y:575/720*box.height}});
  await expect.poll(()=>frame.evaluate(()=>window.__gothTechnologyGame.phase)).toBe('gameSelect');
  let resumeNavigation;
  if(id==='static-wars'){
   const held=new Promise(resolve=>{resumeNavigation=resolve;});
   await page.route(/\/arcade\/shadow-ops-canvas\/\?arcade=1$/,async route=>{await held;await route.continue();},{times:1});
  }
  const grid=await canvas.boundingBox();
  await canvas.click({position:{x:(index===1?640:1048)/1280*grid.width,y:340/720*grid.height}});
  if(resumeNavigation){
   try{
    const expected=new URL(path, page.url());expected.search='?arcade=1';
    await expect(page.locator(surface==='Play'?'#game-standalone-link':'[data-game-fullpage]')).toHaveAttribute('href',expected.href,{timeout:3000});
    await expect(page.locator(surface==='Play'?'#game-frame':'[data-underground-host] iframe')).toHaveAttribute('title',title+' game');
   }finally{resumeNavigation();}
  }
  await expect.poll(()=>new URL(frame.url()).pathname).toBe(new URL(path,'http://example.test').pathname);
  const standalone=page.locator(surface==='Play'?'#game-standalone-link':'[data-game-fullpage]');
  await expect(standalone).toHaveAttribute('href',frame.url());
  await expect(page.locator(surface==='Play'?'#game-frame':'[data-underground-host] iframe')).toHaveAttribute('title',title+' game');
  if(surface==='Play'){
   await expect(page.locator('#game-collection-link')).toBeHidden();
   await expect(page.locator('#requested-character')).toContainText('Controls screen');
  }else{
   await expect(page.locator('#underground-title')).toHaveText(title);
   await expect(page.locator('#underground-help')).toContainText(id==='static-wave'?'IJKL':'Controls screen');
  }
  if(id==='static-wave'){
   await frame.getByRole('button',{name:'Start Sector 1',exact:true}).click();
   await frame.waitForFunction(()=>window.RahbeArcadeGame.getStats().seconds>=2);
   await frame.locator('#bombAction').click();
  }else{
   await frame.getByRole('button',{name:'Solo Run',exact:true}).click();
   const skip=frame.getByRole('button',{name:'Skip Intro',exact:true});if(await skip.isVisible())await skip.click();
   await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().mode),{timeout:15000}).toBe('playing');
   await frame.locator('#game').focus();await page.keyboard.down('d');await page.keyboard.down('j');
  }
  await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().score),{timeout:25000}).toBeGreaterThan(0);
  await page.keyboard.up('d');await page.keyboard.up('j');
  await frame.evaluate(()=>window.RahbeArcadeGame.pause());
  const receipt=await frame.evaluate(()=>window.RahbeArcadeGame.getStats());
  await expect.poll(()=>page.evaluate(({key,id})=>Object.values(JSON.parse(localStorage.getItem(key)||'{"runs":{}}').runs).find(r=>r.game===id)?.score,{key,id})).toBe(receipt.score);
  const records=await page.evaluate(key=>Object.values(JSON.parse(localStorage.getItem(key)).runs),key);
  expect(records.every(r=>r.game===id)).toBe(true);
  await page.screenshot({path:info.outputPath(id+'-'+surface+'.png')});
  if(surface==='popup'){
   await page.getByRole('button',{name:'Close game',exact:true}).click();
   await expect(page.locator('[data-underground-host] iframe')).toHaveCount(0);
   await expect(page.locator('[data-open-reward-game="gothtechnology"]')).toBeFocused();
   await expect(page.locator('#underground-rewards [data-reward-score]')).toHaveText(receipt.score.toLocaleString('en-US'));
  }
  expect(errors).toEqual([]);expect(failed).toEqual([]);
 });
}

test('C-Files removed from desktop and mobile navigation, sitemap, and public routes',async({page,request,isMobile},info)=>{
 await page.goto(base);
 await expect(page.locator('a[href*="c-files"]')).toHaveCount(0);
 if(isMobile){
  await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link')).toHaveCount(6);
 }
 const sitemap=await request.get(base+'sitemap.xml');expect(sitemap.status()).toBe(200);expect(await sitemap.text()).not.toContain('c-files');
 for(const path of ['c-files/','c-files/archive/','c-files/submit/','media/cfiles-world.json','media/cfiles-observatory.webp']){
  const response=await request.get(base+path);expect(response.status(),path).toBe(404);
 }
 await page.screenshot({path:info.outputPath('c-files-removed.png')});
});
