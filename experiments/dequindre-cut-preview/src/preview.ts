import {previewSnapshot,previewState} from './previewState.ts';
import './preview.css';

Object.defineProperty(window,'__dequindrePreview',{value:Object.freeze({snapshot:previewSnapshot}),configurable:false,writable:false});
const banner=document.createElement('aside');
banner.id='dequindre-preview-banner';banner.dataset.dequindrePreview='draft';
banner.setAttribute('aria-label','Unpublished Dequindre Cut preview');
const tag=document.createElement('strong');tag.textContent='DEQUINDRE CUT · PREVIEW';
const note=document.createElement('span');note.textContent='Not released';
const open=document.createElement('button');open.type='button';open.textContent='Preview places';open.setAttribute('aria-haspopup','dialog');
open.setAttribute('aria-label','Preview places');
banner.append(tag,note,open);
document.body.classList.add('dequindre-preview-surface');
const toolbar=document.querySelector('.ride-header>.quick-tools');
if(toolbar){toolbar.prepend(banner);banner.dataset.anchored='true';}
else document.body.append(banner);
const travelStatus=document.createElement('p');travelStatus.id='dequindre-preview-travel-status';travelStatus.setAttribute('role','status');travelStatus.setAttribute('aria-live','polite');travelStatus.hidden=true;document.body.append(travelStatus);

const dialog=document.createElement('dialog');dialog.id='dequindre-preview-places';
dialog.setAttribute('aria-labelledby','dequindre-preview-title');
const title=document.createElement('h2');title.id='dequindre-preview-title';title.textContent='Explore the complete Cut';
const intro=document.createElement('p');intro.textContent='This separate preview brings the existing Swoop map into the Belle Isle world. The production game is unchanged.';
const stage=document.createElement('p');stage.className='preview-stage';stage.setAttribute('role','status');stage.setAttribute('aria-live','polite');
const places=document.createElement('div');places.className='preview-places';
for(const [id,label,detail]of [
  ['atwater','Atwater entrance','Start at the southern end of the Cut'],
  ['freight','Freight Yard','Explore the market and overpass section'],
  ['mack','Mack Avenue','Explore the northern end and studio district'],
  ['island','Belle Isle','Return to the original island starting path'],
]){
  const button=document.createElement('button');button.type='button';button.dataset.previewStop=id;button.disabled=true;
  const name=document.createElement('strong');name.textContent=label;const description=document.createElement('span');description.textContent=detail;button.append(name,description);
  button.onclick=()=>{
    const native=document.querySelector<HTMLButtonElement>('[data-cut-travel="preview-cut-'+id+'"]');
    if(!native){stage.textContent='The shared game is still preparing its destinations.';return;}
    dialog.close();native.click();document.querySelector<HTMLCanvasElement>('canvas')?.focus();
  };
  places.append(button);
}
const travelNote=document.createElement('p');travelNote.className='preview-note';travelNote.textContent='Travel buttons use the game’s normal travel action and return you to the rider. Riding continuously between areas keeps your active vehicle.';
const actions=document.createElement('div');actions.className='preview-actions';
const download=document.createElement('button');download.type='button';download.textContent='Save preview report';
download.onclick=()=>{
  const blob=new Blob([JSON.stringify(previewSnapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='Dequindre_Cut_Preview_Report.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>dialog.close();actions.append(download,close);
dialog.append(title,intro,stage,places,travelNote,actions);document.body.append(dialog);
open.onclick=()=>dialog.showModal();dialog.addEventListener('close',()=>open.focus());

let lastStage='';
const refresh=()=>{
  const start=document.querySelector<HTMLButtonElement>('#start');
  const usable=previewState.ready&&!previewState.travelPending&&!previewState.error&&!!start&&!start.disabled&&!!document.querySelector('[data-cut-travel="preview-cut-atwater"]');
  for(const button of places.querySelectorAll<HTMLButtonElement>('button'))button.disabled=!usable;
  const message=previewState.error?'Could not prepare this preview: '+previewState.error:usable?'The complete source district is ready to explore.':previewState.stage;
  if(message!==lastStage){stage.textContent=message;lastStage=message;}
  banner.dataset.ready=String(usable);
  travelStatus.hidden=!previewState.travelPending;
  if(previewState.travelPending)travelStatus.textContent='Preparing your destination…';
};
const interval=setInterval(refresh,500);refresh();
window.addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(interval);},{once:true});
