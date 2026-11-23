import './cadillacControls.css';

export type CadillacControlAction='trunk'|'rear-left'|'rear-right'|'trunk-view';
export type CadillacControlState={
 visible:boolean;parked:boolean;trunk:boolean;rearLeft:boolean;rearRight:boolean;trunkView:boolean;sounds:boolean;
};
type Result={accepted:boolean;reason?:string;message?:string};
type Hooks={
 state:()=>CadillacControlState;
 request:(action:CadillacControlAction,event:Event)=>Result;
 sounds:(enabled:boolean,event:Event)=>void;
};
const shortcuts:Readonly<Record<string,CadillacControlAction>>={KeyT:'trunk',Digit1:'rear-left',Digit2:'rear-right',KeyC:'trunk-view'};
const messages:Readonly<Record<string,string>>={
 moving:'Stop the Cadillac before opening the trunk or doors.',
 blocked:'There is not enough room to open that panel. Park farther from the obstacle.',
 exiting:'Finish leaving the Cadillac before changing its doors.',
 unavailable:'Return to the Cadillac to use these controls.',
};

/** Parked access controls live in the existing scrollable Ride menu. */
export class CadillacControls{
 private readonly root=document.createElement('section');
 private readonly note=document.createElement('p');
 private readonly sound=document.createElement('input');
 private readonly feedback=document.createElement('output');
 private readonly buttons=new Map<CadillacControlAction,HTMLButtonElement>();
 private timer:ReturnType<typeof setTimeout>|undefined;
 private signature='';
 constructor(private readonly menu:HTMLDialogElement,private readonly canvas:HTMLCanvasElement,private readonly hooks:Hooks){
  this.root.id='cadillac-controls';this.root.hidden=true;this.root.setAttribute('aria-labelledby','cadillac-controls-title');
  const heading=document.createElement('h3');heading.id='cadillac-controls-title';heading.textContent='Cadillac · trunk & rear doors';
  const grid=document.createElement('div');grid.className='cadillac-access-buttons';
  for(const action of ['trunk','trunk-view','rear-left','rear-right'] as const){
   const button=document.createElement('button');button.type='button';button.dataset.cadillacAction=action;
   button.onclick=event=>this.command(action,event);this.buttons.set(action,button);grid.append(button);
  }
  const label=document.createElement('label');label.className='cadillac-sound-control';
  this.sound.type='checkbox';this.sound.addEventListener('change',event=>{this.hooks.sounds(this.sound.checked,event);this.refresh();});
  label.append(this.sound,document.createTextNode('Vehicle sounds · opening horn'));
  this.note.className='cadillac-access-note';this.note.textContent='Stop to open or close the doors and trunk. Your radio music plays through the trunk sound system.';
  this.root.append(heading,grid,label,this.note);
  this.menu.querySelector('.menu-controls-note')?.before(this.root);
  if(!this.root.parentElement)this.menu.append(this.root);
  this.feedback.id='cadillac-access-feedback';this.feedback.hidden=true;this.feedback.setAttribute('role','status');this.feedback.setAttribute('aria-live','polite');document.body.append(this.feedback);
 }
 key(event:KeyboardEvent){
  const action=shortcuts[event.code];if(!action||!this.hooks.state().visible)return false;
  event.preventDefault();if(!event.repeat)this.command(action,event);return true;
 }
 command(action:CadillacControlAction,event:Event){
  const menuOpen=this.menu.open;
  // Closing this menu synchronously lets the normal game input guard apply.
  // A rejected request reopens it before the next paint and retains focus.
  if(menuOpen)this.menu.close();
  const result=this.hooks.request(action,event);
  if(!result.accepted){
   if(menuOpen&&!this.menu.open)this.menu.showModal();
   this.announce(result.message??messages[result.reason??'unavailable']??messages.unavailable);
   if(menuOpen)this.buttons.get(action)?.focus();
  }else{
   if(result.message)this.announce(result.message);
   this.canvas.focus({preventScroll:true});
  }
  this.refresh();return result;
 }
 refresh(){
  const state=this.hooks.state(),signature=JSON.stringify(state);if(signature===this.signature)return;this.signature=signature;
  this.root.hidden=!state.visible;
  if(!state.visible){this.feedback.hidden=true;return;}
  this.sound.checked=state.sounds;
  const labels:[CadillacControlAction,string,boolean][]=[
   ['trunk',(state.trunk?'Close':'Open')+' trunk · T',state.trunk],
   ['rear-left',(state.rearLeft?'Close':'Open')+' rear left · 1',state.rearLeft],
   ['rear-right',(state.rearRight?'Close':'Open')+' rear right · 2',state.rearRight],
   ['trunk-view',state.trunkView?'Driving view · C':'Trunk view · C',state.trunkView],
  ];
  for(const [action,label,pressed]of labels){const button=this.buttons.get(action)!;button.textContent=label;button.setAttribute('aria-pressed',String(pressed));button.disabled=!state.parked;}
  this.note.textContent=state.parked?'T opens the trunk, 1 and 2 open the rear doors, and C shows the sound system. Open panels stay open when you drive.':'Brake to a stop to open or close the trunk and rear doors.';
 }
 private announce(message:string){
  if(this.timer)clearTimeout(this.timer);this.feedback.textContent=message;this.feedback.hidden=false;
  this.timer=setTimeout(()=>{this.feedback.hidden=true;},4500);
 }
 dispose(){if(this.timer)clearTimeout(this.timer);this.root.remove();this.feedback.remove();}
}
