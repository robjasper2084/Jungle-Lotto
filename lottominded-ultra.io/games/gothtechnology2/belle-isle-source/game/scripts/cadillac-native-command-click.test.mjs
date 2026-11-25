import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {clickCadillacCommand,createCadillacCommandSession} from './cadillac-native-command-click.mjs';
import {createCadillacCaseLifecycle} from './cadillac-case-lifecycle.mjs';

const box=(left=100,top=100,width=160,height=48)=>({left,top,width,height,right:left+width,bottom:top+height});
const flush=async()=>{for(let index=0;index<80;index++)await Promise.resolve();};
function deferred(){let resolve;const promise=new Promise(ok=>{resolve=ok;});return{promise,resolve};}
// The actual serialized observer runs in a separate realm with these DOM
// contracts. These tests prove guard/lifetime logic, not native browser delivery.
function fixture(options={}){
 const calls=[],listeners=new Map(),audits=[],animationReads=[];
 const document={pointerLockElement:null};
 class Element{
  constructor(tag='div',{id='',text='',rect=box(0,0,1280,800)}={}){
   this.tagName=tag.toUpperCase();this.attrs=new Map();this.id=id;this.textContent=text;this.rect=rect;
   this.parentElement=null;this.children=[];this.ownerDocument=document;this.disabled=false;this.inert=false;this.animations=[];
   this.style={display:'block',visibility:'visible',pointerEvents:'auto',overflowX:'visible',overflowY:'visible'};
   this.offsetWidth=rect.width;this.offsetHeight=rect.height;this.clientWidth=rect.width;this.clientHeight=rect.height;this.clientLeft=0;this.clientTop=0;
  }
  get id(){return this.getAttribute('id')||'';}set id(value){this.attrs.set('id',value);}
  get isConnected(){return this===document.documentElement||!!this.parentElement?.isConnected;}
  getAttribute(name){return this.attrs.get(name)??null;}hasAttribute(name){return this.attrs.has(name);}
  setAttribute(name,value){this.attrs.set(name,String(value));}removeAttribute(name){this.attrs.delete(name);}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement){const siblings=this.parentElement.children;siblings.splice(siblings.indexOf(this),1);this.parentElement=null;}}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  matches(selector){
   if(selector===':disabled')return this.disabled||this.ancestors().some(node=>node.tagName==='FIELDSET'&&node.disabled);
   return selector.split(',').some(part=>part.startsWith('#')?this.id===part.slice(1):this.tagName===part.toUpperCase());
  }
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  ancestors(){const result=[];for(let node=this.parentElement;node;node=node.parentElement)result.push(node);return result;}
  getBoundingClientRect(){return{...this.rect};}
  getAnimations({subtree=false}={}){
   animationReads.push({node:this,subtree});
   const collect=node=>[...node.animations,...node.children.flatMap(collect)];
   return subtree?collect(this):[...this.animations];
  }
 }
 class HTMLButtonElement extends Element{
  constructor(values){super('button',values);this.setAttribute('type','button');}
 }
 const html=document.documentElement=new Element('html'),body=new Element('body');html.append(body);
 const root=new Element('section',{id:options.root??'hydraulic-controls'}),container=new Element('div');body.append(root);root.append(container);
 const button=options.nonButton?new Element(options.nonButton,{id:options.id??'',text:options.label??'Front up',rect:box()}):
  new HTMLButtonElement({id:options.id??(root.id==='hydraulic-controls'?'hydraulic-front-up':''),text:options.label??'Front up',rect:box()});
 if(options.hop)button.setAttribute('data-cadillac-hop',options.hop);
 container.append(button);
 const child=new Element('span');button.append(child);
 document.querySelectorAll=selector=>{
  const all=node=>[node,...node.children.flatMap(all)];return all(html).filter(node=>node.matches(selector));
 };
 document.querySelector=selector=>document.querySelectorAll(selector)[0]??null;
 document.elementFromPoint=(x,y)=>f.hit?f.hit(x,y):button;
 document.addEventListener=(type,handler,config)=>{assert.equal(config.capture,true);assert.equal(config.passive,true);(listeners.get(type)??listeners.set(type,new Set()).get(type)).add(handler);};
 document.removeEventListener=(type,handler,capture)=>{assert.equal(capture,true);listeners.get(type)?.delete(handler);};
 let clock=0;
 const context=createContext({document,HTMLButtonElement,Element,getComputedStyle:node=>node.style,innerWidth:1280,innerHeight:800,performance:{now:()=>++clock},__element:button});
 const f={calls,listeners,audits,animationReads,document,root,container,button,child,body,Element,HTMLButtonElement,
  now:()=>clock,advance:ms=>{clock+=ms;},session:null,sessionDisposed:false,elementDisposed:false,
  listenerCount:()=>[...listeners.values()].reduce((sum,set)=>sum+set.size,0),
  createSession:()=>runInContext('('+createCadillacCommandSession.toString()+')(__element)',context),
  emit(type,extra={}){
   const target=extra.target??child;
   const event={type,isTrusted:true,pointerType:'mouse',pointerId:0,isPrimary:type!=='click',button:0,buttons:type==='pointerdown'?1:0,
    detail:type==='click'?1:0,clientX:button.rect.left+button.rect.width/2,clientY:button.rect.top+button.rect.height/2,
    target,composedPath:()=>[target,...target.ancestors(),document],...extra};
   for(const listener of listeners.get(type)??[])listener(event);
  }
 };
 const elementHandle={
  node:button,
  async waitForElementState(state,{timeout}){
   assert(['visible','enabled'].includes(state),'Readiness must not add a stable-rectangle wait');
   assert(timeout>0&&timeout<=90000);calls.push(['readiness',state,timeout]);
   await f.onReadiness?.(state,timeout,button);
   if(!button.isConnected)throw Error('Retained button detached during readiness');
   const ancestry=[button,...button.ancestors()];
   if(state==='visible'&&ancestry.some(node=>node.style.display==='none'||['hidden','collapse'].includes(node.style.visibility)))throw Error('Retained button remained hidden');
   if(state==='enabled'&&(button.matches(':disabled')||ancestry.some(node=>node.getAttribute('aria-disabled')==='true')))throw Error('Retained button remained disabled');
  },
  async evaluateHandle(fn){
   calls.push('identify');assert.equal(fn,createCadillacCommandSession);f.session=f.createSession();
   return{
    async evaluate(callback,arg){return structuredClone(await callback(f.session,arg));},
    async dispose(){f.sessionDisposed=true;calls.push('dispose-session');}
   };
  },
  async dispose(){f.elementDisposed=true;calls.push('dispose-element');}
 };
 const locator={async elementHandle({timeout}){assert(timeout>0&&timeout<=90000);calls.push('resolve');return elementHandle;}};
 const page={mouse:{
  async move(x,y){calls.push(['move',x,y]);await f.onHover?.();},
  async click(x,y,config){
   calls.push(['click',x,y,config]);assert.deepEqual(config,{button:'left',clickCount:1});
   if(f.dispatch)await f.dispatch();
   else{for(const type of ['pointerdown','pointerup','click'])f.emit(type);await f.onClick?.();}
  }
 }};
 const targetProof=async(handle,label,...rest)=>{
  assert.equal(handle,elementHandle,'Both proofs retain the original actual element');assert.deepEqual(rest,[],'No owner-selector shortcut is allowed');
  calls.push(['proof',label]);const rect={...button.rect};await f.onProof?.(calls.filter(call=>call[0]==='proof').length);return{rect};
 };
 f.run=(extra={})=>clickCadillacCommand({page,locator,targetProof,record:audit=>audits.push(audit),now:f.now,...extra});
 return f;
}
function cleaned(f){assert.equal(f.listenerCount(),0);assert.equal(f.sessionDisposed,true);assert.equal(f.elementDisposed,true);}
const clicks=f=>f.calls.filter(call=>call[0]==='click');
function caseClock(f,timeout=100000){
 let expire;
 const lifecycle=createCadillacCaseLifecycle({timeout,now:f.now,setTimer:callback=>{expire=callback;return 1;},clearTimer:()=>{}});
 return{lifecycle,expire:()=>{f.advance(timeout);expire();}};
}

