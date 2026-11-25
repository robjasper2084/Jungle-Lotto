import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {createCadillacCaseLifecycle,createCadillacCaseInput} from './cadillac-case-lifecycle.mjs';
import {createCadillacOperationTiming} from './cadillac-operation-timing.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture({timeout=32*60000,maxInputReceipts}={}){
 let clock=100,timer,cleared=false;const calls=[];
 const lifecycle=createCadillacCaseLifecycle({timeout,maxInputReceipts,now:()=>clock,
  setTimer:(callback,ms)=>{assert.equal(ms,timeout);timer=callback;return 1;},clearTimer:id=>{assert.equal(id,1);cleared=true;}});
 const record=(name,args)=>{calls.push([name,...args]);};
 const locator=Object.fromEntries(['tap','click','press','focus','scrollIntoViewIfNeeded'].map(name=>[name,async(...args)=>record('locator.'+name,args)]));
 const page={keyboard:Object.fromEntries(['press','down','up'].map(name=>[name,async(...args)=>record('keyboard.'+name,args)])),
  mouse:Object.fromEntries(['move','click','down','up'].map(name=>[name,async(...args)=>record('mouse.'+name,args)]))};
 const touch={async dispatch(...args){record('touch.dispatch',args);},async cancelActive(){record('touch.cancelActive',[]);}};
 const input=createCadillacCaseInput({lifecycle,page:()=>page,touch:()=>touch});
 return{lifecycle,input,locator,page,touch,calls,now:()=>clock,set:value=>{clock=value;},expire:()=>{clock=100+timeout;timer();},cleared:()=>cleared};
}

test('one monotonic case keeps the original 32 minute ceiling and clips the 90 second action ceiling',()=>{
 const f=fixture();assert.equal(f.lifecycle.remaining(),90000);
 f.set(100+32*60000-1234);assert.equal(f.lifecycle.remaining(),1234);
 // A delayed Node timer cannot authorize work at the inclusive deadline.
 f.set(100+32*60000);assert.throws(()=>f.lifecycle.check(),/case exceeded its deadline/);
 const state=f.lifecycle.snapshot();assert.equal(state.state,'stopped');assert.equal(state.stopReason,'deadline');
 assert.equal(state.stoppedAtNodeMs,state.deadlineAtNodeMs);assert.equal(f.cleared(),true);
});

test('ordinary adapters preserve native order and arguments apart from the clipped locator timeout',async()=>{
 const f=fixture({timeout:500});
 await f.lifecycle.run(async()=>{
  await f.input.tap(f.locator,false);await f.input.tap(f.locator,true);
  await f.input.focus(f.locator);await f.input.scroll(f.locator);await f.input.press(f.locator,'Home');
  await f.input.keyPress('Enter');await f.input.keyDown('w');await f.input.keyUp('w');
  await f.input.mouseMove(10,20);await f.input.mouseDown();await f.input.mouseMove(30,40,{steps:8});await f.input.mouseUp();
  await f.input.mouseClick(50,60);
 });
 assert.deepEqual(f.calls,[['locator.click',{timeout:500}],['locator.tap',{timeout:500}],['locator.focus',{timeout:500}],
  ['locator.scrollIntoViewIfNeeded',{timeout:500}],['locator.press','Home',{timeout:500}],['keyboard.press','Enter'],
  ['keyboard.down','w'],['keyboard.up','w'],['mouse.move',10,20],['mouse.down'],['mouse.move',30,40,{steps:8}],['mouse.up'],['mouse.click',50,60]]);
 assert.equal(f.lifecycle.snapshot().state,'completed');assert.equal(f.cleared(),true);
 assert.throws(()=>f.lifecycle.publish(()=>assert.fail('late publication')),/already complete/);
});

