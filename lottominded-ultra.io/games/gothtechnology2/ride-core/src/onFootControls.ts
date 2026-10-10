import {footLabel,type FootPose} from './onFoot.ts';
/** One touch-accessible control, shared wording and keyboard shortcut. */
export class FootControls{
 readonly root=document.createElement('div');readonly mount=document.createElement('button');readonly sprint=document.createElement('button');readonly note=document.createElement('small');
 private pending=false;run=false;
 constructor(){
  this.root.className='on-foot-controls';this.root.hidden=true;
  this.root.style.cssText='position:fixed;left:max(12px,env(safe-area-inset-left));top:43%;z-index:65;max-width:170px;display:flex;flex-direction:column;gap:5px;color:white;text-shadow:0 1px 3px black';
  const style=document.createElement('style');style.textContent='.on-foot-controls[hidden]{display:none!important}.on-foot-controls button{min-height:44px;padding:8px 12px;border:1px solid #9dbdb3;border-radius:12px;background:#122d29e8;color:white;font:600 12px system-ui;touch-action:manipulation}.on-foot-controls small{font:11px system-ui;background:#122d29d9;border-radius:6px;padding:5px}';document.head.append(style);
  this.mount.type=this.sprint.type='button';this.mount.title='Get off / get on wheel · J';this.mount.onclick=()=>{this.pending=true;this.mount.blur();};this.sprint.onclick=()=>{this.run=!this.run;this.sprint.setAttribute('aria-pressed',String(this.run));this.sprint.blur();};
  this.root.append(this.mount,this.sprint,this.note);document.body.append(this.root);
  addEventListener('keydown',e=>{if(e.code==='KeyJ'&&!e.repeat&&!this.root.hidden&&!this.mount.disabled&&!(e.target as HTMLElement)?.matches('input,textarea,select,button,[contenteditable]')){e.preventDefault();this.pending=true;}});
 }
 consume(){const p=this.pending;this.pending=false;return p;}
 clear(){this.pending=false;this.run=false;this.root.hidden=true;}
 update(p:Partial<FootPose>,visible:boolean){
  this.root.hidden=!visible;if(!visible){this.pending=false;return;}
  this.mount.textContent=footLabel(p);this.mount.disabled=(p.footMode===1||p.footMode===3)||(!p.footMode&&Math.abs(p.speed??0)>1);
  this.sprint.hidden=!p.footMode;this.sprint.textContent=this.run?'Running · tap to walk':'Walking · tap to run';this.sprint.setAttribute('aria-pressed',String(this.run));
  this.note.hidden=!p.footMode;this.note.textContent='Steer + move as usual. Jump: Space / hop. Return to your wheel to ride.';
  this.root.dataset.mode=String(p.footMode??0);
 }
}