test('only the 17 actual command buttons enter the scoped native path',()=>{
 const detailed=[['Lower'],['Stock height'],['Raise'],['Level corners'],['Full-car hop','all'],['Front hop','front'],['Rear hop','rear'],['Finish motion & level']];
 for(const [label,hop]of detailed)assert(fixture({root:'cadillac-modifications',label,hop}).createSession());
 const hydraulic=[['front-up','Front up'],['back-up','Back up'],['pancake','Pancake'],['settle','Finish & level'],['exit','Exit mode'],
  ['hop-all','Full hop'],['hop-front','Front hop'],['hop-rear','Rear hop'],['inside-exit','Exit mode']];
 for(const [id,label]of hydraulic)assert(fixture({id:'hydraulic-'+id,label}).createSession());
 for(const options of [{id:'hydraulic-mode-toggle',label:'Hydraulic mode'},{root:'hydraulic-mode-entry'},
  {root:'cadillac-modifications',label:'Full-car hop',hop:'rear'},
  {root:'cadillac-modifications',label:'Raise',id:'replacement-command'},
  {root:'cadillac-modifications',label:'Raise',nonButton:'summary'},
  {id:'hydraulic-front-up',label:'Unrecognized command'},{root:'ride-menu'}])assert.equal(fixture(options).createSession(),null);
 const submit=fixture();submit.button.setAttribute('type','submit');assert.equal(submit.createSession(),null);
});

