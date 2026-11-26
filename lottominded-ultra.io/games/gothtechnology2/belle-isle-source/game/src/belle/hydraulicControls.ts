import './hydraulicControls.css';
import type {HydraulicSmartPose} from './hydraulicController.ts';

export type HydraulicCorner='FL'|'FR'|'RL'|'RR';
export type HydraulicControlsAction=
 |{kind:'pose';pose:HydraulicSmartPose}
 |{kind:'corner';corner:HydraulicCorner;metres:number}
 |{kind:'hop';mode:'all'|'front'|'rear'}
 |{kind:'settle'};
export type HydraulicControlsState={
 riding:boolean;parked:boolean;active:boolean;inside:boolean;blocked:boolean;
 reduced:boolean;hop:boolean;busy:boolean;cooldown:number;targets:Record<HydraulicCorner,number>;
 current?:Record<HydraulicCorner,number>;minHeight?:number;maxHeight?:number;reason?:string;
};
export type HydraulicControlsResult={accepted:boolean;message?:string};
export type HydraulicControlsHooks={
 state:()=>HydraulicControlsState;
 request:(action:HydraulicControlsAction,event:Event)=>HydraulicControlsResult;
 /** The ride owns braking/input clearing and whether this transition is safe. */
 mode:(enabled:boolean,event?:Event)=>HydraulicControlsResult;
};

const corners:[HydraulicCorner,string][]=[['FL','Front left'],['FR','Front right'],['RL','Rear left'],['RR','Rear right']];
const centimetres=(value:number)=>Math.round(value*100);
const text=(element:HTMLElement,value:string)=>{if(element.textContent!==value)element.textContent=value;};
const hopRecovery='Hop recovering. Wait briefly before hopping again.';

/** A mode-only presentation layer. It never drives the vehicle, changes its
 * camera, persists suspension, or performs a lift outside the supplied hooks. */
export class HydraulicControls{
 private readonly root=document.createElement('aside');
 private readonly entry=document.createElement('section');
 private readonly toggle=document.createElement('button');
 private readonly entryNote=document.createElement('p');
 private readonly outside=document.createElement('div');
 private readonly inside=document.createElement('div');
 private readonly motion=document.createElement('p');
 private readonly feedback=document.createElement('output');
 private readonly advanced=document.createElement('details');
 private readonly poseButtons=new Map<HydraulicSmartPose,HTMLButtonElement>();
 private readonly hopButtons:HTMLButtonElement[]=[];
 private readonly ranges=new Map<HydraulicCorner,{input:HTMLInputElement;output:HTMLOutputElement}>();
 private readonly settle=document.createElement('button');
 private readonly leave=document.createElement('button');
 private readonly cabinLeave=document.createElement('button');
 private signature='';
 private disposed=false;

