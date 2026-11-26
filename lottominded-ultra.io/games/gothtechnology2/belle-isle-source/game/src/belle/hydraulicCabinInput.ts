import type {HydraulicSmartPose} from './hydraulicController.ts';

type Hooks={
 enabled:()=>boolean;
 pick:(clientX:number,clientY:number)=>HydraulicSmartPose|null;
 request:(pose:HydraulicSmartPose,event:PointerEvent)=>{accepted:boolean};
};
type Tap={id:number;x:number;y:number;pose:HydraulicSmartPose};

/** A real, stationary pointer tap owns a switch gesture. Camera drags, secondary
 * pointers, cancelled captures and a view/mode change never become commands. */
export class HydraulicCabinInput{
 private tap:Tap|null=null;
 private disposed=false;
 private readonly down=(event:PointerEvent)=>{
  if(this.disposed)return;
  if(this.tap){this.cancel();return;}
  if(!event.isTrusted||event.button!==0||event.isPrimary===false||!this.hooks.enabled())return;
  const pose=this.hooks.pick(event.clientX,event.clientY);if(!pose)return;
  this.tap={id:event.pointerId,x:event.clientX,y:event.clientY,pose};
  // Capture before the ordinary camera-look listener, only after an actual hit.
  event.preventDefault();event.stopImmediatePropagation();
  try{this.canvas.setPointerCapture(event.pointerId);}catch{this.tap=null;}
 };
 private readonly move=(event:PointerEvent)=>{
  const tap=this.tap;if(!tap||tap.id!==event.pointerId)return;
  if(!this.hooks.enabled()||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>8)this.cancel();
 };
 private readonly up=(event:PointerEvent)=>{
  const tap=this.tap;if(!tap||tap.id!==event.pointerId)return;
  event.preventDefault();event.stopImmediatePropagation();this.cancel();
  // Use spatial intent and current eligibility, not a wall-clock deadline:
  // renderer stalls or a deliberate stationary hold must not lose a click.
  if(!event.isTrusted||!this.hooks.enabled()||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>8)return;
  if(this.hooks.pick(event.clientX,event.clientY)!==tap.pose)return;
  this.hooks.request(tap.pose,event);
 };
 private readonly lost=(event:PointerEvent)=>{if(this.tap?.id===event.pointerId)this.cancel();};
 private readonly interrupt=()=>this.cancel();
 private readonly visibility=()=>{if(document.hidden)this.cancel();};

 constructor(private readonly canvas:HTMLCanvasElement,private readonly hooks:Hooks){
  canvas.addEventListener('pointerdown',this.down,true);
  canvas.addEventListener('pointermove',this.move,true);
  canvas.addEventListener('pointerup',this.up,true);
  canvas.addEventListener('pointercancel',this.lost,true);
  canvas.addEventListener('lostpointercapture',this.lost,true);
  if(typeof window!=='undefined'){window.addEventListener('blur',this.interrupt);window.addEventListener('pagehide',this.interrupt);}
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.visibility);
 }
 cancel(){
  const tap=this.tap;this.tap=null;
  if(tap)try{if(this.canvas.hasPointerCapture(tap.id))this.canvas.releasePointerCapture(tap.id);}catch{/* A removed canvas has no capture. */}
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.cancel();
  this.canvas.removeEventListener('pointerdown',this.down,true);
  this.canvas.removeEventListener('pointermove',this.move,true);
  this.canvas.removeEventListener('pointerup',this.up,true);
  this.canvas.removeEventListener('pointercancel',this.lost,true);
  this.canvas.removeEventListener('lostpointercapture',this.lost,true);
  if(typeof window!=='undefined'){window.removeEventListener('blur',this.interrupt);window.removeEventListener('pagehide',this.interrupt);}
  if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.visibility);
 }
}