test('out-of-scope controls leave native dispatch and receipts untouched',async()=>{
 const f=fixture({id:'hydraulic-mode-toggle'});assert.equal(await f.run(),false);cleaned(f);
 assert.equal(clicks(f).length,0);assert.equal(f.audits.length,0);assert.equal(f.calls.filter(call=>call[0]==='proof').length,0);
});

test('native hover, both actual-button proofs and one primary-left sequence pass even when click hides the panel',async()=>{
 const f=fixture();f.onClick=()=>f.root.remove();assert.equal(await f.run(),true);cleaned(f);
 assert.equal(clicks(f).length,1);assert.equal(f.calls.filter(call=>call[0]==='proof').length,2);
 assert.equal(f.audits[0].receipts.totalEvents,3);assert.equal(f.audits[0].receipts.receipts[2].isPrimary,false);
 assert.equal(f.audits[0].receipts.receipts[0].pointerId,0);
 assert.equal(f.audits[0].dispatchAttempted,true);assert.equal(f.audits[0].error,null);
 for(const metric of ['readinessMs','preflightMs','hoverMs','dispatchMs','totalMs'])assert(Number.isFinite(f.audits[0][metric])&&f.audits[0][metric]>=0);
});

test('transient hidden and disabled states wait on the same retained button before either geometry proof',async()=>{
 const f=fixture(),visible=deferred(),enabled=deferred();f.root.style.display='none';f.button.disabled=true;
 f.onReadiness=(state,timeout,node)=>{assert.equal(node,f.button);return state==='visible'?visible.promise:enabled.promise;};
 const running=f.run();await flush();
 assert.deepEqual(f.calls.filter(call=>call[0]==='readiness').map(call=>call[1]),['visible']);
 assert.equal(clicks(f).length,0);assert.equal(f.calls.filter(call=>call[0]==='proof').length,0);
 f.advance(100);f.root.style.display='block';visible.resolve();await flush();
 assert.deepEqual(f.calls.filter(call=>call[0]==='readiness').map(call=>call[1]),['visible','enabled']);
 assert.equal(clicks(f).length,0);assert.equal(f.calls.filter(call=>call[0]==='proof').length,0);
 f.advance(200);f.button.disabled=false;enabled.resolve();assert.equal(await running,true);cleaned(f);
 assert.equal(f.calls.filter(call=>call==='resolve').length,1);assert.equal(clicks(f).length,1);
 assert.equal(f.audits[0].readinessMs,300);assert.equal(f.audits[0].receipts.totalEvents,3);
});

test('readiness consumes the original single budget instead of granting each element-state wait 90 seconds',async()=>{
 const f=fixture();f.onReadiness=state=>f.advance(state==='visible'?30000:20000);
 assert.equal(await f.run(),true);cleaned(f);
 assert.deepEqual(f.calls.filter(call=>call[0]==='readiness').map(call=>[call[1],call[2]]),[['visible',90000],['enabled',60000]]);
 assert.equal(f.audits[0].readinessMs,50000);assert.equal(clicks(f).length,1);
});

