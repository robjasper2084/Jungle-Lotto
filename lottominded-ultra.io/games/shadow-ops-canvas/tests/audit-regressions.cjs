// Run against an HTTP preview with Playwright available via NODE_PATH or PLAYWRIGHT_MODULE_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:8151/games/shadow-ops-canvas/index.html';
const output = process.env.AUDIT_OUTPUT_DIR || path.join(os.tmpdir(), 'rahbe-audit-regressions');
const failures = [];
const passed = [];
const pageErrors = [];

// Expose state only in this isolated browser response; shipped source has no test hook.
const hook = `
window.__test = {
 get run(){return run}, get mode(){return mode}, get settings(){return settings},
 get images(){return images}, get pads(){return gamepadStates},
 startRun, resumeRun, pauseRun, setMode, getAim, gameplayViewOffset, pollGamepad,
 frame(ms){loop(lastTime + ms)},
 reset(runMode = 'solo'){
   window.requestAnimationFrame = () => 0;
   debugGamepads = null;
   for(const pad of gamepadStates){pad.index=null;pad.assignedIndex=null;pad.id='';pad.down.clear()}
   startRun(runMode); clearInputState(); accumulator=0; lastTime=1000;
   run.introTimer=0;run.player.grounded=true;run.player.invuln=300;
 },
 get modeSnapshot(){return {mode,time:run?.time,hp:run?.player.hp,lives:run?.player.lives}}
};
`;

async function check(name, fn) {
  try { await fn(); passed.push(name); console.log('PASS', name); }
  catch (error) { failures.push({name,error:String(error)}); console.error('FAIL',name,error.message); }
}

async function open(context, query = 'debug=1') {
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.route('**/src/game.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    assert.match(source, /\}\)\(\);\s*$/);
    await route.fulfill({response,body:source.replace(/\}\)\(\);\s*$/,hook+'\n})();')});
  });
  await page.goto(base+'?'+query);
  await page.waitForFunction(() => !!window.__test);
  return page;
}

