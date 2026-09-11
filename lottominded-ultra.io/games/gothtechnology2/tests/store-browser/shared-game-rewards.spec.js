import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const key='gothtechnology.arcade.discount-preview.v2';
async function capture(page,info,name){const dir=process.env.UNDERGROUND_SCREENSHOTS;if(dir){await mkdir(dir,{recursive:true});await page.screenshot({path:join(dir,info.project.name+'-'+name+'.png')});}}
async function read(page){return page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key)||'{"runs":{}}');return {total:(s.carriedPoints||0)+Object.values(s.runs).reduce((sum,r)=>sum+Math.max(0,r.score-r.baseline),0),runs:s.runs};},key);}

test('shared game rewards combine actual play across all five games and reach store prices',async({page,isMobile},info)=>{
 test.setTimeout(180000);const errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'#underground-rewards');
 await expect(page.locator('[data-open-reward-game]')).toHaveCount(5);
 const popup=page.locator('#underground-dialog');
 async function open(id){if(await page.locator('#reward-game-picker').getAttribute('open')===null)await page.locator('#reward-game-picker summary').click();await page.locator(`[data-open-reward-game="${id}"]`).click();await expect(popup.locator('[data-underground-loading]')).toBeHidden({timeout:60000});return page.frames().find(f=>f.parentFrame()===page.mainFrame());}
 async function close(){await popup.getByRole('button',{name:'Close game',exact:true}).click();await expect(popup.locator('iframe')).toHaveCount(0);}
 // An isolated checkpoint establishes earlier gameplay; the next points come from a real pickup.
 await page.evaluate(()=>localStorage.setItem('rahbe-underground-v1',JSON.stringify({version:1,reached:0,coins:40,secrets:0,seals:[],taken:[],treasures:[],wallOpen:false})));
 let frame=await open('underground');await frame.locator('#continue').click();
 await page.keyboard.down('d');await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().score),{timeout:10000,intervals:[50]}).toBeGreaterThan(4000);await page.keyboard.up('d');
 await expect.poll(async()=>(await read(page)).total).toBeGreaterThanOrEqual(5000);await close();const underground=(await read(page)).total;
 frame=await open('underground');await frame.locator('#continue').click();await frame.waitForFunction(()=>window.RahbeArcadeGame.getStats().seconds>=1);await close();expect((await read(page)).total).toBe(underground);

 frame=await open('static-wars');await frame.getByRole('button',{name:'Solo Run',exact:true}).click();
 const skip=frame.getByRole('button',{name:'Skip Intro',exact:true});if(await skip.isVisible())await skip.click();
 await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().mode),{timeout:10000}).toBe('playing');
 await frame.locator('#game').focus();await page.keyboard.down('d');await page.keyboard.down('j');
 await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().score),{timeout:20000}).toBeGreaterThan(0);
 await page.keyboard.up('d');await page.keyboard.up('j');await capture(page,info,'shadow-ops-reward');
 await close();await expect.poll(async()=>(await read(page)).total).toBeGreaterThan(underground);const shadow=(await read(page)).total;

 frame=await open('vault-rush');await frame.locator('#start').click();
 await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().mode),{timeout:20000}).toBe('playing');
 if(isMobile)await frame.getByRole('button',{name:'Jump, hold for higher jump',exact:true}).click();else await page.keyboard.press('Space');
 await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().score),{timeout:10000}).toBeGreaterThan(0);
 await capture(page,info,'vault-rush-reward');await close();await expect.poll(async()=>(await read(page)).total).toBeGreaterThan(shadow);const runner=(await read(page)).total;

 frame=await open('gothtechnology');await expect.poll(()=>frame.evaluate(()=>window.__gothTechnologyGame.phase),{timeout:45000}).toBe('title');
 await frame.evaluate(()=>window.__gothTechnologyGame.openMode('versus'));
 await expect.poll(()=>frame.evaluate(()=>window.__gothTechnologyGame.matchAssetsReady),{timeout:45000}).toBe(true);
 await frame.evaluate(()=>window.__gothTechnologyGame.startVersus());
 await expect.poll(()=>frame.evaluate(()=>window.__gothTechnologyGame.phase),{timeout:10000}).toBe('fight');
 await capture(page,info,'fighter-reward');
 // Seed the last instant of a qualifying match, then let the real round-end transition settle it.
 await frame.evaluate(()=>{const g=window.__gothTechnologyGame;g.rewardTotalTicks=1800;g.rewardMatchActions=2;g.fighters[0].roundWins=g.roundsToWin-1;g.fighters[1].health=0;g.checkRoundEnd();});
 await expect.poll(async()=>(await read(page)).total).toBe(runner+5000);
 await close();await page.reload();
 const beforeStatic=(await read(page)).total;
 frame=await open('static-wave');await frame.getByRole('button',{name:'Start Sector 1',exact:true}).click();
 await frame.waitForFunction(()=>window.RahbeArcadeGame.getStats().seconds>=2);
 await frame.locator('#bombAction').click();
 await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().score)).toBeGreaterThan(0);
 const staticRun=await frame.evaluate(()=>window.RahbeArcadeGame.getStats().runId);
 await close();await expect.poll(async()=>(await read(page)).total).toBeGreaterThan(beforeStatic);
 const afterStatic=(await read(page)).total;
 frame=await open('static-wave');await frame.getByRole('button',{name:'Start Sector 1',exact:true}).click();
 expect(await frame.evaluate(()=>window.RahbeArcadeGame.getStats().runId)).not.toBe(staticRun);
 await frame.waitForFunction(()=>window.RahbeArcadeGame.getStats().seconds>=2);
 await frame.locator('#bombAction').click();
 await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().score)).toBeGreaterThan(0);
 await close();await expect.poll(async()=>(await read(page)).total).toBeGreaterThan(afterStatic);
 await page.reload();
 const final=await read(page);expect(new Set(Object.values(final.runs).map(run=>run.game)).size).toBe(5);
 await expect(page.locator('#underground-rewards [data-reward-score]')).toHaveText(final.total.toLocaleString('en-US'));
 await page.locator('#underground-rewards .reward-summary').scrollIntoViewIfNeeded();await capture(page,info,'shared-total');
 await page.goto(base+'products/night-protocol-hoodie/');
 const percent=final.total>=120000?20:final.total>=60000?15:final.total>=30000?10:final.total>=12000?5:0;
 expect(percent).toBeGreaterThanOrEqual(5);
 await expect(page.locator('.product-information>[data-game-price-preview] [data-game-price-label]')).toHaveText(`With your ${percent}% game discount`);
 expect(errors).toEqual([]);expect(failed).toEqual([]);
});