test('hidden or disabled readiness can exhaust its budget; later readiness cannot continue into proof or native input',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const state of ['visible','enabled']){
  const f=fixture(),ready=deferred();
  if(state==='visible')f.root.style.display='none';else f.button.disabled=true;
  f.onReadiness=current=>current===state?ready.promise:undefined;
  const running=f.run({timeout:25});await flush();
  f.advance(25);t.mock.timers.tick(25);await assert.rejects(running,new RegExp(state+' readiness.*deadline'));cleaned(f);
  assert.equal(f.audits[0].dispatchAttempted,false);assert.equal(f.audits[0].readinessMs,25);
  f.root.style.display='block';f.button.disabled=false;ready.resolve();await flush();
  assert.equal(clicks(f).length,0);assert.equal(f.calls.filter(call=>call[0]==='move'||call[0]==='proof').length,0);
  assert.equal(f.calls.filter(call=>call==='resolve').length,1);
 }
});

test('a detached or replaced button/root during readiness never retargets to another command',async()=>{
 const mutations=[
  f=>f.button.remove(),
  f=>{const replacement=new f.HTMLButtonElement({id:f.button.id,text:f.button.textContent,rect:box()});f.button.remove();f.container.append(replacement);},
  f=>{f.root.id='old-command-root';const replacement=new f.Element('section',{id:'hydraulic-controls'});f.body.append(replacement);replacement.append(f.button);},
  f=>{f.button.textContent='Back up';},
 ];
 for(const mutate of mutations){
  const f=fixture(),ready=deferred();f.onReadiness=state=>state==='enabled'?ready.promise:undefined;
  const running=f.run();await flush();mutate(f);ready.resolve();await assert.rejects(running,/detached|identity changed/);cleaned(f);
  assert.equal(f.calls.filter(call=>call==='resolve').length,1);assert.equal(clicks(f).length,0);
  assert.equal(f.calls.filter(call=>call[0]==='move'||call[0]==='proof').length,0);assert.equal(f.audits[0].dispatchAttempted,false);
 }
});

test('an enabled result after the deadline cannot proceed to strict proof or dispatch',async()=>{
 const f=fixture();f.onReadiness=state=>{if(state==='enabled')f.advance(90001);};
 await assert.rejects(f.run(),/deadline/);cleaned(f);assert.equal(clicks(f).length,0);
 assert.equal(f.calls.filter(call=>call[0]==='move'||call[0]==='proof').length,0);assert.equal(f.audits[0].dispatchAttempted,false);
});

test('readiness does not relax disabled-fieldset, inert or post-readiness state guards',async()=>{
 const f=fixture();f.container.tagName='FIELDSET';f.container.disabled=true;
 f.onReadiness=state=>{if(state==='enabled'){f.container.disabled=false;f.root.inert=true;}};
 await assert.rejects(f.run(),/inert/);cleaned(f);assert.equal(clicks(f).length,0);
 const g=fixture();g.onProof=count=>{if(count===1)g.container.tagName='FIELDSET',g.container.disabled=true;};
 await assert.rejects(g.run(),/disabled/);cleaned(g);assert.equal(clicks(g).length,0);
});

test('an already issued native click that times out is never retried after its late completion',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(),delivery=deferred();f.dispatch=async()=>{f.emit('pointerdown');await delivery.promise;f.emit('pointerup');f.emit('click');};
 const running=f.run({timeout:25});await flush();assert.equal(clicks(f).length,1);
 f.advance(25);t.mock.timers.tick(25);await assert.rejects(running,/dispatch.*deadline/);cleaned(f);
 assert.equal(f.audits[0].dispatchAttempted,true);assert.equal(f.audits[0].receipts.totalEvents,1);
 delivery.resolve();await flush();assert.equal(clicks(f).length,1);assert.equal(f.audits[0].receipts.totalEvents,1);
});

test('a moving hydraulic simulation and unrelated body descendant animation do not invalidate a static command',async()=>{
 const f=fixture();f.root.setAttribute('data-motion','moving');
 const other=new f.Element();other.animations=[{playState:'running'}];f.body.append(other);
 assert.equal(await f.run(),true);cleaned(f);
 assert(f.animationReads.filter(read=>read.node===f.body).every(read=>read.subtree===false));
 assert(f.animationReads.filter(read=>read.node===f.button).every(read=>read.subtree===true));
});

test('disabled button, disabled fieldset, inert ancestry, pointer lock and hidden controls fail before dispatch',async()=>{
 const mutations=[
  f=>{f.button.disabled=true;},f=>{f.container.tagName='FIELDSET';f.container.disabled=true;},
  f=>f.root.setAttribute('inert',''),f=>{f.document.pointerLockElement=f.body;},
  f=>{f.root.style.display='none';},f=>{f.button.style.pointerEvents='none';},f=>f.root.setAttribute('aria-disabled','true')
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);await assert.rejects(f.run());assert.equal(clicks(f).length,0);cleaned(f);}
});