 constructor(private readonly menu:HTMLDialogElement,private readonly canvas:HTMLCanvasElement,private readonly hooks:HydraulicControlsHooks){
  this.root.id='hydraulic-controls';this.root.hidden=true;this.root.setAttribute('aria-label','Hydraulic mode controls');
  this.root.setAttribute('data-view','outside');this.outside.id='hydraulic-outside-controls';
  const heading=document.createElement('header'),title=document.createElement('h2'),eyebrow=document.createElement('span');
  eyebrow.textContent='HYDRAULIC MODE';title.textContent='Smart Pump';title.id='hydraulic-controls-title';heading.append(eyebrow,title);
  this.motion.id='hydraulic-motion-status';this.motion.setAttribute('role','status');this.motion.setAttribute('aria-live','polite');this.motion.setAttribute('aria-atomic','true');
  const radial=document.createElement('div');radial.className='hydraulic-radial';radial.setAttribute('role','group');radial.setAttribute('aria-label','Smart Pump poses');
  for(const [pose,label,position]of [['front-up','Front up','front'],['back-up','Back up','back'],['pancake','Pancake','pancake']] as const){
   const button=document.createElement('button');button.type='button';button.id='hydraulic-'+pose;button.className='hydraulic-pose hydraulic-'+position;button.textContent=label;
   button.setAttribute('aria-describedby',this.motion.id);button.onclick=event=>this.command({kind:'pose',pose},event,button);
   if(pose==='pancake')button.title='Lower all four corners';else button.title='Lift the '+(pose==='front-up'?'front':'rear')+' axle';
   this.poseButtons.set(pose,button);radial.append(button);
  }
  this.settle.type='button';this.settle.id='hydraulic-settle';this.settle.className='hydraulic-center';this.settle.textContent='Finish & level';
  this.settle.title='Finish the current motion and level the car';this.settle.onclick=event=>this.command({kind:'settle'},event,this.settle);
  this.leave.type='button';this.leave.id='hydraulic-exit';this.leave.className='hydraulic-exit';this.leave.textContent='Exit mode';this.leave.onclick=event=>this.setMode(false,event,this.leave);
  radial.append(this.settle,this.leave);
  const hops=document.createElement('div');hops.className='hydraulic-hops';hops.setAttribute('role','group');hops.setAttribute('aria-label','One-shot hydraulic hops');
  for(const [mode,label]of [['all','Full hop'],['front','Front hop'],['rear','Rear hop']] as const){
   const button=document.createElement('button');button.type='button';button.id='hydraulic-hop-'+mode;button.textContent=label;button.setAttribute('aria-describedby',this.motion.id);button.onclick=event=>this.command({kind:'hop',mode},event,button);
   this.hopButtons.push(button);hops.append(button);
  }
  this.advanced.id='hydraulic-advanced-corners';const summary=document.createElement('summary');summary.textContent='Advanced corners';this.advanced.append(summary);
  const grid=document.createElement('div');grid.className='hydraulic-corner-grid';
  for(const [corner,labelText]of corners){
   const row=document.createElement('div');row.className='hydraulic-corner';
   const line=document.createElement('div'),label=document.createElement('label'),output=document.createElement('output'),input=document.createElement('input');
   line.className='hydraulic-corner-label';input.type='range';input.id='hydraulic-corner-'+corner;input.step='.01';input.setAttribute('aria-label',labelText+' hydraulic height');
   input.setAttribute('aria-describedby',this.motion.id);label.htmlFor=input.id;label.textContent=labelText;
   output.id=input.id+'-value';output.setAttribute('for',input.id);output.setAttribute('aria-live','off');
   const change=(event:Event)=>{
    const metres=Number(input.value),state=this.hooks.state();
    if(Number.isFinite(metres)&&Math.abs(metres-state.targets[corner])<.000001){this.refresh(true);return;}
    this.command({kind:'corner',corner,metres},event,input);
   };
   input.addEventListener('input',change);input.addEventListener('change',change);input.addEventListener('blur',()=>this.refresh(true));
   line.append(label,output);row.append(line,input);grid.append(row);this.ranges.set(corner,{input,output});
  }
  this.advanced.append(grid);
  const note=document.createElement('p');note.className='hydraulic-corner-note';note.textContent='Sliders set each corner’s target height. You can adjust a lift while it moves.';this.advanced.append(note);
  this.outside.append(heading,this.motion,radial,hops,this.advanced);

  this.inside.id='hydraulic-inside-controls';this.inside.hidden=true;
  const cabinHint=document.createElement('p');cabinHint.id='hydraulic-inside-hint';cabinHint.textContent='Hydraulic mode · 7 Front up · 8 Back up · 9 Pancake. Tap switches; drag open space to look. Use third-person for corners. H / Escape exits.';
  this.cabinLeave.type='button';this.cabinLeave.id='hydraulic-inside-exit';this.cabinLeave.textContent='Exit mode';this.cabinLeave.onclick=event=>this.setMode(false,event,this.cabinLeave);
  this.inside.append(cabinHint,this.cabinLeave);
  this.feedback.id='hydraulic-controls-feedback';this.feedback.setAttribute('role','status');this.feedback.setAttribute('aria-live','polite');this.feedback.setAttribute('aria-atomic','true');
  this.root.append(this.outside,this.inside,this.feedback);document.body.append(this.root);

  this.entry.id='hydraulic-mode-entry';this.entry.hidden=true;this.toggle.type='button';this.toggle.id='hydraulic-mode-toggle';this.toggle.setAttribute('aria-controls',this.root.id);
  this.toggle.onclick=event=>this.setMode(!this.hooks.state().active,event,this.toggle);
  this.entryNote.id='hydraulic-mode-note';this.entryNote.setAttribute('role','status');this.entryNote.setAttribute('aria-live','polite');this.toggle.setAttribute('aria-describedby',this.entryNote.id);
  this.entry.append(this.toggle,this.entryNote);
  const modifications=menu.querySelector('#cadillac-modifications-entry'),access=menu.querySelector('#cadillac-controls');
  if(modifications)modifications.after(this.entry);else if(access)access.after(this.entry);else menu.append(this.entry);
  // Keep the game's document-level button handler from stealing focus back to
  // the canvas after a native click on a hydraulic control.
  this.root.addEventListener('click',event=>event.stopPropagation());this.entry.addEventListener('click',event=>event.stopPropagation());
  this.root.addEventListener('keydown',event=>{
   if(this.disposed||event.key!=='Escape'||!this.hooks.state().active)return;
   event.preventDefault();event.stopPropagation();this.setMode(false,event,this.root.contains(document.activeElement)?document.activeElement as HTMLElement:this.leave);
  });
  this.refresh(true);
 }