test('shared game reward receipts remain cumulative across tabs, duplicate reports and reload',async({page,context})=>{
 await page.goto(base);const second=await context.newPage();await second.goto(base);
 const bank=(tab,game,id,score)=>tab.evaluate(async({base,game,id,score})=>{const m=await import(base+'arcade/rewards.js');await m.bankGameProgress(game,{runId:id,score,mode:'playing',seconds:30});},{base,game,id,score});
 await Promise.all([bank(page,'underground','concurrent',6000),bank(second,'vault-rush','concurrent',4000)]);
 await expect(page.locator('#underground-rewards [data-reward-percent]')).toHaveText('5%');
 await Promise.all([bank(page,'underground','concurrent',6000),bank(second,'underground','concurrent',7000),bank(second,'static-wars','next',14000)]);
 await expect.poll(async()=>(await read(page)).total).toBe(25000);
 await page.reload();await expect(page.locator('#underground-rewards [data-reward-percent]')).toHaveText('10%');
 await page.goto(base+'products/night-protocol-hoodie/');await page.getByRole('radio',{name:'M',exact:true}).check();await page.getByRole('button',{name:'Save to Launch Loadout',exact:true}).click();
 await expect(page.locator('[data-cart-game-total]')).toHaveText('$96.12');
 await bank(second,'vault-rush','new-session',25000);
 await expect(page.locator('[data-cart-game-total]')).toHaveText('$90.78');
 await second.close();
});