test('active or pending animations on button, ancestors or descendants fail without dispatch',async()=>{
 for(const subject of ['button','root','child'])for(const animation of [{playState:'running'},{playState:'paused',pending:true}]){
  const f=fixture();f[subject].animations=[animation];await assert.rejects(f.run(),/animating/);assert.equal(clicks(f).length,0);cleaned(f);
 }
 const f=fixture();f.root.animations=[{playState:'finished'},{playState:'paused'}];assert.equal(await f.run(),true);cleaned(f);
});

test('a clipped two-pixel edge fails even though all five interior points hit the actual button',async()=>{
 const f=fixture();f.container.style.overflowX='hidden';f.container.rect=box(102,0,500,800);f.container.clientWidth=500;f.container.offsetWidth=500;
 await assert.rejects(f.run(),/clipped/);assert.equal(clicks(f).length,0);cleaned(f);
});

test('client borders and scaled scroll boxes are included in full-rectangle clipping',async()=>{
 const f=fixture();f.container.style.overflowX='auto';f.container.rect=box(96,0,500,800);f.container.offsetWidth=250;f.container.clientLeft=3;f.container.clientWidth=244;
 await assert.rejects(f.run(),/clipped/);assert.equal(clicks(f).length,0);cleaned(f);
});

test('undersized, outside-viewport and obscured sibling-owned hitpoints are rejected',async()=>{
 for(const mutate of [f=>{f.button.rect=box(100,100,160,43);},f=>{f.button.rect=box(-1,100);},
  f=>{const sibling=new f.HTMLButtonElement({text:'Back up'});f.container.append(sibling);f.hit=(x,y)=>x===140?sibling:f.button;}]){
  const f=fixture();mutate(f);await assert.rejects(f.run());assert.equal(clicks(f).length,0);cleaned(f);
 }
});

test('replacement, detached root, moving rectangle, disabled state and hover animation are rejected between proofs',async()=>{
 const mutations=[
  f=>{const replacement=new f.HTMLButtonElement({id:f.button.id,text:f.button.textContent,rect:box()});f.button.remove();f.container.append(replacement);},
  f=>{f.root.remove();},f=>{f.button.rect=box(101,100);},f=>{f.button.disabled=true;},
  f=>{f.child.animations=[{playState:'running'}];}
 ];
 for(const mutate of mutations){const f=fixture();f.onHover=()=>mutate(f);await assert.rejects(f.run());assert.equal(clicks(f).length,0);cleaned(f);}
});

test('the last arm guard rejects movement after the second recorded proof',async()=>{
 const f=fixture();f.onProof=count=>{if(count===2)f.button.rect=box(102,100);};
 await assert.rejects(f.run(),/moved/);assert.equal(clicks(f).length,0);cleaned(f);
});

test('duplicate root identity or a changed command label cannot reuse the retained element',async()=>{
 for(const mutate of [f=>f.body.append(new f.Element('section',{id:f.root.id})),f=>{f.button.textContent='Back up';}]){
  const f=fixture();f.onHover=()=>mutate(f);await assert.rejects(f.run(),/identity changed/);assert.equal(clicks(f).length,0);cleaned(f);
 }
});

test('untrusted, nonprimary, right-button, mismatched or invalid pointer receipts fail after exactly one dispatch',async()=>{
 const variants=[{at:'click',isTrusted:false},{at:'pointerdown',isPrimary:false},{at:'pointerup',isPrimary:false},
  {at:'click',button:2},{at:'pointerup',pointerId:4},{at:'click',pointerType:'touch'},{at:'pointerdown',pointerId:-1},
  {at:'pointerdown',buttons:3},{at:'pointerup',buttons:1},{at:'click',buttons:1},
  {at:'pointerdown',clientX:181},{at:'click',clientY:125}];
 for(const {at,...extra}of variants){
  const f=fixture();f.dispatch=()=>{for(const type of ['pointerdown','pointerup','click'])f.emit(type,type===at?extra:{});};
  await assert.rejects(f.run());assert.equal(clicks(f).length,1);cleaned(f);assert(f.audits[0].error);
 }
});

