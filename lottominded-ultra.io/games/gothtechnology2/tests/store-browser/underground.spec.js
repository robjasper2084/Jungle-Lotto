import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';

test('New Drop Underground popup loads on demand, plays, closes and restores focus',async({page,isMobile},info)=>{
  const errors=[],failures=[],scripts=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/arcade/'))failures.push(r.url());});
  page.on('request',r=>{if(/\/arcade\/(robot-rahbe-underground|shadow-ops-canvas|robot-rahbe-vault-rush)\//.test(r.url())&&r.resourceType()==='script')scripts.push(r.url());});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base+'#current-drop');
  await expect(page.locator('#drop-title')).toContainText('Knight');
  const open=page.locator('.underground-copy').getByRole('button',{name:'Play Underground',exact:true});
  await expect(open).toBeVisible();await expect(page.locator('#underground-dialog iframe')).toHaveCount(0);expect(scripts).toHaveLength(0);
  expect((await page.locator('.underground-poster').boundingBox()).height).toBeGreaterThanOrEqual(180);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const screenshots=process.env.UNDERGROUND_SCREENSHOTS;
  if(screenshots){await mkdir(screenshots,{recursive:true});await page.locator('.drop-arcade').screenshot({path:join(screenshots,info.project.name+'-feature.png')});}
  await open.click();const popup=page.locator('#underground-dialog');await expect(popup).toBeVisible();
  await expect(popup.locator('iframe')).toHaveAttribute('src',base+'arcade/robot-rahbe-underground/');
  const game=page.frameLocator('#underground-dialog iframe');
  await expect(game.locator('#start')).toBeEnabled({timeout:25000});
  await expect(popup.locator('[data-underground-loading]')).toBeHidden();
  await expect(game.locator('body')).toHaveAttribute('data-missing-assets','');
  await expect(game.locator('#sound')).toHaveAttribute('aria-pressed','true');
  if(screenshots)await page.screenshot({path:join(screenshots,info.project.name+'-popup.png')});
  await game.locator('#start').click();await expect(game.locator('#hud')).toBeVisible();
  const frame=page.frames().find(f=>f.url().includes('/arcade/robot-rahbe-underground/'));
  const read=()=>frame.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const initial=await read();
  if(isMobile){
    const box=await game.getByRole('button',{name:'Move right',exact:true}).boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await expect.poll(async()=>(await read()).player.x).toBeGreaterThan(initial.player.x+8);await page.mouse.up();
  }else{
    await page.keyboard.down('d');await expect.poll(async()=>(await read()).player.x).toBeGreaterThan(initial.player.x+8);await page.keyboard.up('d');
  }
  if(screenshots)await page.screenshot({path:join(screenshots,info.project.name+'-playing.png')});
  await page.keyboard.press('p');await expect(game.locator('#panel')).toBeVisible();
  await page.keyboard.press('Escape');await expect(game.locator('#panel')).toBeHidden();await expect(popup).toBeVisible();
  await page.keyboard.press('Escape');await expect(popup).toBeHidden();await expect(popup.locator('iframe')).toHaveCount(0);await expect(open).toBeFocused();
  const saved=await page.evaluate(()=>localStorage.getItem('rahbe-underground-v1'));expect(saved).toBeTruthy();
  await open.click();await expect(game.locator('#continue')).toBeVisible({timeout:25000});
  await popup.getByRole('button',{name:'Close game',exact:true}).click();await expect(popup).toBeHidden();await expect(open).toBeFocused();
  expect(await page.evaluate(()=>localStorage.getItem('rahbe-underground-v1'))).toBe(saved);
  expect(errors).toEqual([]);expect(failures).toEqual([]);
});