test('the explicit non-navigating press adds only noWaitAfter and retains both action and case ceilings',async()=>{
 const f=fixture();
 await f.input.press(f.locator,'Home');await f.input.pressWithoutNavigation(f.locator,'Home');
 f.set(100+32*60000-1234);
 await f.input.press(f.locator,'ArrowDown');await f.input.pressWithoutNavigation(f.locator,'ArrowDown');
 assert.deepEqual(f.calls,[['locator.press','Home',{timeout:90000}],['locator.press','Home',{timeout:90000,noWaitAfter:true}],
  ['locator.press','ArrowDown',{timeout:1234}],['locator.press','ArrowDown',{timeout:1234,noWaitAfter:true}]]);
 assert(f.lifecycle.snapshot().inputs.every(row=>row.outcome==='completed'&&row.completedBeforeStop));
});

test('the final clock boundary and clipped budget describe the actual native call without a second pre-call clock read',async()=>{
 for(const atIssue of [199,200]){
  let reads=0;const calls=[],times=[100,atIssue,200];
  const lifecycle=createCadillacCaseLifecycle({timeout:100,now:()=>times[Math.min(reads++,times.length-1)],setTimer:()=>1,clearTimer:()=>{}});
  await assert.rejects(lifecycle.input('native request',budget=>{calls.push({budget,reads});}),/deadline/);
  const snapshot=lifecycle.snapshot();
  if(atIssue===199){assert.deepEqual(calls,[{budget:1,reads:2}]);assert.equal(snapshot.inputs[0].issuedAtNodeMs,199);}
  else{assert.deepEqual(calls,[]);assert.equal(snapshot.issuedInputs,0);}
 }
});