test('click coordinate flooring is accepted without weakening the down/up dispatch point',async()=>{
 const f=fixture();f.button.rect=box(100.25,100.75,160,48);
 f.dispatch=()=>{f.emit('pointerdown');f.emit('pointerup');f.emit('click',{clientX:180,clientY:124});};
 assert.equal(await f.run(),true);cleaned(f);
 assert.equal(f.audits[0].receipts.receipts[0].clientX,180.25);
});

test('wrong actual button/root, including a sibling in the approved root, fails the receipt proof',async()=>{
 for(const kind of ['sibling','root']){
  const f=fixture(),sibling=new f.HTMLButtonElement({id:'hydraulic-back-up',text:'Back up',rect:box()});f.container.append(sibling);
  f.dispatch=()=>{
   f.emit('pointerdown');
   if(kind==='root'){f.root.id='old-root';f.body.append(new f.Element('section',{id:'hydraulic-controls'}));}
   f.emit('pointerup',kind==='sibling'?{target:sibling}:{});f.emit('click');
  };
  await assert.rejects(f.run());assert.equal(clicks(f).length,1);cleaned(f);
 }
});

test('missing, reordered, duplicate and excess native receipts cannot pass or cause retries',async()=>{
 for(const types of [['pointerdown','click'],['pointerup','pointerdown','click'],['pointerdown','pointerup','click','click'],
  ['pointerdown','pointerup','click','click','click','click','click']]){
  const f=fixture();f.dispatch=()=>types.forEach(type=>f.emit(type));await assert.rejects(f.run());assert.equal(clicks(f).length,1);cleaned(f);
  assert.equal(f.audits[0].receipts.totalEvents,types.length);assert(f.audits[0].receipts.receipts.length<=6);
 }
});

test('a button that becomes unsafe between native down/up is recorded and rejected without interrupting events',async()=>{
 const f=fixture();f.dispatch=()=>{f.emit('pointerdown');f.root.inert=true;f.emit('pointerup');f.emit('click');};
 await assert.rejects(f.run(),/became unsafe/);assert.equal(clicks(f).length,1);cleaned(f);
 assert.equal(f.audits[0].receipts.totalEvents,3);
});

test('native transport failure cleans listeners/handles, retains partial receipts, and never falls back',async()=>{
 const f=fixture(),error=Error('native transport uncertain');f.dispatch=()=>{f.emit('pointerdown');throw error;};
 await assert.rejects(f.run(),caught=>caught===error);cleaned(f);assert.equal(clicks(f).length,1);
 assert.equal(f.audits[0].receipts.totalEvents,1);assert.equal(f.audits[0].dispatchAttempted,true);
});

test('cleanup failure is reported without masking the original native transport error',async()=>{
 const f=fixture(),error=Error('native dispatch failed');
 f.dispatch=()=>{
  const dispose=f.session.dispose;f.session.dispose=()=>{dispose();throw Error('observer cleanup failed');};throw error;
 };
 await assert.rejects(f.run(),caught=>caught===error);cleaned(f);assert.equal(clicks(f).length,1);
 assert.match(f.audits[0].cleanupError,/observer cleanup failed/);
});

test('cleanup failure also fails an otherwise accepted native command',async()=>{
 const f=fixture();f.onClick=()=>{const dispose=f.session.dispose;f.session.dispose=()=>{dispose();throw Error('observer cleanup failed');};};
 await assert.rejects(f.run(),/observer cleanup failed/);cleaned(f);assert.equal(clicks(f).length,1);
});

test('an expired preflight cannot proceed to hover or dispatch even when its read later finishes',async()=>{
 const f=fixture();let complete;
 f.onProof=()=>new Promise(resolve=>{complete=resolve;});
 await assert.rejects(f.run({timeout:10}),/deadline/);cleaned(f);complete();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(clicks(f).length,0);assert.equal(f.calls.filter(call=>call[0]==='move').length,0);
});

test('the single action budget is checked again before issuing native dispatch',async()=>{
 const f=fixture();f.onProof=count=>{if(count===2)f.advance(90001);};
 await assert.rejects(f.run(),/deadline/);cleaned(f);assert.equal(clicks(f).length,0);
});

test('observer disposal is idempotent and forbids a late arm',()=>{
 const f=fixture(),session=f.createSession();const proof=session.inspect();session.arm(proof.rect);assert.equal(f.listenerCount(),3);
 session.dispose();session.dispose();assert.equal(f.listenerCount(),0);assert.throws(()=>session.arm(proof.rect),/closed/);
});

