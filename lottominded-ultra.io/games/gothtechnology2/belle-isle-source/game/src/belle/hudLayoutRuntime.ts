import {clone,profileOf,contains,layoutProblems,normalizedPosition,placementRect,type ControlId,type HudLayout,type Rect,type HudMode} from './hudLayoutModel.ts';
import {availableHudStorage,loadHudArchive,saveHudArchive,legacyHudPreferences} from './hudLayoutStore.ts';
import {mountHudLayoutEditor,type HudEditScope} from './hudLayoutEditor.ts';
import {backgroundTouchRole,customMovementZone,TouchOwnership,type TouchRole} from './touchZones.ts';
type Spec={id:ControlId;selector:string;label:string;kind:'button'|'stick'|'group'|'info';essential:boolean};
type Binding={element:HTMLElement;spec:Spec;width:number;height:number};
type Scope=HudEditScope&{root:HTMLElement;bindings:Binding[];layout:HudLayout};
const spec=(id:ControlId,selector:string,label:string,kind:Spec['kind']='button',essential=true):Spec=>({id,selector,label,kind,essential});
const COMMON=[spec('view','#view','Camera'),spec('pause','#pause','Pause'),spec('tools','#tools-toggle','Tools'),spec('map','#navigation','Map','group',false),spec('location','.location-chip','Location','info',false),spec('radio','#ride-radio','Radio','group',false),spec('trial','#trial-hud','Race status','group',true)];
const WHEEL=[spec('stick','#stick','Move','stick'),spec('brake','#brake','Brake / stop'),spec('hop','#hop','Hop'),spec('mount','#mount','Ride / walk'),spec('recover','#recover','Recover / restart'),spec('sprint','#sprint','Sprint','button',false),spec('speed','.speed-readout','Speed','info',false)];
const HOVER=[spec('hover-stick','#hover-flight-stick','Flight movement','stick'),spec('hover-brake','.hover-pedals [data-hold="Space"]','Brake'),spec('hover-up','.hover-lift [data-hold="KeyE"]','Ascend'),spec('hover-down','.hover-lift [data-hold="KeyQ"]','Descend'),spec('hover-takeoff','[data-hover="takeoff"]','Takeoff / land'),spec('hover-exit','[data-hover="exit"]','Dismount'),spec('hover-recover','[data-hover="reset"]','Recover / restart'),spec('hover-boost','#hover-boost','Boost'),spec('hover-lights','[data-hover="lights"]','Lights','button',false),spec('hover-sound','[data-hover="sound"]','Sound','button',false),spec('hover-instruments','.hover-instruments','Flight instruments','info',true),spec('hover-options','.hover-lighting','Flight options','group',false),spec('hover-cruise','.hover-cruise','Cruise','group',false),spec('jarvs','#jarvs-avionics','JARVS status','info',true)];
const COOP=[spec('coop-stick','.coop-touch-stick','Move','stick'),spec('coop-camera','.coop-player-actions button:nth-child(1)','Camera'),spec('coop-recover','.coop-player-actions button:nth-child(2)','Recover'),spec('coop-join','.coop-player-actions button:nth-child(3)','Join partner','button',false),spec('coop-mount','.coop-player-actions button:nth-child(4)','Ride / walk'),spec('coop-hop','.coop-touch-hop','Hop / takeoff'),spec('coop-brake','.coop-touch-brake','Brake'),spec('coop-up','.coop-lift button:nth-child(1)','Ascend'),spec('coop-down','.coop-lift button:nth-child(2)','Descend'),spec('coop-drive','.coop-drive','Drive controls','group',false),spec('coop-info','.coop-player-status','Player status','info',false)];
const PROPS=['--hud-x','--hud-y','--hud-width','--hud-height','--hud-scale','--hud-alpha'];
const q=<E extends HTMLElement=HTMLElement>(s:string,root:ParentNode=document)=>root.querySelector<E>(s);
const rect=(r:DOMRect):Rect=>({left:r.left,top:r.top,width:r.width,height:r.height});
const visible=(e:HTMLElement)=>!e.closest('[hidden]')&&getComputedStyle(e).display!=='none'&&e.getClientRects().length>0;
/** Adapter only. Existing movement, hover and co-op owners still deliver every simulation input. */
export function installHudCustomization(hooks:{clear:()=>void}){
 const storage=availableHudStorage(),loaded=loadHudArchive(storage),legacy=legacyHudPreferences(storage);let archive=loaded.archive;
 const owner=new TouchOwnership(),managed=new Set<HTMLElement>(),zones=new Set<HTMLElement>(),staleKeys=new Set<string>(),downKeys=new Set<string>(),suppressedClicks=new Set<number>();
 const probe=document.createElement('div');probe.className='belle-hud-safe-probe';probe.setAttribute('aria-hidden','true');document.body.append(probe);
 const notice=document.createElement('output');notice.className='belle-hud-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');document.body.append(notice);
 let noticeTimer:ReturnType<typeof setTimeout>|undefined,frame=0,disposed=false,onFoot=false,scopes:Scope[]=[],signature='',pauseRestore:HTMLButtonElement|undefined,returnDialog:HTMLDialogElement|undefined,returnFocus:HTMLElement|undefined,lastFallback='';
 const rememberSuppressed=(id:number)=>{suppressedClicks.add(id);if(suppressedClicks.size>128)suppressedClicks.delete(suppressedClicks.values().next().value!);};
 const announce=(message:string)=>{notice.textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.textContent='',6500);};
 const neutralize=()=>{for(const key of downKeys)staleKeys.add(key);owner.invalidate();};
 const clear=()=>{neutralize();hooks.clear();};
 const signatureNow=()=>{const b=document.body;return [b.classList.contains('on-hoverbike'),b.classList.contains('coop-playing'),b.classList.contains('touch-controls'),b.classList.contains('at-start'),b.classList.contains('island-trial'),onFoot,...Array.from(document.querySelectorAll<HTMLElement>('.coop-player-pane'),p=>`${p.dataset.seat}/${p.dataset.vehicle}/${Number(p.dataset.footBlend??0)>.5}/${p.style.left}/${p.style.top}/${p.style.width}/${p.style.height}`)].join('|');};
 function safeView(root?:HTMLElement):Rect{
  const p=getComputedStyle(probe),vv=window.visualViewport,left=(vv?.offsetLeft??0)+(parseFloat(p.paddingLeft)||0)+8,top=(vv?.offsetTop??0)+(parseFloat(p.paddingTop)||0)+8,right=(vv?.offsetLeft??0)+(vv?.width??innerWidth)-(parseFloat(p.paddingRight)||0)-8,bottom=(vv?.offsetTop??0)+(vv?.height??innerHeight)-(parseFloat(p.paddingBottom)||0)-8;
  if(!root)return {left,top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
  const r=root.getBoundingClientRect(),toolbar=q('.coop-session-toolbar'),bar=toolbar?.getBoundingClientRect();const x=Math.max(left,r.left+6),y=Math.max(top,r.top+6,bar&&bar.bottom>r.top&&bar.top<r.bottom?bar.bottom+4:0),xr=Math.min(right,r.right-6),yb=Math.min(bottom,r.bottom-6);
  return {left:x,top:y,width:Math.max(0,xr-x),height:Math.max(0,yb-y)};
 }
 function resetStyles(){
  for(const e of managed){e.classList.remove('belle-hud-control');for(const prop of PROPS)e.style.removeProperty(prop);delete e.dataset.hudBox;delete e.dataset.hudStick;delete e.dataset.hudUserHidden;delete e.dataset.hudControl;}
  managed.clear();for(const e of zones){delete e.dataset.hudMoveZone;delete e.dataset.hudLookZone;for(const prop of ['--hud-zone-left','--hud-zone-top','--hud-zone-width','--hud-zone-height','--hud-look-left','--hud-look-width'])e.style.removeProperty(prop);}zones.clear();
 }
 function makeScope(root:HTMLElement,key:string,label:string,specs:Spec[],view:Rect):Scope{
  const bindings:Binding[]=[],controls:HudEditScope['controls']=[],baseline:HudLayout={handedness:'right',centerGuardFraction:.08,controls:{}};
  for(const s of specs){const e=q(s.selector,root);if(!e||e.closest('dialog')||!visible(e))continue;const r=rect(e.getBoundingClientRect());if(r.width<=0||r.height<=0)continue;
   // Closed details are measured as their summary; no hidden menu item is manufactured.
   const interactive=s.kind!=='info',minScale=s.kind==='group'?1:interactive?Math.max(44/r.width,44/r.height):.5;
   bindings.push({element:e,spec:s,width:r.width,height:r.height});controls.push({id:s.id,label:s.label,width:r.width,height:r.height,interactive,essential:s.essential,minScale});
   baseline.controls[s.id]={...normalizedPosition(r,view),scale:1,opacity:legacy.opacity,hidden:false};
  }
  const stored=profileOf(archive).layouts[key],layout=stored?{...clone(baseline),...clone(stored),controls:{...clone(baseline.controls),...clone(stored.controls)}}:clone(baseline);
  return {root,key,label,view,bindings,baseline,controls,layout};
 }
 function collect():Scope[]{
  resetStyles();const result:Scope[]=[];
  if(document.body.classList.contains('coop-playing')){
   const panes=Array.from(document.querySelectorAll<HTMLElement>('.coop-player-pane')),split=q('#coop-overlay')?.dataset.layout==='vertical'?'vertical':'horizontal';
   for(const pane of panes){const mode:HudMode=Number(pane.dataset.footBlend??0)>.5?'foot':pane.dataset.vehicle==='hoverbike'?'hover':'euc',view=safeView(pane),orientation=view.width>=view.height?'landscape':'portrait',seat=Number(pane.dataset.seat)+1;
    result.push(makeScope(pane,`coop-${panes.length}-${split}-p${seat}:${mode}:${orientation}`,`Player ${seat} · ${mode} · ${orientation}`,COOP.filter(s=>mode==='hover'||!['coop-up','coop-down','coop-drive'].includes(s.id)),view));
   }
  }else if(!document.body.classList.contains('at-start')){
   const mode:HudMode=document.body.classList.contains('on-hoverbike')?'hover':onFoot?'foot':'euc',view=safeView(),orientation=view.width>=view.height?'landscape':'portrait';
   result.push(makeScope(document.body,`solo:${mode}:${orientation}`,`Solo · ${mode} · ${orientation}`,[...COMMON,...(mode==='hover'?HOVER:WHEEL.filter(s=>mode==='foot'||s.id!=='sprint'))],view));
  }
  return result.filter(s=>s.controls.length&&s.view.width>0&&s.view.height>0);
 }
 function configureZones(s:Scope,customApplied:boolean){
  const l=s.layout,right=l.handedness==='left',width=s.view.width*(1-l.centerGuardFraction)/2;
  if(s.key.startsWith('solo:')){
   // Unedited and fallback layouts retain the authored responsive hit surfaces.
   // Moving their parent shifts a fixed stick and can steal flight/radio targets.
   const hover=s.key.includes(':hover:'),zone=q(hover?'#hover-move-zone':'#touch-zone'),stick=q(hover?'#hover-flight-stick':'#stick');
   const fixed=document.body.dataset.joystickMode==='fixed';
   const area=customMovementZone(customApplied,s.view,l.handedness,l.centerGuardFraction,fixed&&stick?rect(stick.getBoundingClientRect()):undefined,fixed);
   if(zone&&area){zones.add(zone);zone.dataset.hudMoveZone='true';zone.style.setProperty('--hud-zone-left',area.left+'px');zone.style.setProperty('--hud-zone-top',area.top+'px');zone.style.setProperty('--hud-zone-width',area.width+'px');zone.style.setProperty('--hud-zone-height',area.height+'px');}
  }else{
   const look=q('.coop-look',s.root);if(look){const r=s.root.getBoundingClientRect(),lookLeft=s.view.left+(right?0:s.view.width-width);zones.add(look);look.dataset.hudLookZone='true';look.style.setProperty('--hud-look-left',lookLeft-r.left+'px');look.style.setProperty('--hud-look-width',width+'px');}
  }
 }
 function apply(){
  if(disposed||editor.isOpen)return;scopes=collect();signature=signatureNow();
  for(const s of scopes){const custom=profileOf(archive).layouts[s.key];let customApplied=false;
   if(custom){const issues=layoutProblems(s.layout,s.controls,s.view);if(issues.length){s.layout=clone(s.baseline);const warning=s.key+issues.join('|');if(warning!==lastFallback){lastFallback=warning;announce('Custom HUD does not fit this view. Built-in controls are in use; saved settings are unchanged. Open Customize HUD to adjust.');}}
    else{customApplied=true;for(const b of s.bindings){const p=s.layout.controls[b.spec.id];if(!p)continue;const r=placementRect(p,s.controls.find(g=>g.id===b.spec.id)!,s.view),e=b.element;managed.add(e);e.classList.add('belle-hud-control');e.dataset.hudControl=b.spec.id;e.dataset.hudBox=b.spec.kind;if(b.spec.kind==='stick')e.dataset.hudStick='true';if(p.hidden&&!b.spec.essential)e.dataset.hudUserHidden='true';for(const [name,value]of Object.entries({'--hud-x':r.left+'px','--hud-y':r.top+'px','--hud-width':b.width+'px','--hud-height':b.height+'px','--hud-scale':String(p.scale),'--hud-alpha':String(p.opacity)}))e.style.setProperty(name,value);}}
   }
   configureZones(s,customApplied);
  }
  attachCoopButton();
 }
 const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(()=>{frame=0;apply();});};
 const begin=()=>{
  clear();returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:undefined;returnDialog=q<HTMLDialogElement>('dialog[open]:not(#belle-hud-editor)')??undefined;
  // Use the same public pause controls as a player. Never edit simulation clocks.
  const coop=document.body.classList.contains('coop-playing'),pause=q<HTMLButtonElement>(coop?'#coop-pause':'#pause');
  const wasPaused=coop?q('#coop-overlay')?.dataset.paused==='true':/resume/i.test(pause?.textContent??'');
  pauseRestore=!wasPaused?pause??undefined:undefined;if(pauseRestore)pauseRestore.click();
 };
 const finish=()=>{clear();if(pauseRestore?.isConnected){const coop=pauseRestore.id==='coop-pause',stillPaused=coop?q('#coop-overlay')?.dataset.paused==='true':/resume/i.test(pauseRestore.textContent??'');if(stillPaused)pauseRestore.click();}pauseRestore=undefined;schedule();if(returnDialog?.open)returnFocus?.focus();else q('#game')?.focus();returnDialog=undefined;};
 const editor=mountHudLayoutEditor({archive:()=>archive,scopes:()=>{if(disposed)return[];scopes=collect();const snapshot=scopes.map(s=>({key:s.key,label:s.label,view:s.view,baseline:s.baseline,controls:s.controls}));apply();return snapshot;},begin,finish,announce,save:value=>{const result=saveHudArchive(storage,value);archive=result.archive;lastFallback='';return result.notice;}});
 const settings=q('.mobile-settings')??q('#settings');const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.id='belle-hud-customize';settingsButton.className='belle-hud-settings-button';settingsButton.textContent='Customize HUD';settingsButton.onclick=()=>editor.open();settings?.append(settingsButton);
 let coopButton:HTMLButtonElement|undefined;
 function attachCoopButton(){const toolbar=q('.coop-session-toolbar');if(toolbar&&!coopButton?.isConnected){coopButton=document.createElement('button');coopButton.type='button';coopButton.id='coop-hud-customize';coopButton.className='belle-hud-settings-button';coopButton.textContent='HUD layout';coopButton.onclick=()=>editor.open();toolbar.append(coopButton);}}
 function scopeFor(target:HTMLElement):Scope|undefined{const pane=target.closest('.coop-player-pane');return pane?scopes.find(s=>s.root===pane):scopes.find(s=>s.key.startsWith('solo:'));}
 const consume=(e:Event)=>{if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();};
 function pointerDown(e:PointerEvent){
  if(e.pointerType==='mouse'||!(e.target instanceof Element))return;
  const target=e.target as HTMLElement;if(target.closest('dialog'))return;
  const s=scopeFor(target);if(!s)return;
  const action=target.closest<HTMLElement>('button,summary,input,select,a');
  const movement=target.closest('#touch-zone,#hover-move-zone,.coop-touch-stick'),look=target.id==='game'||!!target.closest('.coop-look');
  if(!action&&!movement&&!look)return;
  if(action?.closest('.coop-session-toolbar,.belle-comms'))return;
  suppressedClicks.delete(e.pointerId);
  let role:TouchRole=action?'action':movement?'move':'look';
  const blocked=editor.isOpen||!!document.querySelector('dialog[open]');
  if(blocked||(action instanceof HTMLButtonElement&&action.disabled))role='ignored';
  if(!action&&!blocked){const background=backgroundTouchRole(s.view,e.clientX,e.clientY,s.layout.handedness,s.layout.centerGuardFraction);
   if(movement){const fixed=document.body.dataset.joystickMode==='fixed'||s.key.startsWith('coop-');const stick=movement.matches('.coop-touch-stick')?movement:q(s.key.includes(':hover:')?'#hover-flight-stick':'#stick');
    // A moved fixed joystick has explicit control priority, even across the guard.
    if(fixed){if(!stick||!contains(rect(stick.getBoundingClientRect()),e.clientX,e.clientY))role='ignored';}
    else if(background!=='move')role='ignored';
   }else if(background!=='look')role='ignored';
  }
  // The co-op lift adapter is scalar: a second opposing contact must not release its owner.
  const actionId=action?.closest('.coop-lift')?'coop-lift':action?(action.id||action.getAttribute('data-hold')||action.getAttribute('aria-label')||action.textContent||'action'):undefined;
  const assigned=owner.begin(e.pointerId,s.key,role,actionId);if(assigned.role==='ignored'){rememberSuppressed(e.pointerId);consume(e);}
 }
 const pointerMove=(e:PointerEvent)=>{if(owner.get(e.pointerId)?.role==='ignored')consume(e);};
 const pointerEnd=(e:PointerEvent)=>{const o=owner.end(e.pointerId);if(o?.role==='ignored'){rememberSuppressed(e.pointerId);consume(e);}};
 const lostCapture=(e:PointerEvent)=>{const o=owner.get(e.pointerId);if(o?.role==='ignored'){consume(e);return;}if(o)owner.end(e.pointerId);};
 const click=(e:MouseEvent)=>{const id=(e as PointerEvent).pointerId;if(typeof id==='number'&&suppressedClicks.has(id)){suppressedClicks.delete(id);consume(e);}};
 const keyDown=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('dialog'))return;if(staleKeys.has(e.code)){consume(e);return;}downKeys.add(e.code);};
 const keyUp=(e:KeyboardEvent)=>{downKeys.delete(e.code);staleKeys.delete(e.code);};
 document.addEventListener('pointerdown',pointerDown,true);document.addEventListener('pointermove',pointerMove,true);document.addEventListener('pointerup',pointerEnd,true);document.addEventListener('pointercancel',pointerEnd,true);document.addEventListener('lostpointercapture',lostCapture,true);document.addEventListener('click',click,true);window.addEventListener('keydown',keyDown,true);window.addEventListener('keyup',keyUp,true);
 const resize=()=>{clear();schedule();};window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);window.visualViewport?.addEventListener('resize',resize);
 const blur=()=>clear();window.addEventListener('blur',blur);const visibility=()=>{if(document.hidden)clear();};document.addEventListener('visibilitychange',visibility);
 const modeChange=()=>{const next=signatureNow();if(next!==signature){clear();schedule();}};
 const modeObserver=new MutationObserver(modeChange);modeObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 const childObserver=new MutationObserver(()=>{attachCoopButton();watchPanes();schedule();});childObserver.observe(document.body,{childList:true});
 const paneObserver=new MutationObserver(()=>{watchPanes();modeChange();});const observed=new WeakSet<HTMLElement>();
 function watchPanes(){const overlay=q('#coop-overlay');if(overlay&&!observed.has(overlay)){observed.add(overlay);paneObserver.observe(overlay,{childList:true,attributes:true,attributeFilter:['data-layout','data-players']});}
  for(const p of document.querySelectorAll<HTMLElement>('.coop-player-pane'))if(!observed.has(p)){observed.add(p);paneObserver.observe(p,{attributes:true,attributeFilter:['data-vehicle','data-foot-blend','style']});}
 }
 const toggle=(e:Event)=>{if((e.target as HTMLElement)?.closest('#ride-radio,#navigation,#hover-hud,.coop-player-pane')){clear();schedule();}};document.addEventListener('toggle',toggle,true);
 const mapButton=q('#minimap-hide');mapButton?.addEventListener('click',resize);
 const controlsChanged=()=>{clear();schedule();};for(const id of ['touch','control-size','control-opacity','control-layout','joystick-mode','reset-mobile'])q('#'+id)?.addEventListener(id==='reset-mobile'?'click':'change',controlsChanged);
 watchPanes();schedule();if(loaded.notice)announce(loaded.notice);
 const dispose=()=>{if(disposed)return;disposed=true;editor.dispose();cancelAnimationFrame(frame);clearTimeout(noticeTimer);modeObserver.disconnect();childObserver.disconnect();paneObserver.disconnect();resetStyles();owner.clear();settingsButton.remove();coopButton?.remove();probe.remove();notice.remove();document.removeEventListener('pointerdown',pointerDown,true);document.removeEventListener('pointermove',pointerMove,true);document.removeEventListener('pointerup',pointerEnd,true);document.removeEventListener('pointercancel',pointerEnd,true);document.removeEventListener('lostpointercapture',lostCapture,true);document.removeEventListener('click',click,true);window.removeEventListener('keydown',keyDown,true);window.removeEventListener('keyup',keyUp,true);window.removeEventListener('resize',resize);document.removeEventListener('fullscreenchange',resize);window.visualViewport?.removeEventListener('resize',resize);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('toggle',toggle,true);mapButton?.removeEventListener('click',resize);for(const id of ['touch','control-size','control-opacity','control-layout','joystick-mode','reset-mobile'])q('#'+id)?.removeEventListener(id==='reset-mobile'?'click':'change',controlsChanged);};
 // pagehide invalidates held input but preserves bfcache listeners; page restore remains usable.
 window.addEventListener('pagehide',clear);
 return {neutralize,mode(value:boolean){if(value!==onFoot){onFoot=value;modeChange();}},refresh:controlsChanged,dispose(){window.removeEventListener('pagehide',clear);dispose();}};
}