test('shared game rewards Vault Rush return banks points and closes only for its own exit message',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'#underground-rewards');
 const trigger=page.locator('[data-open-reward-game="vault-rush"]'),popup=page.locator('#underground-dialog');
 await page.locator('#reward-game-picker summary').click();await trigger.click();await expect(popup.locator('[data-underground-loading]')).toBeHidden({timeout:60000});
 const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());
 await page.evaluate(()=>window.postMessage({type:'rahbe-exit',game:'vault-rush'},location.origin));
 await frame.evaluate(()=>parent.postMessage({type:'rahbe-exit',game:'underground'},location.origin));
 await expect(popup).toBeVisible();
 await frame.locator('#start').click();
 await expect.poll(()=>frame.evaluate(()=>window.RahbeArcadeGame.getStats().score),{timeout:20000}).toBeGreaterThan(0);
 await frame.locator('#pause').click();
 const score=await frame.evaluate(()=>window.RahbeArcadeGame.getStats().score);
 await frame.locator('#arcade-link').click();
 await expect(popup).toBeHidden();await expect(popup.locator('iframe')).toHaveCount(0);await expect(trigger).toBeFocused();
 await expect.poll(async()=>(await read(page)).total).toBe(score);
 // The same URL on its own page still navigates normally back to the storefront.
 await page.goto(base+'arcade/robot-rahbe-vault-rush/?arcade=1');
 await page.locator('#arcade-link').click();await expect(page).toHaveURL(base+'#underground-rewards');
});

test('shared game rewards Fighter preserves earlier round activity and clears it for a new match',async({page})=>{
 test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'#underground-rewards');
 await page.locator('#reward-game-picker summary').click();await page.locator('[data-open-reward-game="gothtechnology"]').click();
 await expect(page.locator('#underground-dialog [data-underground-loading]')).toBeHidden({timeout:60000});
 const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());
 await frame.waitForFunction(()=>window.__gothTechnologyGame?.phase==='title');
 await frame.evaluate(()=>{const g=window.__gothTechnologyGame;g.cpuEnabled=false;g.openMode('versus');});
 await frame.waitForFunction(()=>window.__gothTechnologyGame.matchAssetsReady,null,{timeout:45000});
 await frame.evaluate(()=>window.__gothTechnologyGame.startVersus());
 await frame.waitForFunction(()=>window.__gothTechnologyGame.phase==='fight');
 await frame.locator('canvas').focus();await page.keyboard.down('a');
 await frame.waitForFunction(()=>window.__gothTechnologyGame.rewardMatchActions>0);await page.keyboard.up('a');
 // Skip elapsed time and force knockouts while using the real round transitions and input tracking.
 await frame.evaluate(()=>{const g=window.__gothTechnologyGame;g.rewardTotalTicks=1800;g.fighters[0].health=0;g.checkRoundEnd();});
 await page.keyboard.press('Enter');await frame.waitForFunction(()=>window.__gothTechnologyGame.phase==='fight');
 expect(await frame.evaluate(()=>window.__gothTechnologyGame.rewardMeaningfulActions)).toBe(0);
 expect(await frame.evaluate(()=>window.__gothTechnologyGame.rewardMatchActions)).toBeGreaterThan(0);
 await frame.evaluate(()=>{const g=window.__gothTechnologyGame;g.fighters[0].health=0;g.checkRoundEnd();});
 await expect.poll(async()=>(await read(page)).total).toBe(2500);
 await frame.evaluate(()=>{const g=window.__gothTechnologyGame;g.startMatch(false);g.rewardTotalTicks=1800;g.fighters[1].roundWins=g.roundsToWin-1;g.fighters[0].health=0;g.checkRoundEnd();});
 expect(await frame.evaluate(()=>window.__gothTechnologyGame.rewardMatchActions)).toBe(0);
 await page.locator('#underground-dialog [data-close-dialog]').click();await page.reload();
 expect((await read(page)).total).toBe(2500);
});