test('the case deadline clips readiness and abandons late preflight before hover or click',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const stage of ['readiness','proof']){
  const f=fixture(),clock=caseClock(f,123),pending=deferred();
  if(stage==='readiness')f.onReadiness=()=>pending.promise;
  else f.onProof=()=>pending.promise;
  const running=f.run({caseLifecycle:clock.lifecycle});await flush();
  assert(f.calls.filter(call=>call[0]==='readiness').every(call=>call[2]===123));
  clock.expire();await assert.rejects(running,/case exceeded its deadline/);cleaned(f);
  pending.resolve();await flush();assert.equal(clicks(f).length,0);assert.equal(f.calls.filter(call=>call[0]==='move').length,0);
  assert.equal(f.audits[0].dispatchAttempted,false);assert.equal(f.audits[0].accepted,false);
 }
});

test('case stop during hover or the second proof never resumes into a native click',async()=>{
 for(const stage of ['hover','second proof']){
  const f=fixture(),clock=caseClock(f),pending=deferred();
  if(stage==='hover')f.onHover=()=>pending.promise;else f.onProof=count=>count===2?pending.promise:undefined;
  const running=f.run({caseLifecycle:clock.lifecycle});await flush();assert.equal(f.calls.filter(call=>call[0]==='move').length,1);
  clock.expire();await assert.rejects(running,/case exceeded its deadline/);cleaned(f);
  pending.resolve();await flush();assert.equal(clicks(f).length,0);assert.equal(f.audits[0].accepted,false);
 }
});

test('one Node clock associates native dispatch and accepted cleanup with the case interval',async()=>{
 const f=fixture(),clock=caseClock(f);f.onHover=()=>f.advance(5);
 assert.equal(await f.run({caseLifecycle:clock.lifecycle}),true);cleaned(f);
 const audit=f.audits[0],receipt=clock.lifecycle.snapshot().inputs.find(row=>row.label.startsWith('command mouse.click'));
 assert.equal(audit.startedAtNodeMs,0);assert.equal(audit.dispatchStartedAtNodeMs,5);assert.equal(audit.dispatchStartedAtNodeMs,receipt.issuedAtNodeMs);
 assert.equal(audit.dispatchFinishedAtNodeMs,8);assert.equal(audit.acceptedAtNodeMs,8);assert.equal(audit.accepted,true);
 clock.lifecycle.stop();
});

test('successful disposal crossing the local action deadline cannot beat its delayed timer into acceptance',async()=>{
 const f=fixture(),clock=caseClock(f);
 f.onClick=()=>{const dispose=f.session.dispose;f.session.dispose=()=>{f.advance(90000);return dispose();};};
 await assert.rejects(f.run({caseLifecycle:clock.lifecycle}),/cleanup exceeded its action deadline/);cleaned(f);
 assert.equal(clicks(f).length,1);assert.equal(f.audits[0].accepted,false);assert.equal(f.audits[0].acceptedAtNodeMs,null);
 assert.equal(clock.lifecycle.snapshot().state,'running','The original action ceiling expires before the case ceiling');clock.lifecycle.stop();
});

test('case stop after a click was issued retains its uncertainty without retry or accepted success',async()=>{
 const f=fixture(),clock=caseClock(f),pending=deferred(),issued=deferred();
 f.dispatch=async()=>{f.emit('pointerdown');issued.resolve();await pending.promise;f.emit('pointerup');f.emit('click');};
 const running=f.run({caseLifecycle:clock.lifecycle});await issued.promise;assert.equal(clicks(f).length,1);
 clock.expire();await assert.rejects(running,/case exceeded its deadline/);cleaned(f);
 const audit=f.audits[0];assert.equal(audit.dispatchAttempted,true);assert.equal(audit.dispatchStartedAtNodeMs,0);
 assert.equal(audit.dispatchFinishedAtNodeMs,null);assert.equal(audit.accepted,false);assert.equal(audit.acceptedAtNodeMs,null);
 assert.equal(audit.receipts.totalEvents,1);pending.resolve();await flush();assert.equal(clicks(f).length,1);
 assert.equal(audit.receipts.totalEvents,1);assert.equal(clock.lifecycle.snapshot().inputs.at(-1).outcome,'completed-after-stop');
});

