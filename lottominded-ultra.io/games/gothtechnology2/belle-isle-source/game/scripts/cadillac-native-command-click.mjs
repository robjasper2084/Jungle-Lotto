import assert from 'node:assert/strict';

/** Serialized into the page by ElementHandle.evaluateHandle. It retains the
 * exact button/root, observes DOM state and native events, and never calls an
 * application method or dispatches an event. Keep this function self-contained. */
export function createCadillacCommandSession(element){
 const detailed=new Map([['Lower',null],['Stock height',null],['Raise',null],['Level corners',null],
  ['Full-car hop','all'],['Front hop','front'],['Rear hop','rear'],['Finish motion & level',null]]);
 const hydraulic=new Map([['hydraulic-front-up','Front up'],['hydraulic-back-up','Back up'],['hydraulic-pancake','Pancake'],
  ['hydraulic-settle','Finish & level'],['hydraulic-exit','Exit mode'],['hydraulic-hop-all','Full hop'],
  ['hydraulic-hop-front','Front hop'],['hydraulic-hop-rear','Rear hop'],['hydraulic-inside-exit','Exit mode']]);
 function identify(button){
  if(!(button instanceof HTMLButtonElement)||button.getAttribute('type')!=='button')return null;
  const owner=button.closest('#cadillac-modifications,#hydraulic-controls'),label=button.textContent.trim().replace(/\s+/g,' ');
  if(owner?.id==='cadillac-modifications'&&!button.id&&detailed.has(label)&&button.getAttribute('data-cadillac-hop')===detailed.get(label))
   return{root:owner.id,command:label};
  if(owner?.id==='hydraulic-controls'&&hydraulic.get(button.id)===label)return{root:owner.id,command:button.id};
  return null;
 }
 const identity=identify(element);if(!identity)return null;
 const root=element.closest('#'+identity.root),document=element.ownerDocument;
 const eventTypes=['pointerdown','pointerup','click'],receipts=[];
 let armed=false,closed=false,expectedRect=null,totalEvents=0;
 function require(value,message){if(!value)throw Error('Cadillac native command: '+message);}
 function inspect({rect:previous,geometry=true}={}){
  require(!closed,'observer is closed');
  require(element.isConnected&&root.isConnected&&element.ownerDocument===document,'button/root detached');
  const current=identify(element);
  require(current?.root===identity.root&&current?.command===identity.command&&element.closest('#'+identity.root)===root&&
   document.querySelectorAll('#'+identity.root).length===1&&document.querySelector('#'+identity.root)===root,'button/root identity changed');
  require(!document.pointerLockElement,'pointer lock is active');
  require(!element.disabled&&!element.matches(':disabled'),'button is disabled');
  for(let node=element;node;node=node.parentElement){
   require(!node.inert&&!node.hasAttribute('inert')&&node.getAttribute('aria-disabled')!=='true','button ancestry is inert or disabled');
   const style=getComputedStyle(node);
   require(style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse','button ancestry is hidden');
   require(typeof node.getAnimations==='function','animation inspection is unavailable');
   // Only the target includes its descendants. A body's unrelated animation
   // must not invalidate this static HTML command, nor does data-motion= moving.
   require(!node.getAnimations({subtree:node===element}).some(animation=>animation.pending||animation.playState==='running'),'button ancestry/subtree is animating');
  }
  require(getComputedStyle(element).pointerEvents!=='none','button ignores pointer events');
  if(!geometry)return{identity};
  const bounds=element.getBoundingClientRect();
  const rect=Object.fromEntries(['left','top','right','bottom','width','height'].map(key=>[key,bounds[key]]));
  require(Object.values(rect).every(Number.isFinite)&&rect.width>=44&&rect.height>=44,'button is smaller than 44px or has invalid geometry');
  if(previous)require(Object.keys(rect).every(key=>rect[key]===previous[key]),'button rectangle moved');
  let left=0,top=0,right=innerWidth,bottom=innerHeight;
  const clips=[];
  for(let node=element.parentElement;node;node=node.parentElement){
   const style=getComputedStyle(node),r=node.getBoundingClientRect();
   const sx=node.offsetWidth?r.width/node.offsetWidth:1,sy=node.offsetHeight?r.height/node.offsetHeight:1;
   const x=r.left+node.clientLeft*sx,y=r.top+node.clientTop*sy;
   if(/^(auto|scroll|hidden|clip)$/.test(style.overflowX)){left=Math.max(left,x);right=Math.min(right,x+node.clientWidth*sx);}
   if(/^(auto|scroll|hidden|clip)$/.test(style.overflowY)){top=Math.max(top,y);bottom=Math.min(bottom,y+node.clientHeight*sy);}
   if(/^(auto|scroll|hidden|clip)$/.test(style.overflowX)||/^(auto|scroll|hidden|clip)$/.test(style.overflowY))
    clips.push({id:node.id,tag:node.tagName,left,top,right,bottom});
  }
  require(rect.left>=left&&rect.top>=top&&rect.right<=right&&rect.bottom<=bottom,'button is clipped by the viewport or an ancestor client box');
  const points=[[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75]].map(([u,v])=>{
   const x=rect.left+rect.width*u,y=rect.top+rect.height*v,hit=document.elementFromPoint(x,y);
   return{x,y,receives:hit===element||element.contains(hit)};
  });
  require(points.every(point=>point.receives),'one of five hit points is not owned by the actual button');
  return{identity,rect,clips,points};
 }
 function capture(event){
  totalEvents++;
  if(receipts.length>=6)return;
  const target=event.target,exactButton=target instanceof Element&&target.closest('button')===element&&event.composedPath().includes(element);
  const exactRoot=element.closest('#'+identity.root)===root&&document.querySelector('#'+identity.root)===root;
  let guardError=null;
  try{inspect({rect:expectedRect});}catch(error){guardError=String(error.message||error);}
  receipts.push({type:event.type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,isPrimary:event.isPrimary,
   button:event.button,buttons:event.buttons,detail:event.detail,clientX:event.clientX,clientY:event.clientY,
   exactButton,exactRoot,guardError,at:performance.now()});
 }
 function disarm(){if(armed){for(const type of eventTypes)document.removeEventListener(type,capture,true);armed=false;}}
 function snapshot(){return{identity,point:expectedRect?{x:expectedRect.left+expectedRect.width/2,y:expectedRect.top+expectedRect.height/2}:null,
  totalEvents,receipts:receipts.map(receipt=>({...receipt}))};}
 return{identity,inspect,
  arm(rect){require(!armed&&totalEvents===0,'observer cannot be armed twice');const proof=inspect({rect});expectedRect=rect;
   armed=true;for(const type of eventTypes)document.addEventListener(type,capture,{capture:true,passive:true});return proof;},
  finish(){disarm();return snapshot();},
  dispose(){disarm();closed=true;return snapshot();}
 };
}

export function validateCadillacCommandReceipts(result){
 assert.equal(result.totalEvents,3,'Exactly one native pointerdown/up/click sequence is required');
 assert.deepEqual(result.receipts.map(receipt=>receipt.type),['pointerdown','pointerup','click'],'Native receipt ordering changed');
 const pointerId=result.receipts[0].pointerId;
 assert(Number.isInteger(pointerId)&&pointerId>=0,'A native mouse pointer identity is required');
 for(const [index,receipt]of result.receipts.entries()){
  assert.equal(receipt.trusted,true,'A native trusted event is required');
  assert.equal(receipt.pointerType,'mouse','Desktop command must use the mouse');
  assert.equal(receipt.pointerId,pointerId,'Native pointer identity changed');
  assert.equal(receipt.button,0,'Native command must use the left button');
  assert.equal(receipt.buttons,index===0?1:0,'Native button state must be left down, then fully released');
  // Pointer Events defaults click.isPrimary; down/up establish the primary
  // sequence, while click retains its pointerId/type. Do not reject that default.
  if(index<2)assert.equal(receipt.isPrimary,true,'Native down/up must use the primary pointer');
  for(const [coordinate,axis]of [['clientX','x'],['clientY','y']]){
   const expected=result.point?.[axis],actual=receipt[coordinate];
   assert(Number.isFinite(expected)&&Number.isFinite(actual)&&(actual===expected||(index===2&&actual===Math.floor(expected))),
    'Native receipt must match the dispatch point (click may floor coordinates)');
  }
  assert.equal(receipt.exactButton,true,'Native event targeted a different button');
  assert.equal(receipt.exactRoot,true,'Native event targeted a different command root');
  assert.equal(receipt.guardError,null,'Command became unsafe before '+receipt.type+': '+receipt.guardError);
 }
}

/** Returns false only for targets outside the explicit command whitelist. Any
 * failure for a recognized command is fatal: callers must never retry/fallback.
 * Each awaited operation shares the original 90s action budget. No timed-out
 * step can continue into another input action. An already-issued mouse click
 * can have uncertain delivery; record that attempt and never retry it. */
export async function clickCadillacCommand({page,locator,targetProof,record,timeout=90000,now=()=>performance.now(),caseLifecycle}){
 const started=now(),deadline=started+timeout;
 const startedAtNodeMs=caseLifecycle?.check()??null;
 let element,session,identity,audit,error;
 function actionRemaining(){return Math.max(0,deadline-now());}
 function remaining(){return Math.min(actionRemaining(),caseLifecycle?.remaining()??Infinity);}
 async function step(label,operation,lateCleanup){
  const ms=remaining();if(ms<=0)throw Error('Cadillac native command '+label+' exceeded its deadline');
  let timer;
  const pending=Promise.resolve().then(()=>{const budget=remaining();if(budget<=0)throw Error('Cadillac native command '+label+' exceeded its deadline');return operation(budget);});
  try{
   const result=Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Cadillac native command '+label+' exceeded its deadline')),ms);})]);
   return await(caseLifecycle?caseLifecycle.wait(result):result);
  }catch(caught){
   // Both a local deadline and the case stop abandon this exact handle. Dispose
   // even if its resolution races the stop; never continue from late preflight.
   if(lateCleanup)pending.then(value=>lateCleanup(value),()=>{}).catch(()=>{});
   throw caught;
  }
  finally{clearTimeout(timer);}
 }
 try{
  element=await step('resolve',ms=>locator.elementHandle({timeout:ms}),handle=>handle?.dispose());
  assert(element,'Native command target did not resolve');
  session=await step('identify',()=>element.evaluateHandle(createCadillacCommandSession),handle=>handle.dispose());
  identity=await step('identity',()=>session.evaluate(value=>value?.identity??null));
  if(!identity)return false;
  audit={...identity,readinessMs:null,preflightMs:null,hoverMs:null,dispatchMs:null,totalMs:null,dispatchAttempted:false,receipts:null,error:null,cleanupError:null,
   startedAtNodeMs,dispatchStartedAtNodeMs:null,dispatchFinishedAtNodeMs:null,acceptedAtNodeMs:null,accepted:false};
  // Keep locator.click's transient visibility/enabled waits without its stable-
  // rectangle wait. ElementHandle retains this exact button; it cannot resolve
  // a replacement. Both waits consume the same original action deadline.
  const readinessStarted=now();
  try{
   await step('visible readiness',ms=>element.waitForElementState('visible',{timeout:ms}));
   await step('enabled readiness',ms=>element.waitForElementState('enabled',{timeout:ms}));
  }finally{audit.readinessMs=now()-readinessStarted;}
  // Check disabled/animation state before a potentially necessary native scroll.
  await step('eligibility',()=>session.evaluate(value=>value.inspect({geometry:false})));
  const first=await step('first target proof',()=>targetProof(element,'native-command-'+identity.command));
  audit.before=await step('first guard',()=>session.evaluate((value,rect)=>value.inspect({rect}),first.rect));
  const point={x:first.rect.left+first.rect.width/2,y:first.rect.top+first.rect.height/2};
  const hoverStarted=now();await step('hover',()=>caseLifecycle
   ?caseLifecycle.issue('command mouse.move '+identity.command,()=>page.mouse.move(point.x,point.y))
   :page.mouse.move(point.x,point.y));audit.hoverMs=now()-hoverStarted;
  // Reject movement before targetProof's scroll helper can compensate for it.
  await step('hover guard',()=>session.evaluate((value,rect)=>value.inspect({rect}),first.rect));
  const second=await step('second target proof',()=>targetProof(element,'native-command-'+identity.command+'-after-hover'));
  assert.deepEqual(second.rect,first.rect,'The same button must keep its rectangle after native hover');
  audit.after=await step('arm',()=>session.evaluate((value,rect)=>value.arm(rect),first.rect));
  audit.preflightMs=now()-started;
  const dispatchStarted=now();
  try{await step('dispatch',()=>{
   const dispatch=at=>{audit.dispatchStartedAtNodeMs=at??null;audit.dispatchAttempted=true;return page.mouse.click(point.x,point.y,{button:'left',clickCount:1});};
   return caseLifecycle?caseLifecycle.issue('command mouse.click '+identity.command,dispatch):dispatch();
  });audit.dispatchFinishedAtNodeMs=caseLifecycle?.check()??null;}
  finally{audit.dispatchMs=now()-dispatchStarted;}
  audit.receipts=await step('receipts',()=>session.evaluate(value=>value.finish()));
  validateCadillacCommandReceipts(audit.receipts);
  caseLifecycle?.check();
  return true;
 }catch(caught){error=caught;if(audit){audit.error=String(caught.message||caught);audit.preflightMs??=now()-started;}throw caught;}
 finally{
  // A click can hide/remove the panel. Cleanup therefore never rechecks its
  // visibility and still removes capture listeners on every failure path.
  let timer;
  const cleanup=(async()=>{
   try{
    if(session){try{const result=await session.evaluate(value=>value?.dispose());if(audit&&!audit.receipts)audit.receipts=result;}
     finally{await session.dispose();}}
   }finally{await element?.dispose();}
  })();
  // Stop does not suppress disposal, but it cannot grant another action window
  // or hold failure collection open. A late cleanup may update only this local
  // audit; the final recorded copy below is immutable with respect to it.
  let cleanupMs=actionRemaining();
  if(caseLifecycle)try{cleanupMs=Math.min(cleanupMs,caseLifecycle.remaining());}catch{cleanupMs=0;}
  try{
   await Promise.race([cleanup,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native command cleanup exceeded its action deadline')),cleanupMs);})]);
   if(!error&&audit){
    if(actionRemaining()<=0)throw Error('Native command cleanup exceeded its action deadline');
    audit.acceptedAtNodeMs=caseLifecycle?.check()??null;audit.accepted=true;
   }
  }
  catch(caught){if(audit)audit.cleanupError=String(caught.message||caught);if(!error)throw caught;}
  finally{clearTimeout(timer);if(audit){audit.totalMs=now()-started;record(structuredClone(audit));}}
 }
}
