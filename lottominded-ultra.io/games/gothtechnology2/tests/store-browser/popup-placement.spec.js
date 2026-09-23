import {test,expect} from '@playwright/test';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const stub='<h1>Game loading fixture</h1><script>window.RahbeArcadeGame={ready:true,getStats:()=>({mode:"title",score:0}),pause(){},applySettings(){}}</script>';
test('game popup placement: Underground waits 30 seconds and appears once per session',async({page})=>{
 await page.route('**/arcade/robot-rahbe-underground/',route=>route.fulfill({contentType:'text/html',body:stub}));
 await page.clock.install();await page.goto(base);await expect(page.locator('[data-auto-game]')).toHaveCount(0);
 await page.clock.fastForward(await page.evaluate(()=>Math.max(0,29000-performance.now())));await expect(page.locator('#underground-dialog')).not.toBeVisible();
 await page.clock.fastForward(1500);await expect(page.locator('#underground-dialog')).toBeVisible();
 await expect(page.locator('#underground-dialog iframe')).toHaveAttribute('src',/robot-rahbe-underground/);
 await page.locator('#underground-dialog [data-close-dialog]').click();await expect(page.locator('#underground-dialog iframe')).toHaveCount(0);
 await page.clock.fastForward(120000);await expect(page.locator('#underground-dialog')).not.toBeVisible();
 await page.reload();await page.clock.fastForward(120000);await expect(page.locator('#underground-dialog')).not.toBeVisible();
});
test('game popup placement: About waits 60 seconds and opens Swoop once and Collections retains Elmwood below collections',async({page})=>{
 await page.route('**/arcade/swoop-detroit/',route=>route.fulfill({contentType:'text/html',body:stub}));
 await page.clock.install();await page.goto(base+'about/');
 await page.clock.fastForward(await page.evaluate(()=>Math.max(0,59000-performance.now())));await expect(page.locator('#underground-dialog')).not.toBeVisible();
 await page.clock.fastForward(1500);
 await expect(page.locator('#underground-dialog')).toBeVisible();await expect(page.locator('#underground-dialog iframe')).toHaveAttribute('src',/swoop-detroit/);
 await page.locator('#underground-dialog [data-close-dialog]').click();await expect(page.locator('#underground-dialog iframe')).toHaveCount(0);
 await page.reload();await page.clock.fastForward(120000);await expect(page.locator('#underground-dialog')).not.toBeVisible();
 await page.goto(base+'collections/');expect(await page.locator('.collection-list').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('#elmwood'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 await expect(page.locator('#elmwood-dialog iframe')).toHaveCount(0);
});