test('the stopped latch rejects every new native entry including the deferred CDP transport callback',async()=>{
 const f=fixture();f.expire();const client={send:()=>assert.fail('CDP dispatch after stop')};
 for(const action of [()=>f.input.tap(f.locator,false),()=>f.input.tap(f.locator,true),()=>f.input.focus(f.locator),()=>f.input.scroll(f.locator),
  ()=>f.input.press(f.locator,'Enter'),()=>f.input.pressWithoutNavigation(f.locator,'Enter'),()=>f.input.keyPress('h'),()=>f.input.keyDown('w'),()=>f.input.mouseMove(1,2),
  ()=>f.input.mouseDown(),()=>f.input.mouseClick(1,2),()=>f.input.touch('touchStart',[]),
  ()=>Promise.resolve().then(()=>f.input.sendTouch(client,'Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[]}))])
  await assert.rejects(action,/case exceeded its deadline/);
 assert.deepEqual(f.calls,[]);assert.equal(f.lifecycle.snapshot().issuedInputs,0);
});

test('late preflight or key completion cannot send a following key or publish functional success',async()=>{
 for(const method of ['press','pressWithoutNavigation'])for(const stage of ['preflight','native key']){
  const f=fixture({timeout:100}),pending=deferred();let success=false;
  if(stage==='native key')f.locator.press=(...args)=>{f.calls.push(['locator.press',...args]);return pending.promise;};
  const running=f.lifecycle.run(async()=>{
   if(stage==='preflight')await pending.promise;
   await f.input[method](f.locator,'Home');await f.input[method](f.locator,'ArrowDown');await f.input[method](f.locator,'Enter');
   f.lifecycle.publish(()=>{success=true;});
  });
  await flush();f.expire();await assert.rejects(running,/case exceeded its deadline/);
  if(stage==='native key')assert.equal(f.lifecycle.snapshot().inputs[0].outcome,'pending','Only the original native promise can settle its receipt');
  pending.resolve();await flush();assert.equal(success,false);
  assert.deepEqual(f.calls.map(call=>call[1]),stage==='native key'?['Home']:[]);
  if(stage==='native key'){
   const receipt=f.lifecycle.snapshot().inputs[0];assert.equal(receipt.outcome,'completed-after-stop');
   assert.equal(receipt.completedBeforeStop,false);assert.equal(receipt.completedAtNodeMs,200);
  }
 }
});

test('the actual wheel fixture keeps all 42 keys and scopes noWaitAfter away from boot and mobile selects',async()=>{
 const source=await readFile(new URL('./cadillac-mods-browser-smoke.mjs',import.meta.url),'utf8');
 const select=source.slice(source.indexOf('async function selectWithKeyboard('),source.indexOf('async function setReduced('));
 const wheels=source.slice(source.indexOf('async function wheelChecks('),source.indexOf('async function panelAction('));
 const rim='#cadillac-mod-rim',center='#cadillac-mod-center',tire='#cadillac-mod-tire';
 const expectedSelections=[[rim,1],[center,1],[tire,1],[tire,2],[tire,3],[rim,2],[center,2],[tire,1],[tire,2],[tire,3],[rim,0],[tire,0]];
 const expectedKeys=expectedSelections.flatMap(([selector,index])=>['Home',...Array(index).fill('ArrowDown'),'Enter'].map(key=>({selector,key})));
 assert.equal(expectedKeys.length,42);
 for(const mobile of [false,true]){
  const f=fixture(),calls=[],scrolled=[],enabled=[],valuesChecked=[];
  const options={[rim]:['stock','wire-gold','wire-chrome'],[center]:['gold','black','white'],[tire]:['standard','whitewall','low-profile','low-profile-whitewall'],
   '#quality':['automatic','smooth','high'],'#fps':['60','30'],'#joystick-mode':['floating','fixed']};
  const values=Object.fromEntries(Object.entries(options).map(([selector,items])=>[selector,items[0]]));
  const controls=Object.fromEntries(Object.entries(options).map(([selector,items])=>[selector,{
   selector,locator:child=>{assert.equal(child,'option');return{evaluateAll:async evaluate=>evaluate(items.map(value=>({value}))) };},
   async press(key,config){
    calls.push({selector,key,config});
    if(key==='Home')values[selector]=items[0];
    else if(key==='ArrowDown')values[selector]=items[items.indexOf(values[selector])+1];
    else assert.equal(key,'Enter');
   },
  }]));
  const page={locator:selector=>{assert(Object.hasOwn(controls,selector));return controls[selector];}};
  const context=createContext({assert,mobile,page,nativeInput:f.input,
   scrollIfNeeded:async control=>{scrolled.push(control.selector);},
   expect:control=>({
    toBeEnabled:async()=>{assert(control.selector!==center||values[rim]!=='stock');enabled.push(control.selector);},
    toHaveValue:async value=>{assert.equal(values[control.selector],value);valuesChecked.push(control.selector);},
    toBeDisabled:async()=>{assert.equal(control.selector,center);assert.equal(values[rim],'stock');},
   }),
   phase:()=>{},openMods:async()=>{},closeSettings:async()=>{},editorCapture:async()=>{},frames:async()=>{},capture:async()=>{},checkResult:()=>{},
   snapshot:async()=>({wheels:{rim:values[rim],tire:values[tire],spokesPerWheel:100,texturesAdded:0,
    customMeshes:values[rim]==='stock'&&values[tire]==='standard'?0:8,sourceRestored:values[rim]==='stock'&&values[tire]==='standard'}}),
  });
  runInContext(select+wheels,context);await runInContext('wheelChecks()',context);
  assert.deepEqual(calls.map(({selector,key})=>({selector,key})),expectedKeys);
  assert.deepEqual(scrolled,expectedSelections.map(([selector])=>selector));assert.deepEqual(enabled,scrolled);assert.deepEqual(valuesChecked,scrolled);
  assert(calls.every(({config})=>JSON.stringify(config)===JSON.stringify(mobile?{timeout:90000}:{timeout:90000,noWaitAfter:true})));
  await runInContext("selectWithKeyboard('#quality','smooth')",context);await runInContext("selectWithKeyboard('#fps','30')",context);
  assert.deepEqual(calls.slice(42),['#quality','#fps'].flatMap(selector=>['Home','ArrowDown','Enter'].map(key=>({selector,key,config:{timeout:90000}}))));
  if(mobile){
   await runInContext("selectWithKeyboard('#joystick-mode','fixed')",context);
   assert.deepEqual(calls.slice(48),['Home','ArrowDown','Enter'].map(key=>({selector:'#joystick-mode',key,config:{timeout:90000}})));
  }
  assert.equal(calls.filter(({config})=>config.noWaitAfter).length,mobile?0:42);
  const receipts=f.lifecycle.snapshot().inputs;
  assert.deepEqual(receipts.slice(0,42).map(row=>row.label),expectedKeys.map(({key})=>(mobile?'locator.press ':'locator.press(noWaitAfter) ')+key));
  assert.deepEqual(receipts.slice(42,48).map(row=>row.label),['Home','ArrowDown','Enter','Home','ArrowDown','Enter'].map(key=>'locator.press '+key));
 }
});

test('an already-issued native call is recorded as uncertain and never retried or accepted after stop',async()=>{
 const f=fixture({timeout:100}),delivery=deferred();f.page.mouse.click=(...args)=>{f.calls.push(['mouse.click',...args]);return delivery.promise;};
 const pending=f.input.mouseClick(4,5);await flush();f.expire();await assert.rejects(pending,/deadline/);
 const atStop=f.lifecycle.snapshot();assert.equal(atStop.unresolvedInputs,1);assert.equal(atStop.inputs[0].outcome,'pending');
 delivery.resolve();await flush();const after=f.lifecycle.snapshot();assert.equal(after.unresolvedInputs,0);
 assert.equal(after.inputs[0].outcome,'completed-after-stop');assert.equal(after.inputs[0].completedBeforeStop,false);
 assert.equal(atStop.inputs[0].outcome,'pending','A retained snapshot cannot mutate after late delivery');assert.equal(f.calls.length,1);
});

test('owned key and button releases survive stop and are each issued once across finally and teardown',async()=>{
 const f=fixture();await f.input.keyDown('w');await f.input.mouseDown();
 const released=deferred();f.page.keyboard.up=key=>{f.calls.push(['keyboard.up',key]);return released.promise;};
 f.expire();const first=f.input.keyUp('w'),all=f.input.releaseOwned();await flush();
 assert.deepEqual(f.calls,[['keyboard.down','w'],['mouse.down'],['keyboard.up','w'],['mouse.up']]);
 released.resolve();await first;assert.deepEqual(await all,{keys:[],buttons:[]});await f.input.keyUp('w');await f.input.mouseUp();
 assert.equal(f.calls.length,4);assert(f.lifecycle.snapshot().inputs.slice(2).every(row=>row.cleanup&&row.outcome==='release-completed'));
});

test('uncertain failed release is retained and never retried by teardown',async()=>{
 const f=fixture();await f.input.keyDown('w');f.page.keyboard.up=()=>{f.calls.push(['keyboard.up']);throw Error('transport uncertain');};f.expire();
 await assert.rejects(f.input.keyUp('w'),/transport uncertain/);await assert.rejects(f.input.releaseOwned(),/owned-input release failed/);
 assert.equal(f.calls.filter(call=>call[0]==='keyboard.up').length,1);assert.equal(f.lifecycle.snapshot().inputs.at(-1).outcome,'rejected');
});

test('touch keeps original pending transport ownership and cancels instead of ending after stop',async()=>{
 const f=fixture({timeout:100}),transport=deferred();const payload={type:'touchStart',touchPoints:[{id:1,x:2,y:3}]};
 const client={send(method,params){assert.equal(this,client);f.calls.push([method,params]);return transport.promise;}};
 assert.equal(f.input.sendTouch(client,'Input.dispatchTouchEvent',payload),transport.promise);
 f.expire();await f.input.touch('touchEnd',[]);assert.deepEqual(f.calls,[['Input.dispatchTouchEvent',payload],['touch.cancelActive']]);
 const cancellation={type:'touchCancel',touchPoints:[]};assert.equal(f.input.sendTouch(client,'Input.dispatchTouchEvent',cancellation),transport.promise);
 transport.resolve();await flush();assert.equal(f.lifecycle.snapshot().inputs[0].completedBeforeStop,false);
 assert.equal(f.lifecycle.snapshot().inputs[1].outcome,'release-completed');
});

test('a queued touch send after stop is refused before the actual client call',async()=>{
 const f=fixture(),client={send:()=>assert.fail('Late transport dispatched')};
 const pending=Promise.resolve().then(()=>f.input.sendTouch(client,'Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[]}));
 f.expire();await assert.rejects(pending,/deadline/);assert.equal(f.lifecycle.snapshot().issuedInputs,0);
});

test('failure collection remains possible while all success publication is stopped',async()=>{
 const f=fixture(),pending=deferred(),published=[];let failureScreenshots=0;
 const running=f.lifecycle.run(async()=>{await pending.promise;f.lifecycle.publish(()=>published.push('snapshot','capture','functional pass'));});
 await flush();f.expire();await assert.rejects(running,/deadline/);
 // Failure evidence is explicitly outside the guarded success path.
 await Promise.resolve().then(()=>{failureScreenshots++;});pending.resolve();await flush();
 assert.deepEqual(published,[]);assert.equal(failureScreenshots,1);assert.equal(f.lifecycle.snapshot().state,'stopped');
});

test('ordinary failure also latches stop and bounded scalar receipts retain truthful nulls',async()=>{
 const f=fixture({maxInputReceipts:1}),pending=deferred();f.lifecycle.issue('pending',()=>pending.promise);
 await assert.rejects(f.lifecycle.run(async()=>{await f.input.keyPress('h');throw Error('assertion failure');}),/assertion failure/);
 const snapshot=f.lifecycle.snapshot();assert.equal(snapshot.stopReason,'failure');assert.equal(snapshot.issuedInputs,2);
 assert.equal(snapshot.droppedInputReceipts,1);assert.equal(snapshot.inputs.length,1);assert.equal(snapshot.inputs[0].completedAtNodeMs,null);
 assert.equal(snapshot.unresolvedInputs,1);assert.throws(()=>f.lifecycle.publish(()=>{}),/assertion failure/);
 pending.reject(Error('late transport failure'));await flush();assert.equal(f.lifecycle.snapshot().inputs[0].error,'late transport failure');
});

test('invalid monotonic clock fails closed but cannot suppress an owned cleanup release',async()=>{
 const f=fixture();await f.input.keyDown('w');f.set(99);
 await assert.rejects(f.input.keyPress('h'),/Invalid Cadillac case clock/);await f.input.keyUp('w');
 assert.deepEqual(f.calls,[['keyboard.down','w'],['keyboard.up','w']]);
 const snapshot=f.lifecycle.snapshot(),release=snapshot.inputs.at(-1);assert.equal(snapshot.stopReason,'clock');
 assert.equal(release.issuedAtNodeMs,null);assert.equal(release.completedAtNodeMs,null);assert.match(release.timingError,/Invalid Cadillac case clock/);
});

test('the actual capture path neither starts a late screenshot nor publishes an already-issued late screenshot',async()=>{
 const source=await readFile(new URL('./cadillac-mods-browser-smoke.mjs',import.meta.url),'utf8');
 const capture=source.slice(source.indexOf('async function capture('),source.indexOf('async function editorCapture('));
 for(const stage of ['paint','screenshot']){
  const f=fixture(),pending=deferred(),issued=deferred(),report={captures:[],phase:'test'},screenshots=[],operationTiming=createCadillacOperationTiming({now:f.now});
  const page={screenshot:options=>{screenshots.push(options);issued.resolve();return stage==='screenshot'?pending.promise:Promise.resolve(Buffer.from('pixels'));},viewportSize:()=>({width:1280,height:800})};
  const context=createContext({caseLifecycle:f.lifecycle,operationTiming,page,report,out:'/fixture',resolve:(...parts)=>parts.join('/'),hash:()=> 'hash',
   painted:()=>stage==='paint'?pending.promise:Promise.resolve({fence:true,paints:2})});
  runInContext(capture,context);const running=runInContext("capture('test')",context);
  if(stage==='screenshot')await issued.promise;else await flush();
  f.expire();const timingAtStop=operationTiming.snapshot();
  pending.resolve(stage==='screenshot'?Buffer.from('pixels'):{fence:true,paints:2});await assert.rejects(running,/deadline/);
  assert.equal(screenshots.length,stage==='screenshot'?1:0);assert.deepEqual(report.captures,[]);
  if(screenshots.length)assert.equal(screenshots[0].timeout,150000,'The existing complete screenshot budget remains intact');
  assert.equal(timingAtStop.pendingOperations,1);assert.equal(timingAtStop.entries.at(-1).settlement,'pending');
  const settledTiming=operationTiming.snapshot();assert.equal(settledTiming.pendingOperations,0);
  assert.equal(settledTiming.entries.at(-1).settlement,'resolved','An observed operation settlement cannot publish a successful capture after stop');
 }
});

test('the actual snapshot path refuses a report value that arrives after case stop',async()=>{
 const source=await readFile(new URL('./cadillac-mods-browser-smoke.mjs',import.meta.url),'utf8');
 const snapshot=source.slice(source.indexOf('async function snapshot('),source.indexOf('async function targetProof('));
 const f=fixture(),pending=deferred(),reading=deferred(),report={snapshots:[],harness:{snapshotTimings:[]}};
 const control={getAttribute:async()=>'',getByRole:()=>control,isVisible:async()=>true};
 const page={locator:()=>control,getByLabel:()=>({inputValue:()=>{reading.resolve();return pending.promise;}})};
 const context=createContext({caseLifecycle:f.lifecycle,page,report,assert,variant:'cadillac',mobile:false,openMods:async()=>{},diagnosticActivate:async()=>{}});
 runInContext(snapshot,context);const running=runInContext("snapshot('late')",context);await reading.promise;f.expire();
 pending.resolve(JSON.stringify({settings:{cadillac:{vehicle:'silver-cadillac'}}}));await assert.rejects(running,/deadline/);
 assert.deepEqual(report,{snapshots:[],harness:{snapshotTimings:[]}});
});

test('the harness has no direct native bypass and admits final success only through lifecycle.run',async()=>{
 const source=await readFile(new URL('./cadillac-mods-browser-smoke.mjs',import.meta.url),'utf8');
 assert(!/page\.(?:mouse|keyboard)\.[a-z]+\s*\(|touchSequence\.dispatch\s*\(/.test(source));
 assert(!/await\s+(?:locator|control|page\.locator\([^\n]*?\))\.(?:tap|click|press|focus|scrollIntoViewIfNeeded)\s*\(/.test(source));
 assert(source.includes('createNativeTouchSequence((method,params)=>nativeInput.sendTouch(client,method,params))'));
 assert(source.includes('try{await caseLifecycle.run(run);report.functionalPassed=true;}'));
 assert.equal(source.match(/report\.functionalPassed=true/g)?.length,1);
 assert(source.includes("report.passed=report.caseLifecycle.state==='completed'&&report.functionalPassed===true"));
 const failure=source.slice(source.indexOf('catch(error){\n report.failurePhase='));
 assert(failure.indexOf('startInputCleanup();')<failure.indexOf('const failure=await page.evaluate('),'Owned input release starts before read-only failure collection');
 assert(failure.includes("await page.screenshot({path:resolve(out,file),timeout:30000})"),'Failure collection must stay available after stop');
});

test('the actual failure/teardown cleanup shares one promise and one original 10 second budget',async()=>{
 const source=await readFile(new URL('./cadillac-mods-browser-smoke.mjs',import.meta.url),'utf8');
 const cleanup=source.slice(source.indexOf('function startInputCleanup('),source.indexOf('// Pointer actions'));
 const pending=deferred(),calls=[];
 const context=createContext({nativeInput:{releaseOwned:()=>{calls.push('owned release');return pending.promise;}},
  touchSequence:{cancelActive:()=>{calls.push('touch cancel');return Promise.resolve({cancelled:true});}},
  bounded:(promise,ms,label)=>{calls.push({ms,label});return promise;}});
 runInContext('let inputCleanup;'+cleanup,context);
 const caught=runInContext('startInputCleanup()',context),teardown=runInContext('startInputCleanup()',context);
 assert.equal(caught,teardown);assert.deepEqual(calls,['owned release','touch cancel',{ms:10000,label:'Native input cleanup'}]);
 pending.resolve({keys:[],buttons:[]});await caught;assert.equal(runInContext('startInputCleanup()',context),caught);
});


test('the editor scroll optimizes only confirmed browser-native movement and retains the original fallback',async()=>{
 const source=await readFile(new URL('./cadillac-mods-browser-smoke.mjs',import.meta.url),'utf8');
 const start=source.indexOf('async function scrollIfNeeded(locator){'),end=source.indexOf('\nasync function openMenu(',start);
 assert(start>=0&&end>start,'The exact shared test helper must be present');
 const fn=source.slice(start,end);
 async function exercise({left=100,top=900,width=48,height=48,visibility='visible',move=true,clipped=false}={}){
  const calls=[],rect={left,top,width,height,right:left+width,bottom:top+height},harness={alreadyVisibleScrolls:0,explicitScrolls:0};
  const parent=clipped?{parentElement:null,offsetWidth:150,offsetHeight:150,clientWidth:140,clientHeight:140,clientLeft:0,clientTop:0,
   getBoundingClientRect(){return{left:0,top:0,right:150,bottom:150,width:150,height:150};}}:null;
  const element={isConnected:true,parentElement:parent,getBoundingClientRect(){return{...rect};},
   scrollIntoView(options){calls.push(['instant',options]);if(move)Object.assign(rect,{left:12,top:12,right:12+width,bottom:12+height});}};
  const locator={evaluate:async operation=>operation(element)};
  const context=createContext({
   innerWidth:1280,innerHeight:800,locator,report:{harness},caseLifecycle:{publish:operation=>operation()},
   operationTiming:{observe:(label,operation)=>{calls.push(['observe',label]);return operation();}},
   getComputedStyle:node=>({visibility:node===element?visibility:'visible',display:'block',
    overflowX:node===element?'visible':clipped?'hidden':'visible',
    overflowY:node===element?'visible':clipped?'hidden':'visible'}),
   nativeInput:{scroll:async()=>calls.push(['fallback'])}
  });
  runInContext(fn,context);await runInContext('scrollIfNeeded(locator)',context);return{calls,harness};
 }
 let result=await exercise({top:25});
 assert.deepEqual(result.calls.map(call=>call[0]),['observe']);
 assert.deepEqual(result.harness,{alreadyVisibleScrolls:1,explicitScrolls:0});
 result=await exercise();
 assert.deepEqual(result.calls.map(call=>call[0]),['observe','instant']);
 assert.deepEqual([result.calls[1][1].behavior,result.calls[1][1].block,result.calls[1][1].inline],['instant','nearest','nearest']);
 assert.deepEqual(result.harness,{alreadyVisibleScrolls:0,explicitScrolls:1});
 result=await exercise({move:false});
 assert.deepEqual(result.calls.map(call=>call[0]),['observe','instant','observe','fallback']);
 assert.deepEqual(result.harness,{alreadyVisibleScrolls:0,explicitScrolls:1});
 result=await exercise({visibility:'hidden'});
 assert.deepEqual(result.calls.map(call=>call[0]),['observe','observe','fallback']);
 result=await exercise({left:200,top:10,clipped:true});
 assert.deepEqual(result.calls.map(call=>call[0]),['observe','instant']);
 assert.equal(result.harness.explicitScrolls,1);
});