(async () => {
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',headless:true});
  try {
    const context = await browser.newContext();
    const page = await open(context);
    await page.evaluate(() => __test.reset());
    await page.waitForTimeout(100);

    for(const hz of [30,60,120,144]) {
      await check(`keyboard jump and pause at ${hz} Hz`,async () => {
        const result = await page.evaluate(hz => {
          const a=__test;a.reset();const ms=1000/hz+0.0001;
          window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' '}));
          for(let i=0;i<12;i++) a.frame(ms);
          const jumped=a.run.player.y<502;
          window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' '}));
          window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape'}));
          for(let i=0;i<4;i++) a.frame(ms);
          return {jumped,mode:a.mode};
        },hz);
        assert.equal(result.jumped,true);assert.equal(result.mode,'paused');
      });
      await check(`single controller confirm at ${hz} Hz`,async () => {
        const mode=await page.evaluate(hz=>{
          const a=__test;a.reset();a.setMode('title');
          __shadowOpsControllerDebug.setTestPad(0,{buttons:[0]});
          for(let i=0;i<12;i++)a.frame(1000/hz+0.0001);
          return a.mode;
        },hz);
        assert.equal(mode,'cutscene');
      });
      await check(`both controller players jump at ${hz} Hz`,async()=>{
        const jumped=await page.evaluate(hz=>{
          const a=__test;a.reset('two-player');
          for(const player of a.run.players)player.grounded=true;
          __shadowOpsControllerDebug.setTestPad(0,{buttons:[0]});
          __shadowOpsControllerDebug.setTestPad(1,{buttons:[0]});
          for(let i=0;i<12;i++)a.frame(1000/hz+0.0001);
          return a.run.players.map(player=>player.y<502);
        },hz);
        assert.deepEqual(jumped,[true,true]);
      });
    }

    await check('controller settings navigation, toggles, difficulty, and persistence',async()=>{
      const result=await page.evaluate(()=>{
        const a=__test;a.reset();a.setMode('settings');
        const press=button=>{__shadowOpsControllerDebug.setTestPad(0,{buttons:[button]});a.frame(20);__shadowOpsControllerDebug.setTestPad(0);a.frame(20)};
        document.querySelector('#soundToggle').focus();
        const seen=[];
        for(let i=0;i<6;i++){
          const control=document.activeElement;const before=control.checked;seen.push(control.id);
          press(0);if(control.checked===before)throw new Error('Checkbox did not toggle: '+control.id);
          press(13);
        }
        const select=document.activeElement;
        if(select.id!=='difficultySelect')throw new Error('Difficulty is not reachable');
        const previous=select.value;press(15);const right=select.value;press(14);const restored=select.value;press(0);const confirmed=select.value;
        const saved=JSON.parse(localStorage.getItem('lottomind-vault-run-settings-v1'));
        press(13);const done=document.activeElement.textContent.trim();press(0);
        return {seen,previous,right,restored,confirmed,saved,done,mode:a.mode};
      });
      assert.equal(result.seen.length,6);assert.equal(result.done,'Done');assert.notEqual(result.right,result.previous);
      assert.equal(result.restored,result.previous);assert.equal(result.saved.difficulty,result.confirmed);
      assert.equal(result.mode,'title');assert.equal(result.saved.sound,false);assert.equal(result.saved.music,false);
    });

    await check('settings checkboxes remain keyboard accessible',async()=>{
      await page.evaluate(()=>{__test.setMode('settings');document.querySelector('#soundToggle').focus()});
      const before=await page.locator('#soundToggle').isChecked();
      await page.keyboard.press('Space');
      assert.notEqual(await page.locator('#soundToggle').isChecked(),before);
    });

    await check('sparse controller indexes, disconnect pause, replacement, and reconnect',async()=>{
      const result=await page.evaluate(()=>{
        const a=__test;a.reset('two-player');
        const pad=(index,id)=>({index,id,connected:true,axes:[0,0,0,0],buttons:[]});
        let devices=[null,pad(7,'P1'),pad(9,'P2')];
        Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>devices});
        a.pollGamepad();const initial=a.pads.map(p=>p.index);const snapshot=a.modeSnapshot;
        const p2=devices[2];devices=[null,p2];a.pollGamepad();
        const disconnected={slots:a.pads.map(p=>p.index),...a.modeSnapshot,status:document.querySelector('#controllerStatus').textContent};
        devices=[pad(7,'P1'),p2];a.pollGamepad();const reconnected={slots:a.pads.map(p=>p.index),mode:a.mode};
        a.resumeRun();devices=[pad(12,'Replacement'),p2];a.pollGamepad();
        return {initial,snapshot,disconnected,reconnected,replacement:{slots:a.pads.map(p=>p.index),mode:a.mode}};
      });
      assert.deepEqual(result.initial,[7,9]);assert.deepEqual(result.disconnected.slots,[null,9]);
      assert.equal(result.disconnected.mode,'paused');assert.match(result.disconnected.status,/P2 connected/);
      assert.equal(result.disconnected.hp,result.snapshot.hp);assert.equal(result.disconnected.lives,result.snapshot.lives);
      assert.deepEqual(result.reconnected.slots,[7,9]);assert.equal(result.reconnected.mode,'paused');
      assert.deepEqual(result.replacement.slots,[12,9]);assert.equal(result.replacement.mode,'paused');
    });

    for(const [name,w,h,touch] of [['desktop',1280,720,false],['short-landscape',844,390,true],['tablet-landscape',1024,768,true]]) {
      await check(`pointer inverse camera transform: ${name}`,async()=>{
        await page.setViewportSize({width:w,height:h});
        await page.evaluate(touch=>{
          __test.reset();document.body.classList.toggle('touch-forced',touch);document.body.classList.toggle('touch-landscape',touch);
          __test.run.cameraY=44;__test.run.cameraX=20;
        },touch);
        const target=await page.evaluate(()=>{
          const r=document.querySelector('#game').getBoundingClientRect();const p=__test.run.player;const view=__test.gameplayViewOffset(__test.run);
          return {x:r.x+(p.x+p.w*.5+150-view.x)*r.width/1280,y:r.y+(p.y+p.h*.48-view.y)*r.height/720};
        });
        await page.mouse.move(target.x,target.y);
        const aim=await page.evaluate(()=>__test.getAim(__test.run,__test.run.player));
        assert.ok(Math.abs(aim.x-1)<0.0001);assert.ok(Math.abs(aim.y)<0.0001);
      });
    }
    await context.close();

    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const mp=await open(mobile,'touch=1');
    await mp.getByRole('button',{name:'Solo Run',exact:true}).click();
    await mp.getByRole('button',{name:'Skip Intro',exact:true}).click();
    await mp.waitForFunction(()=>__test.images.player.naturalWidth>0);
    await mp.evaluate(()=>{__test.run.introTimer=0;__test.run.player.invuln=300});
    for(const [w,h] of [[390,844],[844,390],[768,1024],[1024,768],[320,568],[568,320]]) {
      await check(`HUD bounds and orientation pause: ${w}x${h}`,async()=>{
        const old=mp.viewportSize();await mp.setViewportSize({width:w,height:h});await mp.waitForTimeout(160);
        if((old.width>old.height)!==(w>h)){
          const before=await mp.evaluate(()=>__test.modeSnapshot);await mp.waitForTimeout(100);
          assert.equal(before.mode,'paused');assert.deepEqual(await mp.evaluate(()=>__test.modeSnapshot),before);
          await mp.locator('#pauseScreen [data-action="resume"]').click();
        }
        const layout=await mp.evaluate(()=>{
          const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
          const panels=[...document.querySelectorAll('.hud-left,.hud-mid,.hud-right')].map(rect);
          const objective=rect(document.querySelector('#objectiveChip'));
          const pause=rect(document.querySelector('#pauseButton'));
          const meters=[...document.querySelectorAll('.hud-right .meter,.hud-right .dash-meter')].map(rect);
          const canvas=document.querySelector('#game'),pixels=canvas.getContext('2d').getImageData(0,0,1280,720).data;
          let bright=0;for(let i=0;i<pixels.length;i+=80)if(pixels[i]+pixels[i+1]+pixels[i+2]>35)bright++;
          return {panels,objective,pause,meters,bright,reducedMotion:__test.settings.reducedMotion};
        });
        for(const r of [...layout.panels,layout.objective,layout.pause,...layout.meters]){
          assert.ok(r.x>=0 && r.right<=w+1,JSON.stringify(r));assert.ok(r.bottom<=h,JSON.stringify(r));
        }
        assert.ok(layout.objective.y>=Math.max(...layout.panels.map(r=>r.bottom)));
        assert.ok(layout.meters.every(r=>r.w>=48));assert.ok(layout.bright>1000);assert.equal(layout.reducedMotion,true);
        await mp.screenshot({path:path.join(output,`hud-${w}x${h}.jpg`),type:'jpeg',quality:80});
      });
    }
    await mobile.close();
    await check('no browser exceptions',async()=>assert.deepEqual(pageErrors,[]));
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed,failures,pageErrors},null,2));
  }
  if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