test('late cleanup cannot mutate the recorded audit or fabricate observed receipts',async()=>{
 const f=fixture(),clock=caseClock(f),pending=deferred(),cleanup=deferred();
 f.onProof=count=>{if(count===1){const dispose=f.session.dispose;f.session.dispose=async()=>{await cleanup.promise;return dispose();};return pending.promise;}};
 const running=f.run({caseLifecycle:clock.lifecycle});await flush();clock.expire();await assert.rejects(running,/case exceeded its deadline/);
 assert.equal(f.audits.length,1);const saved=structuredClone(f.audits[0]);assert.equal(saved.receipts,null);assert.equal(saved.accepted,false);
 assert.match(saved.cleanupError,/cleanup exceeded/);cleanup.resolve();pending.resolve();await flush();cleaned(f);
 assert.deepEqual(f.audits[0],saved,'The recorded audit is a finalized clone, not the live cleanup object');assert.equal(clicks(f).length,0);
});

test('a handle resolving after case stop is disposed without advancing to identity or input',async()=>{
 const f=fixture(),clock=caseClock(f),pending=deferred();let disposed=0;
 const running=f.run({caseLifecycle:clock.lifecycle,locator:{elementHandle:()=>pending.promise}});await flush();clock.expire();
 await assert.rejects(running,/case exceeded its deadline/);pending.resolve({dispose:async()=>{disposed++;}});await flush();
 assert.equal(disposed,1);assert.equal(f.calls.includes('identify'),false);assert.equal(clicks(f).length,0);assert.equal(f.audits.length,0);
});

test('desktop tap adds only the guarded whitelist path while mobile keeps its native tap',async()=>{
 const source=await readFile(new URL('./cadillac-mods-browser-smoke.mjs',import.meta.url),'utf8');
 assert(source.includes('async function tap(locator){await nativeInput.tap(locator,mobile);caseLifecycle.publish(()=>report.harness.pointerActivations++);}'));
 const command=source.slice(source.indexOf('async function commandTap('),source.indexOf('async function diagnosticActivate('));
 assert.match(command,/if\(mobile\)return tap\(locator\);/);assert.match(command,/assert\(await clickCadillacCommand/);
 assert.match(command,/targetProof,caseLifecycle,record:/);
 assert.match(command,/report\.harness\.pointerActivations\+\+/);
 assert(!/catch|force|dispatchEvent|locator\.click/.test(command),'Recognized failure must not fall back to another input path');
 const routed=source.split('\n').filter(line=>line.includes('await commandTap('));assert(routed.length>10);
 for(const line of routed)assert(/commandTap\(modButton\(|commandTap\(page\.locator\('#hydraulic-(?:'\+pose|front-up'|hop-all'|settle'|pancake'|exit')/.test(line));
 for(const target of ['#view','#hydraulic-mode-toggle','#start'])assert(source.includes("await tap(page.locator('"+target+"'))"));
});

test('clipped dialog command centers actual button before any native mouse input and fully re-proves its new rectangle',async()=>{
 const f=fixture({root:'cadillac-modifications',id:'',label:'Lower'});
 f.container.style.overflowY='auto';f.container.rect=box(0,60,600,400);f.container.clientHeight=400;f.container.offsetHeight=400;
 f.button.rect=box(100,40,160,48);
 let scrolls=0;
 f.button.scrollIntoView=opts=>{
  scrolls++;assert.deepEqual({...opts},{behavior:'instant',block:'center',inline:'center'});
  f.button.rect=box(100,150,160,48);
 };
 assert.equal(await f.run(),true);
 assert.equal(scrolls,1);assert.equal(clicks(f).length,1);
 assert.equal(f.audits[0].clipAdjusted,true);
 assert.equal(f.calls.filter(entry=>entry[0]==='proof').length,3);
 assert.deepEqual(f.audits[0].before.rect,{left:100,top:150,right:260,bottom:198,width:160,height:48});
 cleaned(f);
});
test('unmovable clipped dialog button remains a fatal failure, with no native input or repeated click',async()=>{
 const f=fixture({root:'cadillac-modifications',id:'',label:'Lower'});
 f.container.style.overflowY='auto';f.container.rect=box(0,60,600,400);f.container.clientHeight=400;f.container.offsetHeight=400;
 f.button.rect=box(100,40,160,48);
 let scrolls=0;f.button.scrollIntoView=()=>{scrolls++;};
 await assert.rejects(f.run(),/clipped/);
 assert.equal(scrolls,1);assert.equal(clicks(f).length,0);
 assert.equal(f.audits[0].dispatchAttempted,false);cleaned(f);
});
