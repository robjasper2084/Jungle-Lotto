import {test,expect} from '@playwright/test';
import sharp from 'sharp';
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/c-files/';
const origin='http://127.0.0.1:4186';
const api=base+'api/';
const password='Local-research-test-2026!';
test('desktop and mobile archive, filter, map, dossier and form layouts',async({page},info)=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1536,390]){
  await page.setViewportSize({width,height:width===390?844:1024});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base,{waitUntil:'domcontentloaded'});await expect(page.locator('[data-service]')).toContainText('Local review environment');
  await expect(page.getByRole('heading',{level:1})).toHaveText('The unexplained. On the record.');
  await expect(page.getByRole('button',{name:'Play news ticker'})).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  await expect.poll(()=>page.locator('.cf-feature img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  await page.screenshot({path:info.outputPath('dashboard-'+width+'.png'),fullPage:false});
  await page.getByRole('button',{name:'Nimitz / FLIR1 recording',exact:true}).click();
  await expect(page.locator('.leaflet-popup')).toContainText('Nimitz / FLIR1 recording');
  await page.getByLabel('Search cases',{exact:true}).fill('Rendlesham');await expect(page.locator('[data-case-rows] tr')).toHaveCount(1);await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByLabel('Search cases',{exact:true})).toHaveValue('Rendlesham');
  await page.getByLabel('Year',{exact:true}).selectOption('2004');await expect(page.locator('[data-case-empty]')).toBeVisible();
  await page.getByRole('button',{name:'Reset',exact:true}).press('Enter');await expect(page.locator('[data-case-rows] tr')).toHaveCount(3);
  await page.getByRole('link',{name:'Nimitz / FLIR1 recording',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toHaveText('Nimitz / FLIR1 recording');
  await expect(page.locator('[data-evidence-list]')).toContainText('No community evidence');await page.screenshot({path:info.outputPath('dossier-'+width+'.png'),fullPage:true});
  await page.goto(base+'submit/',{waitUntil:'domcontentloaded'});await page.getByLabel('Report title',{exact:true}).fill('Draft observation in Detroit');await page.getByRole('button',{name:'Save draft on this device'}).click();await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByLabel('Report title',{exact:true})).toHaveValue('Draft observation in Detroit');
  await page.screenshot({path:info.outputPath('submit-'+width+'.png'),fullPage:true});
  for(const route of ['', 'archive/','map/','sources/','account/','moderation/']){await page.goto(base+route,{waitUntil:'domcontentloaded'});await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 }
 expect(errors).toEqual([]);
});
test('local accounts, private report and image, moderator approval, public evidence',async({browser},info)=>{
 const admin=await browser.newContext({baseURL:origin});const member=await browser.newContext({baseURL:origin});const outsider=await browser.newContext({baseURL:origin});
 async function post(ctx,path,data){return ctx.request.post(api+path,{data,headers:{Origin:origin}});}
 expect((await post(admin,'auth/signup',{name:'Review editor',email:'editor@local.test',password})).status()).toBe(201);
 expect((await post(admin,'auth/login',{email:'editor@local.test',password})).ok()).toBe(true);
 const page=await member.newPage();await page.goto(base+'account/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByLabel('Display name').fill('Field researcher');await page.getByLabel('Email',{exact:true}).fill('researcher@local.test');await page.getByLabel('Password',{exact:true}).fill(password);await page.locator('[data-auth-submit]').click();await expect(page.locator('[data-form-status]')).toContainText('Local account created');await page.getByRole('button',{name:'Sign in',exact:true}).last().click();await expect(page.locator('[data-welcome]')).toContainText('Field researcher');
 expect((await member.request.get(api+'queue')).status()).toBe(403);
 const image=await sharp({create:{width:100,height:100,channels:3,background:'#486576'}}).png().toBuffer();
 await page.goto(base+'submit/',{waitUntil:'domcontentloaded'});await page.getByLabel('Report title',{exact:true}).fill('Test observation over the river');await page.getByLabel('Date and time').fill('2026-09-01T21:30');await page.getByLabel('Location',{exact:true}).fill('Detroit riverfront');await page.getByLabel('Latitude (optional)').fill('42.331');await page.getByLabel('Longitude (optional)').fill('-83.045');await page.getByLabel('What did you observe?').fill('A steady light moved across the horizon for a few seconds. Aircraft and satellite explanations have not been ruled out.');await page.getByLabel('Evidence photo (optional)').setInputFiles({name:'test-evidence.png',mimeType:'image/png',buffer:image});await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Submit for review',exact:true}).click();await expect(page.locator('[data-form-status]')).toContainText('Report received and queued');
 const mine=await (await member.request.get(api+'mine')).json();const id=mine.reports[0].id;
 expect((await (await outsider.request.get(api+'cases')).json()).cases.some(c=>c.id===id)).toBe(false);
 expect((await outsider.request.get(api+'evidence?case='+id)).status()).toBe(404);
 const queue=await (await admin.request.get(api+'queue')).json();const evidence=queue.evidence.find(e=>e.case_id===id);
 expect((await outsider.request.get(api+'image/'+evidence.id)).status()).toBe(404);
 expect((await post(admin,'review',{kind:'evidence',id:evidence.id,decision:'published',note:'Attempting publication before the parent case.'})).status()).toBe(409);
 const moderation=await admin.newPage();await moderation.goto(base+'moderation/',{waitUntil:'domcontentloaded'});const report=moderation.locator('[data-review-id="'+id+'"]');await report.getByLabel('Moderator rationale').fill('Test report reviewed for privacy and relevant observations.');await report.getByRole('button',{name:'Save review decision'}).click();await expect(report).toHaveCount(0);
 const contribution=moderation.locator('[data-review-id="'+evidence.id+'"]');await contribution.getByLabel('Moderator rationale').fill('Image format and publishing permission reviewed.');await contribution.getByRole('button',{name:'Save review decision'}).click();await expect(moderation.locator('[data-moderation]')).toContainText('queue is clear');
 const publicCases=await(await outsider.request.get(api+'cases?q=river')).json();expect(publicCases.cases.find(c=>c.id===id)).toMatchObject({lat:42.3,lon:-83,status:'published'});
 expect((await outsider.request.get(api+'image/'+evidence.id)).headers()['content-type']).toBe('image/webp');
 const publicPage=await outsider.newPage();await publicPage.goto(base+'case/?id='+id,{waitUntil:'domcontentloaded'});await expect(publicPage.getByRole('heading',{level:1})).toHaveText('Test observation over the river');await expect(publicPage.locator('[data-evidence-list] img')).toBeVisible();await publicPage.screenshot({path:info.outputPath('approved-evidence.png')});
 expect((await post(member,'review',{kind:'cases',id,decision:'published',note:'Unauthorized',credibility:'Source documented'})).status()).toBe(403);
 expect((await member.request.post(api+'reports',{data:{},headers:{Origin:'https://untrusted.example'}})).status()).toBe(403);
 expect((await outsider.request.get(api+'health',{headers:{Host:'untrusted.example'}})).status()).toBe(403);
 expect((await post(member,'evidence',{case_id:id,kind:'Corroboration',narrative:'Invalid image input for validation.',consent:true,image:Buffer.from('not an image').toString('base64')})).status()).toBe(400);
 expect((await post(member,'auth/logout',{})).status()).toBe(200);
 expect((await member.request.get(api+'mine')).status()).toBe(401);
 await admin.close();await member.close();await outsider.close();
});
test('disconnected host keeps archive readable without claiming a submission succeeded',async({page})=>{
 await page.route('**/c-files/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Offline"}'}));
 await page.goto(base,{waitUntil:'domcontentloaded'});await expect(page.locator('[data-service]')).toContainText('not connected');await expect(page.locator('[data-case-rows] tr')).toHaveCount(3);
 await page.goto(base+'account/',{waitUntil:'domcontentloaded'});await page.getByLabel('Email',{exact:true}).fill('nobody@local.test');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).last().click();await expect(page.locator('[data-form-status]')).toContainText('not connected');
});
