/** One Node monotonic clock owns the complete control case. A stopped case can
 * collect failure evidence and release owned input, but cannot issue new work
 * or publish successful observations. Already-issued browser calls may finish
 * later; their receipts stay explicitly outside the accepted case interval. */
export function createCadillacCaseLifecycle({timeout=32*60000,now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,maxInputReceipts=4096}={}){
 if(!Number.isFinite(timeout)||timeout<=0||!Number.isSafeInteger(maxInputReceipts)||maxInputReceipts<0)throw Error('Invalid Cadillac case limits');
 const startedAtNodeMs=now();if(!Number.isFinite(startedAtNodeMs))throw Error('Invalid Cadillac case clock');
 const deadlineAtNodeMs=startedAtNodeMs+timeout,timeoutError=Error('Cadillac modification case exceeded its deadline');
 let state='running',stopReason=null,stoppedAtNodeMs=null,completedAtNodeMs=null,terminalError,lastTime=startedAtNodeMs,timer,ran=false;
 let issued=0,settled=0,dropped=0;const inputs=[];
 let rejectStopped;const stopped=new Promise((_,reject)=>{rejectStopped=reject;});stopped.catch(()=>{});
 function stop(error=Error('Cadillac case stopped'),reason='failure',at){
  if(state!=='running')return;
  state='stopped';terminalError=error;stopReason=reason;
  if(at!==undefined)stoppedAtNodeMs=at;
  else try{const value=now();if(Number.isFinite(value)&&value>=lastTime){lastTime=value;stoppedAtNodeMs=value;}}catch{}
  if(timer!==undefined)clearTimer(timer);rejectStopped(error);
 }
 function stamp(){
  let value;try{value=now();}catch(error){stop(error,'clock');throw error;}
  if(!Number.isFinite(value)||value<lastTime){const error=Error('Invalid Cadillac case clock');stop(error,'clock');throw error;}
  lastTime=value;return value;
 }
 function check(){
  const at=stamp();if(state==='running'&&at>=deadlineAtNodeMs)stop(timeoutError,'deadline',at);
  if(state!=='running')throw terminalError??Error('Cadillac case is already complete');return at;
 }
 function remaining(ceiling=90000){const at=check();return Math.min(ceiling,deadlineAtNodeMs-at);}
 // Keep the original returned promise for transport ownership (notably the
 // touch tracker). The observer never races or retries an issued native call.
 function issue(label,operation,{cleanup=false}={}){
  let issuedAtNodeMs=null,timingError;
  if(cleanup){try{issuedAtNodeMs=stamp();}catch(error){timingError=String(error?.message??error);}}
  else issuedAtNodeMs=check();
  const receipt={sequence:++issued,label,cleanup,issuedAtNodeMs,completedAtNodeMs:null,outcome:'pending',completedBeforeStop:false,error:null};
  if(timingError)receipt.timingError=timingError;
  if(inputs.length<maxInputReceipts)inputs.push(receipt);else dropped++;
  function finish(rejected=false,error){
   settled++;try{receipt.completedAtNodeMs=stamp();}catch(clockError){receipt.timingError=String(clockError?.message??clockError);}
   if(state==='running'&&receipt.completedAtNodeMs!==null&&receipt.completedAtNodeMs>=deadlineAtNodeMs)stop(timeoutError,'deadline',receipt.completedAtNodeMs);
   receipt.completedBeforeStop=!cleanup&&state==='running'&&receipt.completedAtNodeMs!==null;
   receipt.outcome=rejected?'rejected':cleanup?'release-completed':receipt.completedBeforeStop?'completed':'completed-after-stop';
   receipt.error=rejected?String(error?.message??error):null;
  }
  let result;try{result=operation(issuedAtNodeMs);}catch(error){finish(true,error);throw error;}
  Promise.resolve(result).then(()=>finish(),error=>finish(true,error));return result;
 }
 async function input(label,operation){return wait(issue(label,at=>operation(Math.min(90000,deadlineAtNodeMs-at))));}
 async function wait(pending){const observed=Promise.resolve(pending);observed.catch(()=>{});check();const result=await Promise.race([observed,stopped]);check();return result;}
 async function run(work){
  if(ran)throw Error('Cadillac case can run only once');ran=true;
  try{const result=await wait(Promise.resolve().then(()=>{check();return work();}));completedAtNodeMs=check();state='completed';clearTimer(timer);return result;}
  catch(error){stop(error);throw terminalError??error;}
 }
 timer=setTimer(()=>stop(timeoutError,'deadline'),timeout);
 return{check,remaining,issue,input,wait,run,stop,
  release:(label,operation)=>issue(label,operation,{cleanup:true}),
  publish:operation=>{check();return operation();},
  snapshot:()=>structuredClone({version:1,clock:'Node performance.now; independent of page performance.now',timeoutMs:timeout,
   startedAtNodeMs,deadlineAtNodeMs,stoppedAtNodeMs,completedAtNodeMs,state,stopReason,
   issuedInputs:issued,settledInputs:settled,unresolvedInputs:issued-settled,droppedInputReceipts:dropped,inputs,
   note:'Issue times mark calls into the native browser API, not browser event delivery. Calls already issued at stop may complete or deliver later; they are never retried or accepted after stop. cleanup=true marks release-only calls, including ordinary finally releases, allowed after stop.'}),
 };
}

