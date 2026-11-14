import {clone,profileOf,HudHistory,layoutProblems,placementRect,normalizedPosition,presetLayout,validateArchive,importArchive,MAX_IMPORT_BYTES,type HudArchive,type HudLayout,type ControlGeometry,type Rect,type ControlId} from './hudLayoutModel.ts';
import './hudLayoutEditor.css';
export type HudEditScope={key:string;label:string;view:Rect;baseline:HudLayout;controls:ControlGeometry[]};
export type EditorHooks={scopes:()=>HudEditScope[];archive:()=>HudArchive;begin:()=>void;finish:()=>void;save:(value:HudArchive)=>string;announce:(message:string)=>void};
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
export function mountHudLayoutEditor(hooks:EditorHooks){
 const dialog=element('dialog');dialog.id='belle-hud-editor';dialog.setAttribute('aria-labelledby','belle-hud-editor-title');
 const toolbar=element('header'),heading=element('h2','Customize HUD');heading.id='belle-hud-editor-title';
 const status=element('output');status.className='hud-editor-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const makeButton=(text:string,run:()=>void)=>{const b=element('button',text);b.type='button';b.onclick=run;return b;};
 let generation=0;
 let history=new HudHistory<HudArchive>(hooks.archive()),scopes:HudEditScope[]=[],scopeIndex=0,selected:ControlId|undefined,drag:{id:number;control:ControlId;startX:number;startY:number;rect:Rect;before:HudArchive;preview:HudArchive;viewScaleX:number;viewScaleY:number}|undefined;
 const content=element('div');content.className='hud-editor-content';const previewArea=element('section');previewArea.className='hud-editor-preview';
 const previewLabel=element('p','Layout preview only · editing never activates the game');previewLabel.className='hud-editor-preview-label';
 const stage=element('div');stage.className='hud-editor-stage';stage.setAttribute('aria-label','Control layout preview');
 const guard=element('div');guard.className='hud-editor-guard';guard.setAttribute('aria-hidden','true');stage.append(guard);previewArea.append(previewLabel,stage);
 const panel=element('section');panel.className='hud-editor-panel';panel.setAttribute('aria-label','Layout properties');
 const field=(label:string,input:HTMLElement)=>{const l=element('label'),s=element('span',label);l.append(s,input);panel.append(l);};
 const profiles=element('select');profiles.setAttribute('aria-label','Custom profile');field('Custom profile',profiles);
 const name=element('input');name.type='text';name.maxLength=40;name.setAttribute('aria-label','Profile name');field('Profile name',name);
 const scopeSelect=element('select');scopeSelect.setAttribute('aria-label','Player and mode');field('Player / current mode',scopeSelect);
 const controls=element('select');controls.setAttribute('aria-label','Select control');field('Select control',controls);
 const hint=element('p','Controls not available in the current game mode stay unavailable. Open this editor in each mode or orientation to save its arrangement.');hint.className='hud-editor-hint';panel.append(hint);
 const inputs={} as Record<'u'|'v'|'scale'|'opacity',HTMLInputElement>;
 for(const [key,label,min,max,step]of [['u','Horizontal position (%)',0,100,1],['v','Vertical position (%)',0,100,1],['scale','Size (%)',50,160,5],['opacity','Background opacity (%)',20,100,5]] as const){const input=element('input');input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label',label);inputs[key]=input;field(label,input);}
 const hidden=element('input');hidden.type='checkbox';field('Hide optional control (Reset restores it)',hidden);
 const hand=element('select');hand.append(new Option('Movement left / look right','right'),new Option('Movement right / look left','left'));hand.setAttribute('aria-label','Touch handedness');field('Touch regions',hand);
 const guardInput=element('input');guardInput.type='number';guardInput.min='0';guardInput.max='24';guardInput.step='2';guardInput.setAttribute('aria-label','Center guard percent');field('Center touch-start guard (%)',guardInput);
 const snap=element('input');snap.type='checkbox';snap.checked=true;field('Snap to 2% grid while dragging',snap);
 const presets=element('div');presets.className='hud-editor-button-row';
 for(const [title,kind]of [['Two-thumb','default'],['Left-handed','left'],['Compact','compact']]as const)presets.append(makeButton(title,()=>mutate(a=>{profileOf(a).layouts[current().key]=presetLayout(kind,current().baseline,current().controls);}))); 
 const undo=makeButton('Undo',()=>{history.undo();render();}),redo=makeButton('Redo',()=>{history.redo();render();});
 const resets=element('div');resets.className='hud-editor-button-row';resets.append(undo,redo,makeButton('Reset this view',()=>mutate(a=>{delete profileOf(a).layouts[current().key];})),makeButton('Reset profile',()=>mutate(a=>{profileOf(a).layouts={};})));
 const transfer=element('div');transfer.className='hud-editor-button-row';const file=element('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','Import HUD JSON');
 transfer.append(makeButton('Export JSON',()=>{
  try{const validated=validateArchive(history.value),url=URL.createObjectURL(new Blob([JSON.stringify(validated,null,2)],{type:'application/json'})),link=element('a');link.href=url;link.download='belle-isle-hud.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Exported the current draft. Save still controls which layout is applied.';}
  catch(error){showError(error);}
 }),makeButton('Import JSON',()=>file.click()),file);
 file.onchange=async()=>{const f=file.files?.[0],version=generation;file.value='';if(!f)return;try{if(f.size>MAX_IMPORT_BYTES)throw new Error('Choose a JSON file no larger than 128 KiB.');const imported=importArchive(await f.text());if(!dialog.open||version!==generation)return;history.replace(imported);render();status.textContent='Imported into the draft. Review and Save to apply.';}catch(error){if(dialog.open&&version===generation)showError(error);}};
 panel.append(presets,resets,transfer);const errors=element('p');errors.className='hud-editor-errors';errors.setAttribute('role','alert');panel.append(errors);
 const close=(saved=false)=>{if(!dialog.open)return;generation++;cancelDrag();dialog.close();hooks.finish();if(!saved)hooks.announce('HUD changes cancelled. Your previous layout is unchanged.');};
 const cancel=makeButton('Cancel',()=>close());const save=makeButton('Save layout',()=>{
  try{commitDrag();const all=scopes.flatMap(s=>layoutProblems(resolve(history.value,s),s.controls,s.view));if(all.length)throw new Error(all.join(' '));const message=hooks.save(validateArchive(history.value));close(true);hooks.announce(message);}catch(error){showError(error);}
 });save.className='hud-editor-save';save.id='belle-hud-save';cancel.id='belle-hud-cancel';toolbar.append(heading,cancel,save);content.append(previewArea,panel);dialog.append(toolbar,status,content);document.body.append(dialog);
 function current(){return scopes[scopeIndex];}
 function resolve(archive:HudArchive,s:HudEditScope):HudLayout{const saved=profileOf(archive).layouts[s.key];return saved?{...clone(s.baseline),...clone(saved),controls:{...clone(s.baseline.controls),...clone(saved.controls)}}:clone(s.baseline);}
 function ensure(a:HudArchive):HudLayout{return profileOf(a).layouts[current().key]??=(resolve(a,current()));}
 function mutate(change:(a:HudArchive)=>void){cancelDrag();const next=clone(history.value);change(next);history.replace(next);render();}
 function showError(error:unknown){errors.textContent=error instanceof Error?error.message:String(error);status.textContent='Not applied. Correct the highlighted layout or choose Reset.';}
 function cancelDrag(){if(!drag)return;const prior=drag;drag=undefined;try{if(stage.hasPointerCapture(prior.id))stage.releasePointerCapture(prior.id);}catch{}render();}
 function commitDrag(){if(!drag)return;const old=drag;drag=undefined;history.replace(old.preview);try{if(stage.hasPointerCapture(old.id))stage.releasePointerCapture(old.id);}catch{}render();}
 profiles.onchange=()=>mutate(a=>{a.active=profiles.value as HudArchive['active'];});name.onchange=()=>mutate(a=>{profileOf(a).name=name.value;});
 scopeSelect.onchange=()=>{cancelDrag();scopeIndex=Number(scopeSelect.value);selected=undefined;render();};controls.onchange=()=>{selected=controls.value as ControlId;render();};
 for(const key of ['u','v','scale','opacity']as const)inputs[key].onchange=()=>{if(!selected)return;const value=Number(inputs[key].value);if(!Number.isFinite(value)){render();return;}mutate(a=>{ensure(a).controls[selected!]![key]=value/100;});};
 hidden.onchange=()=>{if(selected)mutate(a=>{ensure(a).controls[selected!]!.hidden=hidden.checked;});};
 hand.onchange=()=>mutate(a=>{ensure(a).handedness=hand.value==='left'?'left':'right';});guardInput.onchange=()=>mutate(a=>{ensure(a).centerGuardFraction=Number(guardInput.value)/100;});
 stage.onpointerdown=e=>{const handle=(e.target as HTMLElement).closest<HTMLElement>('[data-hud-handle]');if(!handle||e.button!==0||drag)return;const id=handle.dataset.hudHandle as ControlId,g=current().controls.find(c=>c.id===id);if(!g)return;e.preventDefault();selected=id;const before=clone(history.value),layout=resolve(before,current()),r=placementRect(layout.controls[id]!,g,current().view),bounds=stage.getBoundingClientRect();drag={id:e.pointerId,control:id,startX:e.clientX,startY:e.clientY,rect:r,before,preview:clone(before),viewScaleX:current().view.width/bounds.width,viewScaleY:current().view.height/bounds.height};stage.setPointerCapture(e.pointerId);draw(drag.preview);};
 stage.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();const moved={...drag.rect,left:drag.rect.left+(e.clientX-drag.startX)*drag.viewScaleX,top:drag.rect.top+(e.clientY-drag.startY)*drag.viewScaleY};let {u,v}=normalizedPosition(moved,current().view);if(snap.checked){u=Math.round(u*50)/50;v=Math.round(v*50)/50;}const draft=clone(drag.before),l=ensure(draft);l.controls[drag.control]={...l.controls[drag.control]!,u,v};drag.preview=draft;draw(draft);};
 stage.onpointerup=e=>{if(e.pointerId===drag?.id)commitDrag();};stage.onpointercancel=e=>{if(e.pointerId===drag?.id)cancelDrag();};stage.onlostpointercapture=e=>{if(e.pointerId===drag?.id)cancelDrag();};
 stage.onkeydown=e=>{const handle=(e.target as HTMLElement).closest<HTMLElement>('[data-hud-handle]');if(!handle)return;selected=handle.dataset.hudHandle as ControlId;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const id=selected,delta=(e.shiftKey?5:1)/100;mutate(a=>{const p=ensure(a).controls[id]!;p.u=Math.max(0,Math.min(1,p.u+(e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0)));p.v=Math.max(0,Math.min(1,p.v+(e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0)));});stage.querySelector<HTMLElement>(`[data-hud-handle="${id}"]`)?.focus();}};
 function draw(archive:HudArchive){
  if(!current())return;const s=current(),layout=resolve(archive,s);stage.style.aspectRatio=`${s.view.width} / ${s.view.height}`;stage.style.setProperty('--hud-preview-ratio',String(s.view.width/s.view.height));
  guard.style.left=((1-layout.centerGuardFraction)/2*100)+'%';guard.style.width=(layout.centerGuardFraction*100)+'%';
  stage.querySelectorAll('[data-hud-handle]').forEach(e=>e.remove());
  for(const g of s.controls){const p=layout.controls[g.id];if(!p)continue;const r=placementRect(p,g,s.view),handle=element('button');handle.type='button';handle.dataset.hudHandle=g.id;handle.textContent=g.label+(p.hidden?' · hidden':'');handle.setAttribute('aria-label',`Select ${g.label}; use arrow keys to move`);handle.setAttribute('aria-pressed',String(selected===g.id));handle.className='hud-editor-handle'+(p.hidden?' hud-editor-handle-hidden':'');Object.assign(handle.style,{left:(r.left-s.view.left)/s.view.width*100+'%',top:(r.top-s.view.top)/s.view.height*100+'%',width:r.width/s.view.width*100+'%',height:r.height/s.view.height*100+'%'});handle.onclick=()=>{if(drag)return;selected=g.id;render();};stage.append(handle);}
  errors.textContent=layoutProblems(layout,s.controls,s.view).join(' ');
  save.disabled=!!errors.textContent||!!drag;
 }
 function render(){
  if(!current())return;const p=profileOf(history.value),s=current(),l=resolve(history.value,s);profiles.replaceChildren(...history.value.profiles.map(p=>new Option(p.name,p.id)));profiles.value=p.id;name.value=p.name;
  scopeSelect.replaceChildren(...scopes.map((s,i)=>new Option(s.label,String(i))));scopeSelect.value=String(scopeIndex);
  if(!selected||!s.controls.some(c=>c.id===selected))selected=s.controls[0]?.id;
  controls.replaceChildren(...s.controls.map(c=>new Option(c.label+(l.controls[c.id]?.hidden?' · hidden':''),c.id)));controls.value=selected??'';
  const pos=selected?l.controls[selected]:undefined,g=s.controls.find(c=>c.id===selected);
  for(const k of ['u','v','scale','opacity']as const){inputs[k].disabled=!pos;inputs[k].value=String(Math.round((pos?.[k]??0)*100));}
  hidden.disabled=!pos||!!g?.essential;hidden.checked=pos?.hidden??false;hand.value=l.handedness;guardInput.value=String(Math.round(l.centerGuardFraction*100));undo.disabled=!history.canUndo;redo.disabled=!history.canRedo;draw(history.value);
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 const key=(e:KeyboardEvent)=>{if(!dialog.open)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if((e.ctrlKey||e.metaKey)&&!['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)){if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?history.redo():history.undo();render();}if(e.key.toLowerCase()==='y'){e.preventDefault();history.redo();render();}}};
 // Register before the later co-op window listener. Modal interactions cannot toggle gameplay pause/cameras.
 window.addEventListener('keydown',key,true);
 const resize=()=>{if(dialog.open){close();hooks.announce('Viewport changed. Unsaved HUD edits were cancelled; your saved layout is unchanged.');}};
 window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);window.visualViewport?.addEventListener('resize',resize);
 return {open(){if(dialog.open)return;generation++;scopes=hooks.scopes();if(!scopes.length){hooks.announce('Start a ride before customizing its controls.');return;}history=new HudHistory(hooks.archive());scopeIndex=0;selected=undefined;hooks.begin();dialog.showModal();status.textContent='Drag a handle or use the numeric controls. Save applies only a valid layout.';render();cancel.focus();},get isOpen(){return dialog.open;},close:()=>close(),dispose(){close();window.removeEventListener('keydown',key,true);window.removeEventListener('resize',resize);document.removeEventListener('fullscreenchange',resize);window.visualViewport?.removeEventListener('resize',resize);dialog.remove();}};
}
