import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve,extname,sep} from 'node:path';
const repo=resolve(import.meta.dirname,'..'),root=resolve(repo,'_site');
const require=createRequire(resolve(repo,'lottominded-ultra.io/games/gothtechnology2/package.json'));
const {chromium}=require('playwright');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp4':'video/mp4','.mp3':'audio/mpeg','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith('/Jungle-Lotto/')){res.writeHead(404).end();return;}
    let file=resolve(root,pathname.slice('/Jungle-Lotto/'.length));
    if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const size=(await stat(file)).size;
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':size});
    createReadStream(file).pipe(res);
  }catch{res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const output=resolve(repo,'output/pages-browser');await mkdir(output,{recursive:true});
try{
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();
    const errors=[],shared=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);if(r.url().includes('/games/shadow-ops-canvas/assets/'))shared.push(r.url());});
    await page.goto(origin+'/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/#underground-rewards');
    await page.locator('[data-open-reward-game="static-wars"]').click();
    await page.locator('#underground-dialog [data-underground-loading]').waitFor({state:'hidden',timeout:60000});
    const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());
    await frame.getByRole('button',{name:'Solo Run',exact:true}).click();
    const skip=frame.getByRole('button',{name:'Skip Intro',exact:true});if(await skip.isVisible())await skip.click();
    await frame.waitForFunction(()=>window.RahbeArcadeGame.getStats().mode==='playing');
    await frame.locator('#game').focus();await page.keyboard.down('d');await page.keyboard.down('j');
    await frame.waitForFunction(()=>window.RahbeArcadeGame.getStats().score>0,null,{timeout:30000});
    await page.keyboard.up('d');await page.keyboard.up('j');
    await page.screenshot({path:resolve(output,name+'-shared-shadow-assets.png')});
    await page.locator('#underground-dialog [data-close-dialog]').click();
    assert.ok(shared.length>10,'game media must load through the existing shared asset URLs');
    assert.deepEqual(errors,[]);console.log(`PASS ${name}: packaged Shadow Ops plays with ${shared.length} shared asset responses and no browser errors`);
    await context.close();
  }
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