/** Explicit adapters for this fixture's existing native methods. There is no
 * Playwright patch/proxy and no synthetic DOM input. Key/button releases own
 * their cleanup promise, so a finally block and teardown cannot release twice. */
export function createCadillacCaseInput({lifecycle,page,touch}){
 const keys=new Map(),buttons=new Map();
 function hold(owners,key,label,operation){
  return lifecycle.input(label,()=>{if(owners.has(key))throw Error('Native input is already held: '+key);owners.set(key,{release:null});return operation();});
 }
 function release(owners,key,label,operation){
  const owner=owners.get(key);if(!owner)return Promise.resolve({attempted:false});
  if(!owner.release)owner.release=Promise.resolve().then(()=>lifecycle.release(label,operation)).then(value=>{owners.delete(key);return value;});
  return owner.release;
 }
 const api={
  tap:(locator,mobile)=>lifecycle.input(mobile?'locator.tap':'locator.click',timeout=>mobile?locator.tap({timeout}):locator.click({timeout})),
  // Only the audited in-page desktop Start button uses this native action.
  clickStartWithoutNavigation:locator=>lifecycle.input('locator.click(noWaitAfter) Start',timeout=>locator.click({timeout,noWaitAfter:true})),
  press:(locator,key)=>lifecycle.input('locator.press '+key,timeout=>locator.press(key,{timeout})),
  // Only the three desktop wheel selects opt out of the navigation barrier.
  // Locator resolution/focus, native keys, timeout and promise ownership stay intact.
  pressWithoutNavigation:(locator,key)=>lifecycle.input('locator.press(noWaitAfter) '+key,timeout=>locator.press(key,{timeout,noWaitAfter:true})),
  focus:locator=>lifecycle.input('locator.focus',timeout=>locator.focus({timeout})),
  scroll:locator=>lifecycle.input('locator.scrollIntoViewIfNeeded',timeout=>locator.scrollIntoViewIfNeeded({timeout})),
  keyPress:key=>lifecycle.input('keyboard.press '+key,()=>page().keyboard.press(key)),
  keyDown:key=>hold(keys,key,'keyboard.down '+key,()=>page().keyboard.down(key)),
  keyUp:key=>release(keys,key,'keyboard.up '+key,()=>page().keyboard.up(key)),
  mouseMove:(...args)=>lifecycle.input('mouse.move',()=>page().mouse.move(...args)),
  mouseClick:(...args)=>lifecycle.input('mouse.click',()=>page().mouse.click(...args)),
  mouseDown:()=>hold(buttons,'left','mouse.down',()=>page().mouse.down()),
  mouseUp:()=>release(buttons,'left','mouse.up',()=>page().mouse.up()),
  async touch(type,points){
   // After stop, ending a gesture might activate a control. Cancel its owned
   // contacts instead. Ordinary successful paths keep the original touchEnd.
   try{lifecycle.check();}catch(error){if(type==='touchEnd')return touch().cancelActive();throw error;}
   return lifecycle.wait(touch().dispatch(type,points));
  },
  sendTouch:(client,method,params)=>params.type==='touchCancel'
   ?lifecycle.release('CDP '+params.type,()=>client.send(method,params))
   :lifecycle.issue('CDP '+params.type,()=>client.send(method,params)),
  async releaseOwned(){
   const results=await Promise.allSettled([...keys.keys()].map(key=>api.keyUp(key)).concat([...buttons.keys()].map(()=>api.mouseUp())));
   const errors=results.filter(result=>result.status==='rejected').map(result=>result.reason);
   if(errors.length)throw new AggregateError(errors,'Native owned-input release failed');
   return{keys:[...keys.keys()],buttons:[...buttons.keys()]};
  },
 };
 return api;
}
