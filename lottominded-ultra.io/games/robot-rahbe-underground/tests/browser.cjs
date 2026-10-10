const {chromium}=require(require('node:path').resolve(__dirname,'../../gothtechnology2/node_modules/playwright'));
const assert=require('node:assert/strict');const fs=require('node:fs/promises');
const base=process.env.RAHBE_QA_URL||'http://127.0.0.1:4198';const out=require('node:path').resolve(__dirname,'../output/playwright');
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.CI?{}:{channel:'chrome'})});const report={checks:[],errors:[],badRequests:[]};
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,detail});assert.ok(ok,name+': '+JSON.stringify(detail));};
try{
for(let attempt=0;attempt<50;attempt++){try{if((await fetch(base)).ok)break;}catch{}if(attempt===49)throw new Error('Local RAHBE server did not start');await new Promise(r=>setTimeout(r,200));}
for(const viewport of [{width:390,height:844},{width:844,height:390}]){
 const ctx=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce'});const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.badRequests.push(r.url());});
 await page.goto(base+'/?debug&touch');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#start').click();await page.waitForSelector('#touch:not([hidden]) .td-control');
 const cdp=await ctx.newCDPSession(page);let touches=[];
 const point=async selector=>{const b=await page.locator(selector).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
 const press=async(selector,id)=>{const p=await point(selector);touches.push({...p,id,radiusX:6,radiusY:6});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});};
 const move=async(id,dx,dy)=>{touches=touches.map(p=>p.id===id?{...p,x:p.x+dx,y:p.y+dy}:p);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches});};
 const release=async id=>{touches=touches.filter(p=>p.id!==id);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:touches});};
 const stat=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));const initial=await stat();
 await press('[data-control="move"]',1);await move(1,35,0);await press('[data-control="aim"]',2);await move(2,-30,-24);await press('[data-control="fire-right"]',3);await page.waitForTimeout(220);
 let state=await page.evaluate(()=>({x:__underground.state.player.x,fire:__underground.input.touch.has('shoot'),aim:__underground.input.aim,shots:__underground.state.shots.filter(s=>!s.enemy).map(s=>({vx:s.vx,vy:s.vy})),move:__underground.input.move}));
 check('move + independent aim + fire '+viewport.width,state.x>initial.player.x+20&&state.fire&&state.shots.some(s=>s.vx<0&&s.vy<0),state);
 await press('[data-control="fire-left"]',4);await release(3);check('releasing one fire button keeps the other active '+viewport.width,await page.evaluate(()=>__underground.input.touch.has('shoot')));await release(4);await release(2);await release(1);
 check('all fingers release cleanly '+viewport.width,await page.evaluate(()=>__underground.input.touch.size===0&&__underground.input.move.x===0&&__underground.input.aim===null));
 await press('[data-control="jump"]',5);await page.waitForTimeout(100);state=await stat();check('real touch jump '+viewport.width,state.player.vy<0&&!state.player.grounded,state.player);await release(5);await page.waitForTimeout(750);
 await press('[data-control="crouch"]',6);await page.waitForTimeout(100);check('touch crouch changes collision height '+viewport.width,await page.evaluate(()=>__underground.state.player.crouching));await release(6);
 await page.getByRole('button',{name:'Customize touch controls'}).click();const paused=await stat();await page.waitForTimeout(120);check('layout editor pauses simulation '+viewport.width,(await stat()).player.x===paused.player.x&&paused.mode==='paused');
 await page.getByRole('slider',{name:'Size',exact:true}).fill('120');await page.getByRole('button',{name:'Save layout',exact:true}).click();check('layout saves and resumes '+viewport.width,await page.evaluate(()=>JSON.parse(localStorage.getItem('rahbe-underground-touch-v1'))[innerWidth>innerHeight?'landscape':'portrait'][0].size===120&&__underground.state.mode==='playing'));
 const bounds=await page.locator('.td-battle .td-control').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {id:n.dataset.control,x:b.x,y:b.y,w:b.width,h:b.height};}));check('touch targets stay in viewport '+viewport.width,bounds.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=viewport.width+1&&b.y+b.h<=viewport.height+1),bounds);
 await page.screenshot({path:out+'/browser-touch-'+viewport.width+'.png'});
 await press('[data-control="move"]',7);await move(7,25,0);await page.setViewportSize({width:viewport.height,height:viewport.width});touches=[];await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});check('rotation clears held movement '+viewport.width,await page.evaluate(()=>__underground.input.move.x===0&&__underground.input.touch.size===0));
 await ctx.close();
}
const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?debug');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#start').click();
await page.evaluate(async()=>{const {routeAction}=await import('./tests/route-driver.js');__underground.input.read=()=>routeAction(__underground.state);});
await page.waitForFunction(()=>['won','dead'].includes(__underground.state.mode),null,{timeout:150000});const route=await page.evaluate(()=>({mode:__underground.state.mode,hp:__underground.state.player.hp,deaths:__underground.state.deaths,seals:__underground.state.world.seals.filter(s=>s.taken).map(s=>s.number),bossHP:__underground.state.world.boss.hp,seconds:__underground.state.time,reached:__underground.state.reached}));check('full rendered route wins without cheats',route.mode==='won'&&route.reached===6&&route.deaths===0&&route.seals.length===3&&route.bossHP===0,route);await page.waitForTimeout(1100);await page.screenshot({path:out+'/browser-route-complete.png'});await ctx.close();check('no runtime errors',report.errors.length===0,report.errors);check('no missing assets',report.badRequests.length===0,report.badRequests);
report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}finally{await fs.writeFile(out+'/browser-controls-and-route.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
})();