 private announce(message:string){text(this.feedback,message);}

 /** Share feedback from native cabin switches and the gameplay key handler. */
 showResult(result:HydraulicControlsResult){
  if(this.disposed)return;
  this.refresh(true);this.announce(result.message??(result.accepted?'Hydraulic target updated.':'Hydraulic control is unavailable right now.'));
 }

 private setMode(enabled:boolean,event:Event,control:HTMLElement){
  if(this.disposed)return false;
  const state=this.hooks.state();
  if(!state.riding||(enabled&&!state.parked)){
   const message=!state.riding?'Enter a Cadillac to use hydraulics.':'Stop the Cadillac before entering Hydraulic mode.';
   text(this.entryNote,message);this.announce(message);this.refresh(true);return false;
  }
  // blocked includes the Ride menu itself. Close it before the ride evaluates
  // the transition; a rejection restores that same menu and keyboard focus.
  const menuOpen=this.menu.open;if(menuOpen)this.menu.close();
  const result=this.hooks.mode(enabled,event);
  if(!result.accepted){
   if(menuOpen&&!this.menu.open)this.menu.showModal();
   this.refresh(true);const message=result.message??'Hydraulic mode is unavailable right now.';
   text(this.entryNote,message);this.announce(message);control.focus({preventScroll:true});return false;
  }
  if(enabled)this.advanced.open=false;
  this.announce(result.message??(enabled?'Hydraulic mode on. The car stays parked.':'Hydraulic mode off.'));
  this.refresh(true);
  if(enabled){const next=this.hooks.state().inside?this.cabinLeave:this.poseButtons.get('front-up')!;if(!this.root.hidden)next.focus({preventScroll:true});}
  else this.canvas.focus({preventScroll:true});
  return true;
 }

