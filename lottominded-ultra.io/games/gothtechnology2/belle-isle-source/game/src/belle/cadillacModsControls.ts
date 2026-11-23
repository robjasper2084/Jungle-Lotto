import './cadillacModsControls.css';
import type {CadillacWheelSelection} from './cadillacWheels.ts';
import {writeCadillacModsPreferences} from './cadillacModsPreferences.ts';

export type CadillacModCorner='FL'|'FR'|'RL'|'RR';
export type CadillacModsAction=
 |{kind:'corner';corner:CadillacModCorner;metres:number}
 |{kind:'stance';stance:'low'|'cruise'|'raised'|'level'}
 |{kind:'hop';mode:'all'|'front'|'rear'}
 |{kind:'wheels';selection:CadillacWheelSelection}
 |{kind:'settle'};
export type CadillacModsState={
 riding:boolean;parked:boolean;reduced:boolean;busy:boolean;minHeight:number;maxHeight:number;
 targets:Record<CadillacModCorner,number>;wheels:CadillacWheelSelection;reason?:string;
};
export type CadillacModsResult={accepted:boolean;message?:string};
export type CadillacModsHooks={
 state:()=>CadillacModsState;
 /** Static changes must validate and preview immediately while Settings pauses
  * the driving simulation. Hops and settling close that dialog before dispatch. */
 request:(action:CadillacModsAction,event:Event)=>CadillacModsResult;
};

const corners:[CadillacModCorner,string][]=[['FL','Front left'],['FR','Front right'],['RL','Rear left'],['RR','Rear right']];
const wheelsEqual=(a:CadillacWheelSelection,b:CadillacWheelSelection)=>a.rim===b.rim&&a.tire===b.tire&&a.center===b.center;
const heightText=(metres:number)=>`${Math.round(metres*100)} cm`;

/** One editor is shared by both Cadillac variants. The ride-menu launcher is a
 * sibling of the access panel because the hydraulic variant has no rear doors. */
export class CadillacModsControls{
 private readonly root=document.createElement('details');
 private readonly summary=document.createElement('summary');
 private readonly entry=document.createElement('section');
 private readonly launch=document.createElement('button');
 private readonly note=document.createElement('p');
 private readonly feedback=document.createElement('output');
 private readonly ranges=new Map<CadillacModCorner,{input:HTMLInputElement;output:HTMLOutputElement}>();
 private readonly selects=new Map<keyof CadillacWheelSelection,HTMLSelectElement>();
 private readonly stanceButtons:HTMLButtonElement[]=[];
 private readonly hopButtons:HTMLButtonElement[]=[];
 private readonly settle=document.createElement('button');
 private signature='';
 private disposed=false;

 constructor(private readonly settings:HTMLDialogElement,private readonly menu:HTMLDialogElement,private readonly canvas:HTMLCanvasElement,private readonly hooks:CadillacModsHooks){
  this.root.id='cadillac-modifications';this.root.hidden=true;
  this.summary.textContent='Cadillac modifications';this.summary.id='cadillac-modifications-title';
  this.root.setAttribute('aria-labelledby',this.summary.id);
  this.note.id='cadillac-modifications-note';this.note.className='cadillac-mods-note';
  this.feedback.id='cadillac-modifications-feedback';this.feedback.setAttribute('role','status');this.feedback.setAttribute('aria-live','polite');
  const content=document.createElement('div');content.className='cadillac-mods-content';
  content.append(this.note,this.makeWheels(),this.makeSuspension(),this.feedback);this.root.append(this.summary,content);
  const settingsHeading=settings.querySelector('h2');if(settingsHeading)settingsHeading.after(this.root);else settings.append(this.root);

  this.entry.id='cadillac-modifications-entry';this.entry.hidden=true;
  this.launch.type='button';this.launch.textContent='Hydraulics, wheels & tires';this.launch.setAttribute('aria-controls',this.root.id);
  this.launch.onclick=()=>this.open();this.entry.append(this.launch);
  const access=menu.querySelector('#cadillac-controls');if(access)access.after(this.entry);else menu.append(this.entry);
  this.refresh(true);
 }

