import {footLabel,type FootPose} from './onFoot.ts';
/** One touch-accessible control, shared wording and keyboard shortcut. */
export class FootControls{
 readonly root=document.createElement('div');readonly mount=document.createElement('button');readonly sprint=document.createElement('button');readonly note=document.createElement('small');
 private pending=false;run=false;private shortcut='KeyJ';
 crouch=false;lean=0;private active=false;private leanKeys=new Set<string>();
 readonly duck=document.createElement('button');readonly left=document.createElement('button');readonly right=document.createElement('button');
 constructor(private options:{tactical?:boolean}={}){
  this.root.className='on-foot-controls';this.root.hidden=true;
  this.root.style.cssText='position:fixed;left:max(12px,env(safe-area-inset-left));top:43%;z-index:65;max-width:170px;display:flex;flex-direction:column;gap:5px;color:white;text-shadow:0 1px 3px black';
  const style=document.createElement('style');style.textContent='.on-foot-controls[hidden]{display:none!important}.on-foot-controls button{min-height:44px;padding:8px 12px;border:1px solid #9dbdb3;border-radius:12px;background:#122d29e8;color:white;font:600 12px system-ui;touch-action:manipulation}.on-foot-controls small{font:11px system-ui;background:#122d29d9;border-radius:6px;padding:5px}';document.head.append(style);
  this.mount.type=this.sprint.type='button';this.mount.title='Get off / get on wheel · J';this.mount.onclick=()=>{this.pending=true;this.mount.blur();};this.sprint.onclick=()=>{this.run=!this.run;this.sprint.setAttribute('aria-pressed',String(this.run));this.sprint.blur();};
  this.root.append(this.mount,this.sprint,this.note);document.body.append(this.root);
  if(options.tactical){
   this.root.style.top='18%';this.root.style.maxHeight='52vh';this.root.style.overflowY='auto';
   for(const button of [this.duck,this.left,this.right])button.type='button';
   this.duck.textContent='Duck / crouch · Z';this.left.textContent='Lean left · Q';this.right.textContent='Lean right · E';
   this.duck.onclick=()=>{this.crouch=!this.crouch;this.duck.blur();};
   this.left.onclick=()=>{this.lean=this.lean===-1?0:-1;this.left.blur();};
   this.right.onclick=()=>{this.lean=this.lean===1?0:1;this.right.blur();};
   this.root.insertBefore(this.duck,this.note);this.root.insertBefore(this.left,this.note);this.root.insertBefore(this.right,this.note);
   addEventListener('keydown',e=>{
    if(!this.active||e.repeat||(e.target as HTMLElement)?.matches('input,textarea,select,button,[contenteditable]'))return;
    if(e.code==='KeyZ'){e.preventDefault();this.crouch=!this.crouch;}
    if(e.code==='KeyQ'||e.code==='KeyE'){e.preventDefault();this.leanKeys.add(e.code);this.lean=Number(this.leanKeys.has('KeyE'))-Number(this.leanKeys.has('KeyQ'));}
   });
   addEventListener('keyup',e=>{if(this.leanKeys.delete(e.code))this.lean=Number(this.leanKeys.has('KeyE'))-Number(this.leanKeys.has('KeyQ'));});
   addEventListener('blur',()=>{this.leanKeys.clear();this.lean=0;});
  }
  addEventListener('keydown',e=>{if(e.code===this.shortcut&&!e.repeat&&!this.root.hidden&&!this.mount.disabled&&!(e.target as HTMLElement)?.matches('input,textarea,select,button,[contenteditable]')){e.preventDefault();this.pending=true;}});
 }
 setShortcut(code:string){this.shortcut=code;this.mount.title='Get off / get on wheel · '+code.replace('Key','');}
 consume(){const p=this.pending;this.pending=false;return p;}
 clear(){this.pending=false;this.run=false;this.crouch=false;this.lean=0;this.leanKeys.clear();this.active=false;this.root.hidden=true;}
 update(p:Partial<FootPose>,visible:boolean,movingDismount=false,critical=false){
  this.active=visible&&p.footMode===2;this.root.hidden=!visible;if(!this.active){this.leanKeys.clear();this.lean=0;}if(!visible){this.pending=false;return;}
  this.mount.textContent=p.footMode&&critical?'Critical health · heal to mount':p.footStagger?'Recovering…':!movingDismount&&!p.footMode&&Math.abs(p.speed??0)>1?'Slow to get off':footLabel(p);this.mount.disabled=(p.footMode===1||p.footMode===3)||(!movingDismount&&!p.footMode&&Math.abs(p.speed??0)>1)||!!p.footStagger||!!p.footMode&&critical;
  this.sprint.hidden=!p.footMode;this.sprint.textContent=this.run?'Run lock · tap to release':'Walk / run · push stick';this.sprint.title='Light stick: walk · full forward: run · Shift: run';this.sprint.setAttribute('aria-pressed',String(this.run));
  this.note.hidden=!p.footMode;this.note.textContent='Steer + move as usual. Jump: Space / hop. Return to your wheel to ride.';
  if(this.options.tactical){
   for(const button of [this.duck,this.left,this.right])button.hidden=!this.active;
   this.duck.setAttribute('aria-pressed',String(this.crouch));this.left.setAttribute('aria-pressed',String(this.lean===-1));this.right.setAttribute('aria-pressed',String(this.lean===1));
   this.note.textContent='Sprint: Shift. Crouch: Z. Lean: hold Q / E or tap. Jump: Space.';
  }
  this.root.dataset.mode=String(p.footMode??0);
 }
}