 private command(action:HydraulicControlsAction,event:Event,control:HTMLElement){
  if(this.disposed)return;
  const state=this.hooks.state();
  const unavailable=!state.riding||!state.active||state.blocked||state.inside;
  const locked=unavailable||!state.parked||(state.hop&&action.kind!=='settle')||(action.kind==='hop'&&(state.busy||state.reduced||state.cooldown>0));
  if(locked){
   this.announce(state.reason??(unavailable?'Use the third-person controls while Hydraulic mode is on.':!state.parked?'Stop the car before adjusting its suspension.':state.reduced&&action.kind==='hop'?'Hops are off with reduced motion.':state.cooldown>0&&!state.hop&&!state.busy&&action.kind==='hop'?hopRecovery:'Let the hop land, or choose Finish & level.'));
   this.refresh(true);return;
  }
  if(action.kind==='corner'&&(!Number.isFinite(action.metres)||action.metres<(state.minHeight??0)||action.metres>(state.maxHeight??.24))){
   this.announce('Choose a height within the slider range.');this.refresh(true);return;
  }
  const result=this.hooks.request(action,event);this.refresh(true);
  this.announce(result.message??(result.accepted?action.kind==='settle'?'Finishing motion and leveling the car.':action.kind==='hop'?'Hop started.':'Height target updated.':'There is not enough clearance for that change.'));
  control.focus({preventScroll:true});
 }

 refresh(force=false){
  if(this.disposed)return;
  const state=this.hooks.state(),signature=JSON.stringify(state);if(!force&&signature===this.signature)return;this.signature=signature;
  const visible=state.riding&&state.active&&!state.blocked;
  document.body.classList.toggle('belle-hydraulic-mode',state.riding&&state.active);
  document.body.classList.toggle('belle-hydraulic-inside',state.riding&&state.active&&state.inside);
  this.root.hidden=!visible;this.entry.hidden=!state.riding;
  this.root.setAttribute('data-view',state.inside?'inside':'outside');this.root.setAttribute('data-motion',state.hop?'hop':state.busy?'moving':'still');
  this.outside.hidden=state.inside;this.inside.hidden=!state.inside;
  text(this.toggle,state.active?'Hydraulic mode · On':'Hydraulic mode');this.toggle.setAttribute('aria-pressed',String(state.active));
  this.toggle.disabled=!state.riding||(!state.active&&!state.parked);
  text(this.entryNote,state.active?'Hydraulic mode keeps the car parked. Exit the mode to drive.':state.parked?'Parked controls for both Cadillac rides.':'Stop the car to enable hydraulics.');
  text(this.motion,state.reason??(!state.parked?'Stop to adjust the suspension.':state.hop?'Hop in progress · Finish & level can settle it.':state.busy?'Adjusting height · you can change the target.':state.reduced?'Parked · reduced motion keeps hops off.':state.cooldown>0?hopRecovery:'Parked · choose a pose or adjust a corner.'));
  const locked=!visible||state.inside||!state.parked;
  for(const button of this.poseButtons.values())button.disabled=locked||state.hop;
  this.settle.disabled=locked;
  for(const button of this.hopButtons){button.disabled=locked||state.hop||state.busy||state.reduced||state.cooldown>0;button.title=state.reduced?'Hops are off with reduced motion.':!locked&&!state.hop&&!state.busy&&state.cooldown>0?hopRecovery:'One hop; wait for landing before repeating.';}
  for(const [corner,{input,output}]of this.ranges){
   input.min=String(state.minHeight??0);input.max=String(state.maxHeight??.24);input.disabled=locked||state.hop;
   if(force||document.activeElement!==input)input.value=String(state.targets[corner]);
   const target=centimetres(Number(input.value)),current=state.current?centimetres(state.current[corner]):target;
   const label=state.busy&&current!==target?current+' → '+target+' cm':target+' cm';
   output.value=label;text(output,label);input.setAttribute('aria-valuetext',target+' cm target'+(current!==target?'; currently '+current+' cm':''));
  }
 }

 dispose(){if(this.disposed)return;this.disposed=true;this.root.remove();this.entry.remove();document.body.classList.remove('belle-hydraulic-mode','belle-hydraulic-inside');}
}