 private makeWheels(){
  const field=document.createElement('fieldset');field.className='cadillac-mods-wheels';
  const legend=document.createElement('legend');legend.textContent='Wheels & tires';field.append(legend);
  const options:{key:keyof CadillacWheelSelection;label:string;values:[string,string][]}[]=[
   {key:'rim',label:'Rim style',values:[['stock','Original Cadillac'],['wire-gold','Gold wire · chrome lip'],['wire-chrome','Polished chrome wire']]},
   {key:'tire',label:'Tire profile',values:[['standard','Standard sidewall'],['whitewall','Whitewall'],['low-profile','Low-profile blackwall'],['low-profile-whitewall','Low-profile whitewall']]},
   {key:'center',label:'Center cap',values:[['gold','Polished gold'],['black','Black & gold'],['white','White & gold']]},
  ];
  for(const {key,label,values}of options){
   const row=document.createElement('label');row.textContent=label;
   const select=document.createElement('select');select.id='cadillac-mod-'+key;select.setAttribute('aria-label',label);select.setAttribute('aria-describedby',this.note.id);
   for(const [value,text]of values){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
   select.addEventListener('change',event=>{
    const state=this.hooks.state(),selection={...state.wheels,[key]:select.value} as CadillacWheelSelection;
    if(wheelsEqual(selection,state.wheels))return;
    this.command({kind:'wheels',selection},event,select);
   });
   this.selects.set(key,select);row.append(select);field.append(row);
  }
  const hint=document.createElement('p');hint.className='cadillac-mods-note';hint.textContent='Center caps are available with wire rims. Wheel and tire changes appear immediately.';field.append(hint);
  return field;
 }

 private makeSuspension(){
  const field=document.createElement('fieldset');field.className='cadillac-mods-suspension';
  const legend=document.createElement('legend');legend.textContent='Hydraulic suspension';field.append(legend);
  const grid=document.createElement('div');grid.className='cadillac-mods-corners';
  for(const [corner,title]of corners){
   const row=document.createElement('div');row.className='cadillac-mods-corner';
   const label=document.createElement('label'),output=document.createElement('output'),input=document.createElement('input');
   input.type='range';input.id='cadillac-height-'+corner;input.step='.01';input.setAttribute('aria-label',title+' suspension height');input.setAttribute('aria-describedby',this.note.id);
   label.htmlFor=input.id;label.textContent=title;output.setAttribute('for',input.id);output.id=input.id+'-value';
   const header=document.createElement('div');header.className='cadillac-mods-corner-title';header.append(label,output);row.append(header,input);grid.append(row);
   const change=(event:Event)=>{
    const metres=Number(input.value),state=this.hooks.state();
    if(Number.isFinite(metres)&&Math.abs(metres-state.targets[corner])<.000001){this.refresh(true);return;}
    this.command({kind:'corner',corner,metres},event,input);
   };
   input.addEventListener('input',change);input.addEventListener('change',change);input.addEventListener('blur',()=>this.refresh(true));
   this.ranges.set(corner,{input,output});
  }
  const presets=document.createElement('div');presets.className='cadillac-mods-actions';
  for(const [stance,title]of [['low','Lower'],['cruise','Stock height'],['raised','Raise'],['level','Level corners']] as const){
   const button=document.createElement('button');button.type='button';button.textContent=title;button.onclick=event=>this.command({kind:'stance',stance},event,button);this.stanceButtons.push(button);presets.append(button);
  }
  const hops=document.createElement('div');hops.className='cadillac-mods-actions';
  for(const [mode,title]of [['all','Full-car hop'],['front','Front hop'],['rear','Rear hop']] as const){
   const button=document.createElement('button');button.type='button';button.textContent=title;button.onclick=event=>this.command({kind:'hop',mode},event,button);this.hopButtons.push(button);hops.append(button);
  }
  this.settle.type='button';this.settle.textContent='Finish motion & level';this.settle.onclick=event=>this.command({kind:'settle'},event,this.settle);hops.append(this.settle);
  const hint=document.createElement('p');hint.className='cadillac-mods-note';hint.textContent='Height is measured from the stock stance. Keep space around the car clear. Hops play once after this menu closes; reduced motion turns hopping off. Finish motion & level closes this menu, completes any hop, and levels the car at the average selected height.';
  field.append(grid,presets,hops,hint);return field;
 }

 open(){
  if(this.disposed||!this.hooks.state().riding)return false;
  if(this.menu.open)this.menu.close();
  this.root.open=true;this.refresh(true);
  if(!this.settings.open)this.settings.showModal();
  this.summary.focus({preventScroll:true});this.root.scrollIntoView({block:'nearest',behavior:'auto'});return true;
 }

 private command(action:CadillacModsAction,event:Event,control:HTMLElement){
  if(this.disposed)return;
  const state=this.hooks.state();
  const blocked=!state.riding||!state.parked||(state.busy&&action.kind!=='settle')||(state.reduced&&action.kind==='hop');
  if(blocked){this.feedback.textContent=state.reason??(!state.riding?'Enter the Cadillac to customize it.':!state.parked?'Stop the Cadillac before changing its setup.':state.reduced&&action.kind==='hop'?'Hopping is off while reduced motion is enabled.':'Let the suspension settle, or use Finish motion & level.');this.refresh(true);return;}
  if(action.kind==='corner'&&(!Number.isFinite(action.metres)||action.metres<state.minHeight||action.metres>state.maxHeight)){
   this.feedback.textContent='Choose a height within the slider range.';this.refresh(true);return;
  }
  const closeForMotion=(action.kind==='hop'||action.kind==='settle')&&this.settings.open;
  if(closeForMotion)this.settings.close();
  const result=this.hooks.request(action,event);
  if(!result.accepted){
   if(closeForMotion&&!this.settings.open)this.settings.showModal();
   this.feedback.textContent=result.message??'There is not enough clearance for that change. Move to a clear, level area.';
   this.refresh(true);control.focus({preventScroll:true});return;
  }
  if(action.kind==='wheels')writeCadillacModsPreferences(this.hooks.state().wheels);
  this.feedback.textContent=result.message??(action.kind==='wheels'?'Wheel and tire selection applied.':action.kind==='hop'?'Hop started.':action.kind==='settle'?'Finishing suspension motion and leveling at the average selected height.':'Suspension height applied.');
  this.refresh(true);if(closeForMotion)this.canvas.focus({preventScroll:true});
 }

 refresh(force=false){
  if(this.disposed)return;
  const state=this.hooks.state(),signature=JSON.stringify(state);
  if(!force&&signature===this.signature)return;this.signature=signature;
  this.root.hidden=this.entry.hidden=!state.riding;
  this.launch.disabled=!state.riding;
  const locked=!state.riding||!state.parked,editing=locked||state.busy;
  this.note.textContent=state.reason??(!state.parked?'Stop the Cadillac before changing its setup.':state.busy?'Close Settings to let the suspension finish, or choose Finish motion & level.':'Change the height and wheel style while parked. Suspension starts at stock height for each new ride.');
  for(const [corner,{input,output}]of this.ranges){
   input.min=String(state.minHeight);input.max=String(state.maxHeight);input.disabled=editing;
   if(force||document.activeElement!==input)input.value=String(state.targets[corner]);
   output.value=heightText(Number(input.value));output.textContent=output.value;input.setAttribute('aria-valuetext',output.value);
  }
  for(const [key,select]of this.selects){select.value=state.wheels[key];select.disabled=editing||(key==='center'&&state.wheels.rim==='stock');}
  for(const button of this.stanceButtons)button.disabled=editing;
  for(const button of this.hopButtons){button.disabled=editing||state.reduced;button.title=state.reduced?'Hopping is off while reduced motion is enabled.':'';}
  this.settle.disabled=locked;
 }

 dispose(){if(this.disposed)return;this.disposed=true;this.root.remove();this.entry.remove();}
}
